-- Web push subscriptions (PWA): a teacher's browser registers here so the
-- server can push "new request" notifications even when the site is closed.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,          -- { p256dh, auth } from PushSubscription
  created_at timestamptz not null default now()
);

create index on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Replace the email-only recipient lookup with one that also returns the
-- teacher id, so the notify route can find their push subscriptions.
drop function matching_teacher_emails(uuid);

create function matching_teacher_recipients(p_request_id uuid)
returns table (teacher_id uuid, email text, full_name text)
language sql security definer stable
set search_path = public as $$
  select p.id, u.email::text, p.full_name
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

revoke execute on function matching_teacher_recipients(uuid)
  from public, anon, authenticated;
grant execute on function matching_teacher_recipients(uuid) to service_role;
