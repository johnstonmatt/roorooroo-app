# Supabase Edge Function: `api`

This repository uses a minimal Edge Functions surface. All app database access
happens directly from the frontend using the Supabase JavaScript client under
Row Level Security (RLS). Edge Functions are only used when the Supabase client
is not viable (e.g., scheduled tasks, service-role operations, or integrations
requiring server-only secrets).

Do not add general CRUD routes here. If you can do it with the Supabase client,
do it there instead.

## Endpoints

- POST `/functions/v1/api/check-endpoint`
  - Purpose: Execute monitor checks (fetch/parse target pages, emit
    notifications).
  - Invocation: Triggered by `pg_cron` via HTTP.
  - Auth: Cron-only. Provide `X-Cron-Secret` or call with Supabase service-role
    credentials.
  - Notes: Not intended for browser use.

- GET `/functions/v1/api/status`
  - Purpose: Lightweight status/health/metadata endpoint.
  - Auth: Typically public/read-only; ensure no secrets or sensitive data are
    returned.
  - Notes: Not for database CRUD.

## Local development

- Check endpoint: `http://127.0.0.1:54321/functions/v1/api/check-endpoint`
- Status endpoint: `http://127.0.0.1:54321/functions/v1/api/status`

## Production

- Check endpoint:
  `https://<project-ref>.supabase.co/functions/v1/api/check-endpoint`
- Status endpoint: `https://<project-ref>.supabase.co/functions/v1/api/status`

## Security

- Keep the server surface minimal; prefer RLS and the Supabase client in the
  app.
- For cron invocations, validate a shared secret header (e.g., `X-Cron-Secret`)
  or use the service role key on the caller side.
- Configure CORS to allow only the frontend origin if the function returns
  browser-accessible responses.
- Store secrets in Supabase project secrets, CI secrets, or local `.env` files;
  never commit secrets.

## When to add another function

Only add a new function when the Supabase client cannot be used safely or
feasibly, for example:

- Scheduled jobs (`pg_cron`) that need to run with elevated privileges
- Third-party webhook handlers (e.g., Twilio status callbacks) that require
  server-side validation
- Outbound requests that must use server-only secrets or network access

Otherwise, implement features using the Supabase client in the frontend.
