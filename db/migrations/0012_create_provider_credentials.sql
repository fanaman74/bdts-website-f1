-- Key and model entered in /admin/api for the built-in assistant providers
-- (DeepSeek, OpenRouter), so they can be configured without a Railway
-- variable. A saved key takes precedence over the provider's Railway variable.
--
-- The key is AES-256-GCM encrypted like assistant_apis; only its last four
-- characters are kept in clear.

create table public.provider_credentials (
  provider_id text primary key check (char_length(provider_id) <= 40),
  api_key_encrypted text,
  key_last4 text not null default '',
  model text check (char_length(model) <= 200),
  updated_at timestamptz not null default now()
);

comment on table public.provider_credentials is
  'Admin-entered key (encrypted) and model for built-in assistant providers. Never store a clear key here.';
