import { Search, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Ticket } from '../types';

interface CustomerSummary {
  name: string;
  email: string;
  count: number;
  open: number;
  latest?: Ticket;
}

export default function Customers() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const rows = await api.listTickets();
        if (active) setTickets(rows);
      } catch (err) {
        if (active) {
          setTickets([]);
          setError(err instanceof Error ? err.message : 'Could not load customers.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const customers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    for (const ticket of tickets) {
      const key = ticket.customer_email.toLowerCase();
      const current =
        map.get(key) ?? {
          name: ticket.customer_name,
          email: ticket.customer_email,
          count: 0,
          open: 0,
        };

      current.count += 1;
      if (ticket.status !== 'Closed') current.open += 1;

      if (
        !current.latest ||
        +new Date(ticket.created_at) > +new Date(current.latest.created_at)
      ) {
        current.latest = ticket;
      }

      map.set(key, current);
    }

    const search = query.toLowerCase().trim();

    return Array.from(map.values())
      .filter(
        (customer) =>
          !search ||
          `${customer.name} ${customer.email}`.toLowerCase().includes(search),
      )
      .sort((a, b) => +new Date(b.latest?.created_at ?? 0) - +new Date(a.latest?.created_at ?? 0));
  }, [tickets, query]);

  const totalOpen = customers.reduce((sum, customer) => sum + customer.open, 0);

  return (
    <div className="stack customers-shell">
      <section className="section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">CUSTOMER CONTEXT</div>
            <h2>Customers</h2>
            <p>See the person behind the issue and their support history.</p>
          </div>

          {!loading && (
            <div className="customer-summary">
              <strong>{customers.length}</strong> customers ·{' '}
              <strong>{totalOpen}</strong> open cases
            </div>
          )}
        </div>

        <div className="toolbar single-toolbar customer-search">
          <div className="search-wrap">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers or emails…"
              aria-label="Search customers or emails"
            />
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="empty">Loading customer context…</div>
        ) : customers.length ? (
          <div className="customer-list customer-api-list">
            {customers.map((customer) => (
              <div className="customer-row customer-card-row" key={customer.email}>
                <div className="customer-identity">
                  <div className="avatar">
                    {customer.name
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join('') || <UserRound size={16} />}
                  </div>

                  <div>
                    <strong>{customer.name}</strong>
                    <small title={customer.email}>{customer.email}</small>
                  </div>
                </div>

                <div className="customer-stats customer-stats-enhanced">
                  <span>
                    <strong>{customer.count}</strong>{' '}
                    ticket{customer.count !== 1 ? 's' : ''}
                  </span>
                  <span>
                    <strong>{customer.open}</strong> open
                  </span>
                  {customer.latest && (
                    <Link
                      className="customer-open"
                      to={`/tickets/${customer.latest.ticket_id}`}
                      title={`Open latest case ${customer.latest.ticket_id}`}
                    >
                      →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No customers match your search.</div>
        )}
      </section>
    </div>
  );
}
