-- LearnTap MVP schema: profiles, help_requests, reviews + RLS + matching RPCs.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  full_name text not null default '',
  languages text[] not null default '{}',
  subjects text[] not null default '{}',          -- teachers only
  hourly_rate_cents int not null default 2000
    check (hourly_rate_cents between 100 and 50000), -- $1–$500/hr; mirrors the rate input bounds
  is_online boolean not null default false,       -- teacher availability toggle
  is_verified boolean not null default false,     -- admin flips via SQL
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by authenticated users"
  on profiles for select to authenticated using (true);

create policy "users insert their own profile"
  on profiles for insert to authenticated with check (auth.uid() = id);

create policy "users update their own profile"
  on profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Column-level grants: users may edit their display/preference fields but
-- never role or is_verified — those would let a student self-elevate to
-- teacher or forge the Verified badge. Admin changes go through the
-- service role / SQL editor, and security-definer RPCs are unaffected.
revoke update on profiles from authenticated, anon;
grant update (full_name, languages, subjects, hourly_rate_cents, is_online)
  on profiles to authenticated;

-- ---------------------------------------------------------------------------
-- help_requests (sessions are folded in: 1 request = 1 session)
-- ---------------------------------------------------------------------------
create table help_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  subject text not null,
  topic text not null,
  duration_minutes int not null check (duration_minutes in (15, 30, 45, 60)),
  language text not null,
  status text not null default 'open'
    check (status in ('open', 'matched', 'completed', 'cancelled', 'expired')),
  accepted_teacher_id uuid references profiles(id),
  accepted_at timestamptz,
  daily_room_name text,
  daily_room_url text,
  started_at timestamptz,
  ended_at timestamptz,
  rate_cents_per_hour int,   -- snapshot of teacher rate at accept
  final_cost_cents int,      -- set at completion
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index on help_requests (status, expires_at);
create index on help_requests (student_id);
create index on help_requests (accepted_teacher_id);

alter table help_requests enable row level security;
alter table help_requests replica identity full;

create policy "participants and teachers see relevant requests"
  on help_requests for select to authenticated using (
    student_id = auth.uid()
    or accepted_teacher_id = auth.uid()
    or (
      status = 'open'
      and exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.role = 'teacher'
      )
    )
  );

create policy "students create their own requests"
  on help_requests for insert to authenticated with check (
    student_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );

-- Students may only cancel while open; all other mutations go through
-- security-definer RPCs or the service role. WITH CHECK forces the new row
-- to 'cancelled' (not merely still-open), and the column grant below stops
-- clients from rewriting topic/duration/expires_at on a live request.
create policy "students cancel their open requests"
  on help_requests for update to authenticated
  using (student_id = auth.uid() and status = 'open')
  with check (student_id = auth.uid() and status = 'cancelled');

revoke update on help_requests from authenticated, anon;
grant update (status) on help_requests to authenticated;

-- Realtime: teacher feed + student redirect both subscribe to this table.
alter publication supabase_realtime add table help_requests;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references help_requests(id),
  student_id uuid not null references profiles(id),
  teacher_id uuid not null references profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index on reviews (teacher_id);

alter table reviews enable row level security;

create policy "reviews are readable by authenticated users"
  on reviews for select to authenticated using (true);

create policy "students review their own completed sessions"
  on reviews for insert to authenticated with check (
    student_id = auth.uid()
    and exists (
      select 1 from help_requests r
      where r.id = request_id
        and r.student_id = auth.uid()
        and r.accepted_teacher_id = teacher_id
        and r.status = 'completed'
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Atomic claim: the conditional UPDATE guarantees exactly one of two racing
-- teachers wins; the loser gets a clean exception.
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
  returning * into v_req;

  if not found then
    raise exception 'request no longer available';
  end if;

  return v_req;
end $$;

revoke execute on function accept_request(uuid) from anon;

-- Either participant ends the session; cost is the full booked duration.
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
     and (student_id = auth.uid() or accepted_teacher_id = auth.uid())
  returning * into v_req;

  if not found then
    raise exception 'request not active or not yours';
  end if;

  return v_req;
end $$;

revoke execute on function complete_request(uuid) from anon;
