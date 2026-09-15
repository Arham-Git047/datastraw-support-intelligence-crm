# DataStraw Support Intelligence CRM

> AI-powered support intelligence CRM that turns ticket activity into explainable priorities, risks, customer impact, and next-best actions.

## Live Application

- Frontend: https://datastraw-support-intelligence-crm.vercel.app
- Backend API: https://datastraw-support-api.onrender.com
- Health check: https://datastraw-support-api.onrender.com/health

## Overview

DataStraw is a production-deployed support intelligence platform designed to help support teams understand what is happening in the queue, identify cases that need attention, understand customer impact, and determine the safest next action.

Instead of treating a CRM as a simple ticket database, DataStraw adds an AI-assisted decision layer around the support workflow while keeping the final decision with the human support agent.

### Core idea

```text
Customer issue
      ↓
Ticket creation
      ↓
Database persistence
      ↓
AI interpretation
      ↓
Priority + sentiment + attention score
      ↓
Customer impact + risks
      ↓
Similar-case detection
      ↓
Recommended next action
      ↓
Human review
      ↓
Status / note / resolution
      ↓
Audit timeline
```

## Why DataStraw?

Traditional support systems primarily answer:

> "Which tickets exist?"

DataStraw focuses on:

> **"What deserves attention, why does it matter, and what should happen next?"**

The platform helps support teams reduce manual interpretation, surface recurring issues, preserve decision context, and keep AI recommendations reviewable.

## Key Features

### Ticket Management

- Create tickets
- View tickets
- Search tickets
- Filter by status
- Open detailed ticket views
- Change ticket status
- Add internal notes
- Review ticket history

Supported statuses:

- Open
- In Progress
- Closed

### AI Decision Brief

Each ticket can be analyzed to produce:

- Issue category
- Priority
- Customer sentiment
- Attention / urgency score
- Confidence
- Summary
- Customer impact
- Recommended next action
- Resolution plan
- Risk factors
- Evidence / data signals
- Similar ticket IDs
- Explanation
- Suggested customer reply

### Human-in-the-Loop AI

AI remains advisory.

```text
AI recommendation
       ↓
Support agent review
       ↓
Final operational decision
```

The system does not allow AI to independently claim that refunds, transactions, order states, or investigations have been completed.

### Explainable Decision Support

The intelligence layer explains why a case needs attention using evidence such as:

- Financial impact
- Missing customer outcome
- Delay signals
- Security signals
- Blocking/access language
- Similar cases

### Similar-Case Detection

The system compares the current ticket with existing ticket descriptions to identify recurring patterns.

### Intelligence Dashboard

The intelligence layer surfaces queue-level signals such as:

- Active workload
- High-risk cases
- Attention scores
- Customer sentiment
- Recurring issue patterns
- Cases requiring review
- Operational learning

### Audit Timeline

Important actions are stored as ticket events:

```text
Ticket created
      ↓
Status changed → In Progress
      ↓
Agent added a note
      ↓
AI decision brief updated
```

## Architecture

```text
                         USER
                           │
                           ▼
              ┌─────────────────────────┐
              │       VERCEL            │
              │ React + Vite Frontend   │
              │                         │
              │ Dashboard               │
              │ Tickets                 │
              │ Customers               │
              │ Intelligence            │
              │ Ticket Detail           │
              └────────────┬────────────┘
                           │
                           │ HTTPS REST API
                           ▼
              ┌─────────────────────────┐
              │        RENDER           │
              │ Node.js + Express       │
              │                         │
              │ Validation              │
              │ CRUD                    │
              │ Audit events            │
              │ AI orchestration        │
              │ CORS                    │
              └───────┬─────────┬───────┘
                      │         │
             ┌────────┘         └──────────┐
             ▼                            ▼
   ┌────────────────────┐       ┌────────────────────┐
   │      SUPABASE      │       │     OPENROUTER     │
   │ PostgreSQL + RLS   │       │ AI model routing   │
   │ tickets            │       │ Structured JSON    │
   │ notes              │       │                    │
   │ ticket_events      │       │                    │
   │ ai_insights        │       │                    │
   └────────────────────┘       └────────────────────┘
```

### Deployment

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React + Vite | Vercel |
| API | Node.js + Express | Render |
| Database | PostgreSQL | Supabase |
| AI | OpenRouter | API |
| Source Control | Git | GitHub |

n8n is intentionally not part of the current production workflow and is reserved for future automation.

## Database Design

Primary tables:

```text
tickets
notes
ticket_events
ai_insights
```

### tickets

```text
id
ticket_id
customer_name
customer_email
subject
description
status
created_at
updated_at
```

