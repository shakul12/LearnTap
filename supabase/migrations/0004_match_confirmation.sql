-- Match confirmation: after a teacher accepts, the student reviews the
-- teacher's profile and either goes ahead (the video room is created and the
-- session proceeds) or continues searching (the request re-opens and that
-- teacher can't take it again).

alter table help_requests
  add column confirmed_at timestamptz,
  add column declined_teacher_ids uuid[] not null default '{}';

-- accept_request: same atomic claim, but teachers this student already
-- declined can't re-claim the request.
create or replace function accept_request(p_request_id uuid)
returns help_requests
language plpgsql security definer set search_path = public as $$
declare
  v_teacher profiles%rowtype;
  v_req help_requests%rowtype;
begin
  select * into v_teacher from profiles
    where id = auth.uid() and role = 'teacher';
  if not found then
    raise exception 'not a teacher';
  end if;

  update help_requests
     set status = 'matched',
         accepted_teacher_id = v_teacher.id,
         accepted_at = now(),
         rate_cents_per_hour = v_teacher.hourly_rate_cents
   where id = p_request_id
     and status = 'open'
     and expires_at > now()
     and not (v_teacher.id = any(declined_teacher_ids))
  returning * into v_req;

  if not found then
    raise exception 'request no longer available';
  end if;

  return v_req;
end $$;

revoke execute on function accept_request(uuid) from anon;

-- The student sends an unconfirmed match back: the request re-opens for
-- other teachers and the declined teacher is remembered. Instant requests
-- get a fresh 10-minute search window (their original one was ticking while
-- the student deliberated); scheduled ones keep their slot.
create or replace function decline_match(p_request_id uuid)
returns help_requests
language plpgsql security definer set search_path = public as $$
declare
  v_req help_requests%rowtype;
begin
  update help_requests
     set declined_teacher_ids =
           array_append(declined_teacher_ids, accepted_teacher_id),
         accepted_teacher_id = null,
         accepted_at = null,
         rate_cents_per_hour = null,
         status = 'open',
         starts_at = case when starts_at <= now() then now() else starts_at end,
         expires_at = case when starts_at <= now()
                           then now() + interval '10 minutes'
                           else expires_at end
   where id = p_request_id
     and student_id = auth.uid()
     and status = 'matched'
     and confirmed_at is null
  returning * into v_req;

  if not found then
    raise exception 'match not declinable';
  end if;

  return v_req;
end $$;

revoke execute on function decline_match(uuid) from anon;

-- Only confirmed sessions can complete (and bill).
create or replace function complete_request(p_request_id uuid)
returns help_requests
language plpgsql security definer set search_path = public as $$
declare
  v_req help_requests%rowtype;
begin
  update help_requests
     set status = 'completed',
         ended_at = now(),
         -- must stay in sync with sessionCostCents() in src/lib/constants.ts
         final_cost_cents = round(rate_cents_per_hour * duration_minutes / 60.0)
   where id = p_request_id
     and status = 'matched'
     and confirmed_at is not null
     and now() >= starts_at
     and (student_id = auth.uid() or accepted_teacher_id = auth.uid())
  returning * into v_req;

  if not found then
    raise exception 'request not active or not yours';
  end if;

  return v_req;
end $$;

revoke execute on function complete_request(uuid) from anon;

-- Unconfirmed matches are cancellable at any time (an instant match whose
-- start time has passed would otherwise be stuck); confirmed sessions only
-- before their start, as before.
create or replace function cancel_matched_request(p_request_id uuid)
returns help_requests
language plpgsql security definer set search_path = public as $$
declare
  v_req help_requests%rowtype;
begin
  update help_requests
     set status = 'cancelled',
         ended_at = now()
   where id = p_request_id
     and status = 'matched'
     and (confirmed_at is null or starts_at > now())
     and (student_id = auth.uid() or accepted_teacher_id = auth.uid())
  returning * into v_req;

  if not found then
    raise exception 'request not cancellable';
  end if;

  return v_req;
end $$;

revoke execute on function cancel_matched_request(uuid) from anon;

-- Stats for the student's match card. RLS hides a teacher's other sessions
-- from students, so aggregate them here — only the request's own student may
-- ask, and only about the teacher matched to their request.
create or replace function teacher_match_stats(p_request_id uuid)
returns table (
  sessions_taught bigint,
  subject_sessions bigint,
  avg_rating numeric,
  review_count bigint
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
      where v.teacher_id = r.accepted_teacher_id)
  from help_requests r
  where r.id = p_request_id
    and r.student_id = auth.uid()
    and r.accepted_teacher_id is not null
$$;

revoke execute on function teacher_match_stats(uuid) from anon;
