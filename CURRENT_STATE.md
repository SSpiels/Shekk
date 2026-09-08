# Current state

**Last audited:** 2026-09-08
**Branch audited:** `feature/programme-os-v1`; Content data-integrity &
security checkpoint, after the Content module checkpoint, after the
date-stabilisation checkpoint (`ade0992`).

This is the only document in this set that's expected to go stale — treat it
as a snapshot, not a guarantee. If you find it disagrees with the code, trust
the code and update this file. "There is code for X" is not the same as "X is
production-ready" — the states below try to keep that distinction explicit.

States used: **Live/implemented** · **Implemented but gated** ·
**Sandbox/integration** · **Partially implemented** · **Stub/placeholder** ·
**Local-only** · **Blocked** · **Legacy/preserved** · **Planned**

## Home ("Today")

**Live/implemented.** `src/routes/index.tsx` — real hooks for programme data
(`useProgrammeHub`), travel/setup state (`useTravel`, `useSetup`), a "For You"
component, an "Active now" component, events, and promotions. Not verified
line-by-line for every widget's data source in this pass.

## Programme — student experience

**Live/implemented.** `src/routes/programme.tsx` + `programme.schedule/inbox/info.tsx`.
Join-by-code, Today/Schedule/Updates/Info sub-tabs, checklist, announcements,
DB-backed via the programme engine in `supabase/migrations`
(`programmes`, `programme_cohorts`, `programme_memberships`,
`programme_announcements`, `programme_acknowledgements`,
`programme_checklist_items/progress`, `programme_events/rsvps`, etc.).

## Mobile staff tools

**Implemented.** `src/routes/programme.staff.tsx` — the pre-existing
field-operations surface for madrichim/staff. Not re-audited in depth this
pass; assume it predates and is independent of the new desktop Programme OS
work below.

## Programme OS (desktop, `/staff`)

Shell (`ProgrammeOSShell`, `StaffSidebar`, `StaffMobileNav`), auth gate and
session context are **implemented**. Per V1 module:

| Module | State | Notes |
|---|---|---|
| Overview | **Implemented, DB-backed** | `src/routes/staff/overview.tsx` calls `useStaffOverview(cohortId)` — real query with loading/error states, not mock arrays. Underlying data may still be limited to whatever cohorts exist (including the internal sandbox cohort — see below). |
| Students | **Implemented, DB-backed** | Roster (`staff/students/index.tsx`) and profile (`staff/students/$studentId.tsx`) both call real hooks (`useStaffStudentRoster`, presumably an equivalent for the detail view) with loading/error handling. Backed by the new `programme_student_details` table (added this branch, phase 1). |
| Onboarding | **Implemented, DB-backed** | `staff/onboarding.tsx` — cohort-wide dashboard via `useStaffOnboardingOverview`, plus a working reminder-notify mutation (`useNotifyOnboardingReminder`). |
| Communications | **Implemented, DB-backed** | Publishing, audience targeting, acknowledgement rollups and eligible-student drill-down using the existing announcement engine. Notifications are in-app only. |
| Calendar | **Implemented, DB-backed** | Agenda/Week/Month, create/edit/delete, delay/move/cancel, change history and audience-aware RSVP breakdown using the existing event engine. |
| Content | **Implemented, DB-backed** | `staff/content.tsx` — welcome message, checklist, documents, contacts and places, create/edit/delete, on the existing content/audience engine. See "Content module" below. |
| Team | **Stub/placeholder** | Placeholder text explicitly says it's planned for "Phase 4 — built on the existing owner \| staff + permissions model." |
| Settings | **Stub/placeholder** | Same pattern as the above. |

### Programme date handling checkpoint

- Desktop and mobile programme event surfaces share explicit Asia/Jerusalem
  formatting and strict local-time resolution. Invalid calendar dates and spring
  DST gaps are rejected; repeated autumn times require an earlier/later choice
  labelled with UTC offsets. Existing instants retain their known occurrence.
- Both editors send local input/choice alongside the instant; the server verifies
  agreement and requires end > start when an end is supplied. Instant-based live
  operations remain supported with strict offset-bearing timestamp validation.
- Untouched minute inputs retain existing seconds/milliseconds. Equivalent instant
  representations and unchanged audiences are semantic no-ops: no event write,
  freshness update, audience rewrite, change history or notification. Real changes
  continue through the existing history/in-app notification pipeline.
- Cohort ranges (join/header) and programme checklist due dates use a dedicated
  strict date-only formatter, independent of the viewer's timezone. No migration
  or stored-date rewrite is needed.
- Verification: 206 tests pass, including DST transitions, invalid inputs,
  London/New York/Israel viewer zones, date-only values, precision-preserving
  edits and actual server mutation side effects. Typecheck and changed-line lint
  pass, and the production build passes; legacy formatting findings are left untouched.
