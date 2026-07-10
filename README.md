# LearnTap

LearnTap is an on-demand marketplace connecting students with verified teachers for live, one-on-one sessions.

A student describes what they're stuck on ("Explain integration by parts", 30 min, English). Online teachers see the request instantly, accept with one tap, and a live video session with screen share starts immediately.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind) — deployable to Vercel
- **Supabase** — auth, Postgres, row-level security, realtime matching
- **Daily.co** — in-browser video, screen share, and chat

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Authentication → Sign In / Providers → Email**, turn **off** "Confirm email" (so test signups are instant).
3. Apply the schema — either:
   - paste `supabase/migrations/0001_init.sql` into the SQL Editor and run it, or
   - use the CLI: `npx supabase link --project-ref <your-ref>` then `npx supabase db push`.
4. Copy the project URL, anon key, and service-role key from **Settings → API**.

### 2. Daily.co

1. Create a free account at [daily.co](https://dashboard.daily.co).
2. Copy your API key from **Developers**.

### 3. Environment

```bash
cp .env.example .env.local
# fill in the four values
```

### 4. Run

```bash
npm install
npm run dev
```

## Trying it end-to-end

1. Open http://localhost:3000 in two browser profiles (two profiles so both tabs can use the webcam).
2. Profile 1: sign up as a **student**. Profile 2: sign up as a **teacher** (pick subjects + languages), then toggle **online**.
3. As the student, post a request in one of the teacher's subjects.
4. The request appears on the teacher dashboard within ~1s — hit **Accept**.
5. Both sides land in a live video session. End it from either side; the student rates the teacher.

To mark a teacher as verified (shows a ✓ badge): `update profiles set is_verified = true where id = '<teacher-uuid>';` in the SQL editor.

## Deploying

Push to Vercel and set the four env vars from `.env.example`. Supabase and Daily free tiers both work from the deployed URL with no extra config.
