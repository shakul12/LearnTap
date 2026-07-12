-- Phase 1 session toolkit: image uploads (photo→whiteboard, request
-- attachments), pre-session context on requests, and whiteboard persistence.

-- ---------------------------------------------------------------------------
-- Storage: one public bucket for user uploads. Paths are
-- <user_id>/<uuid>.jpg — public read (URLs are unguessable), but users can
-- only write inside their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "users upload to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Pre-session context: optional note + photo attached to a request.
-- ---------------------------------------------------------------------------
alter table help_requests
  add column context_note text not null default '',
  add column context_image_url text;

-- ---------------------------------------------------------------------------
-- Whiteboard persistence: one scene per session, participants only.
-- elements is the Excalidraw element array; files maps fileId -> public URL
-- for images placed on the board.
-- ---------------------------------------------------------------------------
create table board_scenes (
  request_id uuid primary key references help_requests(id) on delete cascade,
  elements jsonb not null default '[]',
  files jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table board_scenes enable row level security;

create policy "participants read their board"
  on board_scenes for select to authenticated using (
    exists (
      select 1 from help_requests r
      where r.id = request_id
        and (r.student_id = auth.uid() or r.accepted_teacher_id = auth.uid())
    )
  );

create policy "participants create their board"
  on board_scenes for insert to authenticated with check (
    exists (
      select 1 from help_requests r
      where r.id = request_id
        and (r.student_id = auth.uid() or r.accepted_teacher_id = auth.uid())
    )
  );

create policy "participants update their board"
  on board_scenes for update to authenticated using (
    exists (
      select 1 from help_requests r
      where r.id = request_id
        and (r.student_id = auth.uid() or r.accepted_teacher_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Match stats v2: adds real response-time data ("accepts in ~40s") measured
-- over instant requests only (scheduled ones sit open by design).
-- ---------------------------------------------------------------------------
drop function teacher_match_stats(uuid);

create function teacher_match_stats(p_request_id uuid)
returns table (
  sessions_taught bigint,
  subject_sessions bigint,
  avg_rating numeric,
  review_count bigint,
  avg_accept_seconds numeric
)
language sql security definer stable set search_path = public as $$
  select
    (select count(*) from help_requests h
      where h.accepted_teacher_id = r.accepted_teacher_id
        and h.status = 'completed'),
    (select count(*) from help_requests h
      where h.accepted_teacher_id = r.accepted_teacher_id
        and h.status = 'completed'
        and h.subject = r.subject),
    (select avg(v.rating) from reviews v
      where v.teacher_id = r.accepted_teacher_id),
    (select count(*) from reviews v
      where v.teacher_id = r.accepted_teacher_id),
    (select avg(extract(epoch from (h.accepted_at - h.created_at)))
      from help_requests h
      where h.accepted_teacher_id = r.accepted_teacher_id
        and h.accepted_at is not null
        and h.starts_at <= h.created_at + interval '1 minute')
  from help_requests r
  where r.id = p_request_id
    and r.student_id = auth.uid()
    and r.accepted_teacher_id is not null
$$;

revoke execute on function teacher_match_stats(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Smart matching v1: rank notification recipients so the notify route can
-- ping the best-fit teachers first (subject track record, rating, speed).
-- ---------------------------------------------------------------------------
drop function matching_teacher_recipients(uuid);

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
  order by
    (select count(*) from help_requests h
      where h.accepted_teacher_id = p.id
        and h.status = 'completed' and h.subject = r.subject) desc,
    (select avg(v.rating) from reviews v where v.teacher_id = p.id)
      desc nulls last,
    (select avg(extract(epoch from (h.accepted_at - h.created_at)))
      from help_requests h
      where h.accepted_teacher_id = p.id and h.accepted_at is not null)
      asc nulls last
$$;

revoke execute on function matching_teacher_recipients(uuid)
  from public, anon, authenticated;
grant execute on function matching_teacher_recipients(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Favorites: students bookmark teachers they'd book again.
-- ---------------------------------------------------------------------------
create table favorites (
  student_id uuid not null references profiles(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, teacher_id)
);

alter table favorites enable row level security;

create policy "students manage their own favorites"
  on favorites for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notify-me waitlist: when no matching teacher is online, the student leaves
-- a marker; the moment a matching teacher toggles online, they get an email.
-- ---------------------------------------------------------------------------
create table online_waitlist (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  language text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

create index on online_waitlist (subject, language) where notified_at is null;

alter table online_waitlist enable row level security;

create policy "students manage their own waitlist entries"
  on online_waitlist for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- Emails for waitlisted students of a teacher who just came online.
-- Service-role only (reads auth.users). Claims rows atomically so two
-- teachers toggling online at once can't double-email the same student.
create function claim_waitlist_for_teacher(p_teacher_id uuid)
returns table (email text, subject text, language text)
language sql security definer
set search_path = public as $$
  update online_waitlist w
  set notified_at = now()
  from profiles p, auth.users u
  where p.id = p_teacher_id
    and p.role = 'teacher'
    and u.id = w.student_id
    and w.notified_at is null
    and w.created_at > now() - interval '24 hours'
    and w.subject = any(p.subjects)
    and w.language = any(p.languages)
  returning u.email::text, w.subject, w.language
$$;

revoke execute on function claim_waitlist_for_teacher(uuid)
  from public, anon, authenticated;
grant execute on function claim_waitlist_for_teacher(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Extend a running session by 15 minutes (student-initiated; billing derives
-- from duration_minutes at completion, so cost follows automatically).
-- ---------------------------------------------------------------------------
-- The original check pinned duration to the booking options; extensions
-- need headroom (still 15-minute steps, capped at 4 hours).
alter table help_requests
  drop constraint help_requests_duration_minutes_check;
alter table help_requests
  add constraint help_requests_duration_minutes_check
    check (duration_minutes between 15 and 240 and duration_minutes % 15 = 0);

create function extend_session(p_request_id uuid)
returns help_requests
language plpgsql security definer set search_path = public as $$
declare
  v_req help_requests%rowtype;
begin
  update help_requests
     set duration_minutes = duration_minutes + 15
   where id = p_request_id
     and status = 'matched'
     and confirmed_at is not null
     and student_id = auth.uid()
     and now() >= starts_at
     and now() < greatest(starts_at, coalesce(started_at, starts_at))
                 + (duration_minutes || ' minutes')::interval
  returning * into v_req;

  if not found then
    raise exception 'session not extendable';
  end if;

  return v_req;
end $$;

revoke execute on function extend_session(uuid) from anon;

