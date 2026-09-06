# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

A full-stack website monitoring application that watches websites for content
changes and sends notifications. Built with Next.js 16 (static export) on the
frontend and a single Supabase Edge Function (Deno + `@supabase/middleware` +
`@supabase/server`) for server-side monitor checks. All database access from the
frontend uses the Supabase JS client with Row Level Security (RLS). Scheduled
checks run via `pg_cron` calling the Edge Function.

**Key constraint**: Sign-up is restricted to `@supabase.io` email addresses --
enforced in the signup form, not in the database. See Known Limitations.

## Common Commands

### Development

```bash
# Run full development environment (frontend + edge functions)
deno task dev

# Run only frontend (Next.js on port 3000)
deno task dev:frontend

# Run only backend (Supabase Edge Functions, reading .env at the repo root)
deno task dev:backend
```

### Testing & Quality

```bash
# Run all checks (fns:checks + frontend:checks)
deno task checks

# Check edge functions only (fmt --check, lint, type check, tests)
deno task fns:checks

# Edge function unit tests only (supplies placeholder TWILIO_* values)
deno task fns:test

# Lint frontend only
deno task frontend:checks

# Build frontend
deno task frontend:build
```

### Database

Schema changes start by editing `supabase/schemas/`, never by writing a
migration by hand and never in Studio or the SQL editor.

```bash
# Generate a migration from your schema edits, then apply it locally
deno task db:sync

# Same, but non-interactive: writes the migration without touching local DB
deno task db:sync:check

# Re-export supabase/schemas/ from the local database (drift recovery)
deno task db:schema:export

# Push database migrations to linked project
deno task db:push

# Generate TypeScript types into supabase/db/database.types.ts
deno task db:gen-types

# Dump the local schema as a single baseline migration
deno task db:baseline

# Reset local database (destructive)
deno task db:unsafe-nuke
```

`db:gen-types` and `db:unsafe-nuke` hard-code this project's ref in `deno.json`.

### Setup wizards

```bash
deno task setup-twilio      # Twilio credentials -> .env / GitHub secrets
deno task setup-branching   # Supabase branching + GitHub integration
deno task setup-vercel      # Vercel <-> Supabase env var sync
```

### Deployment

```bash
# Deploy edge functions to Supabase
deno task fns:deploy
```

## Architecture

### Frontend Architecture

- **Location**: `frontend/`
- **Framework**: Next.js 16 with `output: "export"` for static site generation
- **Styling**: Tailwind CSS v4 with Radix UI primitives
- **Data Access**: All CRUD operations use the Supabase client from the browser
  (`frontend/lib/supabase/client.ts`), a singleton built with
  `createBrowserClient` from `@supabase/ssr` and typed against
  `supabase/db/database.types.ts`
- **Key Principle**: Never proxy database operations through the Edge Function.
  All reads/writes happen directly from browser with RLS protection.
  `frontend/lib/api-client.ts` is the one path to the function, used only for
  the status badge (`GET /openapi.json`) and a user-forced re-check
  (`POST /check-endpoint` with `force: true`).

### Backend Architecture

- **Location**: `supabase/functions/api/` with shared code in
  `supabase/functions/_shared/`
- **Runtime**: Deno 2
- **Composition**: one Edge Function named `api`, exporting the nested form
  (`export default { fetch: pipeline(...) }`). No HTTP framework and no router:
  `pipeline` from `@supabase/middleware` composes three layers around a single
  handler, and `withOpenAPI` does the only path matching there is.
- **Pipeline order** (`api/index.ts`): `withCORS` → `withOpenAPI` →
  `withSupabase` → handler. CORS is outermost so every response carries CORS
  headers, including ones that short-circuit above the auth gate. `withOpenAPI`
  runs before `withSupabase` so the document is public and undeclared paths 404
  before reaching the auth gate.
