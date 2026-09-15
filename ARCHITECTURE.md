# DataStraw Architecture

## Production topology

```text
                         ┌────────────────────┐
                         │       USER         │
                         └─────────┬──────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │      VERCEL        │
                         │ React + Vite       │
                         │ Production UI      │
                         └─────────┬──────────┘
                                   │
                                   │ HTTPS REST API
                                   ▼
                         ┌────────────────────┐
                         │      RENDER        │
                         │ Node + Express     │
                         │ Validation         │
                         │ CRUD               │
                         │ AI orchestration   │
                         │ Audit events       │
                         │ CORS               │
                         └──────┬──────┬──────┘
                                │      │
                    ┌───────────┘      └───────────┐
                    ▼                              ▼
          ┌──────────────────┐           ┌──────────────────┐
          │     SUPABASE     │           │    OPENROUTER    │
          │ PostgreSQL + RLS │           │ AI model routing │
          │ tickets          │           │ Structured JSON  │
          │ notes            │           │                  │
          │ ticket_events    │           │                  │
          │ ai_insights      │           │                  │
          └──────────────────┘           └──────────────────┘
```

## Request lifecycle

```text
Create ticket
    ↓
Express validation
    ↓
Supabase INSERT
    ↓
ticket_events: created
    ↓
Ticket available to UI
```

## Intelligence lifecycle

```text
Analyze ticket
    ↓
Load ticket + comparable tickets
    ↓
Similarity detection
    ↓
OpenRouter request
    ↓
Structured JSON
    ↓
Validation
    ↓
Persist ai_insights
    ↓
ticket_events: ai_analyzed
    ↓
Decision brief rendered in React
```

## Failure path

```text
OpenRouter unavailable
        ↓
Catch provider error
        ↓
Deterministic fallback
        ↓
Usable decision brief
        ↓
CRM continues operating
```

## Security boundary

```text
Browser
  │
  │ public API calls
  ▼
Express
  │
  │ server-only credentials
  ├────────────► Supabase
  │
  └────────────► OpenRouter

Secrets never belong in the browser.
```

## Current automation boundary

n8n is intentionally excluded from the current production path.

Future:

```text
High-risk event
      ↓
n8n
      ↓
Slack / Email / Escalation
```

This keeps the present production system simple while preserving an extension point for future automation.
