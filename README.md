# RooRooRoo App

A full-stack application composed of a static-exported Next.js 14 frontend and a
Supabase-backed API built as Deno Edge Functions using Hono. It provides website
“watchers” (monitors) that check a URL for a pattern and notify users via email
or SMS when content appears, disappears, or errors.

- Frontend: Next.js 14 + React 18 + Tailwind CSS v4, Radix UI primitives,
  TypeScript
- Backend/API: Supabase Edge Functions (Deno v2) using Hono
- Database/Auth/Storage: Supabase (Postgres + RLS, Auth, Storage, Realtime)
- Notifications: Email (Resend) and SMS (Twilio)
- Scheduling: pg_cron via RPC helpers to trigger monitor checks
- CI/CD: GitHub Actions for function deploys and DB ops

## Motivation

This project has 2 motivations:

1. Build something with as many Supabase features as I can for my onboarding
   "dogfooding" project at Supabase.
2. Create a tool which can watch websites for changes so people don't need to
   waste time refreshing websites by hand.

## Limitations

- Users must have a `@supabase.io` email address
- Content must exist before "hydration" in pure HTML
- Does not adhere to `robots.txt`

## Future Releases

- Support for browser automation for flexibilty and reliability
- LLM integration for natural language watcher specifications
- Caching and Performance optimization

## Why `/functions/v1/api` ?

This repo deliberately uses an Edge Function for an API rather than a typical
Supabase architecture that avoids an API all together. This is mostly because
I'm on the Edge Functions team and wanted to see how far I could take it, but
there are benefits, like the portability not relying on any frontend cloud APIs
and shipping purely static assets to the browser.

## Repository structure

- frontend/
  - Next.js app (App Router) with UI primitives in components/ui and Supabase
    helpers in lib/supabase
  - next.config.mjs sets output: "export" for static export with trailing
    slashes
  - package.json scripts: dev, build, start, lint
- supabase/
  - config.toml: local dev ports/services for Supabase stack
  - migrations/: SQL migrations for tables, policies, and cron RPC helpers
  - functions/api/: Hono app with routes, middleware, and libs
    - routes: auth, monitors, monitor-check, notifications, webhooks (Twilio)
    - middleware: auth (Supabase JWT), cors, cron, error handling
    - lib: config, supabase client, cron helpers, notifications (Resend +
      Twilio)
    - index.ts: registers routes under basePath /api and serves via Deno.serve
- .github/workflows/
  - fns-push.yml: deploys Supabase functions on pushes to main (uses Deno +
    supabase CLI)
  - db-push.yml: example workflow to apply SQL files on tag push (expects
    scripts/*.sql)

## High-level architecture

Frontend (static)

- Next.js 14 outputs a static site (output: export) served by any static host
- Auth and data via Supabase client-side SDK
- Calls API endpoints hosted as a single Supabase Edge Function named `api`

API (Supabase Edge Functions / Deno + Hono)

- Base path: /api
- Public endpoints: health, status, auth (login, signup, logout), webhooks
  (Twilio)
- Authenticated endpoints: monitors (CRUD), notifications (listing)
- Cron-protected endpoint: /api/monitors/check — invoked by pg_cron to run
  checks
- CORS: allows requests from FRONTEND_URL and PRODUCTION_FRONTEND_URL (and
  optional extras)

Database (Supabase Postgres)

- Tables: profiles, monitors, monitor_logs, notifications
- Row Level Security (RLS) policies enforce per-user access
- pg_cron and helper RPC functions schedule monitor checks that POST back to the
  API (see migrations)

Notifications

- Email via Resend (RESEND_API_KEY)
- SMS via Twilio (ACCOUNT_SID, AUTH_TOKEN, PHONE_NUMBER); optional webhook for
  delivery status

## API overview

Function name: `api` (served under /functions/v1/api on Supabase)

Base: /api

Public

- GET /api/health — health check
- GET /api/status — service metadata and known routes
- GET /api/meta — simple metadata endpoint
- POST /api/auth/login — email/password login against Supabase Auth, returns
  access/refresh tokens
- POST /api/auth/signup — email/password signup; sends confirmation email
- POST /api/auth/logout — acknowledge logout (client clears session)
- GET/POST /api/webhooks/sms-status — Twilio webhook for delivery receipts
  (signature validation)

Cron-only

- POST /api/monitors/check — executes a check for a given monitor_id + user_id
  - Auth via X-Cron-Secret or service role credentials (see middleware/cron.ts)

Authenticated (Authorization: Bearer <Supabase user JWT>)

- GET /api/monitors — list monitors for current user
- POST /api/monitors — create a monitor; also attempts to schedule a cron job
- PUT /api/monitors/:id — update a monitor (only owned by user)
- GET /api/notifications — list notifications with optional query params (since,
  limit)

Note: When deployed on Supabase, the full path is:

- https://<project-ref>.supabase.co/functions/v1/api/health (etc.)

## Environment variables

Frontend (frontend/.env.local)

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- Optional: VERCEL_ANALYTICS_ID

Edge Functions / API (set in Supabase project or local env for serve)

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- FRONTEND_URL (e.g., http://localhost:3000)
- PRODUCTION_FRONTEND_URL (e.g., https://roorooroo.app)
- LOG_LEVEL (debug|info|warn|error; default info)
- CRON_SECRET (shared secret for cron-only routes)
- Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
  TWILIO_WEBHOOK_URL (optional)
- Resend: RESEND_API_KEY (optional; enables email notifications)

Supabase Auth (config.toml references)

- JWT_SECRET (used by Supabase Auth for JWT signing; set via Supabase)

GitHub Actions (secrets)

- SUPABASE_PROJECT_ID, SUPABASE_ACCESS_TOKEN, JWT_SECRET
- DATABASE_URL (for db-push workflow)

## Database and migrations

- Migrations live in supabase/migrations and are applied via the Supabase CLI
- Core tables: profiles, monitors, monitor_logs, notifications (with RLS
  policies)
- Cron helpers (create/update/delete/check/list/get) live in
  20240101000004_create_cron_functions.sql
- The db-push workflow in .github/workflows expects scripts/*.sql; prefer the
  migrations folder instead, or update the workflow to use Supabase CLI
  migrations

## Frontend notes

- Next.js output is set to static export (next.config.mjs): output: "export",
  trailingSlash: true, images: unoptimized
- UI components are based on Radix primitives (components/ui)
- Supabase client helpers under frontend/lib/supabase for browser, server, and
  middleware
- Typical scripts:
  - pnpm dev — dev server
  - pnpm build — production build
  - pnpm start — start prod server (not used for static export)
  - pnpm lint — Next/ESLint

## Deployment

- Functions: deployed via .github/workflows/fns-push.yml using Deno and
  supabase/setup-cli
  - Requires SUPABASE_PROJECT_ID and SUPABASE_ACCESS_TOKEN
- Database: managed via supabase/migrations; you can integrate Supabase CLI in
  CI
- Frontend: static export can be hosted on Vercel or any static host

## Security

- Authenticated routes require Authorization: Bearer <Supabase user JWT>
- Cron endpoints accept either X-Cron-Secret or Supabase service-role
  credentials
- CORS configured to allow only configured frontend origins; set FRONTEND_URL
  and PRODUCTION_FRONTEND_URL
- Secrets should be managed via Supabase project secrets, GitHub Actions
  secrets, or local .env files that are not committed

## Roadmap

- The fns-push workflow comments indicate parts may be WIP; validate before
  relying on it for production
- If you plan to manage DB changes via CI, align workflows to
  supabase/migrations instead of scripts/

## License

MIT (unless otherwise specified).
