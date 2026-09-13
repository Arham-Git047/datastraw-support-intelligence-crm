import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { storage } from '../services/storage';
import type { Ticket, TicketStatus } from '../types';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';

const tabs: Array<'All' | TicketStatus> = ['All', 'Open', 'In Progress', 'Closed'];

function matchesSearch(ticket: Ticket, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    ticket.ticket_id,
    ticket.customer_name,
    ticket.customer_email,
    ticket.subject,
    ticket.description,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

export default function Tickets() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | TicketStatus>('All');
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTickets() {
    setLoading(true);
    setError('');

    try {
      // Fetch the full queue once. Tabs/search then work instantly on the
      // client while PostgreSQL remains the source of truth behind the API.
      const rows = await storage.list();
      setAllTickets(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();

    const refresh = () => {
      void loadTickets();
    };

    window.addEventListener('tickets-changed', refresh);
    return () => window.removeEventListener('tickets-changed', refresh);
  }, []);

  const counts = useMemo(() => {
    const grouped: Record<'All' | TicketStatus, number> = {
      All: allTickets.length,
      Open: 0,
      'In Progress': 0,
      Closed: 0,
    };

    allTickets.forEach((ticket) => {
      grouped[ticket.status] += 1;
    });

    return grouped;
  }, [allTickets]);

  const visibleTickets = useMemo(() => {
    return allTickets.filter((ticket) => {
      const matchesStatus = status === 'All' || ticket.status === status;
      return matchesStatus && matchesSearch(ticket, query);
    });
  }, [allTickets, query, status]);

  return (
    <div className="stack">
      <section className="section-card">
        <div className="queue-tabs" role="tablist" aria-label="Ticket status">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={status === tab}
              className={`queue-tab ${status === tab ? 'active' : ''}`}
              onClick={() => setStatus(tab)}
            >
              <span>{tab}</span>
              <strong>{counts[tab]}</strong>
            </button>
          ))}
        </div>

        <div className="toolbar ticket-toolbar">
          <div className="search-wrap">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tickets, customers, emails, or issues…"
              aria-label="Search tickets"
            />
          </div>
        </div>

        <div className="result-count">
          {loading
            ? 'Loading tickets…'
            : query.trim()
              ? `Showing ${visibleTickets.length} of ${counts[status]} matching ${status === 'All' ? 'all tickets' : `${status.toLowerCase()} tickets`}`
              : `Showing ${visibleTickets.length} ${status === 'All' ? 'tickets' : status.toLowerCase() + ' tickets'}`}
        </div>

        {error ? (
          <div className="empty error-state">
            <strong>Could not load the ticket queue.</strong>
            <p>{error}</p>
            <button type="button" className="secondary-btn" onClick={() => void loadTickets()}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="empty">Loading your workspace…</div>
        ) : (
          <div className="ticket-list">
            {visibleTickets.map((ticket) => (
              <Link
                className="ticket-row"
                to={`/tickets/${ticket.ticket_id}`}
                key={ticket.ticket_id}
              >
                <div className="ticket-main">
                  <div className="ticket-id">{ticket.ticket_id}</div>
                  <div className="ticket-title">{ticket.subject}</div>
                  <div className="ticket-customer">
                    {ticket.customer_name} · {ticket.customer_email}
                  </div>
                </div>
                <div className="ticket-meta">
                  <PriorityBadge priority={ticket.ai_insights?.priority ?? 'Medium'} />
                  <StatusBadge status={ticket.status} />
                  <span className="date">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
            {visibleTickets.length === 0 && (
              <div className="empty">
                {query.trim()
                  ? 'No tickets match your search.'
                  : `No ${status === 'All' ? '' : status.toLowerCase() + ' '}tickets yet.`}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
