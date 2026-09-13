# Datastraw Support Intelligence CRM

A beginner-friendly support CRM built for the Datastraw assessment. The product keeps the required ticket workflow simple while adding a lightweight AI assistance layer focused on summary, priority, sentiment, urgency, recommended action, and a draft customer reply.

## Current MVP

- Create tickets with generated ticket IDs/timestamps
- List, search, and filter tickets
- Ticket detail with status updates and internal notes
- Customer history view
- Timeline / audit-style event history
- AI assistance panel with visible reasoning
- Duplicate-safe workflow patterns and mistake prevention
- n8n webhook adapter (enabled when `VITE_N8N_WEBHOOK_URL` is configured)
- Supabase adapter placeholder for production persistence
- Responsive interface

## Run locally

```bash
npm install
npm run dev
```

The app starts in **demo mode** with localStorage persistence when Supabase is not configured. This makes the product immediately testable.

## Production architecture target

Frontend (React) → Supabase/PostgreSQL → REST/Edge Functions → AI provider → n8n automations.

Secrets must stay in backend/Edge Functions and never in the React client. The frontend's Supabase anonymous key is intended for RLS-protected client access; provider API keys belong server-side.

## Environment

Copy `.env.example` to `.env` and fill values as the backend is connected.
