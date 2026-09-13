import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../services/api';
import { loadPreferences } from '../services/preferences';
import {
  StatusBadge,
  PriorityBadge,
} from '../components/StatusBadge';
import type { Ticket, TicketStatus } from '../types';

function getNextAction(status: TicketStatus) {
  switch (status) {
    case 'Open':
      return {
        label: 'Start working',
        target: 'In Progress' as TicketStatus,
        helper:
          'Start the case when you are ready to investigate it.',
      };

    case 'In Progress':
      return {
        label: 'Mark resolved',
        target: 'Closed' as TicketStatus,
        helper:
          'Close only after the customer-impacting issue has been resolved.',
      };

    case 'Closed':
    default:
      return {
        label: 'Re-open ticket',
        target: 'Open' as TicketStatus,
        helper:
          'Re-open when the issue needs more work or the customer returns.',
      };
  }
}

export default function TicketDetail() {
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState<Ticket | undefined>();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const prefs = loadPreferences();

  useEffect(() => {
    let active = true;

    async function loadTicket() {
      if (!ticketId) {
        setTicket(undefined);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const loaded = await api.getTicket(ticketId);

        if (active) {
          setTicket(loaded);
        }
      } catch (err) {
        if (active) {
          setTicket(undefined);
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the ticket.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTicket();

    return () => {
      active = false;
    };
  }, [ticketId]);

  async function refreshTicket() {
    if (!ticket || saving) return;

    setSaving(true);
    setError('');

    try {
      const updated = await api.getTicket(ticket.ticket_id);
      setTicket(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not refresh the ticket.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function refreshAI() {
    if (!ticket || saving) return;

    setSaving(true);
    setError('');

    try {
      await api.analyzeTicket(ticket.ticket_id);

      const updated = await api.getTicket(ticket.ticket_id);
      setTicket(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not analyze this ticket.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!ticket || saving || ticket.status === status) return;

    if (status === 'Closed') {
      const confirmed = window.confirm(
        'Mark this ticket as resolved?\n\nMake sure the customer-impacting issue has been addressed before closing it.'
      );

      if (!confirmed) return;
    }

    setSaving(true);
    setError('');

    try {
      const updated = await api.updateTicket(
        ticket.ticket_id,
        { status }
      );

      setTicket(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update the ticket.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    const text = note.trim();

    if (!ticket || !text || saving) return;

    setSaving(true);
    setError('');

    try {
      const updated = await api.updateTicket(
        ticket.ticket_id,
        {
          status: ticket.status,
          notes: text,
        }
      );

      setTicket(updated);
      setNote('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save the note.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyReply() {
    const reply = ticket?.ai_insights?.suggested_reply;

    if (!reply) return;

    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      setError(
        'The reply could not be copied on this device.'
      );
    }
  }

  const timelineItems = useMemo(() => {
    return [...(ticket?.timeline ?? [])]
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      )
      .slice(-12);
  }, [ticket?.timeline]);

  if (loading) {
    return (
      <div className="empty ticket-page-state">
        Loading ticket…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="empty ticket-page-state">
        <Link to="/tickets" className="back-link">
          <ArrowLeft size={16} />
          Back to tickets
        </Link>

        <p>
          {error || 'Ticket not found.'}
        </p>
      </div>
    );
  }

  const ai = ticket.ai_insights;
  const nextAction = getNextAction(ticket.status);

  return (
    <div className="stack ticket-detail-page">
      <Link
        to="/tickets"
        className="back-link"
      >
        <ArrowLeft size={16} />
        Back to tickets
      </Link>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="detail-grid">
        {/* =====================================================
            MAIN COLUMN
        ===================================================== */}
        <div className="stack">
          {/* CASE HEADER */}
          <section className="section-card case-header-card">
            <div className="detail-header">
              <div className="case-title-block">
                <div className="ticket-id">
                  {ticket.ticket_id}
                </div>

                <h2>{ticket.subject}</h2>

                <p className="muted">
                  {ticket.customer_name}
                  {' · '}
                  {ticket.customer_email}
                </p>
              </div>

              <StatusBadge status={ticket.status} />
            </div>

            <div className="description">
              {ticket.description}
            </div>

            {/* ONE PRIMARY ACTION */}
            <div className="next-action-strip">
              <div className="next-action-copy">
                <span className="eyebrow">
                  NEXT ACTION
                </span>

                <strong>
                  {nextAction.helper}
                </strong>
              </div>

              <button
                className="primary-btn next-action-btn"
                onClick={() =>
                  void changeStatus(
                    nextAction.target
                  )
                }
                disabled={saving}
              >
                {saving
                  ? 'Saving…'
                  : nextAction.label}
              </button>
            </div>
          </section>

          {/* ===================================================
              AI DECISION BRIEF
          =================================================== */}
          <section className="section-card decision-brief">
            <div className="section-head">
              <div>
                <div className="pill light-pill">
                  <Sparkles size={13} />
                  AI decision brief
                </div>

                <h3>
                  Understand → decide → act
                </h3>

                <p>
                  A concise interpretation of the case,
                  with the reasoning and next action kept
                  visible.
                </p>
              </div>

              <button
                className="secondary-btn"
                onClick={() => void refreshAI()}
                disabled={saving}
              >
                <Sparkles size={15} />

                {saving
                  ? 'Thinking…'
                  : ai
                    ? 'Refresh analysis'
                    : 'Analyze issue'}
              </button>
            </div>

            {ai ? (
              <div className="ticket-ai-content">
                {/* TOP DECISION SIGNALS */}
                <div className="ai-priority-row">
                  <div className="attention-panel">
                    <span>ATTENTION</span>

                    <strong>
                      {ai.urgency_score}/100
                    </strong>

                    <small>
                      {ai.urgency_score >= 76
                        ? 'High attention'
                        : ai.urgency_score >= 56
                          ? 'Needs attention'
                          : 'Routine attention'}
                    </small>
                  </div>

                  <div className="ai-signal-list">
                    <div className="ai-signal-item">
                      <span>Issue</span>
                      <strong>{ai.category}</strong>
                    </div>

                    <div className="ai-signal-item">
                      <span>Priority</span>
                      <PriorityBadge
                        priority={ai.priority}
                      />
                    </div>

                    <div className="ai-signal-item">
                      <span>Customer mood</span>
                      <strong>{ai.sentiment}</strong>
                    </div>

                    <div className="ai-signal-item">
                      <span>AI confidence</span>
                      <strong>
                        {ai.confidence}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 01 */}
                <div className="decision-section">
                  <span className="decision-kicker">
                    01 · WHAT IS HAPPENING?
                  </span>

                  <p className="decision-large">
                    {ai.summary}
                  </p>
                </div>

                {/* 02 + 03 */}
                <div className="decision-two-col">
                  <div className="decision-section subdued">
                    <span className="decision-kicker">
                      02 · WHY IT MATTERS
                    </span>

                    <p>
                      {ai.customer_impact}
                    </p>
                  </div>

                  <div className="decision-section action-highlight">
                    <span className="decision-kicker">
                      03 · WHAT TO DO
                    </span>

                    <strong>
                      {ai.suggested_action}
                    </strong>
                  </div>
                </div>

                {/* RESOLUTION */}
                {ai.resolution_plan?.length ? (
                  <div className="resolution-plan">
                    <div className="plan-title">
                      <ListChecks size={16} />
                      Resolution path
                    </div>

                    {ai.resolution_plan.map(
                      (step, index) => (
                        <div
                          className="plan-step"
                          key={`${step}-${index}`}
                        >
                          <strong>
                            {index + 1}
                          </strong>

                          <span>{step}</span>
                        </div>
                      )
                    )}
                  </div>
                ) : null}

                {/* EVIDENCE + RISK */}
                <div className="decision-two-col">
                  <div className="decision-section">
                    <span className="decision-kicker">
                      04 · EVIDENCE
                    </span>

                    <div className="evidence-list">
                      {ai.data_signals?.length ? (
                        ai.data_signals.map(
                          (item) => (
                            <div
                              className="evidence-line"
                              key={item}
                            >
                              <Check size={14} />
                              <span>{item}</span>
                            </div>
                          )
                        )
                      ) : (
                        <div className="muted">
                          No additional evidence
                          recorded.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="decision-section">
                    <span className="decision-kicker">
                      05 · RISKS
                    </span>

                    <div className="evidence-list">
                      {ai.risk_factors?.length ? (
                        ai.risk_factors.map(
                          (item) => (
                            <div
                              className="evidence-line risk"
                              key={item}
                            >
                              <CircleAlert
                                size={14}
                              />
                              <span>{item}</span>
                            </div>
                          )
                        )
                      ) : (
                        <div className="muted">
                          No major risk signals
                          recorded.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* EXPLANATION */}
                {prefs.showAIExplanations && (
                  <div className="decision-section explanation-block">
                    <span className="decision-kicker">
                      WHY THIS RECOMMENDATION?
                    </span>

                    <p>{ai.explanation}</p>
                  </div>
                )}

                {/* CUSTOMER REPLY */}
                {ai.suggested_reply && (
                  <div className="reply-box ai-wide">
                    <div>
                      <span>Draft customer reply</span>

                      <p>
                        {ai.suggested_reply}
                      </p>
                    </div>

                    <button
                      className="icon-btn"
                      title="Copy suggested reply"
                      aria-label="Copy suggested customer reply"
                      onClick={() => void copyReply()}
                    >
                      {copied ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                )}

                {/* HUMAN CONTROL */}
                <div className="human-control">
                  <ShieldCheck size={16} />

                  <span>
                    <strong>
                      Human decision required.
                    </strong>{' '}
                    AI suggestions are advisory.
                    Verify the facts and choose
                    the final action.
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty decision-empty">
                <Sparkles size={20} />

                <p>
                  No decision brief yet. Analyze the
                  issue to turn the customer message
                  into a clear next-step plan.
                </p>
              </div>
            )}
          </section>

          {/* ===================================================
              INTERNAL NOTES
          =================================================== */}
          <section className="section-card">
            <div className="section-head">
              <div>
                <h3>Internal notes</h3>

                <p>
                  Record checks and decisions so the
                  next person can continue without
                  guessing.
                </p>
              </div>
            </div>

            <div className="note-composer">
              <textarea
                rows={3}
                value={note}
                onChange={(event) =>
                  setNote(event.target.value)
                }
                placeholder="Example: Payment gateway confirmed success; checking order creation log…"
                disabled={saving}
              />

              <button
                className="primary-btn"
                onClick={() => void addNote()}
                disabled={
                  !note.trim() || saving
                }
              >
                {saving
                  ? 'Saving…'
                  : 'Add Note'}
              </button>
            </div>

            {(ticket.notes ?? []).map(
              (item) => (
                <div
                  className="note"
                  key={item.id}
                >
                  <div>
                    {item.note_text}
                  </div>

                  <span>
                    {new Date(
                      item.created_at
                    ).toLocaleString()}
                  </span>
                </div>
              )
            )}
          </section>
        </div>

        {/* =====================================================
            SIDE COLUMN
        ===================================================== */}
        <aside className="stack">
          {/* CUSTOMER */}
          <section className="section-card">
            <div className="section-head compact-head">
              <div>
                <div className="eyebrow">
                  CUSTOMER
                </div>

                <h3>
                  Customer context
                </h3>
              </div>
            </div>

            <div className="customer-card">
              <strong>
                {ticket.customer_name}
              </strong>

              <span>
                {ticket.customer_email}
              </span>
            </div>

            <div className="divider" />

            <div className="meta-line">
              <span>Current outcome</span>

              <strong>
                {ticket.status}
              </strong>
            </div>

            <Link
              to="/customers"
              className="context-link"
            >
              View customer history →
            </Link>
          </section>

          {/* TIMELINE */}
          <section className="section-card">
            <div className="section-head compact-head">
              <div>
                <div className="eyebrow">
                  HISTORY
                </div>

                <h3>What happened</h3>
              </div>

              <button
                className="icon-btn"
                title="Refresh ticket"
                aria-label="Refresh ticket"
                onClick={() =>
                  void refreshTicket()
                }
                disabled={saving}
              >
                <RefreshCw size={15} />
              </button>
            </div>

            <p className="muted">
              Every important action stays
              traceable.
            </p>

            {timelineItems.length ? (
              <div className="timeline">
                {timelineItems.map(
                  (event) => (
                    <div
                      className="timeline-item"
                      key={event.id}
                    >
                      <div className="timeline-dot" />

                      <div>
                        <strong>
                          {event.message}
                        </strong>

                        <span>
                          {new Date(
                            event.created_at
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="empty">
                No activity recorded yet.
              </div>
            )}
          </section>

          {/* INTEGRITY */}
          <section className="section-card">
            <div className="section-head compact-head">
              <div>
                <div className="eyebrow">
                  INTEGRITY
                </div>

                <h3>Trust signals</h3>
              </div>
            </div>

            <div className="integrity">
              <div>
                <Check size={15} />
                Server-generated ticket ID
              </div>

              <div>
                <Check size={15} />
                Server timestamp tracked
              </div>

              <div>
                <Check size={15} />
                Status changes logged
              </div>

              <div>
                <Check size={15} />
                AI evidence remains visible
              </div>

              <div>
                <Check size={15} />
                Human approval preserved
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}