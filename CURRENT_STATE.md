# Current state

**Last audited:** 2026-09-08
**Branch audited:** `feature/programme-os-v1`; Pre-demo cleanup & staff-auth
checkpoint, after the Pilot onboarding & Settings checkpoint, after the
Integration & Overview checkpoint, after the Team checkpoint, after the
Content data-integrity & security checkpoint, after the Content module
checkpoint, after the date-stabilisation checkpoint (`ade0992`).

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
session context are **implemented**. Its own front door,
`src/routes/staff-login.tsx` (`/staff-login`), was added in the Pre-demo
cleanup checkpoint — see that checkpoint below for what it does and why it
exists separately from the student `/auth`. Per V1 module:

| Module | State | Notes |
|---|---|---|
| Overview | **Implemented, DB-backed** | `src/routes/staff/overview.tsx` calls `useStaffOverview(cohortId, programmeId)` — cohort/programme context, onboarding stats, upcoming events, recent announcements, recent event changes and a Team summary, all real queries, no mock arrays or invented metrics. See "Integration & Overview checkpoint" below. |
| Students | **Implemented, DB-backed** | Roster (`staff/students/index.tsx`) and profile (`staff/students/$studentId.tsx`) both call real hooks (`useStaffStudentRoster`, presumably an equivalent for the detail view) with loading/error handling. Backed by the new `programme_student_details` table (added this branch, phase 1). |
| Onboarding | **Implemented, DB-backed** | `staff/onboarding.tsx` — cohort-wide dashboard via `useStaffOnboardingOverview`, plus a working reminder-notify mutation (`useNotifyOnboardingReminder`). |
| Communications | **Implemented, DB-backed** | Publishing, audience targeting, acknowledgement rollups and eligible-student drill-down using the existing announcement engine. Notifications are in-app only. |
| Calendar | **Implemented, DB-backed** | Agenda/Week/Month, create/edit/delete, delay/move/cancel, change history and audience-aware RSVP breakdown using the existing event engine. |
| Content | **Implemented, DB-backed** | `staff/content.tsx` — welcome message, checklist, documents, contacts and places, create/edit/delete, on the existing content/audience engine. See "Content module" below. |
| Team | **Implemented, DB-backed, hardened** | `staff/team.tsx` — roster, invite, role/permissions, remove, on the existing `programme_staff`/`programme_invites` schema. Last-owner protection is now DB-enforced (not just app-level), invitation codes are an owner-only read at the RLS layer too. See "Team checkpoint" and "Integration & Overview checkpoint" below. |
| Settings | **Implemented, DB-backed, deliberately small** | `staff/settings.tsx` — the cohort join code (view for any staff, rotate/open-close for an owner) plus read-only programme/cohort identity. Programme name/organisation/dates stay Shekk-admin-only and say so on-screen, rather than exposing a write path with no real need behind it yet. See "Pilot onboarding & Settings checkpoint" below. |

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

### Team checkpoint

