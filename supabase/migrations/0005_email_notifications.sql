-- Email notifications: teachers get an email when a matching request is
-- posted. notify_by_email is the teacher's opt-out; notified_at limits each
-- request to a single notification blast.

alter table profiles
  add column notify_by_email boolean not null default true;

-- Re-issue the column-level grant list with the new preference included.
revoke update on profiles from authenticated, anon;
grant update (full_name, languages, subjects, hourly_rate_cents, is_online, notify_by_email)
  on profiles to authenticated;

alter table help_requests
  add column notified_at timestamptz;

-- Emails live in auth.users, which clients can't read. This function joins
-- them for exactly the teachers who should hear about a request: matching
-- subject + language, opted in, not already declined by this student.
-- Service role only — a regular user must never be able to harvest emails.
create or replace function matching_teacher_emails(p_request_id uuid)
returns table (email text, full_name text)
language sql security definer stable
set search_path = public as $$
  select u.email::text, p.full_name
  from help_requests r
  join profiles p
    on p.role = 'teacher'
   and p.notify_by_email
   and r.subject = any(p.subjects)
   and r.language = any(p.languages)
   and not (p.id = any(r.declined_teacher_ids))
  join auth.users u on u.id = p.id
  where r.id = p_request_id
    and r.status = 'open'
$$;

revoke execute on function matching_teacher_emails(uuid)
  from public, anon, authenticated;
grant execute on function matching_teacher_emails(uuid) to service_role;
