import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { storage } from '../services/storage';
import { api } from '../services/api';
import { loadPreferences } from '../services/preferences';
import type { TicketDraft } from '../types';

const emptyDraft: TicketDraft = {
  customer_name: '',
  customer_email: '',
  subject: '',
  description: '',
};

export default function NewTicket() {
  const navigate = useNavigate();

  // Local storage is used ONLY for unfinished drafts.
  const [form, setForm] = useState<TicketDraft>(
    () => storage.getDraft() ?? emptyDraft
  );

  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const [lastSaved, setLastSaved] = useState(() =>
    Boolean(storage.getDraft())
  );

  const [showRestore, setShowRestore] = useState(() =>
    Boolean(storage.getDraft())
  );

  const [error, setError] = useState('');

  const prefs = loadPreferences();

  const valid = Boolean(
    form.customer_name.trim() &&
      form.customer_email.trim() &&
      form.subject.trim() &&
      form.description.trim()
  );

  // ---------------------------------------------------------
  // DRAFT AUTOSAVE
  // ---------------------------------------------------------
  useEffect(() => {
    if (created) return;

    const hasDraft = Object.values(form).some(
      (value) => value.trim().length > 0
    );

    if (hasDraft) {
      storage.saveDraft(form);
      setLastSaved(true);
    } else {
      storage.clearDraft();
      setLastSaved(false);
    }

    const timer = window.setTimeout(() => {
      setLastSaved(false);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [form, created]);

  const preview = useMemo(
    () => ({
      customer: form.customer_name || 'Customer name',
      issue: form.subject || 'Your issue title will appear here',
      description:
        form.description ||
        'Add enough context for the support team to understand what happened.',
    }),
    [form]
  );

  // ---------------------------------------------------------
  // CREATE TICKET
  // IMPORTANT:
  // Submitted ticket -> REAL API -> SUPABASE
  // Draft -> LOCAL STORAGE
  // ---------------------------------------------------------
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!valid || saving) return;

    setSaving(true);
    setError('');

    try {
      // 1. Create the real ticket in PostgreSQL through Express.
      const ticket = await api.createTicket({
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        subject: form.subject.trim(),
        description: form.description.trim(),
      });

      /*
       * At this point the ticket already exists in Supabase.
       *
       * This is important:
       * Even if AI fails below, the ticket must NEVER be lost.
       */

      if (prefs.autoAnalyze) {
        try {
          // 2. Ask the backend to generate/persist the decision brief.
          await api.analyzeTicket(ticket.ticket_id);
        } catch (analysisError) {
          /*
           * AI failure is non-blocking.
           * The ticket has already been committed to PostgreSQL.
           */
          console.warn(
            'Ticket created successfully, but AI analysis could not be completed.',
            analysisError
          );
        }
      }

      // 3. Only clear the local draft AFTER the API ticket exists.
      storage.clearDraft();

      // 4. Show the success state.
      setCreated(ticket.ticket_id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create the ticket. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof TicketDraft>(
    key: K,
    value: string
  ) {
    setShowRestore(false);

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  // ---------------------------------------------------------
  // SUCCESS STATE
  // ---------------------------------------------------------
  if (created) {
    return (
      <div className="form-page">
        <div className="success-card">
          <CheckCircle2 size={46} />

          <div className="eyebrow success-eyebrow">
            TICKET READY
          </div>

          <h2>Ticket created successfully</h2>

          <p>
            Your request is now in the support queue as{' '}
            <strong>{created}</strong>.
          </p>

          <div className="success-next">
            <div>
              <Sparkles size={18} />

              <div>
                <strong>Next best step</strong>

                <span>
                  Open the ticket and review the recommended resolution
                  path before taking action.
                </span>
              </div>
            </div>
          </div>

          <div className="integrity-note">
            <ShieldCheck size={16} />

            <span>
              AI is advisory. The support person keeps the final decision.
            </span>
          </div>

          <div className="actions">
            <button
              className="secondary-btn"
              onClick={() =>
                navigate(`/tickets/${created}`)
              }
            >
              View Ticket
            </button>

            <button
              className="primary-btn"
              onClick={() => {
                setCreated(null);
                setForm(emptyDraft);
                storage.clearDraft();
                setShowRestore(false);
              }}
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // CREATION FORM
  // ---------------------------------------------------------
  return (
    <div className="form-page wide-form">
      <Link to="/tickets" className="back-link">
        <ArrowLeft size={16} />
        Back to tickets
      </Link>

      {showRestore && (
        <div className="draft-banner">
          <div>
            <Save size={16} />

            <span>
              <strong>Draft restored.</strong>{' '}
              Your unfinished ticket was saved automatically on this
              device.
            </span>
          </div>

          <button
            className="text-btn"
            onClick={() => {
              setForm(emptyDraft);
              storage.clearDraft();
              setShowRestore(false);
            }}
          >
            Discard draft
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="creation-layout">
        <section className="section-card form-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">NEW REQUEST</div>

              <h2>Create a support ticket</h2>

              <p>
                Explain the customer's problem in plain language.
                You do not need to understand CRM terminology.
              </p>
            </div>

            <div className="save-state">
              {lastSaved ? (
                <>
                  <Save size={14} />
                  Draft saved
                </>
              ) : (
                'Auto-save enabled'
              )}
            </div>
          </div>

          <form
            onSubmit={submit}
            className="form-grid"
          >
            <label>
              Customer name

              <input
                value={form.customer_name}
                onChange={(event) =>
                  update(
                    'customer_name',
                    event.target.value
                  )
                }
                placeholder="e.g. Rahul Sharma"
                autoComplete="name"
                required
              />
            </label>

            <label>
              Customer email

              <input
                type="email"
                value={form.customer_email}
                onChange={(event) =>
                  update(
                    'customer_email',
                    event.target.value
                  )
                }
                placeholder="e.g. rahul@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="full">
              What is the issue?

              <input
                value={form.subject}
                onChange={(event) =>
                  update(
                    'subject',
                    event.target.value
                  )
                }
                placeholder="e.g. Payment deducted but order not created"
                required
              />
            </label>

            <label className="full">
              What happened?

              <textarea
                rows={9}
                value={form.description}
                onChange={(event) =>
                  update(
                    'description',
                    event.target.value
                  )
                }
                placeholder="Describe what the customer experienced, what they expected, and anything that may help resolve the issue..."
                required
              />
            </label>

            <div className="form-hint full">
              <Sparkles size={15} />

              <span>
                {prefs.autoAnalyze
                  ? 'After creation, the intelligence layer will interpret the case, assess impact and risk, and prepare a recommended next action.'
                  : 'Automatic intelligence is disabled. You can run assistance from the ticket later.'}
              </span>
            </div>

            <div className="integrity-note full">
              <ShieldCheck size={16} />

              <span>
                AI recommendations remain reviewable. Important
                decisions stay with the support person.
              </span>
            </div>

            <div className="form-footer full">
              <span className="muted">
                Ticket ID and timestamp are generated by the
                server. Your unfinished form is protected if you
                refresh the page.
              </span>

              <button
                type="submit"
                className="primary-btn"
                disabled={!valid || saving}
              >
                {saving
                  ? prefs.autoAnalyze
                    ? 'Creating & preparing insights...'
                    : 'Creating ticket...'
                  : 'Create Ticket'}
              </button>
            </div>
          </form>
        </section>

        <aside className="section-card live-preview">
          <div className="eyebrow">
            LIVE PREVIEW
          </div>

          <h3>
            How the support team will understand this case
          </h3>

          <div className="preview-card">
            <div className="ticket-id">
              NEW TICKET
            </div>

            <h4>{preview.issue}</h4>

            <div className="ticket-customer">
              {preview.customer} ·{' '}
              {form.customer_email ||
                'customer@email.com'}
            </div>

            <div className="divider" />

            <p>{preview.description}</p>

            <div className="preview-ai">
              <Sparkles size={16} />

              <div>
                <strong>Decision brief</strong>

                <span>
                  The system will identify the issue,
                  customer impact, urgency, risks and
                  safest next action.
                </span>
              </div>
            </div>
          </div>

          <div className="plain-language">
            <strong>Good support note</strong>

            <span>
              Write what happened, not what you think
              the solution is. This gives the system
              better evidence.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}