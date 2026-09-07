# Shekk

Shekk is a mobile-first companion app for international students spending a
year in Israel — gap-year, yeshiva, seminary and other year-programme
participants. It's built around a student's programme, plans and day-to-day
life in Israel, not around payments.

For the full product story, see [`SHEKK_CONTEXT.md`](./SHEKK_CONTEXT.md).

## Current student-facing product areas

The app's primary navigation is five tabs (`src/lib/nav.ts`,
`src/components/AppShell.tsx`):

- **Today** — personalised home / "For You"
- **Programme** — a student's programme hub: schedule, updates, info, checklist
- **What's On** — events and activities discovery
- **Explore** — the mini-app/utility library (transit, health, visa, housing, etc.)
- **You** — profile, settings, verification status

Alongside these, there's a separate desktop-first **Programme OS** at `/staff`
for programme managers and staff, and the existing mobile staff tools at
`/programme/staff`. See [`PROGRAMME_OS_SPEC.md`](./PROGRAMME_OS_SPEC.md).

Shekk also has a built financial layer (credits, top-up, card, ledger) that is
preserved in the codebase but intentionally not part of the launch navigation.
See [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md) for why, and
[`CURRENT_STATE.md`](./CURRENT_STATE.md) for what's actually wired up today.

## Tech stack

- **Frontend**: React 19, TanStack Start / TanStack Router (file-based
  routing), TanStack Query, Vite, Tailwind CSS v4, Radix UI primitives
- **Backend**: Supabase (Postgres, auth, storage) via `@supabase/supabase-js`,
  plus server functions (`createServerFn`) for anything that needs
  service-role access or an external API key
- **Payments (preserved, paused)**: Stripe, Airwallex
- **Email**: Resend, `@react-email`
- **Package manager**: npm (`package-lock.json` is authoritative; a `bun.lock`
  also exists in the repo — check with the team before assuming which is live)

## Architecture notes

- Routing is TanStack Start's file-based convention — see
  [`src/routes/README.md`](./src/routes/README.md) before adding or moving
  routes.
- `src/components/AppShell.tsx` + `src/lib/nav.ts` own the student tab bar and
  which routes count as tab roots vs. full-screen "mini apps".
- `src/components/staff/ProgrammeOSShell.tsx` is a deliberately separate
  desktop-first surface over the same programme backend — it does not reuse
  `AppShell`.
- Server-side logic that touches money, KYC or partner credentials lives in
  `*.server.ts` files and server functions, not in client code — see
  [`CLAUDE.md`](./CLAUDE.md).
- Database schema lives in `supabase/migrations`.

## Local development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/Bendavila122/shekk.git
cd shekk
npm i
npm run dev
```

Other scripts: `npm run build`, `npm run lint`, `npm run format`.

## Deployment

Hosted on Vercel, connected to this GitHub repo — pushes to `main` deploy to
production, with no PR/preview gate, so build and run locally
(`npm run build && npm run dev`) before pushing. Backend is Supabase. Don't
assume the specific active Supabase project or environment variables from this
file — the setup has changed recently; check the current environment directly
rather than relying on documentation (see
[`CURRENT_STATE.md`](./CURRENT_STATE.md) for known infrastructure notes).

## Further reading

- [`SHEKK_CONTEXT.md`](./SHEKK_CONTEXT.md) — what Shekk is and why
- [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md) — settled product decisions
- [`PROGRAMME_OS_SPEC.md`](./PROGRAMME_OS_SPEC.md) — Programme OS spec
- [`CURRENT_STATE.md`](./CURRENT_STATE.md) — what's actually implemented today
- [`CLAUDE.md`](./CLAUDE.md) — instructions for coding agents
