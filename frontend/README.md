# roorooroo-frontend

A Next.js 16 app using React 19, Tailwind CSS v4, and Supabase. This is the
frontend package of the [RooRooRoo](../README.md) monitoring app:
authentication, dashboards, and a component system based on Radix UI and
shadcn-like primitives.

It is a static export (`output: "export"`), so there is no Next.js server in
production — the built site is hosted on Vercel or any static host.

## Features

- **Next.js App Router** with layouts and client components
- **Supabase** auth and database helpers (`lib/supabase`)
- **Tailwind CSS v4** with utility-first styles
- **Radix UI** primitives and composable UI components in `components/ui`
- **TypeScript** end-to-end, typed against the generated database schema

## Data access policy

- All database reads/writes/RPC calls must use the Supabase client from the
  frontend (see `lib/supabase`).
- Do not proxy database operations through Supabase Edge Functions.
- The Edge Function exists only for server-only tasks that the Supabase client
  cannot perform. It is served under `/functions/v1/api` and has two routes:
  - `POST /functions/v1/api/check-endpoint` — invoked by `pg_cron` to execute
    monitor checks, and by a signed-in user asking to force a re-check of their
    own monitor.
  - `GET /functions/v1/api/openapi.json` — the public OpenAPI 3.1 document.
    `components/status-tag.tsx` polls it for the status badge; serving it also
    proves the function is up.
- `lib/api-client.ts` is the only path from this app to the function. Its base
  URL is derived from `NEXT_PUBLIC_SUPABASE_URL` rather than configured
  separately: the function verifies the browser's JWT against its own project's
  JWKS, so auth and the function must be the same project.

## Getting Started

Prereqs:

- Node.js and pnpm installed
- A Supabase project, or the local stack via `npx supabase start` from the repo
  root

Install dependencies:

```bash
pnpm install
```

Create a `.env.local` in this directory and set your environment variables:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional
# Escape hatch; defaults to ${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api
NEXT_PUBLIC_API_BASE_URL=
# Signup allowlist; defaults to @supabase.io
NEXT_PUBLIC_ALLOWED_SIGNUP_DOMAIN=@supabase.io
NEXT_PUBLIC_ALLOWED_SIGNUP_EMAILS=
```

Run the dev server:

```bash
pnpm dev
```

Open the app at `http://localhost:3000`.

To run the frontend and the Edge Functions together, use the repo root instead:

```bash
deno task dev
```

## Useful Scripts

- `pnpm dev` — start Next.js in development
- `pnpm build` — production build (writes the static export to `out/`)
- `pnpm start` — start the production server (**not** used for static export)
- `pnpm lint` — ESLint (flat config, `eslint-config-next`)
- `postinstall` — `scripts/copy-twemoji-assets.mjs` copies Twemoji SVGs into
  `public/emoji/twemoji/latest` so emoji are served locally

From the repo root, `deno task frontend:checks` and `deno task frontend:build`
wrap the last two.

## Project Structure

```text
app/                 Next.js app router pages and layouts
  auth/              Auth pages (login, signup, forgot/reset password)
  dashboard/         Dashboard routes and layout
components/          Shared components (monitor-card, status-tag, ...)
  ui/                Radix-based UI primitives
lib/                 Utilities and clients
  supabase/          Browser Supabase client singleton
  api-client.ts      Typed fetch wrapper for the Edge Function
  db.ts              Row types derived from the generated schema
  monitor-schedule.ts  pg_cron job name and cron expression helpers
  phone-validation.ts  Phone number parsing and validation
  emoji.tsx          Twemoji rendering helpers
public/              Static assets, including public/emoji
scripts/             Build-time asset tooling (Twemoji copy)
app/globals.css      Global styles and Tailwind layers
```

## Coding Standards

- TypeScript: explicit types for public APIs; avoid `any`
- Prefer clear, descriptive names; avoid abbreviations
- Keep components small and composable; use UI primitives where possible
- Run `pnpm lint` before opening a PR

## Contributing

We welcome contributions! Follow these steps:

1. Fork the repo and create your feature branch:
   ```bash
   git checkout -b feat/short-description
   ```
2. Install dependencies and run the app:
   ```bash
   pnpm install
   pnpm dev
   ```
3. Make changes with clear commits. Conventional commits are encouraged (e.g.,
   `feat:`, `fix:`, `chore:`).
4. Lint and build locally:
   ```bash
   pnpm lint && pnpm build
   ```
5. Open a Pull Request describing:
   - What changed and why
   - Screenshots for UI changes
   - Any breaking changes or follow-ups

Note that PRs from forks do not get a Supabase preview branch — the preview
workflow deliberately skips them, because fork PRs receive no secrets. See
[Preview Environments](../CLAUDE.md#preview-environments).

### PR Checklist

- [ ] Code compiles (`pnpm build`)
- [ ] Lint passes (`pnpm lint`)
- [ ] No unused files/vars
- [ ] Updated docs or comments where helpful

## Issue Reporting

- Use GitHub Issues for bugs and feature requests
- Include steps to reproduce, expected vs actual behavior, and environment
  details

## License

MIT. No `LICENSE` file is checked in yet.
