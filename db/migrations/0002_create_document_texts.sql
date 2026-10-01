-- Extracted PDF text, cached so each document is downloaded and parsed once.
--
-- Two reasons this exists rather than fetching on every question:
--   1. Some insurers (AXA) refuse requests from datacenter IPs, so a server-side
--      fetch can fail on Railway even though the document is publicly readable.
--      `npm run ingest:documents` warms this cache from a developer machine.
--   2. Parsing a multi-megabyte PDF on every question is slow and wasteful.

create table public.document_texts (
  document_id text primary key,
  source_url text not null,
  content text not null,
  char_count integer not null,
  truncated boolean not null default false,
  fetched_at timestamptz not null default now()
);

comment on table public.document_texts is
  'Extracted text of catalogue PDFs, cached to avoid repeat downloads and to work around host IP blocks.';

create index document_texts_fetched_at_idx
  on public.document_texts (fetched_at desc);
