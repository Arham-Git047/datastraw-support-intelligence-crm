# Datastraw Support Intelligence CRM — Step-by-Step Build & Test

## Product goal

Build a support CRM that is easy for first-time users, fast for experienced agents, and trustworthy when AI is involved.

## What makes this different from the assessment baseline

The required CRM flow remains the foundation:

- Create ticket
- List tickets
- Search
- Filter by status
- Open/update tickets
- Add notes

The product also adds:

1. Beginner-friendly navigation and guided ticket creation
2. Universal search across ticket/customer information
3. Customer history / Customer 360-lite
4. Ticket timeline / audit-style activity
5. AI summary, category, priority, sentiment, urgency, suggested action, and draft reply
6. Visible AI reasoning so suggestions are explainable
7. "Needs attention" priority queue
8. Mistake-prevention patterns such as confirmation and duplicate-warning flows (to be completed during production hardening)
9. n8n webhook adapter for automation

## Important current state

The scaffold starts in local demo mode using browser localStorage. Supabase persistence, the production REST path, real Claude calls from the browser flow, and n8n automation are not yet fully wired end-to-end. Do not call the application production-ready until the Stage 2–7 gates below pass.

---

# Stage 1 — Local baseline

## 1. Prerequisites

Use Node.js 20+ and npm.

From the project directory:

```bash
node -v
npm -v
```

## 2. Install dependencies

```bash
npm install
```

Expected result: installation completes without fatal errors and creates `node_modules/`.

## 3. Type-check + production build

```bash
npm run build
```

Expected result:

- TypeScript completes without errors
- Vite creates `dist/`
- Exit code is 0

## 4. Start development server

```bash
npm run dev
```

Open the URL printed by Vite.

## 5. Manual smoke test

Run these in order:

### Dashboard
- Dashboard loads
- Ticket counts appear
- "Needs attention" appears when high-urgency active tickets exist
- Navigation works

### Create ticket
Create a ticket with:

- Customer name: Test User
- Email: test@example.com
- Subject: Payment deducted but order missing
- Description: Payment was deducted but no order was created.

Expected:
- Ticket is created
- Ticket ID follows `TKT-xxx`
- Status is `Open`
- Success confirmation appears
- Ticket detail opens
- AI analysis appears in demo mode

### Search
Search for `test@example.com`, then `payment`, then the new ticket ID.

Expected: the correct ticket remains visible.

### Filter
Test `All`, `Open`, `In Progress`, and `Closed`.

Expected: results match the selected status.

### Ticket detail
Verify:
- Customer information
- Description
- Status controls
- AI assistance
- Notes
- Timeline
- Integrity panel

### Status flow
Use:

`Open → In Progress → Closed`

Then re-open.

Expected:
- Status changes are reflected immediately
- Timeline records the change

### Notes
Add an internal note.

Expected:
- Note appears
- Timestamp appears
- Timeline records the note event

### Customer history
Open Customers and verify that the created customer appears with ticket history/counts.

### Analytics
Open Analytics and verify category counts update from the current local data.

---

# Stage 1.1 — Browser integrity checks

Open browser DevTools.

## Console
Expected: no uncaught React/JavaScript errors during normal use.

## Application → Local Storage
Confirm the key:

`datastraw-support-crm-tickets-v1`

contains the ticket data in demo mode.

## Responsive test
Test at approximately:

- Desktop: 1440px
- Tablet: 900px
- Mobile: 390px

Expected:
- Navigation remains usable
- Forms remain readable
- Ticket rows do not become unusable
- Bottom navigation appears on mobile

---

# Stage 2 — Supabase production persistence

Create a Supabase project and run `supabase/schema.sql` in the SQL editor.

Then verify the tables exist:

- `tickets`
- `notes`
- `ticket_events`
- `ai_insights`

Configure frontend environment values in `.env` using only the public Supabase project URL and anonymous key.

Configure backend environment values separately. Never place a service-role key or AI provider key in the React/Vite frontend environment.

## Stage 2 tests

