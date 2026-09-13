import type { Ticket, AIInsights, TicketPriority } from '../types';

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));
const scoreFromWords = (text: string, words: string[], points: number) =>
  words.reduce((score, word) => score + (text.includes(word) ? points : 0), 0);

function detectCategory(text: string) {
  if (hasAny(text, ['payment', 'paid', 'charge', 'transaction', 'charged', 'deducted'])) return 'Payment';
  if (hasAny(text, ['refund', 'return', 'money back', 'reimbursement'])) return 'Refund';
  if (hasAny(text, ['delivery', 'deliver', 'shipment', 'tracking', 'courier', 'package'])) return 'Delivery';
  if (hasAny(text, ['login', 'password', 'account', 'blocked', 'sign in', 'otp'])) return 'Account';
  if (hasAny(text, ['product', 'damaged', 'broken', 'defective', 'wrong item'])) return 'Product';
  if (hasAny(text, ['invoice', 'gst', 'billing'])) return 'Billing';
  return 'General';
}

function actionFor(category: string, priority: TicketPriority) {
  const prefix =
    priority === 'Critical'
      ? 'Start immediately. '
      : priority === 'High'
        ? 'Handle before routine tickets. '
        : '';

  const actions: Record<string, string> = {
    Payment: 'Verify the transaction, confirm order creation, then reconcile or refund based on the outcome.',
    Refund: 'Confirm approval and settlement, then give the customer a specific credit timeline.',
    Delivery: 'Check the latest carrier scan, compare it with the promised date, and escalate if stalled.',
    Account: 'Verify account state and recent access attempts, then use the safest recovery path.',
    Product: 'Confirm the product and order context, then determine replacement, return or troubleshooting.',
    Billing: 'Validate the billing record and invoice details, then correct any mismatch before replying.',
    General: 'Identify the operational dependency, choose one concrete next action, and record the outcome.',
  };

  return prefix + actions[category];
}

function similarityTokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
}

function findSimilarTickets(ticket: Ticket, allTickets: Ticket[]) {
  const current = similarityTokens(`${ticket.subject} ${ticket.description}`);
  if (!current.size) return [];

  return allTickets
    .filter((candidate) => candidate.ticket_id !== ticket.ticket_id)
    .map((candidate) => {
      const other = similarityTokens(`${candidate.subject} ${candidate.description}`);
      const shared = [...current].filter((token) => other.has(token)).length;
      return { id: candidate.ticket_id, shared };
    })
    .filter((item) => item.shared >= 2)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 3)
    .map((item) => item.id);
}

export async function analyzeTicket(ticket: Ticket, allTickets: Ticket[] = []): Promise<AIInsights> {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
  const category = detectCategory(text);
  const financialRisk = scoreFromWords(text, ['payment', 'deducted', 'charge', 'refund', 'money'], 16);
  const accessRisk = scoreFromWords(text, ['hacked', 'unauthorized', 'password', 'blocked', 'login'], 18);
  const urgencyLanguage = scoreFromWords(text, ['urgent', 'asap', 'immediately', 'still waiting', 'again', 'missing', 'not working'], 10);
  const negative = scoreFromWords(text, ['angry', 'frustrated', 'upset', 'terrible', 'unacceptable', 'still', 'missing'], 9);
  const critical =
    financialRisk + accessRisk >= 48 ||
    hasAny(text, ['fraud', 'unauthorized transaction', 'account hacked', 'security breach']);
  const urgency_score = Math.min(99, Math.max(24, 35 + financialRisk + accessRisk + urgencyLanguage + negative));
  const priority: TicketPriority = critical ? 'Critical' : urgency_score >= 76 ? 'High' : urgency_score >= 56 ? 'Medium' : 'Low';
  const sentiment =
    accessRisk > 20 || negative >= 25
      ? 'Angry'
      : negative >= 9
        ? 'Frustrated'
        : hasAny(text, ['thank you', 'thanks'])
          ? 'Positive'
          : 'Neutral';

  const riskFactors: string[] = [];
  const dataSignals: string[] = [];
  if (financialRisk) {
    riskFactors.push('Potential financial impact');
    dataSignals.push('Payment or money-related language was detected');
  }
  if (accessRisk) {
    riskFactors.push('Potential account-access risk');
    dataSignals.push('Account or authentication language was detected');
  }
  if (urgencyLanguage) {
    riskFactors.push('Customer indicates an unresolved or urgent impact');
    dataSignals.push('Urgency language appears in the customer message');
  }
  if (!riskFactors.length) riskFactors.push('No immediate high-impact risk detected');
  if (!dataSignals.length) dataSignals.push('Decision based on issue topic and customer wording');

  const similar_ticket_ids = findSimilarTickets(ticket, allTickets);
  if (similar_ticket_ids.length) {
    riskFactors.push(`${similar_ticket_ids.length} similar case${similar_ticket_ids.length > 1 ? 's' : ''} found`);
    dataSignals.push(`Similar wording found in ${similar_ticket_ids.join(', ')}`);
  }

  const resolution = [
    `Confirm the core issue: ${ticket.subject.toLowerCase()}.`,
    actionFor(category, priority),
    priority !== 'Low'
      ? 'Record the verification result before closing the case.'
      : 'Record the outcome and close the case once the customer-impacting issue is resolved.',
  ];

  const summary =
    category === 'Payment'
      ? `The customer appears to have completed a payment but does not have the expected order outcome. The main dependency is reconciling payment status with order creation.`
      : category === 'Refund'
        ? `The customer is waiting for a refund outcome. The key dependency is confirming settlement and communicating a realistic credit timeline.`
        : category === 'Delivery'
          ? `The customer is reporting a delivery or tracking problem. The key dependency is the latest carrier status compared with the promised date.`
          : `The customer needs help with a ${category.toLowerCase()} issue. The immediate task is to identify the operational dependency and resolve that step first.`;

  const customerImpact = critical
    ? 'High impact: the case may involve money, account access or security and should be handled immediately.'
    : priority === 'High'
      ? 'Meaningful impact: the issue appears unresolved and may be blocking the expected customer outcome.'
      : priority === 'Medium'
        ? 'Moderate impact: the customer needs a concrete update and a clear path to resolution.'
        : 'Lower immediate impact based on the information currently available.';

  const confidence = Math.min(97, 70 + (category !== 'General' ? 9 : 0) + Math.min(12, riskFactors.length * 4));
  const explanationParts = [
    `Issue type: ${category}.`,
    `Priority is ${priority.toLowerCase()} because the case scored ${urgency_score}/100 for urgency and impact signals.`,
    `Customer tone is ${sentiment.toLowerCase()}.`,
  ];
  if (similar_ticket_ids.length) {
    explanationParts.push(`The wording also resembles ${similar_ticket_ids.join(', ')}, which may indicate a repeat issue.`);
  }

  return {
    category,
    priority,
    sentiment,
    urgency_score,
    confidence,
    summary,
    suggested_action: actionFor(category, priority),
    suggested_reply: `Hi ${ticket.customer_name}, we have received your request regarding ${ticket.subject.toLowerCase()}. We are checking the relevant details and will update you with the next step shortly.`,
    resolution_plan: resolution,
    customer_impact: customerImpact,
    risk_factors: riskFactors,
    data_signals: dataSignals,
    similar_ticket_ids,
    explanation: explanationParts.join(' '),
    generated_at: new Date().toISOString(),
  };
}

