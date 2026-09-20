-- Runtime-editable settings, changed from the admin area.
--
-- Deliberately secrets-free: provider API keys stay in environment variables
-- (Railway), never in the database, so a database leak cannot hand over
-- provider credentials. Only non-secret choices live here.

create table public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.settings is
  'Runtime settings editable in the admin area (assistant provider and model). No secrets.';

insert into public.settings (key, value) values
  ('assistant_provider', 'deepseek'),
  ('assistant_model', 'deepseek-flash')
on conflict (key) do nothing;
