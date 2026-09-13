const base = process.env.API_BASE_URL || 'http://localhost:8080';

async function call(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  console.log(`${init.method || 'GET'} ${path} -> ${response.status}`);
  if (!response.ok) {
    console.log(body);
    throw new Error(`API test failed: ${response.status}`);
  }
  return body;
}

const health = await call('/health');
if (!health.ok || health.database !== 'connected') throw new Error('Database is not connected.');

const created = await call('/api/tickets', {
  method: 'POST',
  body: JSON.stringify({
    customer_name: 'Stage Two Test',
    customer_email: `stage2-${Date.now()}@example.com`,
    subject: 'Payment deducted but order not created',
    description: '₹2499 was deducted but the order does not appear in the account.',
  }),
});

const ticket = await call(`/api/tickets/${created.ticket_id}`);
if (ticket.ticket_id !== created.ticket_id) throw new Error('Created ticket could not be read back.');

const list = await call('/api/tickets?search=Payment');
if (!Array.isArray(list)) throw new Error('Ticket list is not an array.');

await call(`/api/tickets/${created.ticket_id}`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'In Progress', notes: 'Stage 2 API test note.' }),
});

const analyzed = await call(`/api/tickets/${created.ticket_id}/analyze`, {
  method: 'POST',
  body: '{}',
});

if (!analyzed.category || !analyzed.suggested_action) throw new Error('AI analysis response is incomplete.');

const finalTicket = await call(`/api/tickets/${created.ticket_id}`);
if (finalTicket.status !== 'In Progress') throw new Error('Status update did not persist.');
if (!finalTicket.notes?.some((item) => item.note_text === 'Stage 2 API test note.')) throw new Error('Note did not persist.');
if (!finalTicket.ai_insights) throw new Error('AI insight did not persist.');

console.log('\nStage 2 API verification passed.');
console.log(`Created ${created.ticket_id}`);
