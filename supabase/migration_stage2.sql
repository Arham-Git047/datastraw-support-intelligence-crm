-- Use this only if the initial CRM schema was already created and you want to
-- upgrade it in place. Fresh projects should run schema.sql instead.

alter table if exists public.ai_insights add column if not exists confidence integer not null default 0;
alter table if exists public.ai_insights add column if not exists resolution_plan jsonb not null default '[]'::jsonb;
alter table if exists public.ai_insights add column if not exists customer_impact text not null default '';
alter table if exists public.ai_insights add column if not exists risk_factors jsonb not null default '[]'::jsonb;
alter table if exists public.ai_insights add column if not exists data_signals jsonb not null default '[]'::jsonb;
alter table if exists public.ai_insights add column if not exists similar_ticket_ids jsonb not null default '[]'::jsonb;
alter table if exists public.ai_insights add column if not exists generated_at timestamptz not null default now();
alter table if exists public.ai_insights drop constraint if exists ai_insights_urgency_score_check;
alter table if exists public.ai_insights add constraint ai_insights_urgency_score_check check (urgency_score between 0 and 100);
alter table if exists public.ai_insights drop constraint if exists ai_insights_priority_check;
alter table if exists public.ai_insights add constraint ai_insights_priority_check check (priority in ('Low','Medium','High','Critical'));
alter table if exists public.ai_insights drop constraint if exists ai_insights_sentiment_check;
alter table if exists public.ai_insights add constraint ai_insights_sentiment_check check (sentiment in ('Positive','Neutral','Frustrated','Angry'));

create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_created_at_idx on public.tickets(created_at desc);
create index if not exists notes_ticket_id_idx on public.notes(ticket_id);
create index if not exists events_ticket_id_idx on public.ticket_events(ticket_id);
create index if not exists ai_insights_ticket_id_created_at_idx on public.ai_insights(ticket_id, created_at desc);

alter table if exists public.tickets enable row level security;
alter table if exists public.notes enable row level security;
alter table if exists public.ticket_events enable row level security;
alter table if exists public.ai_insights enable row level security;
