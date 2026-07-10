-- Scheduled sessions: students can book a slot up to 7 days out instead of
-- only "right now". Instant requests keep today's behavior (starts_at
-- defaults to insert time).

alter table help_requests
  add column starts_at timestamptz not null default now();

-- Clients insert starts_at/expires_at directly, so bound them in the DB:
-- bookings at most 7 days out, and a request never stays acceptable more
-- than 15 minutes past its start.
alter table help_requests
  add constraint help_requests_starts_at_bounds
    check (starts_at <= created_at + interval '7 days'),
  add constraint help_requests_expires_at_bounds
    check (expires_at <= greatest(starts_at, created_at) + interval '15 minutes');

-- Completing is only possible once the booked start time has arrived, so a
-- teacher can't accept an evening booking and instantly bill it.
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
     and now() >= starts_at
     and (student_id = auth.uid() or accepted_teacher_id = auth.uid())
  returning * into v_req;

  if not found then
    raise exception 'request not active or not yours';
  end if;

  return v_req;
end $$;

revoke execute on function complete_request(uuid) from anon;

-- Either participant can cancel a booked (matched) session before it starts.
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
     and starts_at > now()
     and (student_id = auth.uid() or accepted_teacher_id = auth.uid())
  returning * into v_req;

  if not found then
    raise exception 'request not cancellable';
  end if;

  return v_req;
end $$;

revoke execute on function cancel_matched_request(uuid) from anon;
