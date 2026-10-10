-- Missing-information requests on claims, and the two new public forms
-- (attestation requests and the guided arrival form). The token stored on a claim is a SHA-256 hash of the
-- link sent to the customer, so a leaked database row cannot be used as a link.

alter table public.declarations
  add column info_request_token text unique,
  add column info_request_expires_at timestamptz,
  add column info_request_items text check (char_length(info_request_items) <= 300);

alter table public.declaration_events drop constraint declaration_events_kind_check;
alter table public.declaration_events
  add constraint declaration_events_kind_check
  check (kind in ('note', 'status', 'assignment', 'info_request', 'customer_info'));

alter table public.inquiries drop constraint inquiries_form_type_check;
alter table public.inquiries
  add constraint inquiries_form_type_check
  check (form_type in ('contact', 'devis', 'declaration', 'attestation', 'arrivee'));
