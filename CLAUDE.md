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

```bash
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

- **Core tables**: `profiles`, `monitors`, `monitor_logs`, `notifications`
- **Security**: RLS enabled on all tables with user-scoped policies
- **Scheduling**: `pg_cron` extension schedules monitor checks by calling the
  Edge Function via HTTP
- **Helpers**: Database functions in
  `supabase/migrations/20240101000004_create_cron_functions.sql` manage cron
  jobs programmatically

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
  migrations/       - SQL migrations (ordered by timestamp)
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

- Users must have `@supabase.io` email
- Content must exist in raw HTML (no client-rendered content)
- Does not respect `robots.txt`
- Monitor checks timeout after 30 seconds (see
  `supabase/functions/api/routes/monitor-check.ts:223`)
