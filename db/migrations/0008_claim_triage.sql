-- Claim triage: the insurer a declaration belongs to, and a log of every time
-- the office forwarded a declaration to that insurer from /admin.
--
-- `insurer` holds an id from src/lib/insurers.ts (ag-insurance, axa, ...).
-- `insurer_source` says how it was set: matched on an earlier claim with the
-- same policy number ('policy') or from the same customer ('customer'), named
-- by the customer in the form ('text'), or chosen by staff ('manual').

alter table public.declarations
  add column insurer text check (char_length(insurer) <= 60),
  add column insurer_source text check (insurer_source in ('policy', 'customer', 'text', 'manual'));

create index declarations_insurer_idx
  on public.declarations (insurer);

create table public.declaration_forwards (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references public.declarations (id) on delete cascade,
  insurer text not null check (char_length(insurer) <= 60),
  to_email text not null check (char_length(to_email) <= 1000),
  cc_email text check (char_length(cc_email) <= 1000),
  subject text not null check (char_length(subject) <= 300),
  body text not null check (char_length(body) <= 20000),
  attachment_names text not null default '',
  sent_by text check (char_length(sent_by) <= 200),
  ok boolean not null,
  error text check (char_length(error) <= 500),
  created_at timestamptz not null default now()
);

comment on table public.declaration_forwards is
  'Every forward of a declaration to an insurer from /admin, successful or not.';

create index declaration_forwards_declaration_id_idx
  on public.declaration_forwards (declaration_id, created_at desc);
