# Product decisions

Settled decisions that shouldn't be repeatedly reopened without a new reason.
For the reasoning behind Shekk's overall direction, see
[`SHEKK_CONTEXT.md`](./SHEKK_CONTEXT.md). For what's actually built, see
[`CURRENT_STATE.md`](./CURRENT_STATE.md). This file is intentionally short —
implementation detail doesn't belong here.

- **Primary student navigation is five tabs**: Today, Programme, What's On,
  Explore, You. Not Pay/Explore/Social/Me — that was an earlier design.
- **Money is intentionally paused from primary navigation for launch, not
  deleted.** No tab, no Home prompts, no service tiles, but every screen stays
  reachable by direct URL and can be switched back on via one flag
  (`VITE_MONEY_ENABLED` / `MONEY_ENABLED` in `src/lib/flags.ts`).
- **Home should be personalised**, with "For You" prominent — it's the reason
  a student opens the app on a day nothing specific is due.
- **Explore is primarily the mini-app/utility library.** It should not become
  a dumping ground for commercial promotions (eSIM, insurance, etc.) at the
  top when those already have better homes on Home, in onboarding, or in
  their own journeys.
- **What's On is discovery-led**, not assumed to be a full live events
  marketplace or ticketing API — see `CURRENT_STATE.md` for what's actually
  sourced from where.
- **Programme is one of the most strategically important parts of the
  product.** It should connect directly to the staff-facing Programme OS.
- **Banking is a later major layer, not the current launch wedge.** See the
  "Product strategy" section of `SHEKK_CONTEXT.md`.
- **Programme OS (desktop) and the existing mobile staff tools are distinct
  surfaces over the same programme engine**, not two separate products.
  Desktop = programme management and office operations. Mobile = useful
  actions for staff/madrichim while with students.
- **Preserve existing financial infrastructure unless deliberately changing
  it.** It's real, working code, just not switched on for launch.
- **Programme OS should initially be discovery-led and operationally useful,
  not a wholesale CRM replacement.** It should complement how programmes
  already run, not force them onto a generic system from day one.
- **Programme onboarding/import and student-facing programme workflows are
  high priority** — the core loop is: programme creates/updates something →
  student receives it in Shekk → student responds/completes/acknowledges →
  staff see the result → staff act on exceptions.
