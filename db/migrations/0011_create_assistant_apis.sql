-- AI APIs added from the admin area (/admin/api), in addition to the built-in
-- providers configured through Railway variables.
--
-- Every entry speaks the OpenAI-compatible chat completions format. The API
-- key is stored encrypted (AES-256-GCM, key derived from a Railway secret), so
-- the database alone never yields a usable key; only its last four characters
-- are kept in clear to identify it in the admin area.

create table public.assistant_apis (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  chat_endpoint text not null check (chat_endpoint like 'https://%' and char_length(chat_endpoint) <= 500),
  model text not null check (char_length(model) between 1 and 200),
  api_key_encrypted text not null,
  key_last4 text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assistant_apis is
  'Admin-added OpenAI-compatible AI APIs. api_key_encrypted is AES-256-GCM; never store a clear key here.';
