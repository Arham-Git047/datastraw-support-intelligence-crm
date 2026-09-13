# Support Intelligence CRM — Production Plan

## Product principle

The interface should be understandable without CRM or technical background, while remaining fast for an experienced support agent. AI assists; it does not silently make consequential decisions.

## Required assessment coverage

- Create ticket: customer name/email, issue title/description, generated ticket ID/timestamp
- List tickets: ID, name, title, status, date
- Search: name, ID, email, description
- Filter: Open, In Progress, Closed
- Detail/update: status, notes
- Full-stack architecture: React frontend, REST API, Supabase/PostgreSQL persistence
- Deployment-ready structure and README

## Differentiators

1. Universal search with plain-language placeholder.
2. Guided ticket creation.
3. Ticket timeline / audit-style event history.
4. Customer 360-lite history.
5. AI assistance: category, priority, sentiment, urgency, summary, suggested action, reply draft.
6. Visible AI explanation for trust.
7. Human approval model for customer-facing output.
8. Mistake prevention patterns (duplicate warning, unsaved-change handling, close/re-open clarity).
9. n8n webhook integration for automation.
10. Analytics page focused on operational visibility rather than decorative charts.

## Architecture

React/Vite → Express REST API → Supabase/PostgreSQL
                         ↘ Claude API (server only)
                         ↘ n8n webhook

The browser never receives provider secrets. The Supabase service role key also stays server-side.

## Delivery sequence

### Phase 1 — Core CRM

- UI shell
- Create/list/detail pages
- Search/filter/status update/notes
- Database schema
- REST endpoints

### Phase 2 — Trust + usability

- Timeline
- Customer history
- Clear status transitions
- Help affordances
- Empty/loading/error states
- Keyboard-accessible controls

### Phase 3 — AI assistance

- Server-side AI endpoint
- Insight persistence
- AI reasoning display
- Draft reply with copy/edit flow

### Phase 4 — Automation + deployment

- n8n webhook
- Production environment variables
- Supabase RLS policies for public-facing data access patterns
- Deploy API + frontend
- Smoke-test all required flows

### Phase 5 — Demo readiness

- Seed demo data
- 3–5 minute walkthrough
- README cleanup
- architecture diagram
- tradeoff explanation
