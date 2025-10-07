[roorooroo.com](https://roorooroo.com)

[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3FCF8E?logo=supabase)](https://supabase.com/)
[![Deno](https://img.shields.io/badge/Deno-2-black?logo=deno)](https://deno.com/)
[![Hono](https://img.shields.io/badge/Hono-4-FF7E33)](https://hono.dev/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

A full‑stack application composed of a static‑exported
[Next.js 14](https://nextjs.org/) frontend and a Supabase‑backed API built as
[Deno](https://deno.com/) Edge Functions using [Hono](https://hono.dev/). It
provides website “watchers” (monitors) that check a URL for a pattern and notify
users via email or SMS when content appears, disappears, or errors.

- Frontend: Next.js 14 + React 18 +
  [Tailwind CSS v4](https://tailwindcss.com/) +
  [Radix UI](https://www.radix-ui.com/) primitives, TypeScript
- Backend/API: Supabase Edge Functions (Deno v2) using Hono
- Database/Auth/Storage: [Supabase](https://supabase.com/) (Postgres + RLS,
  Auth, Storage, Realtime)
- Notifications: Email ([Resend](https://resend.com/)) and SMS
  ([Twilio](https://www.twilio.com/))
- Scheduling: [pg_cron](https://github.com/citusdata/pg_cron) via RPC helpers
- CI/CD: [GitHub Actions](https://github.com/features/actions) for function
  deploys and DB ops

> Tip: Quick links — [frontend/](frontend/) •
> [functions/api](supabase/functions/api/) • [migrations](supabase/migrations/)
> • [workflows](.github/workflows/)

---

## Table of contents

- [Motivation](#motivation)
- [Limitations](#limitations)
- [Future Releases](#future-releases)
- [Why `/functions/v1/api` ?](#why-functionsv1api-)
- [Repository structure](#repository-structure)
- [Architecture](#architecture)
- [API](#api)
- [Environment variables](#environment-variables)
- [Database and migrations](#database-and-migrations)
- [Frontend notes](#frontend-notes)
- [Deployment](#deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [License](#license)

## Motivation

This project has two motivations:

1. Build something with as many [Supabase](https://supabase.com/) features as
   possible for my onboarding “dogfooding” project at Supabase.
2. Create a tool that can watch websites for changes so people don’t need to
   waste time refreshing websites by hand.

## Limitations

- Users must have a `@supabase.io` email address
- Content must exist pre‑hydration in the raw HTML (no client‑only content)
- Does not adhere to
  [`robots.txt`](https://developers.google.com/search/docs/crawling-indexing/robots/intro)

## Future Releases

- Support for Supabase Realtime
- Support for browser automation (flexibility and reliability)
- LLM integration for natural language watcher specifications
- Caching and performance optimizations

## Why `/functions/v1/api` ?

This repo deliberately uses an Edge Function for an API rather than a typical
Supabase architecture that avoids an API altogether. This is mostly because I’m
on the Edge Functions team and wanted to see how far I could take it, but there
are benefits, like portability (not relying on frontend cloud APIs) and shipping
purely static assets to the browser.

## Repository structure

```text
frontend/
  app/
  components/ui/
  lib/supabase/
  next.config.mjs
  package.json
supabase/
  config.toml
  functions/api/
    index.ts
    routes/
    middleware/
    lib/
  migrations/
.github/
  workflows/
```

- Frontend: Next.js app with UI primitives in
  [`components/ui`](frontend/components/ui/) and Supabase helpers in
  [`lib/supabase`](frontend/lib/supabase/). See
  [`next.config.mjs`](frontend/next.config.mjs).
- Supabase: Local config [`config.toml`](supabase/config.toml), SQL migrations
  in [`migrations/`](supabase/migrations/), and Edge Function in
  [`functions/api`](supabase/functions/api/).
- Workflows: GitHub Actions under [`.github/workflows/`](.github/workflows/).

## Architecture

```mermaid
flowchart TD
  A[Browser (Next.js static site)] -- Supabase JS --> B[Supabase (Auth, Postgres, Storage, Realtime)]
  A -- HTTP --> C[Edge Function: api (Hono)]
  B <--> C
  subgraph Cron
    direction LR
    D[pg_cron] -- HTTP POST /api/monitors/check --> C
  end
  C -- Resend --> E[Email]
  C -- Twilio SMS --> F[SMS]
  F -- Webhook /api/webhooks/sms-status --> C
```

- Frontend (static): Next.js 14 outputs a static site (`output: "export"`)
  served by any static host. Auth/data via Supabase client SDK.
- API: Single Supabase Edge Function named `api` exposing routes under `/api`
  using Hono.
- DB: RLS‑secured Postgres tables. `pg_cron` triggers monitor checks via HTTP
  back to the `api` function.
- Notifications: Email (Resend) and SMS (Twilio) with delivery status webhook.

## API

Function name: `api` (served under `/functions/v1/api` on Supabase)

| Method | Path                       | Auth                             | Notes                                     |
| -----: | -------------------------- | -------------------------------- | ----------------------------------------- |
|    GET | `/api/health`              | Public                           | Health check                              |
|    GET | `/api/status`              | Public                           | Service metadata and endpoints            |
|    GET | `/api/meta`                | Public                           | Simple metadata                           |
|   POST | `/api/auth/login`          | Public                           | Email/password login → returns tokens     |
|   POST | `/api/auth/signup`         | Public                           | Email/password signup; sends confirmation |
|   POST | `/api/auth/logout`         | Public                           | Acknowledge logout                        |
|    GET | `/api/webhooks/sms-status` | Public                           | Twilio webhook verification/health        |
|   POST | `/api/webhooks/sms-status` | Public + signature validation    | Twilio status callbacks                   |
|   POST | `/api/monitors/check`      | Cron only (X‑Cron‑Secret or SRK) | Invoked by cron; executes a check         |
|    GET | `/api/monitors`            | Bearer user JWT                  | List monitors                             |
|   POST | `/api/monitors`            | Bearer user JWT                  | Create monitor (+ schedule cron)          |
|    PUT | `/api/monitors/:id`        | Bearer user JWT                  | Update monitor                            |
|    GET | `/api/notifications`       | Bearer user JWT                  | List notifications (`since`, `limit`)     |

> Cron auth: see
> [`middleware/cron.ts`](supabase/functions/api/middleware/cron.ts). Accepts
> `X-Cron-Secret` or Supabase service‑role credentials.

## Environment variables

Frontend (`frontend/.env.local`)

| Name                            | Required | Example                   | Notes                |
| ------------------------------- | -------- | ------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | `https://xyz.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | `eyJhbGciOi...`           | Anonymous key        |
| `VERCEL_ANALYTICS_ID`           | No       | `abc123`                  | Optional             |

Edge Functions / API (Supabase project secrets or local `.env`)

| Name                        | Required    | Notes                                  |
| --------------------------- | ----------- | -------------------------------------- |
| `SUPABASE_URL`              | Yes         | Project URL used by server SDK         |
| `SUPABASE_ANON_KEY`         | Yes         | Anon key                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes         | Service role key (server‑side only)    |
| `FRONTEND_URL`              | No          | e.g., `http://localhost:3000`          |
| `PRODUCTION_FRONTEND_URL`   | No          | e.g., `https://roorooroo.app`          |
| `LOG_LEVEL`                 | No          | `debug`                                |
| `CRON_SECRET`               | Recommended | Shared secret for cron endpoint        |
| `TWILIO_ACCOUNT_SID`        | If SMS      | Twilio account SID                     |
| `TWILIO_AUTH_TOKEN`         | If SMS      | Twilio auth token                      |
| `TWILIO_PHONE_NUMBER`       | If SMS      | Sending phone number                   |
| `TWILIO_WEBHOOK_URL`        | No          | Public URL to receive status callbacks |
| `RESEND_API_KEY`            | If Email    | Enables email notifications            |

Supabase Auth (referenced in [`supabase/config.toml`](supabase/config.toml))

| Name         | Required | Notes                               |
| ------------ | -------- | ----------------------------------- |
| `JWT_SECRET` | Yes      | JWT signing key managed in Supabase |

GitHub Actions (repo secrets)

- `SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `JWT_SECRET`
- `DATABASE_URL` (used by the example db workflow)

## Database and migrations

- SQL lives in [`supabase/migrations/`](supabase/migrations/); applied via the
  Supabase CLI.
- Core schema: see
  [`20240101000000_create_tables.sql`](supabase/migrations/20240101000000_create_tables.sql)
- Cron helpers: see
  [`20240101000004_create_cron_functions.sql`](supabase/migrations/20240101000004_create_cron_functions.sql)

> The example workflow [`db-push.yml`](.github/workflows/db-push.yml) expects
> `scripts/*.sql`. Prefer the migrations folder, or update the workflow to use
> `supabase db push`.

## Frontend notes

- Static export is enabled in [`next.config.mjs`](frontend/next.config.mjs):
  `output: "export"`, `trailingSlash: true`, images unoptimized.
- Supabase helpers live under [`frontend/lib/supabase`](frontend/lib/supabase/):
  browser, server, and middleware utilities.
- Scripts in [`frontend/package.json`](frontend/package.json):
  - `pnpm dev` — dev server
  - `pnpm build` — production build
  - `pnpm start` — start prod server (not used for static export)
  - `pnpm lint` — Next/ESLint

## Deployment

- Functions: deployed via [`fns-push.yml`](.github/workflows/fns-push.yml) using
  Deno and `supabase/setup-cli`
  - Requires `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` secrets
- Database: managed via migrations in CI (Supabase CLI) or manually
- Frontend: static export can be hosted on Vercel or any static host

## Security

- Authenticated routes require `Authorization: Bearer <Supabase user JWT>`
- Cron endpoints accept either `X-Cron-Secret` or Supabase service‑role
  credentials
- CORS allows only configured frontend origins — set `FRONTEND_URL` and
  `PRODUCTION_FRONTEND_URL`
- Store secrets in Supabase project secrets, GitHub Actions secrets, or local
  `.env` files (never commit secrets)

## Roadmap

- The function deploy workflow is marked as WIP; validate before relying on it
  for production
- If you plan to manage DB changes via CI, align workflows to
  `supabase/migrations/` instead of `scripts/`

## License

MIT (unless otherwise specified).