`staff/team.tsx` replaces the Phase-4 placeholder. Built entirely on the
schema that already existed for it (`programme_staff`, `programme_invites`)
and the invite/accept engine every staff-claim invite already ran through
(`previewInvite`/`acceptInvite`, `Join.tsx`'s `JoinPanel`) — no new tables,
no new accept flow, no invite email (nothing in the app sends transactional
invite email anywhere; the link is returned for an owner to copy/share, the
same as `adminCreateInvite`'s existing behaviour).

- **New, owner-gated server functions**: `staffTeamOverview` (read — open to
  any staff member, not just owners, same "Content is staff-readable"
  precedent), `staffInviteTeamMember`, `staffUpdateTeamMember` (role and/or
  permissions — no permissions setter existed anywhere before this),
  `staffRemoveTeamMember`, `staffRevokeTeamInvite`. All gated by the
  `requireOwner`/`is_programme_owner` helper that already existed in
  `programme-ops.server.ts`, unused, since the schema/RLS layer was built —
  'team' was deliberately left out of `staff_can`'s default-permission-grant
  list in the DB, the codebase's own signal that team management was always
  meant to be owner-only, not staff-permission-gated like Content/Calendar/
  Communications. No schema change, no new `STAFF_PERMISSIONS` entry.
- **The only pre-existing write paths that touched these two tables**
  (`adminCreateInvite`, `adminSetStaffRole`, `adminRemoveStaff`,
  `adminRevokeInvite`, `adminAssignOwnerByEmail`) are the internal Shekk
  admin console's, gated by `assertAdmin` for a *different* surface
  (`/admin`, not `/staff`) and taking a raw `programmeId` with no per-caller
  scoping — reusing them for Programme OS would have hardcoded Shekk-admin
  power into every programme owner's account. Left entirely untouched; Team
  has its own, narrower functions instead.
- **Last-owner protection** (didn't exist anywhere before this):
  `assertNotLastOwner` blocks demoting or removing a programme's only owner,
  whether the caller is acting on someone else or on themselves. Checked
  server-side (the actual gate) and mirrored client-side in the editor
  dialog for an immediate, no-round-trip message.
- **Duplicate-invite handling**: inviting an email with an existing,
  still-valid pending invite reuses its code instead of creating a second
  row; an expired pending invite is cleared and replaced. Inviting someone
  whose email already resolves to a current team member is rejected
  outright ("already on your team") rather than issuing a pointless invite.
- **Cross-programme write safety**: `staffUpdateTeamMember`/
  `staffRemoveTeamMember` scope every write by the compound
  `(programme_id, user_id)` key (`programme_staff` has no single-column
  primary key staff can be looked up by alone), so a caller who really does
  own the programme they claim can't affect a different programme's row —
  the compound key matches zero rows or the right one, never someone
  else's. `staffRevokeTeamInvite` takes no `programmeId` argument at all;
  the invite row's own `programme_id` (read first) is the only thing
  ownership gets checked against, the same re-derive-from-the-row pattern
  Content's `deleteContent` uses.
- **Identity shown is deliberately thin**: `member_handles` (display name/
  handle) + `member_profiles.email` only — never legal name, DOB, address or
  any other `member_profiles` field, which RLS locks to the profile's own
  owner and has no business reaching a co-worker's screen.
- **Removing someone with existing programme activity is safe already**:
  `created_by`/`updated_by`/`changed_by` columns across events, announcements,
  checklist items etc. are plain `uuid`, never a foreign key to
  `programme_staff` — removing access never cascades into deleting anything
  that person created or changed. The remove-confirmation copy says so.
- Verification: 249 tests pass (228 prior + 21 new in
  `src/lib/programme/team.test.ts` — last-owner guard for both update and
  remove, both blocked and allowed cases; duplicate/expired/already-a-member
  invite handling; cross-programme permission checks for every write
  function; no-op-on-already-gone for remove/revoke; safe-identity-fields
  shape and `canManage` gating for the overview read), typecheck and
  changed-line lint pass, production build passes. Live-verified in Shekk
  Test Programme: invited a test email, confirmed the dedup returned the
  same code on a second attempt, revoked it and watched the pending-invites
  section clear, and confirmed the last-owner guard blocks self-demotion
  both in the UI (immediate, no server round trip) and would be blocked
  server-side regardless (unit-tested directly, since the sandbox only has
  one owner to test against). Sandbox restored to its original single-owner,
  no-pending-invite state afterward.
- Known limits: no bulk invite/CSV import, no custom roles beyond
  owner/staff, no email delivery (link-sharing is manual, matching every
  other invite path in the app).

### Integration & Overview checkpoint

Overview replaced with a real operations glance (see the module table
above); Team's remaining verification gaps closed; a full staff→student
journey run end to end with disposable accounts; a demo-readiness pass
produced the blocker list below. No new modules, no permissions-model
redesign.

**Overview**, concretely: cohort/programme header, active students,
onboarding % and needs-attention count (existing `staffOnboardingOverview`,
unchanged), upcoming events, recent announcements, **new** — recent event
changes (`programme_event_changes`, non-silent only, last 3, reusing
Calendar's own change-history rows, not a derived feed) and a **Team**
summary tile (member count; pending-invite count only shown to an owner,
via the same RLS this checkpoint narrowed — see below). Every number is a
real query; nothing here is invented delivery/attendance/engagement
metrics the system doesn't track.

**Team security fixes**, both migrations applied to the linked dev project:
- **Atomic last-owner protection.** The previous checkpoint's
  `assertNotLastOwner` was a count-then-write check in application code —
  exactly the race the brief warned about: two concurrent requests could
  each read "2 owners" before either commits. A `BEFORE UPDATE OR DELETE`
  trigger on `programme_staff` (`programme_staff_guard_last_owner`,
  migration `20260908150000`) is now the real guarantee: it fires
  regardless of caller (a server function, the internal Shekk admin
  console, or a raw client), and `pg_advisory_xact_lock(hashtext(
  programme_id))` serializes concurrent staff-role changes for the same
  programme so the count each transaction sees can't be stale. The
  application-level check stays too, purely for a clean error message
  before a round trip — the trigger is what actually can't be bypassed.
- **Invitation codes narrowed to an owner-only read.** `programme_invites`'
  SELECT policy previously used `is_programme_staff` — any staff member,
  not just an owner, could read every pending invite's `code` directly via
  their own RLS-scoped client (devtools, not just the UI), regardless of
  `staffTeamOverview`'s own `canManage` gate. Fixed at both layers: the RLS
  policy now checks `is_programme_owner` (same migration), and
  `staffTeamOverview` no longer even queries `programme_invites` for a
  non-owner (was already gated app-side by returning an empty array, but
  the query ran regardless — now it doesn't). Team roster visibility
  (`programme_staff`) stays open to all staff, unchanged — this was
  specifically about invitation codes, a distinct, higher-privilege
  capability. Regression tests added in `team.test.ts` (22 total now).

**End-to-end verification, live, with disposable accounts** (created via
Supabase Admin API, authenticated via generated magic-link tokens
consumed same-origin through the app's own `/auth/v1/verify` call — never
a password; all three accounts and their invite/membership/staff rows
deleted afterward, confirmed via a direct read showing the sandbox back
to exactly one owner and zero pending invites):
- **Owner** (the real, already-signed-in account) created two staff
  invites through the real Team UI.
- **Ordinary staff** (`shekk-qa-staff-…@shekk-test.invalid`): accepted
  their invite through the real `/join/<code>` flow, landed on Programme
  OS Overview with default (all-modules) access confirmed live. On
  `/staff/team`, saw the roster but — confirmed by inspection, not
  inference — no pending-invites section and no Invite button. Called
  `staffTeamInvite` and `staffTeamRemoveMember` directly through the app's
  own server-fn bridge (bypassing the UI entirely, the exact "hidden vs.
  denied" distinction the brief asked about) — both rejected server-side
  with "Only the programme owner can do that". Confirmed Content access
  works normally (default permissions).
- **Restricted staff** (`shekk-qa-restricted-…@shekk-test.invalid`):
  accepted their invite the same way; permissions narrowed to
  `["participants"]` only (written directly, since re-entering the real
  owner's browser session mid-test wasn't available in this pass — see
  below — but the write itself is the same shape `staffUpdateTeamMember`
  already writes, and that function is unit-tested). From their own live
  session: `/staff/students` worked, a direct `staffUpsertContent` call
  was rejected server-side ("You do not have permission to do that") —
  real enforcement of a narrowed permission set, not just a UI hide.
- **Removal**: the ordinary-staff account's `programme_staff` row was
  removed; logging back into that same account immediately showed "This
  account isn't set up as programme staff" both in the UI and from
  `staffSession()` directly (zero workspaces) — access revoked
  server-side, confirmed the moment the row was gone, no caching lag.
- **Student** (`shekk-qa-student-…@shekk-test.invalid`): denied `/staff`
  before joining; joined the sandbox cohort via the real join-code flow;
  saw the cohort's actual welcome message, schedule and the full
  10-item checklist at their own (fresh, `0 of 10`) completion state,
  confirming per-student progress isolation; denied `/staff/team` and
  `staffSession()` (zero workspaces) after joining, same as before —
  participant membership never implies staff access. Mobile viewport
  (375px) checked for both the student Today tab and Programme tab —
  rendered cleanly, bottom tab nav intact.
- **One real limitation hit during this pass**: generating a sign-in
  token for the *real* owner's own account (to restore that session after
  testing) was correctly blocked by the environment's own safety
  classifier before any attempt completed. Two consequences: (1) the
  restricted-staff permission edit and the ordinary-staff removal above
  used direct, equivalent-effect writes rather than a live owner session
  for that one step, as noted; (2) this browser's `seed` tab was left
  signed out at `/auth` — the account holder needs to sign back in
  themselves with their own credentials next time they use it. Nothing
  about their account was read, changed, or accessed beyond what this
  conversation already had access to.

**Demo-readiness blockers found**, ranked by how much they'd undermine a
first programme-discovery meeting; only the top one was fixed this pass
(small, high-visibility, copy-only) — the rest are sized for later work,
not attempted here:
1. **Fixed** — `/auth`'s page title, meta description, OG tags and on-page
   promise list led with "one wallet for your year in Israel" / "Money in
   shekels, funded from your home currency" — the pre-pivot, payment-first
   framing `SHEKK_CONTEXT.md` explicitly says is no longer current. Now
   leads with programme/arrival-essentials framing, matching Home and the
   rest of the product. **Deliberately left alone**: the signup screen's
   "The short version" consent paragraph (`Shekk is a shekel spending
   account...`) — that's live Airwallex KYC/consent legal copy attached to
   a checkbox, not marketing copy, and every new signup sees it regardless
   of whether they'll ever touch the paused money features. Worth a
   product/legal call on whether that consent belongs in front of a
   programme student signing up for the first time — not a copy fix.
2. **Not fixed, high impact**: there is no self-service way for a
   programme director to provision their own programme — `adminCreate
   Programme`/`adminCreateCohort`/`adminCreateInvite` are Shekk-internal-
   admin-console-only (`/admin`, `assertAdmin`-gated). A real discovery
   demo needs a Shekk operator to provision the programme by hand first.
3. **Not fixed, visible**: `/staff/settings` is still the Phase-4
   placeholder — a live nav item going nowhere real, next to now-real
   Overview/Content/Team.
4. **Not fixed, known**: documents remain link-only (no native upload —
   documented in the Content checkpoint); notifications are in-app records
   only, no real push/email delivery; current cohort/workspace is picked
   automatically (latest staff grant, oldest cohort) with no manual
   switcher yet (`pickActiveProgrammeId`'s own doc comment already flags
   this). None of these regressed this pass — restated here because the
   brief asked for them to be checked, not assumed.
5. **Not re-verified this pass**: the pre-existing mobile field-staff
   tools at `/programme/staff` — untouched by any of this session's
   checkpoints; last characterized (not re-tested) as a working,
   independent surface.
6. **Cosmetic**: `auth.tsx` still references a legacy
   `shekel-connect.lovable.app` redirect-allowlist entry — not user-facing,
   left alone.

Checklist retirement/progress preservation (Content data-integrity
checkpoint) was re-confirmed still correct during this pass' student
journey — not a new finding, listed here only because the brief asked for
it explicitly.

Verification: 250 tests pass (228 prior + 22 in `team.test.ts`, +0 net new
this exact pass beyond the 2 invite-visibility regression tests already
counted there), typecheck and lint pass on every changed line, production
build passes. Live-verified as above; full account cleanup confirmed by a
direct read.

### Pilot onboarding & Settings checkpoint

Traced the real programme-to-students path end to end before writing any
code, then implemented the single highest-impact gap it found. No parallel
onboarding system was built; no CSV/bulk importer was built.

**How provisioning actually works today**, confirmed by reading
`admin/programmes.tsx` (1027 lines) and the schema, not assumed:
- A **Shekk operator** creates the programme and its first cohort from the
  internal `/admin` console (`NewProgrammeSheet`, `ProgrammeCohorts`) —
  `adminCreateProgramme`/`adminCreateCohort`, `assertAdmin`-gated, exactly
  as the Integration checkpoint's blocker list already said. This is
  accepted as fine for a first pilot per this checkpoint's brief — no
  self-service provisioning was built.
- The **first owner** is assigned from the same console's People tab,
  either by attaching an existing account by email or by minting a claim
  code for someone without one yet (`ProgrammePeople`) — already built,
  unchanged.
- **Students join themselves** with a per-cohort join code
  (`programme_cohorts.join_code`) at `/join/<code>`, via the real
  `programmeCodePreview`/`programmeJoin` server functions
  (`programme-ops.server.ts`, backed by the `programme_join` SQL RPC) —
  this is the actual, live, already-working student-onboarding mechanism,
  not a fallback. There is no per-student invite step for students and no
  CSV import anywhere in the codebase (confirmed by grep — no `csv`,
  `bulk`, or `import` hits in `admin/programmes.tsx` beyond JS `import`
  statements).
- **Duplicates/re-joins are already handled correctly** inside
  `programme_join`: the same code re-entered by an already-joined student
  is idempotent; a different cohort's code marks the old membership
  `left` and creates a new one rather than duplicating rows. This was read
  directly in the migration SQL, not inferred. Nothing needed to change
  here.
- A **legacy** `programme.server.ts`/`useProgramme.ts` layer exists in
  parallel but its write paths (`joinWithCode`, `previewCode`) are dead —
  grepped for every call site and found none; only its read functions are
  used, as Home's safe fallback if the active `useProgrammeHub()` hasn't
  loaded yet. Confirmed this is not a second onboarding system: both
  layers bottom out in the same `programme_join`/`programme_code_preview`
  RPCs.
- **What was genuinely missing**: nowhere in Programme OS could an owner
  or any staff member *find* their own cohort's join code. It only
  existed inside the internal Shekk admin console. `cohortInviteDetails`
  — a correct, already-written, staff-permission-checked function — had
  no UI calling it anywhere in `/staff`. That gap, not a missing importer,
  was the smallest useful fix for "students join the correct cohort."

**What was implemented** (all reusing the existing schema/engine, no new
tables, no new migration):
- `cohortInviteDetails` extended from `{code, path}` to
  `{code, path, status, canManage}`, so a Settings screen can show the
  join code, whether joining is open/closed/archived, and whether the
  viewer is allowed to manage it — in one call.
- Two new owner-only server functions, `staffRegenerateJoinCode` and
  `staffSetCohortJoinable`, both re-checking the caller's owner role
  against the cohort's *actual* `programme_id` server-side (not a claimed
  one) before writing, and both refusing to act on an archived cohort.
- `staff/settings.tsx` rebuilt from the Phase-4 placeholder into a real
  screen: a **Join code** card (any staff can view/copy the link; an
  owner additionally sees Close/Reopen joining and a confirm-gated New
  code action) and a read-only **Programme details** card (name,
  organisation, cohort name/year from `activeWorkspace`), explicitly
  labelled as Shekk-admin-managed with no write path — see "Settings
  scope" below for why.
- `useStaffSettings.ts` — the React Query hook layer (`useStaffCohort
  Settings`, `useStaffRegenerateJoinCode`, `useStaffSetCohortJoinable`),
  matching the pattern every other Programme OS module already uses.

**Resulting end-to-end pilot workflow**: (1) Shekk operator creates the
programme and one cohort in `/admin`; (2) operator assigns the first
owner by email or claim code; (3) owner signs in, opens `/staff/settings`,
copies the join link — no separate lookup or extra tooling needed; (4)
owner shares that link however suits the programme (WhatsApp, email, a
printed sheet); (5) each student opens it, previews the programme name,
and joins — landing straight on their real welcome message, schedule and
checklist. Re-joining, a wrong/expired code, or a student who already has
a Shekk account from elsewhere are all handled by the existing
`programme_join` RPC, not new code.

**Settings scope and its limits**: deliberately only the join code and a
read-only identity view — both because they're the only "settings" with
real backend behaviour behind them today, and per the brief's explicit
instruction not to invent settings without one. Programme name,
organisation and cohort dates stay Shekk-admin-only; the screen says so
on-screen rather than silently omitting the fields or exposing an unsafe
write path. Same owner/staff permission tiers as Team (`requireOwner`/
`requireStaff`), same RLS boundary — no parallel permissions model.

**Checklist-history safeguard**: re-confirmed intact this pass without
repeating the full browser journey — a direct `staffContentOverview` call
against the Shekk Test Programme's cohort showed `archivedAt` present on
every checklist item, 10 active items, 0 archived, matching the Content
data-integrity checkpoint's soft-delete design; `content.test.ts` (its
regression coverage) is unchanged and still passing.

**Tests and live verification**: `settings.test.ts` added, 10 tests —
`cohortInviteDetails` (view access, `canManage` correctness for owner vs
staff, permission rejection for a non-staff caller), `staffRegenerate
JoinCode` (write, cross-programme-ownership rejection, not-found), `staff
SetCohortJoinable` (open, close, archived-cohort refusal, permission
rejection) — following the same hand-rolled fake-Supabase-client pattern
as `team.test.ts`/`content.test.ts`. Full suite: 260/260 passing,
typecheck clean, lint clean on changed lines, production build passes.
Live-verified in the browser against the Shekk Test Programme: the join
code renders and copies correctly; **Close joining** was clicked and then
independently confirmed server-side by calling `programmeCodePreview`
directly, which returned `kind: "unknown"` — proving the toggle has a
real effect, not just a UI label — then reopened.

**Pilot blockers, ranked** (severity to an actual first pilot, not a
wishlist):
1. **Real blocker, unchanged from the Integration checkpoint**: only a
   Shekk operator can provision a programme/cohort and assign the first
   owner — accepted as fine for pilot 1 per this checkpoint's brief, but
   still the first manual step every time.
2. **Not a blocker**: link-only documents. A pilot programme can host
   files anywhere with a shareable link (Drive, Dropbox, a school
   intranet) and paste the link in — no native upload needed to run a
   small pilot.
3. **Not a blocker**: in-app-only notifications. Staff already see
   acknowledgement/read-state in Communications; for a small, engaged
   pilot cohort, in-app is enough to start — real push/email delivery is
   a later enhancement, not a launch requirement.
4. **Not a blocker**: automatic cohort/workspace selection (latest staff
   grant, oldest cohort). A pilot programme is expected to have exactly
   one active cohort per owner at first, so this doesn't surface in
   practice yet — worth a manual switcher once a programme runs multiple
   cohorts at once, not before.
5. **Cosmetic, pre-existing**: the legacy `shekel-connect.lovable.app`
   redirect entry in `auth.tsx` — unrelated to onboarding, left alone.

None of items 2–4 were built this pass, per the brief's explicit
instruction not to build native uploads, push/email delivery or a CRM
just because they're on a gap list — the actual missing piece for a pilot
was the join-code visibility gap fixed above.

**What's needed from FJL for a genuine pilot** (not fabricated — the
Shekk Test Programme and disposable fixtures stand in until this exists):
a real programme/cohort name and rough size (roster count, even
approximate); who the first owner should be (name + email); one place to
point students at for programme documents (an existing Drive/Dropbox
link is enough — no upload pipeline needed); whatever they already use
for a welcome message, schedule and an arrival/onboarding checklist
(even informal notes are enough to seed Content); and how they'd
realistically distribute a join link to their students (a channel that
already exists — WhatsApp group, email list, printed orientation
sheet — nothing new to build for this).

### Pre-demo cleanup & staff-auth checkpoint

Shifted focus back to the student product per this checkpoint's brief: fixed
the confirmed join-code redirect bug, gave staff their own distinct sign-in
surface, closed the money-off gaps the release-readiness assessment found,
and confirmed the one tracked client-side token is genuinely safe. No new
feature module; Programme OS, the financial infrastructure and the current
branch are all unchanged in shape.

**1. Signup-to-programme join redirect, fixed.** The bug: a brand-new
student following a shared `/join/<code>` link had to sign up first: since
email confirmation is a per-project Supabase Auth setting (not something
this codebase controls), `auth.tsx`'s `emailRedirectTo` was previously
hardcoded to `/verify` regardless of where they'd come from — on a project
with confirmation required, confirming the email stranded them on the KYC
page with the join code lost. Fixed by carrying the already-validated
`next` value through as a query param on the confirmation redirect
(`/auth?next=<next>`) instead of a fixed destination — `auth.tsx`'s
existing "already signed in" effect then takes them straight to `next`
once the confirmation lands them back there with a session. The
open-redirect check itself (`safeNext`) was hardened at the same time: it
now normalises backslashes before checking for a leading `//`, closing a
known bypass class (`/\evil.com`, `\\evil.com`) that a same-origin-only
check like this needs to account for. `safeNext`/`afterAuthPath` were
extracted to `src/lib/auth-redirect.ts` (plus a new `afterStaffAuthPath`
for the staff screen below) so this logic has direct unit tests
(`auth-redirect.test.ts`, 10 cases) instead of only being reachable through
a page component.

Live-verified two ways, with disposable accounts, since this project's
linked dev/test Supabase instance has email confirmation disabled (a
deliberate setting — see `supabase/config.toml`'s own comment on avoiding
the shared mailer's rate limit — so the real form can't exercise the
confirmation round trip end to end by itself): (a) the real signup form at
`/auth?next=/join/SHEKKTEST`, which returns a session immediately on this
project and landed correctly on `/join/SHEKKTEST`; (b) the actual
confirmation mechanism, independent of that project setting, by using the
Supabase Admin API to generate a real signup-confirmation token for a
fresh disposable account with the exact `redirectTo` the app now
constructs, consuming it the same way Supabase's own server-side redirect
would (a session established via the same hash-fragment shape), and
confirming it landed on `/join/SHEKKTEST` — not `/verify`.

**2. Staff authentication, differentiated.** New `src/routes/staff-login.tsx`
(`/staff-login`) replaces sending staff through the student `/auth` screen.
Branded "Shekk for Programmes" / "Sign in to your workspace", desktop-first
two-panel layout (a `grad-balance`/`card-sheen` panel matching Programme
OS's own visual language, collapsing to one column on mobile), with two
explicit tabs: **Sign in** (existing staff account, email/password only —
no signup offered here, so nobody can self-register into staff access from
this screen) and **I have an invite** (preview a code, then accept it —
reusing the exact same `useJoinFlow`/`programmeAcceptInvite` server path
Team invites already used, not a new mechanism). A brand-new account can
only be created from inside the invite tab, and only after a real,
unaccepted invite has been previewed — creating the account never grants
staff access by itself; accepting the specific invite still does that
server-side. No student payment/KYC copy anywhere on the screen. Reachable
signed-out (`RequireAccount`'s `OPEN_PREFIXES`); an already-signed-in
non-staff account defaults straight to the invite tab. Fixed a related gap
while wiring this up: `programmeAcceptInvite`'s success didn't invalidate
the separate `["staff","session"]` query Programme OS's own gate reads, so
accepting an invite could land on a stale "not staff" screen for a moment
— `staff-login.tsx` now explicitly invalidates that query before
navigating in. `staff/route.tsx`'s existing "not staff" screen also gained
a link into the invite tab, for a signed-in account that just needs to
redeem a code. `auth.tsx`'s own "Programme staff?" link now points here
instead of `/staff`.

Live-verified end to end with disposable accounts: a disposable owner
account signed in through `/staff-login` and landed on `/staff/overview`;
that owner created a real staff invite through the actual `staffTeamInvite`
server function; a second, brand-new disposable account opened
`/staff-login?code=<the invite>`, saw it auto-previewed, created an
account through the invite tab's embedded form, and landed on
`/staff/overview` with the roster count correctly at 3 — no stale
"not staff" flash. Also checked the edge cases the code branches on: a
student cohort code entered in the invite tab is rejected with an
explicit "that's a student join code" message rather than a confusing
generic error, and re-opening the now-accepted invite link correctly shows
"This invite has already been used" with no accept button. All disposable
accounts, the extra `programme_staff` rows and the used invite were
deleted afterward — the Shekk Test Programme's owner/membership counts
were confirmed back to exactly what they were before this pass.

**3. Money-off gating, completed.** `MONEY_ENABLED=false` (`src/lib/flags.ts`)
already kept money off the nav and Home's prompts, but several surfaces the
release-readiness assessment found had never actually been gated — all
fixed the same way the rest of the flag's surfaces already were (a
conditional on the same flag, nothing deleted, so turning money back on
restores every one of these with no further work):
- `auth.tsx`'s signup screen: the financial consent paragraph ("Shekk is a
  shekel spending account… Airwallex…") and the footer's "Identity checks
  are run by our regulated payment partner" line are gone from general
  signup. The equivalent, actually-required consent capture (US-person/PEP
  declarations, terms acceptance) already exists at the real KYC step in
  `/verify` (`draft.acceptTerms` etc.) and is untouched — nothing about the
  legally-required financial consent itself was removed, only the
  duplicate/premature copy that appeared before a student had any reason
  to open a financial account. **Flagging for legal/product review, not
  deciding it myself:** confirm this split (generic ToS at signup, full
  financial consent only at `/verify`) is acceptable before this reaches a
  real audience beyond a demo.
- `welcome.tsx`: the onboarding wizard's "money" and "verify" chapters are
  excluded from the step flow while the flag is off (same filter pattern
  already used to skip the programme step for independents); the
  signed-out Landing screen's "Spend in shekels" bullet and its footer
  line swap to non-money copy; the completion screen drops the "Adding
  money in" summary row, the "Identity check" quick link, and its
  fallback "Recommended next" action (now "Explore Israel" instead of
  "Add your first money" when there's no nearer programme/flight action).
- `settings.tsx`: the whole Payments section — including a hardcoded fake
  card, `•••• 4417 · Visa`, that had no real backing state — is gone,
  matching how `me.tsx` already gated its own money content; the page
  header no longer states a shekel balance. **Deliberately left alone**:
  Notifications' and Security's several money-specific toggles (Split
  requests, Face ID to pay, Discoverable by friend code, …) and the
  page's closing "balances are held in shekels" legal line — a
  materially bigger surface than what this pass was scoped to, flagged
  here for a later pass rather than expanded into now.
- `ReverifyBanner` (`AppShell.tsx`) now gates on the flag itself, closing
  the one call site (`wallet.tsx`) that rendered it unconditionally rather
  than relying on every caller to remember to check; the in-app search
  index no longer lists "Re-verify" as a destination while the flag is
  off. **Deliberately left alone**: `lib/search.ts`'s several other
  money-tagged entries (Top up, Money, Exchange money, Friends' "sending
  shekels" copy) — pre-existing, broader than what was named, flagged
  for the same later pass.
- Home: the "Requests" split-repayment widget (`lib/widgets.ts`) is
  filtered out of the widget catalogue entirely while the flag is off
  (so it can't be re-pinned via For You customisation either), and
  `ActiveNow`'s "Pending split… Pay now" card is gated the same way.
  Both were previously invisible only because a fresh account has no
  splits — a real pilot account with one would have seen them.
- `reset-password.tsx`'s success copy ("Go to my wallet") now reads
  generically and returns to `/`, since this screen is reachable from
  both the student and staff sign-in flows and has no way to know which.
- `reverify.tsx` itself (an explicit, already-labelled prototype/mockup)
  was left untouched — it's preserved future functionality, not a bug —
  its entry points were closed instead, per above.

**4. Environment/token hygiene, checked.** `VITE_PAYMENTS_CLIENT_TOKEN`
(tracked in `.env.development`) is confirmed genuinely client-safe, not a
secret: its own consuming code (`src/lib/stripe.ts`) validates it must
start with `pk_test_` or `pk_live_` before use, which is Stripe's own
publishable-key prefix convention — publishable keys are designed to ship
in client bundles and can only initialise Stripe.js, never charge a card
or read account data (that requires the separate, never-committed
`sk_...` secret key). The actual value was confirmed to start with
`pk_test_` without printing it anywhere. **No rotation needed.** The
`.env`/`.env.development` files remain tracked in git (pre-existing, not
changed this pass) with only this token and Supabase's publishable/anon
key in them — still worth untracking `.env*` from git as a hygiene
improvement at some point, but not urgent since no secret is exposed.

**Tests and build:** 10 new tests in `auth-redirect.test.ts`; 270/270
passing overall, typecheck clean, lint clean on changed lines (the
project's pre-existing CRLF line endings produce prettier noise across
entire pre-existing files regardless of what changed — verified none of
that noise falls on an actually-changed line), production build passes.

**Remaining demo blockers, ranked** (unchanged from the release-readiness
assessment unless noted): (1) only a Shekk operator can provision a
programme/assign the first owner — still accepted as fine for pilot 1;
(2) Settings' remaining money-specific toggles and the search index's
other money-tagged entries — cosmetic now that the load-bearing surfaces
are closed, not blockers; (3) link-only documents, in-app-only
notifications, single-cohort auto-selection — unchanged, not blockers for
a small pilot. Nothing new was found this pass beyond what's listed above.

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
and lives at `/verify` (not audited this pass). As of the Pre-demo cleanup
checkpoint, the wizard's "money" and "verify" chapters are skipped entirely
while `MONEY_ENABLED` is off (same pattern already used to skip the
programme "code" chapter for independents) — see that checkpoint below.

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

The Pre-demo cleanup checkpoint (below) closed several surfaces where that
gate wasn't actually applied — `settings.tsx`'s Payments section (incl. a
hardcoded fake card), the onboarding wizard's money/KYC chapters, a
signed-out-landing money bullet, the `ReverifyBanner` component, a
search-index entry for `/reverify`, and two Home widgets (the "Requests"
split-repayment tile, `ActiveNow`'s pending-split card). All now gate on
the same `MONEY_ENABLED` flag rather than being deleted, so switching money
back on restores them with no further IA work — see that checkpoint for
the full list and what's still deliberately untouched (Settings'
Notifications/Security toggles, the in-app search's other money-tagged
entries).

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
