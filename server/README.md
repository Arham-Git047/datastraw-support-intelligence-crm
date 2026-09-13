# Datastraw Support Intelligence CRM API

Stage 2 provides the required REST API and server-side Supabase access.

## Endpoints

- `GET /health`
- `POST /api/tickets`
- `GET /api/tickets?status=Open&search=customer_name`
- `GET /api/tickets/:ticket_id`
- `PUT /api/tickets/:ticket_id`
- `POST /api/tickets/:ticket_id/analyze`

## Security boundary

The browser calls this API. Only the API server receives `SUPABASE_SERVICE_ROLE_KEY`.

## Development

```powershell
npm install
npm run dev
```

The server defaults to port `8080`.