1. Create a ticket in the app.
2. Refresh the browser.
3. Confirm the ticket still exists.
4. Open the same ticket from another browser session.
5. Confirm notes and timeline persist.
6. Confirm deleting/reloading browser storage does not delete production data.

Do not proceed until persistence survives refresh and a second session.

---

# Stage 3 — REST API integration

The required assessment endpoints are:

- `POST /api/tickets`
- `GET /api/tickets`
- `GET /api/tickets/{ticket_id}`
- `PUT /api/tickets/{ticket_id}`

The scaffold also includes:

- `GET /health`
- `POST /api/tickets/{ticket_id}/analyze`

## API test sequence

Start the backend and verify:

```bash
curl http://localhost:8080/health
```

Expected:

```json
{"ok":true,"service":"datastraw-support-crm-api"}
```

Then test create → list → detail → update.

For every endpoint verify:

- success response
- invalid input response
- missing ticket response
- malformed request does not crash the server

## Integrity hardening before production

Replace application-side max-ID generation with a database-safe unique ID strategy so two simultaneous ticket creations cannot generate the same ticket ID.

---

# Stage 4 — Real AI assistance

The AI layer should remain server-side.

Input:

- ticket subject
- ticket description
- relevant customer context

Output:

- category
- priority
- sentiment
- urgency score
- summary
- suggested action
- suggested reply
- explanation

## AI trust rules

- AI output is a suggestion, not an automatic final decision.
- The UI must show why a recommendation was made.
- Do not invent customer/order facts.
- Handle provider failure with a clear fallback state.
- Do not expose provider API keys in client-side code.

## AI tests

Use at least five tickets representing:

1. normal request
2. payment problem
3. refund request
4. delivery problem
5. possible security/fraud problem

Check that results are sensible, bounded, and do not invent facts.

---

# Stage 5 — n8n automation

Create a webhook workflow for `ticket.created`.

Recommended flow:

`Ticket Created → Webhook → AI/Rules → Persist/Notify → CRM timeline`

For a high-priority ticket, the workflow can create a visible operational alert or notification.

## n8n tests

- webhook receives a test event
- normal ticket completes normally
- high-priority ticket follows the escalation branch
- webhook failure does not break ticket creation

---

# Stage 6 — UX and integrity hardening

Complete these before deployment:

## Beginner experience

- Plain-language labels
- Helpful empty states
- Clear primary action
- No unnecessary CRM jargon
- Help modal / contextual explanations

## Error prevention

- Duplicate-ticket warning where similarity is reliable
- Unsaved-change protection
- Close-ticket confirmation
- Clear error messages
- Disabled/loading states during writes

## Auditability

Every important state change should produce a timeline event.

The user should always be able to answer:

- What happened?
- When did it happen?
- What changed?
- Was the action suggested by AI or chosen by the user?

---

# Stage 7 — Final assessment QA

Map every required item to a test case.

## Functional

- Create ticket
- Auto ID/timestamp
- List tickets
- Search by name, ID, email, description
- Filter Open/In Progress/Closed
- Detail page
- Status update
- Notes

## Deliverables

- Public deployed application
- GitHub repository
- README with setup instructions
- `.env.example`
- `.gitignore`
- 3–5 minute demo video
- Submission email

## Demo flow

Recommended 3–5 minute narrative:

1. Start with dashboard
2. Create a realistic ticket
3. Show automatic ID and AI assistance
4. Explain the AI recommendation and human approval
5. Show status change + note + timeline
6. Search for the ticket/customer
7. Show analytics/customer history
8. Briefly show architecture and n8n automation
9. End with deployment + GitHub

---

# Definition of done

The application is ready for submission only when:

- all required assessment features work
- data survives refresh and deployment
- API failures are handled safely
- AI is explainable and advisory
- no secrets are exposed in frontend code
- core workflows can be completed by a first-time user without instructions
- important changes are traceable in the timeline
- mobile and desktop flows are usable
- the deployed app passes the complete QA checklist
