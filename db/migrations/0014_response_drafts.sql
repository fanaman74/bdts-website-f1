create table if not exists public.response_drafts (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.inquiries(id) on delete cascade,
  declaration_id uuid references public.declarations(id) on delete cascade,
  subject varchar(300) not null default '',
  body text not null default '',
  source_document_ids text[] not null default '{}',
  author varchar(200),
  updated_at timestamptz not null default now(),
  constraint response_drafts_one_record check ((inquiry_id is not null) <> (declaration_id is not null))
);
create unique index if not exists response_drafts_inquiry_idx on public.response_drafts (inquiry_id) where inquiry_id is not null;
create unique index if not exists response_drafts_declaration_idx on public.response_drafts (declaration_id) where declaration_id is not null;