- **Purpose**: Server-only tasks (monitor checks, notifications)
- **Endpoints**:
  - `POST /functions/v1/api/check-endpoint` - Execute a monitor check
    (`auth: ['user', 'secret']` -- pg_cron presents a secret key, the dashboard
    presents the caller's JWT)
  - `GET /functions/v1/api/openapi.json` - The OpenAPI 3.1 document (public;
    serving it also proves the function is up). There is no `/status` route;
    this replaced it.

### Database Schema

Managed declaratively with **pg-delta**, Supabase's Postgres schema diffing
engine (see
[Declarative schemas](https://supabase.com/blog/declarative-schemas)). Enabled
via `[experimental.pgdelta]` in `supabase/config.toml`, so `supabase db diff`
and `supabase db schema declarative sync` use pg-delta without per-command
flags.

- **Source of truth**: `supabase/schemas/`, organized as
  `<schema>/<object-type>/<name>.sql` (plus `_cluster/extensions/`). File load
  order is resolved by pg-delta and recorded in `schemas/.pgdelta-export.json` —
  do not hand-edit that file. `[db.migrations] schema_paths` stays empty; that
  key drives the older migra-based declarative workflow, not pg-delta.
- **Migrations**: `supabase/migrations/` is now generated output, not something
  you author. It remains the deploy artifact and the history of record.
- **Core tables**: `profiles`, `monitors`, `monitor_logs`, `notifications`
- **Security**: RLS enabled on all tables with user-scoped policies
- **Scheduling**: `pg_cron` schedules a `pg_net` HTTP POST per monitor; the cron
  command resolves URL and headers at run time
- **Helpers**: Database functions in `supabase/schemas/public/functions/`
  (`create_monitor_cron_job`, `update_monitor_cron_job`,
  `delete_monitor_cron_job`, `check_cron_job_exists`, `get_cron_job_info`,
  `list_user_cron_jobs`) manage cron jobs programmatically.
  `_get_cron_auth_headers()` and `get_cron_secret()` are leftovers from the
  previous service-role / `X-Cron-Secret` scheme and are no longer on any live
  path -- `_get_cron_headers()` is.

### Notification System

- **Email**: Resend API (requires `RESEND_API_KEY`)
- **SMS**: Twilio API (requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`)
- **Implementation**: `supabase/functions/_shared/notifications.ts` and
  `supabase/functions/_shared/sms-service.ts`
- **When it fires**: `getNotificationSpec` in `_shared/monitor.ts` returns
  `initial` on the first check (previous status `pending`), `changed` when the
  status differs, `forced` when a user-mode caller passed `force`, and null
  otherwise. Per-channel outcomes come back in the response `channels` array;
  `sendNotifications` never rejects, so only the results say what happened.

## Important Patterns

### Data Flow for Monitor Checks

1. User creates a monitor via frontend (direct Supabase insert)
2. Frontend calls database function `create_monitor_cron_job()` to schedule
   checks
3. `pg_cron` triggers `POST /functions/v1/api/check-endpoint` with `monitor_id`
   and `user_id`
4. Edge Function fetches URL, checks pattern, writes a `monitor_logs` row,
   updates `monitors.last_status`/`last_checked`, and sends notifications
5. Frontend reads `monitors`, `monitor_logs` and `notifications` directly under
   RLS. There are no Realtime subscriptions yet -- the dashboard re-queries on
   navigation and on user action.

### Authentication & Authorization

- **Frontend**: Uses Supabase Auth with email/password
- **Edge Function**: `withSupabase` auth modes. `user` verifies the JWT against
  the local JWKS; `secret` matches an `sb_secret_` key in the `apikey` header.
  `ctx.authMode` tells the handler which matched -- in `user` mode the verified
  subject replaces any `user_id` in the request body, so a caller cannot check
  someone else's monitor. `/openapi.json` never reaches this layer at all,
  because `withOpenAPI` answers it first.
- **Database**: RLS policies ensure users only access their own data
- **CORS**: `withCORS` (built with `defineMiddleware`) is the outermost layer.
  It answers preflights itself and otherwise only _backfills_ headers on the way
  out, so `withSupabase`'s own CORS handling wins where it applies. It exists
  because `withOpenAPI` short-circuits above the auth gate and shipped answering
  200 with no `Access-Control-Allow-Origin`, which made the status badge read
  "Disconnected" on every Vercel preview while the API was healthy. The header
  set is the canonical one from `@supabase/supabase-js/cors` -- a wildcard
  origin. CORS is not the access control here; credentials are.
- **Routing**: `withOpenAPI` (also built with `defineMiddleware`) serves the
  document and rejects any path it does not declare. `document.paths` is the
  route table, so there is no second list to drift from it. Typed with
  `openapi3-ts` (`OpenAPIObject`, type-only import, no cold-start cost). Adding
  an endpoint means declaring it in `_shared/openapi-document.ts`.
- **Client privilege**: the handler picks the client by mode -- `ctx.supabase`
  (RLS-scoped) for a user, `ctx.supabaseAdmin` for cron, which has no
  `auth.uid()` to scope by. So a user's own policies are a backstop and the
  explicit `user_id` filter is defence in depth. Note `ctx.supabase` is
  RLS-restricted in `secret` mode too, despite the docs describing it as full
  access -- cron genuinely needs the admin client.
- **Authorization**: the handler resolves the monitor itself. In `user` mode it
  pins to the verified JWT subject and discards any `user_id` in the body; only
  `secret` mode (pg_cron) may name a user. Kept inline rather than as middleware
  -- there is one monitor-scoped route, so the abstraction had no second
  consumer to justify it.
- **Cron Security**: `_get_cron_headers()` sends only `apikey: <sb_secret_...>`,
  read from Vault (`supabase/secret_key`) with a fallback to
  `app.settings.secret_key`. It deliberately sends no Authorization bearer: a
  credential that is present but invalid is rejected outright rather than
  falling through to a lesser mode.
- **Platform JWT check**: `verify_jwt = false` for `[functions.api]`, because
  the platform gate is equivalent to `auth: 'user'` on every route and would
  reject both `/openapi.json` and the cron call. The gate moves into the
  function, it is not removed.

### Pattern Matching Types

Monitor checks support three pattern types (see `checkPattern` in
`supabase/functions/_shared/monitor.ts`):

- `contains`: Case-insensitive substring match
- `not_contains`: Inverse of contains
- `regex`: Regular expression match (case-insensitive)

A `regex` pattern is screened by `findUnsafeRegexConstruct` before it is
compiled, and rejected if it can backtrack catastrophically -- a quantifier
applied to a group that can match the same input more than one way, such as
`(a+)+$`. A match is synchronous and uninterruptible on the edge worker, so
neither the AbortController nor a timer can stop a runaway one; 47 bytes of
input is enough to wedge the isolate. The screen is a heuristic, not a proof.
The complete fix is a linear-time engine (RE2), which would add a WASM
dependency to the cold-start path and is deliberately deferred.

Regex runs against at most the first 512KB of a page, and any response body is
capped at 5MB.

### Monitor Scheduling

`frontend/lib/monitor-schedule.ts` owns both the pg_cron job name
(`monitor_check_<uuid with underscores>`) and the cron expression. `pg_cron` has
a one-minute floor, and only divisors of 60 tile cleanly across an hour, so an
interval that does not divide evenly falls back to every five minutes rather
than drifting. The job name is the only handle on a scheduled job, so it must
match exactly everywhere.

## File Structure

```
frontend/
  app/              - Next.js App Router pages (auth/, dashboard/)
  components/       - Feature components (monitor-card, status-tag, ...)
  components/ui/    - Radix UI components and custom UI
  lib/supabase/     - Supabase browser client singleton
  lib/api-client.ts - Typed fetch wrapper for the Edge Function
  lib/db.ts         - Row types derived from the generated schema
  lib/monitor-schedule.ts - pg_cron job name + expression helpers
  scripts/          - postinstall asset copy (Twemoji)
  next.config.mjs   - Static export configuration

supabase/
  config.toml       - Local Supabase configuration
  seed.sql          - Applied on db reset and on preview branches
  db/
    database.types.ts    - Generated types (deno task db:gen-types)
  functions/
    deno.json       - import map (Deno workspace member)
    api/index.ts    - the pipeline: cors -> openapi -> auth gate -> handler
    _shared/
      with-cors.ts         - outermost CORS layer
      with-openapi.ts      - route table + document middleware
      openapi-document.ts  - the OpenAPI document (also the route table)
      monitor.ts           - fetch, pattern matching, check logging
      notifications.ts     - email/SMS dispatch and notification logging
      sms-service.ts       - Twilio transport with retry
      config.ts            - required env, frontend URL, logger
      *_test.ts            - unit tests (deno task fns:test)
  schemas/          - Declarative schema (SOURCE OF TRUTH; edit these)
    public/           - tables/, functions/, schema.sql, default_privileges.sql
    auth/             - user-defined objects on Supabase-managed schemas
    _cluster/         - extensions
  migrations/       - SQL migrations (generated by db:sync; deploy artifact)

scripts/
  setup-twilio.sh   - Twilio credential wizard (deno task setup-twilio)
  setup-branching.sh - Supabase branching wizard (deno task setup-branching)
  setup-vercel-integration.sh - Vercel env sync wizard (deno task setup-vercel)

docs/img/           - README assets
llms.txt            - Machine-readable repo map (STALE; see Known Limitations)

.github/workflows/
  fns-push.yml      - CI/CD for Edge Function deployment
  preview-env.yml   - Seeds preview-branch secrets, comments URL + anon key
```

## Environment Variables

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous/publishable key for browser client
- `NEXT_PUBLIC_API_BASE_URL` - optional escape hatch. Defaults to
  `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api`, deliberately derived rather
  than configured separately: the function verifies the browser's JWT against
  its own project's JWKS, so auth and the function must be the same project
- `NEXT_PUBLIC_ALLOWED_SIGNUP_DOMAIN` - optional, defaults to `@supabase.io`
- `NEXT_PUBLIC_ALLOWED_SIGNUP_EMAILS` - optional comma-separated exceptions

### Edge Function (Supabase project secrets, or `.env` at the repo root)

`deno task dev:backend` runs `supabase functions serve --env-file .env`, so the
local file is `.env` in the repo root -- not `supabase/.env.local`.

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` -
  **required**. `_shared/config.ts` reads them at module load, so the function
  will not boot without all three -- including `/openapi.json`. This is
  deliberate fail-fast: a deployment missing SMS credentials is misconfigured,
  and finding out at the first alert is worse than finding out at deploy.
  `deno task fns:test` supplies placeholders.
- `RESEND_API_KEY` - Email notification API key (optional; email sends fail
  cleanly and are reported per channel when it is absent)
- `NOTIFICATION_FROM_EMAIL` - From address for alert email (optional, defaults
  to `notifications@roorooroo.com`)
- `TWILIO_WEBHOOK_URL` - Twilio StatusCallback URL (optional)
- `PRODUCTION_FRONTEND_URL` / `FRONTEND_URL` - base origin for links inside
  notifications, preferring the production one and falling back to
  `https://roorooroo.com`. Despite the names, neither configures CORS -- CORS
  uses the wildcard header set from `@supabase/supabase-js/cors`.
- `LOG_LEVEL` - `debug` | `info` | `warn` | `error` (optional, defaults `info`)
- `CURRENT_SHA` - set by CI; its short form becomes `info.version` in the
  OpenAPI document, which the dashboard status badge renders
- `APP_ENVIRONMENT` - set to `preview` by `preview-env.yml`. Without it the
  environment falls back to `DENO_DEPLOYMENT_ID`, which is set on _any_ deployed
  function, so every preview would label itself "production"
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the newer key material
  (`SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_JWKS`) are
  auto-provisioned by the platform and the CLI. `withSupabase` reads them to
  build `ctx.supabase` and `ctx.supabaseAdmin`; do not set them by hand.

### Database settings (not environment variables)

- `supabase/secret_key` in Vault - the `sb_secret_...` key `_get_cron_headers()`
  sends, with `app.settings.secret_key` as the fallback
- `app.settings.api_base_url` - base for `_get_monitor_check_url()`; falls back
  to a hard-coded project URL when unset

## Preview Environments

Every PR gets its own **Supabase preview branch**, created by the Supabase
GitHub integration. It is a separate Postgres instance that applies
`supabase/migrations/` and `supabase/seed.sql`, and starts with **no**
production data. It is destroyed when the PR closes.

`.github/workflows/preview-env.yml` does two things. It seeds the branch's Edge
Function secrets -- preview branches inherit none from production, and without
the three `TWILIO_*` values the function serves 500 WORKER_ERROR on every route,
including the public `/openapi.json` the status badge polls. Then it posts a
sticky PR comment with the branch's API URL and anon key, so a reviewer can
point a local frontend at the PR's own database without digging through the
dashboard.

First-time setup is dashboard work — run `deno task setup-branching`, which
walks through the GitHub integration and enabling branching, then verifies the
result.

**This repo is public.** `preview-env.yml` triggers on `pull_request` (not
`pull_request_target`) and skips PRs from forks, because fork PRs get no secrets
and Supabase does not create preview branches for them. Only the API URL and the
publishable anon key are ever written to a comment — never a Postgres connection
string.

**Preview branches are billable** at the same hourly rate as a project, for as
long as the PR stays open.

**Browser IDEs (StackBlitz pr.new and similar) are not used here.** They run
Node in a WebContainer, which cannot run Deno, Docker, or the local Supabase
stack, so only `frontend/` would boot — and the repo root is `deno.json`, not a
`package.json`, so nothing would start at all.

## Deployment Notes

- **Frontend**: Static export can be deployed to Vercel or any static host.
  `deno task setup-vercel` wires Vercel's env vars to the Supabase integration
  so preview deployments point at the right project.
- **Edge Functions**: Auto-deployed via GitHub Actions on push to `main` (see
  `.github/workflows/fns-push.yml`). The workflow runs `deno task fns:checks`
  and sets `CURRENT_SHA` before deploying. The deploy step carries a
  `# this is broken` comment -- verify it before relying on it.
- **Database**: On merge to `main`, the Supabase GitHub integration applies
  `supabase/migrations/` to production. `supabase db push` remains available for
  manual deploys.
- **Secrets**: Store via Supabase Vault or project secrets dashboard

## Known Limitations

### Not managed by the declarative schema

pg-delta diffs schema, not data or platform state. These still need a
hand-written migration in `supabase/migrations/`, and will never appear in a
generated diff:

- **DML**: `INSERT`/`UPDATE`/`DELETE`, including seed and backfill data
- **`pg_cron` job rows**: scheduled jobs are rows in `cron.job`, created at
  runtime by `create_monitor_cron_job()`. The functions are managed; the jobs
  they schedule are not.
- **Vault secrets**: `supabase/secret_key` is data in `vault.secrets`. The
  `supabase_vault` extension is installed but filtered from the export as
  platform-managed, which is why it has no file under
  `schemas/_cluster/extensions/`.
- **Supabase-managed internals** of the `auth` and `storage` schemas.
  `schemas/auth/tables/users.sql` holds only our own `on_auth_user_created`
  trigger, not the `auth.users` table itself.

pg-delta is in public alpha. Review every generated migration before pushing,
especially anything destructive.

### Application

- Sign-up is restricted to `@supabase.io` addresses by the signup form only
  (`frontend/app/auth/signup/page.tsx`, configurable via
  `NEXT_PUBLIC_ALLOWED_SIGNUP_DOMAIN` / `NEXT_PUBLIC_ALLOWED_SIGNUP_EMAILS`).
  Nothing in Postgres or Supabase Auth enforces it.
- Content must exist in raw HTML (no client-rendered content)
- Does not respect `robots.txt`
- Monitor checks timeout after 30 seconds, covering the body read as well as the
  connection (see `FETCH_TIMEOUT_MS` in `supabase/functions/_shared/monitor.ts`)
- Regex patterns that can backtrack catastrophically are rejected rather than
  run; see Pattern Matching Types
- No Realtime subscriptions; the dashboard re-queries instead

### Stale artifacts

These describe an older architecture (Hono router,
`routes/`/`middleware/`/`lib/` directories, `X-Cron-Secret`, `GET /status`) and
have not been updated. Do not treat them as a source of truth, and prefer fixing
them over citing them:

- `llms.txt`
- `frontend/README.md`
- the `/api/status` reference in the `[functions.api]` comment in
  `supabase/config.toml`
- the `withAPIStatusEndpoint` reference in
  `supabase/schemas/public/functions/_get_monitor_check_url.sql`
