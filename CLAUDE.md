# Instructions for coding agents

This file is for any coding agent (Claude Code or otherwise) working in this
repository. This file only covers how to behave in the code — for product and
implementation context, see [`SHEKK_CONTEXT.md`](./SHEKK_CONTEXT.md),
[`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md),
[`PROGRAMME_OS_SPEC.md`](./PROGRAMME_OS_SPEC.md) and
[`CURRENT_STATE.md`](./CURRENT_STATE.md).

**Before making any substantial product or architectural change** — new
features, navigation changes, changes that touch the programme engine or the
financial infrastructure, anything that isn't a small, self-contained fix —
read `SHEKK_CONTEXT.md` and `CURRENT_STATE.md` first, and `PRODUCT_DECISIONS.md`
/ `PROGRAMME_OS_SPEC.md` where relevant. Don't rely on an earlier session's
memory of what Shekk is, and don't fall back on assumptions from legacy code
or comments (e.g. old "ShekelPay"/payment-first framing) that these docs have
superseded.

## Inspect before changing

Don't trust prior documentation, a memory of an earlier session, or a route's
file name to tell you what's implemented. Read the actual code — the hooks it
calls, the server functions behind them, the migrations behind those — before
describing something as "done", "mock", or "broken". `CURRENT_STATE.md` is a
snapshot from one point in time, not a live source of truth; if it looks stale
against what you find in the code, say so and prefer the code.

## Preserve existing working behaviour

- Do not broadly refactor without a specific reason tied to the task at hand.
- Do not delete or rewrite the existing financial infrastructure (ledger,
  top-up, Stripe/Airwallex, KYC) just because it's not part of the current
  launch navigation — it's deliberately preserved. See `PRODUCT_DECISIONS.md`.
- Avoid blanket reformatting of legacy files — a formatting-only diff on top
  of a real change makes the real change hard to review and hard to revert.
- Server-side permissions (Supabase RLS policies, `requireSupabaseAuth`,
  `has_role` checks) are the real authority. Never treat hiding something in
  the UI as equivalent to securing it.

## Product shape to respect

- The student product is mobile-first (`AppShell`, `PhoneFrame`, the five-tab
  bottom nav).
- Programme OS (`/staff`) is desktop-first and intentionally a separate
  surface (`ProgrammeOSShell`, not `AppShell`) over the same programme
  backend as the mobile staff tools and the student Programme tab. Reuse that
  existing programme engine (programmes/cohorts/groups/memberships/etc. in
  `supabase/migrations` and `src/lib/programme/`) rather than building a
  second, parallel system for the same concepts.
- Money/KYC/financial data is sensitive by nature — be careful with it even
  though the product is paused. Never log, print, or commit real card
  numbers, KYC documents, API keys, or database credentials, and never expose
  secrets in client-side code, URLs, or command output.

## Working with git

- Check the current branch and working tree state before making changes —
  don't assume you're on `main`, and don't assume a clean tree.
- Respect whatever branch/workflow is currently in use; don't create new
  branches, merge, or push to `main` without being explicitly asked to.
- For substantial work, commit in deliberate, reviewable checkpoints rather
  than one large diff — but only when asked to commit at all.

## Routing

This project uses TanStack Start's file-based routing. Read
[`src/routes/README.md`](./src/routes/README.md) for the conventions
(`index.tsx`, `$id.tsx`, `{-$optional}.tsx`, `_layout.tsx`, `__root.tsx`,
never hand-edit `routeTree.gen.ts`) rather than re-deriving them from scratch.
