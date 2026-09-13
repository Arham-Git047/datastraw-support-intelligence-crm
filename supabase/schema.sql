-- Datastraw Support Intelligence CRM — Stage 2 database
-- Core ticket/notes structure follows the assessment while preserving
-- separate audit and intelligence data for the enhanced product.

create extension if not exists pgcrypto;

create sequence if not exists public.ticket_number_seq start 1;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_id text unique not null default ('TKT-' || lpad(nextval('public.ticket_number_seq')::text, 3, '0')),
  customer_name text not null check (char_length(trim(customer_name)) >= 2),
  customer_email text not null,
  subject text not null check (char_length(trim(subject)) >= 4),
  description text not null check (char_length(trim(description)) >= 10),
  status text not null default 'Open' check (status in ('Open','In Progress','Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null references public.tickets(ticket_id) on delete cascade,
  note_text text not null check (char_length(trim(note_text)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null references public.tickets(ticket_id) on delete cascade,
  event_type text not null check (event_type in ('created','ai_analyzed','status_changed','note_added','assignment')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null references public.tickets(ticket_id) on delete cascade,
  category text not null,
  priority text not null check (priority in ('Low','Medium','High','Critical')),
  sentiment text not null check (sentiment in ('Positive','Neutral','Frustrated','Angry')),
  urgency_score integer not null check (urgency_score between 0 and 100),
  confidence integer not null default 0 check (confidence between 0 and 100),
  summary text not null,
  suggested_action text not null,
  suggested_reply text,
  resolution_plan jsonb not null default '[]'::jsonb,
  customer_impact text not null default '',
  risk_factors jsonb not null default '[]'::jsonb,
  data_signals jsonb not null default '[]'::jsonb,
  similar_ticket_ids jsonb not null default '[]'::jsonb,
  explanation text not null default '',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists tickets_status_idx on public.tickets(status);
create index if not exists tickets_customer_email_idx on public.tickets(lower(customer_email));
create index if not exists tickets_created_at_idx on public.tickets(created_at desc);
create index if not exists notes_ticket_id_idx on public.notes(ticket_id);
create index if not exists events_ticket_id_idx on public.ticket_events(ticket_id);
create index if not exists ai_insights_ticket_id_created_at_idx on public.ai_insights(ticket_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- Keep sequence ahead of any imported/seeded TKT-### values.
select setval(
  'public.ticket_number_seq',
  greatest(
    coalesce((select max((regexp_match(ticket_id, '[0-9]+$'))[1]::bigint) from public.tickets), 0),
    (select last_value from public.ticket_number_seq)
  ),
  true
);

-- The browser does not receive the service-role key. These tables are accessed
-- through the Express API, which uses the service-role key server-side.
alter table public.tickets enable row level security;
alter table public.notes enable row level security;
alter table public.ticket_events enable row level security;
alter table public.ai_insights enable row level security;

-- No public/anonymous policies are created intentionally.
-- The API server is the only application data path in Stage 2.
