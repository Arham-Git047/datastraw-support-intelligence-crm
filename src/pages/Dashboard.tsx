import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { derivePortfolioInsights } from '../services/ai';
import type { Ticket } from '../types';

export default function Dashboard() {
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
              : 'Could not load the workspace.',
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
    [tickets],
  );

  const open = tickets.filter(
    (ticket) => ticket.status === 'Open',
  ).length;

  const progress = tickets.filter(
    (ticket) => ticket.status === 'In Progress',
  ).length;

  const closed = tickets.filter(
    (ticket) => ticket.status === 'Closed',
  ).length;

  const attention = insights.highRisk
    .filter((ticket) => ticket.status !== 'Closed')
    .slice(0, 4);

  const analyzedTickets = tickets.filter(
    (ticket) => ticket.ai_insights,
  );

  const topCategory = Object.entries(
    insights.categoryCounts,
  )
    .filter(([name, count]) => name !== 'Unanalysed' && count > 0)
    .sort((a, b) => b[1] - a[1])[0];

  const analyzedCount = analyzedTickets.length;

  if (loading) {
    return (
      <div className="empty">
        Reading the support workspace…
      </div>
    );
  }

  return (
    <div className="stack dashboard-page">
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <section className="hero dashboard-hero">
        <div>
          <div className="pill">
            <Sparkles size={13} />
            Beginner-friendly workspace
          </div>

          <h2>
            Know what needs attention — without
            learning a CRM.
          </h2>

          <p>
            The workspace turns ticket activity into
            a clear work plan: what matters, why it
            matters, and what to do next.
          </p>
        </div>

        <Link
          to="/tickets/new"
          className="secondary-btn"
        >
          Create a ticket
          <ArrowRight size={16} />
        </Link>
      </section>

      <div className="metric-grid">
        <Link to="/tickets?status=Open" className="metric-card metric-card-link">
          <span>Open tickets</span>
          <strong>{open}</strong>
          <CircleDot size={20} />
          <small>New or waiting for action</small>
        </Link>

        <Link
          to="/tickets?status=In%20Progress"
          className="metric-card metric-card-link"
        >
          <span>In progress</span>
          <strong>{progress}</strong>
          <Clock3 size={20} />
          <small>Currently being worked on</small>
        </Link>

        <Link
          to="/tickets?status=Closed"
          className="metric-card metric-card-link"
        >
          <span>Closed</span>
          <strong>{closed}</strong>
          <CheckCircle2 size={20} />
          <small>Resolved cases</small>
        </Link>

        <Link
          to="/analytics"
          className="metric-card metric-card-link"
        >
          <span>Needs attention</span>
          <strong>{attention.length}</strong>
          <AlertTriangle size={20} />
          <small>High-risk active tickets</small>
        </Link>
      </div>

      <div className="dashboard-grid">
        <section className="section-card decision-panel">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                TODAY'S DECISION
              </div>

              <h3>
                What should happen next?
              </h3>
            </div>

            <Lightbulb size={20} />
          </div>

          <div className="decision-copy">
            {insights.action}
          </div>

          <div className="decision-support">
            <div>
              <TrendingUp size={16} />
              <span>
                <strong>
                  {topCategory?.[0] ?? 'No pattern yet'}
                </strong>{' '}
                is the leading analyzed issue
              </span>
            </div>

            <div>
              <Sparkles size={16} />
              <span>
                <strong>
                  {insights.active.length}
                </strong>{' '}
                active cases are in the queue
              </span>
            </div>

            <div>
              <CheckCircle2 size={16} />
              <span>
                <strong>{analyzedCount}</strong>{' '}
                tickets have decision support
              </span>
            </div>
          </div>

          <Link
            className="insight-link"
            to="/analytics"
          >
            Open decision intelligence
            <ArrowRight size={15} />
          </Link>
        </section>

        <section className="section-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                NEEDS ATTENTION
              </div>

              <h3>
                Cases to look at first
              </h3>

              <p>
                Ranked by unresolved customer impact.
              </p>
            </div>
          </div>

          {attention.length === 0 ? (
            <div className="empty">
              No high-risk active tickets right now.
            </div>
          ) : (
            <div className="ticket-list">
              {attention.map((ticket) => (
                <Link
                  className="ticket-row"
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
                      {ticket.customer_name}
                    </div>
                  </div>

                  <div className="ticket-meta">
                    <PriorityBadge
                      priority={
                        ticket.ai_insights?.priority ??
                        'Medium'
                      }
                    />

                    <StatusBadge
                      status={ticket.status}
                    />

                    <span className="urgency">
                      {ticket.ai_insights?.urgency_score ?? 0}
                      /100
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