- Browser verification in Shekk Test Programme: desktop/mobile gap rejection,
  explicit earlier/later selection, stored-instant agreement, unchanged saves
  (including mobile notify mode) without writes, real-change notifications,
  student schedule display and live +15-minute delay. The disposable test event
  and its two notifications were removed afterward.
- Reopening the desktop editor now remounts it, preventing stale form state on
  repeated edits. Real repeated-hour history changes show both UTC offsets.
- Known V1 limits remain: workspace is selected from the latest staff grant;
  current cohort from creation order. Communications' and Calendar's audience
  pickers still derive groups from `students[].groups`, so a group with no
  members yet won't appear there — Content's picker was fixed instead (see
  below); Communications/Calendar were left alone as out of scope for this pass.
  Team and Settings remain placeholders.
- Git reconciliation is pending separately: remote main's five unique commits are
  generated Supabase type parentheses, generated route ordering, a Resend pin to
  6.25.0/Bun lock update and two merges. No infrastructure migration is implied.

### Content module checkpoint

- `staff/content.tsx`: five tabs — Programme information, Documents, Contacts,
  Places, Checklist — over the existing engine
  (`programme-ops.server.ts`'s `upsertContent`/`deleteContent`/
  `seedDefaultChecklist`, already used by the mobile staff `ContentEditor` in
  `components/programme/Staff.tsx`). No second content model was introduced.
  Desktop adds one real capability mobile never had: editing an existing row
  in place, not just create/delete — `upsertContent` already supported an
  `id` for updates, nothing there needed to change.
- New: `staffContentOverview` (a lean, Content-scoped read — checklist/
  documents/contacts/places plus the full cohort group list — instead of
  reusing the much heavier participant-shaped `readHub`) and
  `staffUpdateProgrammeInfo` (writes `programme_cohorts.welcome_message`,
  the text already shown verbatim at the top of the student's Programme
  "Today" tab — `programme_cohorts` has no staff RLS write policy, so this
  follows the same proved-permission-then-service-role pattern as
  `notifyOnboardingReminder`, not a new one).
- Content's audience picker uses `programme_groups` directly (via
  `staffContentOverview`), so a group with no members yet is still a valid
  target — unlike Communications'/Calendar's roster-derived list, which was
  left as-is (out of scope for this pass, noted above).
- Documents are link-only in V1: `programme_documents.storage_path` /
  `mime_type` / `byte_size` columns exist, but no storage bucket or policy
  was ever created for programme documents (unlike `kyc-documents`,
  `insurance-cards`, `member-documents`, which are all real per-user
  buckets). The editor is honest about this — a hint under the Link field
  says native upload isn't part of V1 — rather than showing an upload
  control that doesn't work. Native upload remains unbuilt after the
  integrity/security checkpoint below too — that pass added link *safety*
  (scheme validation), not upload.
- Checklist items with student completion history are **retired, not
  deleted** — see the integrity/security checkpoint below; the original
  "delete cascades progress" behaviour it replaced is gone.
- Verification: 206 tests pass (no new ones added — this module has no
  date/timezone logic worth unit-testing beyond what already exists;
  correctness was checked live instead), typecheck and changed-line lint
  pass, and the production build passes. Live-verified in Shekk Test
  Programme via the desktop UI, logged in as the sandbox's staff+student
  account: created, viewed and deleted a checklist item, watched it appear
  in and disappear from `/programme/info` without a manual refresh (React
  Query cache invalidation), confirmed the audience picker offers a group
  with zero members, and read through existing Documents/Contacts/Places
  data rendering correctly. No disposable test document/contact/place was
  created — only the one checklist item, which was deleted afterward.

### Content data-integrity & security checkpoint

Follow-up pass over Content, before starting Team. No UI redesign — same
five tabs, same engine; this closed specific gaps found on review.

- **Checklist retirement, not deletion.** `programme_checklist_items` gained
  an `archived_at timestamptz` column (migration
  `20260908130000_checklist_item_archive.sql`, applied to the linked dev
  project) — purely additive, plus one RLS policy replacement that only
  *narrows* what students (not staff) can see. `deleteContent` now checks
  `programme_checklist_progress` for the item first: zero rows hard-deletes
  exactly as before; one or more retires it (`archived_at = now()`) instead
  — the row, its history and its audience targeting are preserved, and it's
  simply excluded from the active student checklist, from onboarding
  completion math (`loadCohortRosterRaw`, `staffStudentProfile`), and from
  `readHub` (student view and mobile staff's read-only list). Content's own
  `staffContentOverview` still shows retired items, in a separate "Retired"
  section with a completion count and a **Restore** button
  (`restoreChecklistItem`, clears `archived_at`) — staff can see and undo a
  retirement, nothing is ever silently gone. The desktop confirmation dialog
  and the Delete/Retire button label both say which is about to happen and
  why, using the real completion count, before the staff member confirms.
- **Cross-cohort write safety.** `upsertContent`/`deleteContent` previously
  trusted a client-supplied `cohortId` next to a client-supplied row `id` —
  RLS's `USING`/`WITH CHECK` clauses back-stopped this so nothing was
  actually exploitable, but a staff member with grants on two programmes
  could in principle have supplied a mismatched pair. Both functions now
  re-read the target row's real `cohort_id` first (same pattern
  `deleteGroup`/`setGroupMembership` already used) and check permission —
  and, on edit, write — against that, never the caller's claim. Covered by
  `content.test.ts`.
