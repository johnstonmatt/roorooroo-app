# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

A full-stack website monitoring application that watches websites for content
changes and sends notifications. Built with Next.js 14 (static export) on the
frontend and Supabase Edge Functions (Deno + Hono) for server-side monitor
checks. All database access from the frontend uses the Supabase JS client with
Row Level Security (RLS). Scheduled checks run via `pg_cron` calling the Edge
Function.

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
- **Framework**: Hono v4 for HTTP routing
- **Purpose**: Server-only tasks (monitor checks, notifications)
- **Key Endpoints**:
  - `POST /functions/v1/api/check-endpoint` - Execute a monitor check
    (cron-only, authenticated via `X-Cron-Secret` header or service role)
  - `GET /functions/v1/api/status` - Health check endpoint (public)

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
- **Edge Function**: Authenticated via `X-Cron-Secret` header (for cron) or
  service role key
- **Database**: RLS policies ensure users only access their own data
- **Cron Security**: Uses Vault-stored secrets (`cron/secret`,
  `supabase/anon_key`) with fallback to DB settings

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
  functions/api/    - Edge Function (Hono app)
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

.github/workflows/
  fns-push.yml      - CI/CD for Edge Function deployment
```

## Environment Variables

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key for browser client

### Edge Function (Supabase secrets or `supabase/.env.local`)

- `SUPABASE_URL` - Project URL (service-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-only)
- `CRON_SECRET` - Shared secret for cron authentication
- `RESEND_API_KEY` - Email notification API key (optional)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS
  notification credentials (optional)
- `FRONTEND_URL` - Local frontend URL for CORS (e.g., `http://localhost:3000`)
- `PRODUCTION_FRONTEND_URL` - Production frontend URL for CORS (e.g.,
  `https://roorooroo.app`)

## Deployment Notes

- **Frontend**: Static export can be deployed to Vercel or any static host
- **Edge Functions**: Auto-deployed via GitHub Actions on push to `main` (see
  `.github/workflows/fns-push.yml`)
- **Database**: Migrations applied via `supabase db push` or CLI commands
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
- **Vault secrets**: `cron/secret` and `supabase/anon_key` are data in
  `vault.secrets`. The `supabase_vault` extension is installed but filtered from
  the export as platform-managed, which is why it has no file under
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
