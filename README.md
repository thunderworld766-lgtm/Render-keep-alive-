# RenderKeep

Keep Your Websites Alive. RenderKeep is a responsive uptime dashboard backed by Supabase. Supabase Edge Functions perform checks and store status, response time, and history; Supabase Cron runs the monitor every five minutes, independently of the dashboard or your phone.

## Supabase setup

1. In the Supabase SQL Editor for your project, run `supabase/migrations/20261026000000_initial_schema.sql`.
2. Deploy the `api` and `monitor` Edge Functions from `supabase/functions`. Set these **Edge Function secrets** in Supabase (never put them in frontend or Render environment variables):

   - `SUPABASE_URL` — your Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — the project service-role secret key. Never expose this key in a browser.
   - `ADMIN_TOKEN` — a long, randomly generated dashboard access token. This is the current single-admin access gate.
   - `MONITOR_CRON_SECRET` — a separate long, randomly generated secret used only by the scheduled monitor.

   For the Supabase CLI, link the project and run `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_TOKEN=... MONITOR_CRON_SECRET=...`, then deploy with `supabase functions deploy api --no-verify-jwt` and `supabase functions deploy monitor --no-verify-jwt`. Run these commands in a trusted terminal; do not commit actual values.
3. In Supabase Dashboard → **Project Settings → Vault**, save two secrets with these exact names:

   - `renderkeep_supabase_url` — the project URL.
   - `renderkeep_monitor_cron_secret` — the same value as `MONITOR_CRON_SECRET`.

4. Run `supabase/schedule_monitoring.sql` in the SQL Editor. This creates a five-minute Supabase Cron job; it does not depend on Render staying awake.
5. Verify the job in **Integrations → Cron**. You can also run the monitor function manually from the Supabase Edge Functions page, including the `x-cron-secret` header, to test a monitoring cycle.

The public/publishable Supabase key is safe to include in frontend configuration. The service-role key, admin token, cron secret, and database password are not. The direct database connection string provided in the project brief contains a password placeholder and is not needed by this application.

## Run locally

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Run `npm install`, then `npm run dev`.
3. Enter the `ADMIN_TOKEN` value configured in Supabase to open the dashboard.

## Deploy the frontend

Connect this repository to Render as a **Static Site** using the included `render.yaml`, or use these settings:

- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

The Supabase project is the backend and scheduler; the frontend is a static site. Render's sleep behavior therefore cannot pause the five-minute monitor. Checks do not follow HTTP redirects, avoiding redirect-based requests to internal addresses. Private, local, and reserved IP address literals are rejected.

## Security and future authentication

The database has row-level security enabled and no public table policies. All database access uses the service-role key inside Edge Functions only; dashboard requests require the separate admin token. The token is stored in session storage and clears when the browser session ends. Replace this single-admin gate with Supabase Auth and user-scoped RLS before supporting multiple accounts.
