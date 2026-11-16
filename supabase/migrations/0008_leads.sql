-- Marketing waitlist leads captured on /join (parents of Class 6–9 students).
-- Written only by the server via the service-role client. RLS is enabled with
-- no policies, so the anon/authenticated roles can neither read nor write.

create table leads (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null check (char_length(parent_name) between 2 and 80),
  -- Normalised Indian mobile, E.164 (+91XXXXXXXXXX).
  whatsapp text not null check (whatsapp ~ '^\+91[6-9][0-9]{9}$'),
  email text check (email is null or char_length(email) <= 254),
  child_class smallint not null check (child_class between 6 and 9),
  board text not null check (board in ('CBSE', 'ICSE', 'State', 'Other')),
  city text not null check (char_length(city) between 2 and 60),
  need text not null default '' check (char_length(need) <= 500),
  whatsapp_opt_in boolean not null default false,
  consent_at timestamptz not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  created_at timestamptz not null default now()
);

-- One lead per WhatsApp number; repeat signups are treated as success.
create unique index leads_whatsapp_key on leads (whatsapp);
create index on leads (created_at desc);
create index on leads (utm_source);

alter table leads enable row level security;