### notes

```text
id
ticket_id
note_text
created_at
```

### ticket_events

```text
id
ticket_id
event_type
message
created_at
```

### ai_insights

```text
id
ticket_id
category
priority
sentiment
urgency_score
confidence
summary
suggested_action
suggested_reply
resolution_plan
customer_impact
risk_factors
data_signals
similar_ticket_ids
explanation
generated_at
```

Relationships:

```text
tickets
   │
   ├── notes
   ├── ticket_events
   └── ai_insights
```

Row Level Security is enabled on the operational tables.

## API

### Health

```http
GET /health
```

### List tickets

```http
GET /api/tickets
```

Optional filters:

```http
GET /api/tickets?status=Open
GET /api/tickets?search=payment
```

### Get ticket

```http
GET /api/tickets/:ticket_id
```

### Create ticket

```http
POST /api/tickets
```

Example:

```json
{
  "customer_name": "Rahul Sharma",
  "customer_email": "rahul@example.com",
  "subject": "Payment deducted but order not created",
  "description": "The payment was deducted but the order is not visible."
}
```

### Update ticket

```http
PUT /api/tickets/:ticket_id
```

Supports status updates and internal notes.

### Analyze ticket

```http
POST /api/tickets/:ticket_id/analyze
```

The analysis pipeline validates the AI output before persisting it.

## AI Pipeline

```text
Ticket
  ↓
Load ticket context
  ↓
Load comparable tickets
  ↓
Identify similar cases
  ↓
OpenRouter
  ↓
Structured JSON
  ↓
Validation
  ↓
Persist ai_insights
  ↓
Create ai_analyzed event
  ↓
Return decision brief
```

### AI resilience

```text
OpenRouter
    │
    ├── Success
    │     ↓
    │   AI decision brief
    │
    └── Failure
          ↓
    Deterministic fallback
```

A provider outage or free-tier limitation therefore does not prevent the CRM from producing a usable analysis.

## Security

Backend secrets remain server-side.

### Backend

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
FRONTEND_URL
```

### Frontend

```text
VITE_API_BASE_URL
```

The frontend must never contain:

- `SUPABASE_SECRET_KEY`
- `OPENROUTER_API_KEY`

Environment files containing real credentials are excluded from Git.

## Environment Setup

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:8080
```

### Backend `server/.env`

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/free
FRONTEND_URL=http://localhost:5173
```

Use the existing `.env.example` files as templates.

## Local Development

```bash
git clone https://github.com/Arham-Git047/datastraw-support-intelligence-crm.git
cd datastraw-support-intelligence-crm
npm install
```

Start the frontend:

```bash
npm run dev
```

Start the backend:

```bash
npm run server:dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8080
```

Health:

```text
http://localhost:8080/health
```

## Production Deployment

```text
GitHub
   │
   ├──► Vercel
   │      React frontend
   │
   └──► Render
          Express API
            │
            ├──► Supabase
            └──► OpenRouter
```

The frontend receives the production API URL through:

```text
VITE_API_BASE_URL
```

The backend reads its production secrets from the hosting platform environment.

## Production Data

The production demo dataset is intentionally composed of realistic support scenarios across:

- Payment
- Delivery
- Refund
- Billing
- Account

Development and regression records are removed before the final showcase.

## Design Principles

### Evidence before action

Recommendations should be traceable to the information in the case.

### AI as advisor

The support employee retains final decision authority.

### Operational traceability

Important support actions remain visible through the ticket timeline.

### Production-first architecture

Operational records are persisted through PostgreSQL rather than browser-only state.

### Graceful degradation

AI failure does not destroy the ticket workflow.

## Future Roadmap

- n8n workflow automation
- Slack / email escalation
- Role-based access
- SLA monitoring
- Agent performance analytics
- Knowledge-base integration
- RAG-assisted recommendations
- Human feedback loops for AI improvement

## Project Structure

```text
DataStraw/
│
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── types/
│
├── server/
│   ├── index.js
│   ├── .env.example
│   └── package.json
│
├── supabase/
├── vercel.json
├── package.json
├── README.md
└── .gitignore
```

## Project Positioning

> **DataStraw is an AI-powered support intelligence platform that turns ticket activity into explainable operational decisions.**

Rather than being another CRUD CRM, the product focuses on:

```text
Tickets
   ↓
Context
   ↓
Intelligence
   ↓
Prioritization
   ↓
Action
   ↓
Learning
```

## Release

**Production Release: v1.0.0**

- Frontend: Vercel
- Backend: Render
- Database: Supabase
- AI: OpenRouter
- Source: GitHub
