# Programme OS — product spec

This is the durable spec for what Programme OS should become. It describes
intent, not implementation status — for what's actually built today, see
[`CURRENT_STATE.md`](./CURRENT_STATE.md). Nothing in this file should be read
as "this exists" just because it's specified here.

## Purpose

Programmes currently run much of the student journey through a fragmented mix
of WhatsApp, email, spreadsheets, Google Forms, PDFs and separate calendars.
Programme OS gives programme managers, administrators and staff a proper
system to manage that journey through Shekk instead — complementing existing
programme operations rather than replacing all of them on day one.

The core loop:

```
Programme creates or updates something
  → Student receives it in Shekk
  → Student responds / completes / acknowledges / checks in
  → Staff see the result
  → Staff act on exceptions
```

## Product surfaces

- **Desktop Programme OS** (`/staff`, `ProgrammeOSShell`) — programme
  management and office operations. Information-dense, desktop-first.
- **Existing mobile staff tools** (`/programme/staff`) — useful actions for
  madrichim/staff while physically with students, in the field.

Both surfaces sit over the same underlying programme engine (programmes,
cohorts, groups, memberships, staff, checklists, announcements,
acknowledgements, events, audiences, permissions) — they are not, and should
not become, two parallel systems for the same concepts.

## Conceptual hierarchy

```
Organisation
  → Programme
    → Cohort
      → Group
        → Student
```

**Organisation is conceptual today.** There is currently no dedicated
`organisations` table in the schema — programmes are not yet grouped under a
formal organisation entity. Don't invent or migrate that layer without
inspecting the current schema and agreeing an implementation plan first.

## V1 modules

- Overview
- Students
- Onboarding
- Communications
- Calendar
- Content
- Team
- Settings

## Later modules

Not part of V1 — don't assume any of these exist yet:

- Attendance
- Forms
- Requests / helpdesk
- Tasks / cases
- Services
- Analytics

## Product principles

- Operational, not a generic CRM — the product should help staff go from
  "see a problem" to "click, solve it," not force them to configure a
  general-purpose system.
- Desktop information density is appropriate here — this doesn't need to feel
  like a mobile app stretched wide, and shouldn't default to generic SaaS
  dashboard styling either.
- The programme side and the student side should feel like one connected
  workflow, not two disconnected products that happen to share a login.
- Permissions and data sensitivity matter — student data, onboarding
  documents and programme communications are not low-stakes content.
- Reuse the existing programme engine. Extend it; don't fork it.
