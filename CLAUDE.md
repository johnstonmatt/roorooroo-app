# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

A full-stack website monitoring application that watches websites for content
changes and sends notifications. Built with Next.js 14 (static export) on the
frontend and Supabase Edge Functions (Deno + `@supabase/server`) for server-side
monitor checks. All database access from the frontend uses the Supabase JS
client with Row Level Security (RLS). Scheduled checks run via `pg_cron` calling
the Edge Function.

**Key constraint**: Users must have a `@supabase.io` email address.

## Common Commands

### Development

```bash
# Run full development environment (frontend + edge functions)
deno task dev

# Run only frontend (Next.js on port 3000)
deno task dev:frontend

# Run only backend (Supabase Edge Functions)
deno task dev:backend
```

### Testing & Quality

```bash
# Run all checks (lint + type checking)
deno task checks

# Check edge functions only
deno task fns:checks

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

# Generate TypeScript types from database schema
deno task db:gen-types

# Reset local database (destructive)
deno task db:unsafe-nuke
```

### Deployment

```bash
# Deploy edge functions to Supabase
deno task fns:deploy
```

## Architecture

### Frontend Architecture

- **Location**: `frontend/`
- **Framework**: Next.js 14 with `output: "export"` for static site generation
- **Styling**: Tailwind CSS v4 with Radix UI primitives
- **Data Access**: All CRUD operations use Supabase client from browser
  (`frontend/lib/supabase/client.ts`)
- **Key Principle**: Never proxy database operations through the Edge Function.
  All reads/writes happen directly from browser with RLS protection.

### Backend Architecture

- **Location**: `supabase/functions/api/`
- **Runtime**: Deno 2
- **Composition**: `withSupabase` from `@supabase/server` (no HTTP framework).
  It supplies CORS, the auth gate, and both Supabase clients, so `index.ts` only
  dispatches on pathname.
- **Purpose**: Server-only tasks (monitor checks, notifications)
- **Key Endpoints**:
  - `POST /functions/v1/api/check-endpoint` - Execute a monitor check
    (`auth: ['user', 'secret']` -- pg_cron presents a secret key, the dashboard
    presents the caller's JWT)
  - `GET /functions/v1/api/openapi.json` - The OpenAPI 3.1 document (public;
    serving it also proves the function is up)

  Each endpoint is its own Edge Function exporting the nested form
  (`export default { fetch: withSupabase(...) }`), so there is no router and no
  path parsing. Shared code lives in `functions/_shared/`.

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
- **Scheduling**: `pg_cron` extension schedules monitor checks by calling the
  Edge Function via HTTP
- **Helpers**: Database functions in `supabase/schemas/public/functions/`
  (`create_monitor_cron_job`, `update_monitor_cron_job`,
  `delete_monitor_cron_job`, etc.) manage cron jobs programmatically

### Notification System

- **Email**: Resend API (requires `RESEND_API_KEY`)
- **SMS**: Twilio API (requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`)
- **Implementation**: `supabase/functions/api/lib/notifications.ts`

## Important Patterns

### Data Flow for Monitor Checks

1. User creates a monitor via frontend (direct Supabase insert)
2. Frontend calls database function `create_monitor_cron_job()` to schedule
   checks
3. `pg_cron` triggers `POST /functions/v1/api/check-endpoint` with `monitor_id`
   and `user_id`
4. Edge Function fetches URL, checks pattern, logs results, sends notifications
5. Frontend polls `monitor_logs` table via Supabase Realtime or manual refresh

### Authentication & Authorization

- **Frontend**: Uses Supabase Auth with email/password
- **Edge Function**: `withSupabase` auth modes. `user` verifies the JWT against
  the local JWKS; `secret` matches an `sb_secret_` key in the `apikey` header;
  `/status` uses `none`. `ctx.authMode` tells the handler which matched -- in
  `user` mode the verified subject replaces any `user_id` in the request body,
  so a caller cannot check someone else's monitor.
- **Database**: RLS policies ensure users only access their own data
- **Routing**: `withOpenAPI` (built with `defineMiddleware`) serves the document
  and rejects any path it does not declare. `document.paths` is the route table,
  so there is no second list to drift from it. Typed with `openapi3-ts`
  (`OpenAPIObject`, type-only import, no cold-start cost). Adding an endpoint
  means declaring it in `_shared/openapi-document.ts`.
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
  reject both `/status` and the cron call. The gate moves into the function, it
  is not removed.

### Pattern Matching Types

Monitor checks support three pattern types (see
`supabase/functions/api/routes/monitor-check.ts:283`):

- `contains`: Case-insensitive substring match
- `not_contains`: Inverse of contains
- `regex`: Regular expression match (case-insensitive)

## File Structure

```
frontend/
  app/              - Next.js App Router pages
  components/ui/    - Radix UI components and custom UI
  lib/supabase/     - Supabase client setup
  hooks/            - React hooks
  next.config.mjs   - Static export configuration

supabase/
  functions/
    deno.json       - import map (Deno workspace member)
    api/index.ts    - the pipeline: openapi -> auth gate -> handler
    _shared/        - withOpenAPI, openapi-document, check logic
    index.ts        - Main entry point
    routes/         - Route handlers
    middleware/     - CORS, auth, error handling
    lib/            - Services (notifications, validation)
  schemas/          - Declarative schema (SOURCE OF TRUTH; edit these)
    public/           - tables/, functions/, schema.sql, default_privileges.sql
    auth/             - user-defined objects on Supabase-managed schemas
    _cluster/         - extensions
  migrations/       - SQL migrations (generated by db:sync; deploy artifact)
  config.toml       - Local Supabase configuration

scripts/
  setup-twilio.sh   - Twilio credential wizard (deno task setup-twilio)
  setup-branching.sh - Supabase branching wizard (deno task setup-branching)

.github/workflows/
  fns-push.yml      - CI/CD for Edge Function deployment
  preview-env.yml   - Comments the preview branch URL + anon key on PRs
```

## Environment Variables

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key for browser client

### Edge Function (Supabase secrets or `supabase/.env.local`)

- `SUPABASE_URL` - Project URL (service-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-only)
- Auth keys (`SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS`,
  `SUPABASE_JWKS`) are auto-provisioned by the platform and the CLI
- `RESEND_API_KEY` - Email notification API key (optional)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS
  notification credentials (optional)
- `FRONTEND_URL` - Local frontend URL for CORS (e.g., `http://localhost:3000`)
- `PRODUCTION_FRONTEND_URL` - Production frontend URL for CORS (e.g.,
  `https://roorooroo.app`)

## Preview Environments

Every PR gets its own **Supabase preview branch**, created by the Supabase
GitHub integration. It is a separate Postgres instance that applies
`supabase/migrations/` and `supabase/seed.sql`, and starts with **no**
production data. It is destroyed when the PR closes.

`.github/workflows/preview-env.yml` posts a sticky PR comment with the branch's
API URL and anon key, so a reviewer can point a local frontend at the PR's own
database without digging through the dashboard.

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

- **Frontend**: Static export can be deployed to Vercel or any static host
- **Edge Functions**: Auto-deployed via GitHub Actions on push to `main` (see
  `.github/workflows/fns-push.yml`)
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

- Users must have `@supabase.io` email
- Content must exist in raw HTML (no client-rendered content)
- Does not respect `robots.txt`
- Monitor checks timeout after 30 seconds (see
  `supabase/functions/api/routes/monitor-check.ts:223`)