- **`staffUpdateProgrammeInfo` reviewed**, not changed: it already checked
  `requireStaff` before touching the service role, with no separate row id
  to mismatch (the target *is* the checked cohort). Returns no student PII
  or financial/KYC data — confirmed by reading `staffContentOverview`'s
  full return shape.
- **Document/checklist link scheme validation.** `programme_documents
  .link_url` and `programme_checklist_items.action_url` both render straight
  into a student-facing `<a href>` (`Participant.tsx`'s DocRow/ChecklistRow)
  and previously accepted any string. `isSafeContentUrl` (`logic.ts`) now
  gates both — http(s) only, `action_url` additionally accepts a same-origin
  `/path` (its documented use, e.g. `/services/esim`) but rejects a
  protocol-relative `//host`, which a browser resolves as absolute the same
  as a full URL. Enforced in `upsertContent` itself (the trust boundary,
  same as `validateEventInterval`/`validateEventTime` for events), with the
  same rule mirrored in the zod schema for an earlier client-side message.
  Live-tested with `javascript:alert(1)` in the desktop Documents editor —
  rejected, cleanly ("Enter a valid http(s) link"), nothing written.
- **Error message cleanup**, found while doing that live test:
  `staffUpsertContent`'s input validator originally let a raw `ZodError`
  (whose `.message` is the JSON issues array) reach the staff editor's error
  banner verbatim. Now `safeParse`s and throws just the first issue's
  message — scoped to this one server function, not a global change to
  every `inputValidator` in `programme-ops.functions.ts`, which all still
  use bare `.parse()`.
- Verification: 228 tests pass (206 prior + 22 new in
  `src/lib/programme/content.test.ts`, covering create/edit cohort
  re-derivation, cross-cohort permission rejection, retire-vs-hard-delete by
  progress count, restore, `staffUpdateProgrammeInfo` permission checks, and
  the group-authoritative-list/archived-flag shape of
  `staffContentOverview`), typecheck and changed-line lint pass, production
  build passes. Live-verified in Shekk Test Programme: ticked a real
  checklist item as a student, retired it as staff (confirmed the dialog's
  real completion count and retire-specific copy), confirmed it left both
  the student checklist and the onboarding total, restored it, confirmed
  both came back exactly as before — then reverted the tick to leave the
  sandbox as found. Separately confirmed the `javascript:` link rejection
  live, as above.

There is an internal **Shekk testing sandbox** programme
(`src/lib/programme-testbed.server.ts`, `src/lib/programme-ops.functions.ts`)
that operators can create/reset — useful for exercising Programme OS end to
end, but its data is explicitly fake/resettable, not a real programme.

**Organisation layer:** conceptual only — no `organisations` table exists in
`supabase/migrations`. The word "organisation" appears only as a free-text
label on the sandbox test programme, not as a modeled entity.

## Explore

**Live/implemented as a library**, with per-tile status already modeled in
the data, not something to infer: `src/lib/services.ts` and
`src/lib/mini-apps.ts` tag each entry `"live" | "guide" | "integrating" |
"planned"`. Examples: Maps, Health cover, Visa & status, Fitness are `live`
(real in-app flows); Gett rides is `integrating` ("booking flow already
built against Gett's API, waiting on live partner credentials"); most
practical-info tiles (shuk guide, hospitals, safety, arnona) are `guide`
(informational, not a live integration); several are `planned`. Treat the
`status` field in those files as the authoritative answer for any individual
tile rather than guessing from the tile's name.

## What's On

**Partially implemented — DB-backed core; partner sourcing confirmed
unimplemented; end-to-end purchase not independently verified.**
`src/lib/events.server.ts` / `events.functions.ts` define a code-complete
listing/purchase flow (`listEvents`, `getEvent`, `buyTicket`, `myTickets`)
backed by real tables (`events`, `event_tickets`) — this pass read the code
but did not execute a purchase, so "code-complete" is not the same as
"confirmed working end-to-end." Events currently come only from what's
created via the internal Shekk console/admin functions (`adminCreateEvent`
etc.).

External partner sourcing (Eventer, Tickchak) is confirmed **not
implemented**, independent of credentials: `src/lib/events-provider.server.ts`
is an explicit, documented seam — `listPartnerEvents` unconditionally
`console.warn`s `"adapter not implemented yet"` and returns an empty array
even when a provider's API key is present, because the actual HTTP call
against the partner's API was never written. Whether `EVENTER_API_KEY` /
`TICKCHAK_API_KEY` are currently set was not checked (that would mean reading
`.env`, which this pass deliberately avoided) — it wouldn't change the
outcome, since the adapter itself is a stub either way.

## Passport

**Live/implemented, local-first.** `src/routes/passport.tsx` — the file's own
header states it deliberately doesn't touch auth or the ledger. City spreads,
stamping, geofenced check-in (`CHECKIN_RADIUS_KM`, `nearestCity`) all appear
wired up via `usePassport`. Not independently verified against a live
geolocation test in this pass.

## Setup / onboarding

**Live/implemented.** `src/routes/welcome.tsx` (927 lines) is the real
onboarding flow — front door for signed-out users into Supabase auth, then a
staged journey setup that writes to a server-side travel record on every
step (resumable across devices). Identity verification is out of scope here
and lives at `/verify` (not audited this pass).

`/setup` is **legacy/retired** — it now just redirects to `/before-you-fly`;
its own header explains it was a duplicate of the same pre-arrival checklist
with no entry point, and its one useful idea (adaptive "do this next") was
migrated to `/before-you-fly`.

## Money / payments

**Implemented but gated off** at the feature-flag level
(`MONEY_ENABLED` in `src/lib/flags.ts`, defaults to `false`; no nav entry
points, no Home prompts, no service tiles). Screens (`/wallet`, `/topup`,
`/card`, `/exchange`, `/money`) remain reachable by direct URL. Underlying
schema is real: `accounts`, `ledger_entries`, `holds`, `funding_events`,
`kyc_documents`, `insurance_cards`, `subscriptions`, `split_bills/shares`.

Two payment providers are wired in, at different levels of readiness:

- **Airwallex** — **Sandbox/integration, code-complete.**
  (`src/lib/airwallex.server.ts`, `airwallex.functions.ts`,
  `AirwallexDropIn.tsx`) — calls Airwallex's own API directly
  (`api.sandbox.airwallex.com` / production, gated by `AIRWALLEX_ENV`), keyed
  on `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_API_KEY`. Sandbox by default. The code
  path exists and calls Airwallex directly with no third-party gateway in the
  middle, but this pass did not execute a real transaction against it — "the
  integration code exists" is not the same as "a live payment was confirmed."
- **Stripe** — **Blocked/unverified, do not assume working.**
  (`src/lib/stripe.server.ts`) routes through a Lovable connector gateway
  (`connector-gateway.lovable.dev/stripe`), requiring a `LOVABLE_API_KEY`
  alongside the Stripe key — a real, hard dependency on Lovable
  infrastructure. This branch has separately removed Lovable editor/MCP
  tooling and disabled Google/Apple sign-in because "the Lovable OAuth broker
  it depends on doesn't exist anymore" (commit `0b2d1bf`). That is
  circumstantial evidence, not proof, that the Stripe gateway is also down —
  nobody has actually called this path in this pass to check. Treat it as
  **unverified and possibly non-functional** until someone tests it directly;
  do not describe it as working, and do not describe it as confirmed broken
  either.

## Infrastructure / deployment state (transient — kept here on purpose)

- Dev environment was recently repointed to "a reachable Supabase project"
  (commit `8d5e1e0`) — don't assume any specific project ref, URL or env var
  from older documentation; check the live environment.
- Google/Apple sign-in is currently **disabled** — the Lovable OAuth broker
  it depended on no longer exists (commit `0b2d1bf`).
- Lovable editor/MCP dev-tooling has been removed from the repo (commit
  `503ad98`); auth/transactional email has moved off Lovable onto Resend
  (commit `2459c6e`). The Stripe gateway dependency noted above appears to be
  a remaining, unaudited exception to that migration away from Lovable.
- Deployment (Vercel, GitHub `main` auto-deploy) matches the existing README
  claim and was not independently re-verified this pass beyond what's in git
  history.

## Not yet audited in this pass

`/verify` (KYC flow), `/social`, `/before-you-fly`, `src/routes/admin/*`
(the separate internal `/admin` operational console — not the same thing as
the `/staff` Programme OS product), and the exact partner status of eSIM
(`src/lib/sim-providers`) and insurance integrations. Treat these as unknown
rather than assuming either "done" or "mock" until inspected.
