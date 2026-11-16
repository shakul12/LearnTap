-- Email is the contact for new waitlist registrations. Existing leads may
-- have registered with WhatsApp as their only contact.
alter table leads
  alter column whatsapp drop not null,
  alter column board drop not null,
  drop constraint leads_child_class_check,
  add constraint leads_child_class_check check (child_class between 5 and 9),
  add constraint leads_contact_check check (email is not null or whatsapp is not null);

-- Keep the existing mobile uniqueness and deduplicate email-only registrations.
create unique index leads_email_only_key on leads (lower(email)) where whatsapp is null;
