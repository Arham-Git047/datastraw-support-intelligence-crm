-- Optional local/demo seed data for Stage 2.
-- Run after schema.sql in a development Supabase project only.

insert into public.tickets (ticket_id, customer_name, customer_email, subject, description, status, created_at, updated_at)
values
('TKT-024', 'Rahul Sharma', 'rahul@example.com', 'Payment deducted but order not created', 'The payment was completed successfully, but I did not receive an order confirmation and the order is missing from my account.', 'Open', now() - interval '220 minutes', now() - interval '28 minutes'),
('TKT-023', 'Priya Mehta', 'priya@example.com', 'Refund still not received', 'My return was approved last week, but the refund is still not showing in my bank account.', 'In Progress', now() - interval '420 minutes', now() - interval '55 minutes'),
('TKT-022', 'Aman Verma', 'aman@example.com', 'Delivery delayed by two days', 'The tracking page has not changed for two days and the package has not arrived.', 'Closed', now() - interval '620 minutes', now() - interval '190 minutes')
on conflict (ticket_id) do nothing;

insert into public.notes (ticket_id, note_text, created_at)
select 'TKT-023', 'Refund approval confirmed. Checking settlement status.', now() - interval '60 minutes'
where not exists (select 1 from public.notes where ticket_id='TKT-023' and note_text='Refund approval confirmed. Checking settlement status.');

insert into public.ticket_events (ticket_id, event_type, message, created_at)
select 'TKT-024', 'created', 'Ticket created', now() - interval '220 minutes'
where not exists (select 1 from public.ticket_events where ticket_id='TKT-024' and event_type='created');

insert into public.ticket_events (ticket_id, event_type, message, created_at)
select 'TKT-023', 'created', 'Ticket created', now() - interval '420 minutes'
where not exists (select 1 from public.ticket_events where ticket_id='TKT-023' and event_type='created');

insert into public.ticket_events (ticket_id, event_type, message, created_at)
select 'TKT-022', 'created', 'Ticket created', now() - interval '620 minutes'
where not exists (select 1 from public.ticket_events where ticket_id='TKT-022' and event_type='created');
