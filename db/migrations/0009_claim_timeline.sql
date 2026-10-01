-- Claim timeline: who follows each claim, the language its customer used,
-- and every note, status change and assignment made on it in /admin.
--
-- `language` lets status emails reach the customer in the language they
-- declared in; claims saved before this migration are taken as French.

alter table public.declarations
  add column language text not null default 'fr' check (language in ('fr', 'en', 'nl')),
  add column assigned_to text check (char_length(assigned_to) <= 120);

create index declarations_assigned_to_idx
  on public.declarations (assigned_to);

create table public.declaration_events (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references public.declarations (id) on delete cascade,
  kind text not null check (kind in ('note', 'status', 'assignment')),
  body text check (char_length(body) <= 4000),
  from_status text,
  to_status text,
  assigned_to text check (char_length(assigned_to) <= 120),
  author text check (char_length(author) <= 200),
  -- null: no email was attempted; true/false: the customer email's outcome.
  customer_notified boolean,
  customer_email_error text check (char_length(customer_email_error) <= 500),
  created_at timestamptz not null default now()
);

comment on table public.declaration_events is
  'Timeline of a declaration in /admin: notes, status changes (with the customer email outcome) and assignments.';

create index declaration_events_declaration_id_idx
  on public.declaration_events (declaration_id, created_at desc);
