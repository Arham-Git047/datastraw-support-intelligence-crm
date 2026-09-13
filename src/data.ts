import { Ticket } from './types';

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

export const seedTickets: Ticket[] = [
  {
    id: '1', ticket_id: 'TKT-024', customer_name: 'Rahul Sharma', customer_email: 'rahul@example.com',
    subject: 'Payment deducted but order not created',
    description: 'The payment was completed successfully, but I did not receive an order confirmation and the order is missing from my account.',
    status: 'Open', created_at: iso(220), updated_at: iso(28), notes: [],
    timeline: [
      { id: 'e1', ticket_id: 'TKT-024', event_type: 'created', message: 'Ticket created', created_at: iso(220) },
      { id: 'e2', ticket_id: 'TKT-024', event_type: 'ai_analyzed', message: 'AI analysis completed', created_at: iso(217) },
    ],
    ai_insights: {
      category: 'Payment', priority: 'High', sentiment: 'Frustrated', urgency_score: 88, confidence: 94,
      summary: 'Customer reports a successful payment without a corresponding order or confirmation.',
      suggested_action: 'Verify the payment transaction and reconcile the order creation status.',
      suggested_reply: 'Hi Rahul, we have received your request regarding the payment deduction. We are checking the transaction and order status and will update you shortly.',
      similar_ticket_ids: ['TKT-019', 'TKT-021'], resolution_plan: ['Verify the payment transaction.', 'Confirm whether an order was created.', 'Reconcile or refund based on the transaction outcome.'], customer_impact: 'High customer impact: payment appears successful while the expected order is unavailable.', risk_factors: ['Potential financial impact', 'Unresolved order/payment mismatch'], data_signals: ['Payment terms detected', 'Customer reports missing order confirmation'],
      explanation: 'High priority because money appears to have been deducted while the expected order is unavailable.', generated_at: iso(217),
    },
  },
  {
    id: '2', ticket_id: 'TKT-023', customer_name: 'Priya Mehta', customer_email: 'priya@example.com',
    subject: 'Refund still not received',
    description: 'My return was approved last week, but the refund is still not showing in my bank account.',
    status: 'In Progress', created_at: iso(420), updated_at: iso(55),
    notes: [{ id: 'n1', ticket_id: 'TKT-023', note_text: 'Refund approval confirmed. Checking settlement status.', created_at: iso(60) }],
    timeline: [
      { id: 'e3', ticket_id: 'TKT-023', event_type: 'created', message: 'Ticket created', created_at: iso(420) },
      { id: 'e4', ticket_id: 'TKT-023', event_type: 'status_changed', message: 'Status changed → In Progress', created_at: iso(60) },
      { id: 'e5', ticket_id: 'TKT-023', event_type: 'note_added', message: 'Agent added a note', created_at: iso(60) },
    ],
    ai_insights: {
      category: 'Refund', priority: 'Medium', sentiment: 'Frustrated', urgency_score: 67, confidence: 89,
      summary: 'Customer is waiting for an approved refund that has not yet appeared in their bank account.',
      suggested_action: 'Verify refund settlement and expected bank processing time.',
      suggested_reply: 'Hi Priya, your refund has been approved. We are verifying the settlement status and will keep you updated on the expected credit date.',
      similar_ticket_ids: [], resolution_plan: ['Confirm refund approval.', 'Check settlement status.', 'Give the customer a specific expected credit timeline.'], customer_impact: 'Moderate customer impact: the refund is expected but delayed.', risk_factors: ['Refund delay may increase customer frustration'], data_signals: ['Refund and bank processing language detected'], explanation: 'Medium priority due to an approved refund that is delayed but not reported as a duplicate charge.', generated_at: iso(417),
    },
  },
  {
    id: '3', ticket_id: 'TKT-022', customer_name: 'Aman Verma', customer_email: 'aman@example.com',
    subject: 'Delivery delayed by two days',
    description: 'The tracking page has not changed for two days and the package has not arrived.',
    status: 'Closed', created_at: iso(620), updated_at: iso(190), notes: [],
    timeline: [
      { id: 'e6', ticket_id: 'TKT-022', event_type: 'created', message: 'Ticket created', created_at: iso(620) },
      { id: 'e7', ticket_id: 'TKT-022', event_type: 'status_changed', message: 'Status changed → Closed', created_at: iso(190) },
    ],
    ai_insights: {
      category: 'Delivery', priority: 'Low', sentiment: 'Neutral', urgency_score: 34, confidence: 84,
      summary: 'Customer reported a delivery delay and lack of tracking movement.',
      suggested_action: 'Confirm the latest carrier scan and delivery estimate.',
      suggested_reply: 'Hi Aman, we are sorry for the delay. We have checked the shipment status and are confirming the latest delivery update.',
      similar_ticket_ids: [], resolution_plan: ['Check the latest carrier scan.', 'Compare the scan with the promised delivery date.', 'Escalate if the shipment remains stalled.'], customer_impact: 'Moderate customer impact based on a delayed shipment.', risk_factors: ['Shipment may be stalled'], data_signals: ['Tracking and delivery terms detected'], explanation: 'Low urgency because the issue concerns a delayed shipment without evidence of payment loss or account access problems.', generated_at: iso(618),
    },
  },
];
