create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  form_type text not null check (form_type in ('contact', 'devis', 'declaration')),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 200),
  phone text not null check (char_length(phone) between 6 and 30),
  message text not null check (char_length(message) between 10 and 5000),
  consented_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inquiries is
  'Contact, quote, and claim submissions received from the BDTS website.';

create index inquiries_status_created_at_idx
  on public.inquiries (status, created_at desc);

alter table public.inquiries enable row level security;

-- No browser or signed-in user may read or write submissions directly.
-- The Astro server uses a Supabase secret key, which assumes service_role.
revoke all on table public.inquiries from anon, authenticated;
grant all on table public.inquiries to service_role;

create or replace function public.set_inquiries_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_inquiries_updated_at
before update on public.inquiries
for each row execute function public.set_inquiries_updated_at();