export function derivePortfolioInsights(tickets: Ticket[]) {
  const analyzed = tickets.filter((ticket) => ticket.ai_insights);
  const active = tickets.filter((ticket) => ticket.status !== 'Closed');
  const highRisk = active
    .filter((ticket) => (ticket.ai_insights?.urgency_score ?? 0) >= 76)
    .sort((a, b) => (b.ai_insights?.urgency_score ?? 0) - (a.ai_insights?.urgency_score ?? 0));

  const categoryCounts = tickets.reduce<Record<string, number>>((acc, ticket) => {
    const key = ticket.ai_insights?.category ?? 'Unanalysed';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const sentimentCounts = tickets.reduce<Record<string, number>>((acc, ticket) => {
    const key = ticket.ai_insights?.sentiment ?? 'Unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const topSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0];

  const repeated = Object.entries(categoryCounts).find(([, count]) => count >= 2);
  const frustratedCount = (sentimentCounts.Frustrated ?? 0) + (sentimentCounts.Angry ?? 0);
  const recommendedQueue = [...highRisk, ...active.filter((ticket) => !highRisk.some((risk) => risk.ticket_id === ticket.ticket_id) && ticket.ai_insights)]
    .sort((a, b) => {
      const aScore = (a.ai_insights?.urgency_score ?? 0) + (a.status === 'Open' ? 8 : 0);
      const bScore = (b.ai_insights?.urgency_score ?? 0) + (b.status === 'Open' ? 8 : 0);
      return bScore - aScore;
    })
    .slice(0, 5);

  const emerging = repeated
    ? `${repeated[0]} is recurring (${repeated[1]} cases). Look for the process step creating repeat demand.`
    : topCategory
      ? `${topCategory[0]} is the largest issue group (${topCategory[1]} case${topCategory[1] > 1 ? 's' : ''}).` 
      : 'Add a few cases to reveal an operational pattern.';

  const action = highRisk.length
    ? `Start with ${highRisk[0].ticket_id}: it has the strongest unresolved impact signal (${highRisk[0].ai_insights?.urgency_score ?? 0}/100).`
    : active.length
      ? `Work the ${active.length} active case${active.length > 1 ? 's' : ''} in order of customer impact, starting with the clearest next action.`
      : 'The queue is clear. New tickets will appear here with decision guidance.';

  const processOpportunity = repeated
    ? `The ${repeated[0].toLowerCase()} pattern is a candidate for a repeatable fix, clearer guidance or an automation.`
    : topCategory
      ? `The ${topCategory[0].toLowerCase()} queue is the best place to look for a repeatable process improvement.`
      : 'No repeated pattern is strong enough yet to recommend a process change.';

  const processEvidence = repeated
    ? `${repeated[1]} tickets share the same high-level issue category. ${frustratedCount ? `${frustratedCount} customer${frustratedCount > 1 ? 's' : ''} also show frustration or anger.` : 'Customer tone is not showing a strong negative pattern.'}`
    : `${analyzed.length} of ${tickets.length} tickets have been analysed. More cases will improve the pattern signal.`;

  return {
    active,
    highRisk,
    recommendedQueue,
    analyzed,
    categoryCounts,
    sentimentCounts,
    topCategory,
    topSentiment,
    recentlyCreated: [...tickets].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5),
    emerging,
    action,
    frustratedCount,
    processOpportunity,
    processEvidence,
  };
}
