-- Structured claim declarations submitted from /declaration.
--
-- Kept apart from public.inquiries on purpose: a declaration carries a fixed,
-- rich set of fields (contact details, incident, witness, third party,
-- attachments) that would otherwise become nullable columns on every contact
-- message. A dedicated table keeps the inbox queries cheap and gives the future
-- automation a stable, well-typed shape to read from.
--
-- As with the rest of the schema, Neon runs a single application role, so there
-- is no anon/authenticated role to revoke from and row level security is not
-- enabled: only the Astro server, which holds DATABASE_URL, can reach this table.

create table public.declarations (
  id uuid primary key default gen_random_uuid(),

  -- Mes informations de contact
  person_title text check (person_title in ('mr', 'mrs')),
  last_name text not null check (char_length(last_name) between 1 and 120),
  first_name text not null check (char_length(first_name) between 1 and 120),
  date_of_birth date,
  street text check (char_length(street) <= 200),
  street_number text check (char_length(street_number) <= 30),
  bus text check (char_length(bus) <= 30),
  postal_code text check (char_length(postal_code) <= 20),
  city text check (char_length(city) <= 120),
  country text check (char_length(country) <= 120),
  company text check (char_length(company) <= 200),
  phone_fixed text check (char_length(phone_fixed) <= 40),
  phone_mobile text check (char_length(phone_mobile) <= 40),
  email text not null check (char_length(email) <= 200),

  -- Identification du sinistre
  insured_person_or_item text check (char_length(insured_person_or_item) <= 500),
  insurance_policy_number text check (char_length(insurance_policy_number) <= 120),
  incident_date date,
  incident_time time,
  incident_place text check (char_length(incident_place) <= 500),
  incident_circumstances text check (char_length(incident_circumstances) <= 8000),

  -- Informations sur le témoin
  witness_present boolean not null default false,
  witness_title text check (witness_title in ('mr', 'mrs')),
  witness_last_name text check (char_length(witness_last_name) <= 120),
  witness_first_name text check (char_length(witness_first_name) <= 120),
  witness_street text check (char_length(witness_street) <= 200),
  witness_street_number text check (char_length(witness_street_number) <= 30),
  witness_bus text check (char_length(witness_bus) <= 30),
  witness_postal_code text check (char_length(witness_postal_code) <= 20),
  witness_city text check (char_length(witness_city) <= 120),
  witness_country text check (char_length(witness_country) <= 120),
  witness_phone text check (char_length(witness_phone) <= 40),

  -- Partie adverse
  counterparty_present boolean not null default false,
  counterparty_title text check (counterparty_title in ('mr', 'mrs')),
  counterparty_last_name text check (char_length(counterparty_last_name) <= 120),
  counterparty_first_name text check (char_length(counterparty_first_name) <= 120),
  counterparty_street text check (char_length(counterparty_street) <= 200),
  counterparty_street_number text check (char_length(counterparty_street_number) <= 30),
  counterparty_bus text check (char_length(counterparty_bus) <= 30),
  counterparty_postal_code text check (char_length(counterparty_postal_code) <= 20),
  counterparty_city text check (char_length(counterparty_city) <= 120),
  counterparty_country text check (char_length(counterparty_country) <= 120),
  counterparty_phone text check (char_length(counterparty_phone) <= 40),
  counterparty_insurance_company text check (char_length(counterparty_insurance_company) <= 200),
  counterparty_insurance_policy_number text check (char_length(counterparty_insurance_policy_number) <= 120),

  -- Autres
  remarks text check (char_length(remarks) <= 8000),
  consented_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.declarations is
  'Structured claim declarations from /declaration, consumed by the admin area and, later, by the claims automation.';

create index declarations_status_created_at_idx
  on public.declarations (status, created_at desc);

create index declarations_created_at_idx
  on public.declarations (created_at desc);

create or replace function public.set_declarations_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_declarations_updated_at
before update on public.declarations
for each row execute function public.set_declarations_updated_at();

-- Photos, constats and other documents attached to a declaration. The bytes
-- live in Postgres rather than on the container filesystem: Railway restarts
-- the container without warning, and the app declares no object storage, so the
-- database is the only durable place available today.
create table public.declaration_attachments (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references public.declarations (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 255),
  content_type text not null check (char_length(content_type) between 1 and 120),
  byte_size integer not null check (byte_size > 0 and byte_size <= 4194304),
  content_base64 text not null,
  created_at timestamptz not null default now()
);

comment on table public.declaration_attachments is
  'Files attached to a declaration, stored base64-encoded so the Neon HTTP driver can persist them. Max 4 MiB per file.';

create index declaration_attachments_declaration_id_idx
  on public.declaration_attachments (declaration_id);
