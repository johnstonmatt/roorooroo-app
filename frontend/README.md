# roorooroo-app

A Next.js 14 app using React 18, Tailwind CSS v4, and Supabase. This repo powers
the Roorooroo application with authentication, dashboards, and a component
system based on Radix UI and shadcn-like primitives.

## Features

- **Next.js App Router** with layouts and server components
- **Supabase** auth and database helpers (`lib/supabase`)
- **Tailwind CSS v4** with utility-first styles
- **Radix UI** primitives and composable UI components in `components/ui`
- **TypeScript** end-to-end

## Getting Started

Prereqs:

- Node.js and pnpm installed

Install dependencies:

```bash
pnpm install
```

Create a `.env.local` in the project root and set your environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: if you use service-role server-side utilities
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Vercel Analytics
VERCEL_ANALYTICS_ID=optional
```

Run the dev server:

```bash
pnpm dev
```

Open the app at `http://localhost:3000`.

## Useful Scripts

- `pnpm dev` — start Next.js in development
- `pnpm build` — production build
- `pnpm start` — start the production server
- `pnpm lint` — run Next.js/ESLint checks (if configured)

## Project Structure

```text
app/                 Next.js app router pages, layouts, and routes
  api/               Route handlers (e.g., monitors)
  auth/              Auth pages (login/signup)
  dashboard/         Dashboard routes and layout
components/          Shared components
  ui/                Radix-based UI primitives
hooks/               React hooks
lib/                 Utilities and clients (e.g., Supabase)
  supabase/          Supabase client and server helpers
public/              Static assets
scripts/             SQL or tooling scripts
styles/              Global styles
```

## Database & Supabase

- Use the SQL files in `scripts/` to bootstrap your database:
  - `001_create_tables.sql`
  - `002_create_profile_trigger.sql`
- You can run these via the Supabase SQL editor or CLI.
- Configure Supabase env vars in `.env.local` (see above).

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

MIT — see `LICENSE` if present. If not included, contributions are accepted
under the project’s intended MIT licensing.
