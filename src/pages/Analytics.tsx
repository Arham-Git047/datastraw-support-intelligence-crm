import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Lightbulb,
  MessageCircleWarning,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import { derivePortfolioInsights } from '../services/ai';
import {
  PriorityBadge,
  StatusBadge,
} from '../components/StatusBadge';
import type { Ticket } from '../types';

export default function Analytics() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const rows = await api.listTickets();

        if (active) {
          setTickets(rows);
        }
      } catch (err) {
        if (active) {
          setTickets([]);

          setError(
            err instanceof Error
              ? err.message
              : 'Could not load intelligence.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const insights = useMemo(
    () => derivePortfolioInsights(tickets),
    [tickets]
  );

  const analyzedTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) => ticket.ai_insights
      ),
    [tickets]
  );

  const analyzed = analyzedTickets.length;

  const avgUrgency = analyzed
    ? Math.round(
        analyzedTickets.reduce(
          (sum, ticket) =>
            sum +
            (ticket.ai_insights
              ?.urgency_score ?? 0),
          0
        ) / analyzed
      )
    : 0;

  const frustrated = tickets.filter(
    (ticket) =>
      ['Frustrated', 'Angry'].includes(
        ticket.ai_insights?.sentiment ?? ''
      )
  ).length;

  /*
   * Only analysed categories are used for the
   * "leading issue" insight.
   *
   * This prevents "Unanalysed" from appearing
   * as the leading issue when the actual pattern
   * is Payment / Refund / Delivery etc.
   */
  const categoryRows = Object.entries(
    insights.categoryCounts
  )
    .filter(
      ([name, count]) =>
        name !== 'Unanalysed' && count > 0
    )
    .sort(
      (a, b) => b[1] - a[1]
    );

  const topCategory =
    categoryRows[0]?.[0] ?? '—';

  const topCategoryCount =
    categoryRows[0]?.[1] ?? 0;

  const highRiskCase =
    insights.highRisk[0];

  const reviewQueue =
    insights.recommendedQueue.slice(0, 4);

  const processHeadline =
    insights.emerging.includes(
      'is recurring'
    )
      ? insights.emerging
      : insights.processOpportunity;

  if (loading) {
    return (
      <div className="empty">
        Reading the support queue…
      </div>
    );
  }

  return (
    <div className="stack intelligence-page">
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* =====================================================
          HERO
      ===================================================== */}
      <section className="hero intelligence-hero-simple">
        <div>
          <div className="pill">
            <BrainCircuit size={14} />
            Decision intelligence
          </div>

          <h2>
            Turn support activity into
            decisions.
          </h2>

          <p>
            The system reads the queue, finds
            patterns, explains customer impact,
            prioritizes attention and turns the
            evidence into a practical next step.
          </p>
        </div>

        <div className="hero-signal">
          <Sparkles size={18} />

          <span>
            {analyzed} of {tickets.length}{' '}
            tickets analyzed
          </span>
        </div>
      </section>

      {/* =====================================================
          01 → 05 DECISION JOURNEY
      ===================================================== */}
      <section
        className="intelligence-decision-flow"
        aria-label="Decision intelligence journey"
      >
        <div className="intelligence-flow-item">
          <div className="intelligence-flow-step">
            <div className="intelligence-step-number">
              01
            </div>

            <div className="intelligence-step-content">
              <div className="intelligence-step-label">
                READ
              </div>

              <h4>
                What are customers reporting?
              </h4>

              <p>
                Understand the issue before
                deciding what to do.
              </p>
            </div>
          </div>

          <ArrowRight
            className="intelligence-flow-arrow"
            aria-hidden="true"
          />
        </div>

        <div className="intelligence-flow-item">
          <div className="intelligence-flow-step">
            <div className="intelligence-step-number">
              02
            </div>

            <div className="intelligence-step-content">
              <div className="intelligence-step-label">
                FIND
              </div>

              <h4>
                What needs attention?
              </h4>

              <p>
                Find urgency, risk and
                repeated problems.
              </p>
            </div>
          </div>

          <ArrowRight
            className="intelligence-flow-arrow"
            aria-hidden="true"
          />
        </div>

        <div className="intelligence-flow-item">
          <div className="intelligence-flow-step">
            <div className="intelligence-step-number">
              03
            </div>

            <div className="intelligence-step-content">
              <div className="intelligence-step-label">
                UNDERSTAND
              </div>

              <h4>
                Why does it matter?
              </h4>

              <p>
                Translate signals into
                customer impact.
              </p>
            </div>
          </div>

          <ArrowRight
            className="intelligence-flow-arrow"
            aria-hidden="true"
          />
        </div>

        <div className="intelligence-flow-item">
          <div className="intelligence-flow-step">
            <div className="intelligence-step-number">
              04
            </div>

            <div className="intelligence-step-content">
              <div className="intelligence-step-label">
                ACT
              </div>

              <h4>
                What should happen next?
              </h4>

              <p>
                Recommend the safest
                useful action.
              </p>
            </div>
          </div>

          <ArrowRight
            className="intelligence-flow-arrow"
            aria-hidden="true"
          />
        </div>

        <div className="intelligence-flow-item last">
          <div className="intelligence-flow-step">
            <div className="intelligence-step-number">
              05
            </div>

            <div className="intelligence-step-content">
              <div className="intelligence-step-label">
                LEARN
              </div>

              <h4>
                What can improve?
              </h4>

              <p>
                Turn repeated cases into
                operational insight.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          KEY SIGNALS
      ===================================================== */}
      <div className="metric-grid">
        <div className="metric-card">
          <span>Active workload</span>

          <strong>
            {insights.active.length}
          </strong>

          <Clock3 size={20} />

          <small>
            Tickets still needing action
          </small>
        </div>

        <div className="metric-card">
          <span>High-risk cases</span>

          <strong>
            {insights.highRisk.length}
          </strong>

          <AlertTriangle size={20} />

          <small>
            Attention score 76+
          </small>
        </div>

        <div className="metric-card">
          <span>Average attention</span>

          <strong>
            {avgUrgency}/100
          </strong>

          <TrendingUp size={20} />

          <small>
            Across analyzed tickets
          </small>
        </div>

        <div className="metric-card">
          <span>Customer frustration</span>

          <strong>
            {frustrated}
          </strong>

          <MessageCircleWarning size={20} />

          <small>
            Frustrated or angry signals
          </small>
        </div>
      </div>

      {/* =====================================================
          DECISION CENTER
      ===================================================== */}
      <section className="section-card decision-center">
        <div className="decision-center-head">
          <div>
            <div className="eyebrow">
              DECISION
            </div>

            <h3>
              What should the team do now?
            </h3>

            <p>
              One practical conclusion, backed
              by the current queue.
            </p>
          </div>

          <Lightbulb size={21} />
        </div>

        <div className="decision-center-body">
          <div className="decision-conclusion">
            <div className="decision-kicker">
              RECOMMENDATION
            </div>

            <strong>
              {insights.action}
            </strong>

            <span>
              Based on unresolved impact signals,
              issue patterns and the intelligence
              attached to current cases.
            </span>

            {highRiskCase && (
              <Link
                className="insight-link"
                to={`/tickets/${highRiskCase.ticket_id}`}
              >
                Open highest-risk case
                <ArrowUpRight size={15} />
              </Link>
            )}
          </div>

          <div className="mini-metrics">
            <div>
              <span>Top issue</span>
              <strong>
                {topCategory}
              </strong>
            </div>

            <div>
              <span>Issue count</span>
              <strong>
                {topCategoryCount}
              </strong>
            </div>

            <div>
              <span>Analyzed</span>
              <strong>
                {analyzed}/{tickets.length}
              </strong>
            </div>

            <div>
              <span>Attention avg.</span>
              <strong>
                {avgUrgency}/100
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          PATTERN + CUSTOMER SIGNAL
      ===================================================== */}
      <div className="two-col">
        <section className="section-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                PATTERN
              </div>

              <h3>
                What are customers asking
                about?
              </h3>

              <p>
                Issue distribution across
                analyzed cases.
              </p>
            </div>
          </div>

          <div className="bar-list">
            {categoryRows.length ? (
              categoryRows.map(
                ([name, count]) => (
                  <div
                    className="bar-row"
                    key={name}
                  >
                    <div>
                      <span>{name}</span>
                      <strong>{count}</strong>
                    </div>

                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${Math.max(
                            8,
                            (count /
                              Math.max(
                                1,
                                analyzed
                              )) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              )
            ) : (
              <div className="empty">
                Analyze a few tickets to reveal
                issue patterns.
              </div>
            )}
          </div>
        </section>

        <section className="section-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                CUSTOMER SIGNAL
              </div>

              <h3>
                How are customers feeling?
              </h3>

              <p>
                Emotion is context, not the
                final decision.
              </p>
            </div>
          </div>

          <div className="signal-stack">
            {Object.entries(
              insights.sentimentCounts
            ).map(([name, count]) => (
              <div
                className="signal-row"
                key={name}
              >
                <span>{name}</span>

                <strong>{count}</strong>

                <span className="signal-copy">
                  {name === 'Frustrated' ||
                  name === 'Angry'
                    ? 'Be specific about the next step and timing.'
                    : 'No strong negative signal detected.'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* =====================================================
          LEARN
      ===================================================== */}
      <section className="section-card intelligence-learning-card">
        <div className="decision-center-head">
          <div>
            <div className="eyebrow">
              LEARN
            </div>

            <h3>
              What can improve?
            </h3>

            <p>
              Convert repeated support demand
              into a process-level insight.
            </p>
          </div>

          <TrendingUp size={21} />
        </div>

        <div className="learning-insight">
          <div className="learning-main">
            <strong>
              {processHeadline ||
                'No recurring process opportunity has been identified yet.'}
            </strong>

            <span>
              This conclusion is derived from
              analyzed issue categories, customer
              signals and unresolved cases.
            </span>
          </div>

          <div className="learning-facts">
            <div>
              <span>Leading issue</span>

              <strong>
                {topCategory}
              </strong>
            </div>

            <div>
              <span>Cases represented</span>

              <strong>
                {topCategoryCount}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          REVIEW QUEUE
      ===================================================== */}
      <section className="section-card decision-queue">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              CASES TO REVIEW
            </div>

            <h3>
              What deserves a closer look?
            </h3>

            <p>
              Ranked using issue context,
              attention score and unresolved
              impact.
            </p>
          </div>

          <CheckCircle2 size={20} />
        </div>

        {reviewQueue.length ? (
          <div className="ticket-list">
            {reviewQueue.map((ticket) => (
              <Link
                className="ticket-row decision-row"
                to={`/tickets/${ticket.ticket_id}`}
                key={ticket.ticket_id}
              >
                <div className="ticket-main">
                  <div className="ticket-id">
                    {ticket.ticket_id}
                  </div>

                  <div className="ticket-title">
                    {ticket.subject}
                  </div>

                  <div className="ticket-customer">
                    {ticket.ai_insights?.summary}
                  </div>

                  <div className="decision-reason">
                    <Lightbulb size={13} />

                    {ticket.ai_insights
                      ?.suggested_action}
                  </div>
                </div>

                <div className="ticket-meta">
                  <PriorityBadge
                    priority={
                      ticket.ai_insights
                        ?.priority ?? 'Medium'
                    }
                  />

                  <StatusBadge
                    status={ticket.status}
                  />

                  <span className="urgency">
                    {ticket.ai_insights
                      ?.urgency_score ?? 0}
                    /100
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            No active case currently needs
            elevated attention.
          </div>
        )}
      </section>
    </div>
  );
}