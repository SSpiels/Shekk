import { afterEach, describe, expect, it, vi } from "vitest";
import {
  announcementAcknowledgementStats,
  audienceAllows,
  audienceLabel,
  changeLine,
  checklistProgress,
  delayBy,
  emptyHub,
  eventFullForGoing,
  eventResponseBreakdown,
  everyone,
  filterForViewer,
  fmtIsraelTime,
  countOnboardingStatuses,
  filterOnboardingStudents,
  filterStaffStudents,
  importantChanges,
  isoToIsraelLocalInput,
  israelDateKey,
  israelLocalInputToIso,
  nextEvent,
  nowEvent,
  onboardingComplete,
  onboardingItemStats,
  onboardingStatus,
  openVotes,
  overallOnboardingPercent,
  pendingAcknowledgements,
  pickActiveProgrammeId,
  placeDirectionsUrl,
  staffCan,
  statusTone,
  todaysEvents,
  updatedAgo,
  voteBlockedReason,
  type Audience,
  type ChecklistItem,
  type ChecklistProgress,
  type CommunicationsMember,
  type ProgrammeEvent,
  type ProgrammeHub,
  type ProgrammeVote,
  type StaffContext,
  type StaffOnboardingStudent,
  type StaffStudentSummary,
  type StaffWorkspace,
} from "./logic";

/* ───────────────────────────────── fixtures ──────────────────────────────── */

const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const aud = (kind: Audience["kind"], groupIds: string[] = [], userIds: string[] = []): Audience => ({
  kind,
  groupIds,
  userIds,
});

function ev(over: Partial<ProgrammeEvent> = {}): ProgrammeEvent {
  return {
    id: "e1",
    title: "Tiyul",
    description: null,
    startsAt: "2026-08-24T09:00:00.000Z",
    endsAt: "2026-08-24T11:00:00.000Z",
    originalStartsAt: null,
    timezone: "Asia/Jerusalem",
    locationLabel: null,
    meetingPoint: null,
    googlePlaceId: null,
    latitude: null,
    longitude: null,
    onlineUrl: null,
    eventType: "trip",
    mandatory: false,
    status: "scheduled",
    statusNote: null,
    audience: everyone,
    rsvpEnabled: false,
    capacity: null,
    requiresAck: false,
    urgent: false,
    lastChangedAt: null,
    updatedAt: "2026-08-24T08:00:00.000Z",
    myRsvp: null,
    acknowledged: false,
    goingCount: null,
    ackCount: null,
    changes: [],
    ...over,
  };
}

function vote(over: Partial<ProgrammeVote> = {}): ProgrammeVote {
  return {
    id: "v1",
    eventId: null,
    question: "Which tiyul?",
    description: null,
    voteKind: "poll",
    createdAt: "2026-08-24T08:00:00.000Z",
    status: "open",
    anonymous: false,
    allowChange: false,
    resultsVisible: true,
    audience: everyone,
    closesAt: null,
    closedAt: null,
    winningOptionId: null,
    options: [
      { id: "o1", label: "Masada", detail: null, capacity: 2, count: 2 },
      { id: "o2", label: "Golan", detail: null, capacity: null, count: 0 },
    ],
    myOptionId: null,
    responseCount: 2,
    ...over,
  };
}

/* ───────────────────────────────── permissions ───────────────────────────── */

describe("staffCan", () => {
  const owner: StaffContext = { programmeId: "p", cohortId: "c", role: "owner", permissions: [] };
  const scoped: StaffContext = {
    programmeId: "p",
    cohortId: "c",
    role: "staff",
    permissions: ["events"],
  };
  const unscoped: StaffContext = { programmeId: "p", cohortId: "c", role: "staff", permissions: [] };

  it("denies participants (no staff context)", () => {
    expect(staffCan(null, "events")).toBe(false);
    expect(staffCan(null, "participants")).toBe(false);
  });

  it("allows owners everything", () => {
    expect(staffCan(owner, "events")).toBe(true);
    expect(staffCan(owner, "participants")).toBe(true);
  });

  it("restricts scoped staff to their granted permissions", () => {
    expect(staffCan(scoped, "events")).toBe(true);
    expect(staffCan(scoped, "votes")).toBe(false);
    expect(staffCan(scoped, "participants")).toBe(false);
  });

  it("treats an empty permission list as the default full staff set", () => {
    expect(staffCan(unscoped, "announcements")).toBe(true);
  });
});

/* ─────────────────────────────── audience targeting ──────────────────────── */

describe("audience targeting", () => {
  const viewer = { userId: ME, groupIds: [G1] };

  it("everyone reaches every participant", () => {
    expect(audienceAllows(everyone, viewer)).toBe(true);
    expect(audienceAllows(everyone, { userId: OTHER, groupIds: [] })).toBe(true);
  });

  it("group content only reaches members of that group", () => {
    const a = aud("groups", [G1]);
    expect(audienceAllows(a, viewer)).toBe(true);
    expect(audienceAllows(a, { userId: OTHER, groupIds: [G2] })).toBe(false);
    expect(audienceAllows(a, { userId: OTHER, groupIds: [] })).toBe(false);
  });

  it("individual content only reaches the named people", () => {
    const a = aud("individuals", [], [ME]);
    expect(audienceAllows(a, viewer)).toBe(true);
    expect(audienceAllows(a, { userId: OTHER, groupIds: [G1] })).toBe(false);
  });

  it("filters mixed rows for one viewer", () => {
    const rows = [
      { id: "all", audience: everyone },
      { id: "g1", audience: aud("groups", [G1]) },
      { id: "g2", audience: aud("groups", [G2]) },
      { id: "me", audience: aud("individuals", [], [ME]) },
      { id: "them", audience: aud("individuals", [], [OTHER]) },
    ];
    expect(filterForViewer(rows, viewer).map((r) => r.id)).toEqual(["all", "g1", "me"]);
  });

  it("labels audiences for staff", () => {
    const groups = [
      { id: G1, name: "Bus A" },
      { id: G2, name: "Bus B" },
    ];
    expect(audienceLabel(everyone, groups)).toBe("Everyone");
    expect(audienceLabel(aud("groups", [G1, G2]), groups)).toBe("Bus A, Bus B");
    expect(audienceLabel(aud("groups", ["gone"]), groups)).toBe("Selected groups");
    expect(audienceLabel(aud("individuals", [], [ME]), groups)).toBe("1 person");
    expect(audienceLabel(aud("individuals", [], [ME, OTHER]), groups)).toBe("2 people");
  });
});

/* ───────────────────────────── live programme view ───────────────────────── */

describe("live schedule", () => {
  const at = Date.parse("2026-08-24T09:30:00.000Z");

  it("finds what is happening now, ignoring cancelled events", () => {
    expect(nowEvent([ev()], at)?.id).toBe("e1");
    expect(nowEvent([ev({ status: "cancelled" })], at)).toBeNull();
  });

  it("finds the next upcoming event in start order", () => {
    const later = ev({ id: "late", startsAt: "2026-08-24T18:00:00.000Z", endsAt: null });
    const soon = ev({ id: "soon", startsAt: "2026-08-24T12:00:00.000Z", endsAt: null });
    expect(nextEvent([later, soon], at)?.id).toBe("soon");
    expect(nextEvent([ev({ status: "cancelled", startsAt: "2026-08-24T12:00:00.000Z" })], at)).toBeNull();
  });

  it("groups today's events by Israel day and sorts them", () => {
    const ref = new Date("2026-08-24T09:00:00.000Z");
    const today = ev({ id: "b", startsAt: "2026-08-24T15:00:00.000Z" });
    const alsoToday = ev({ id: "a", startsAt: "2026-08-24T07:00:00.000Z" });
    const tomorrow = ev({ id: "c", startsAt: "2026-08-27T07:00:00.000Z" });
    expect(todaysEvents([today, alsoToday, tomorrow], ref).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("counts an event as 'today' by the Israel calendar day, not the UTC one", () => {
    // 22:00 UTC on 24 Aug is 01:00 on 25 Aug in Israel (summer, UTC+3) — a
    // naive UTC or browser-local .toDateString() comparison would wrongly
    // call this "the 24th".
    const ref = new Date("2026-08-25T06:00:00.000Z"); // 09:00 Israel, 25 Aug
    const justAfterIsraelMidnight = ev({ id: "a", startsAt: "2026-08-24T22:00:00.000Z" });
    const stillThe24thInIsrael = ev({ id: "b", startsAt: "2026-08-24T20:00:00.000Z" });
    expect(
      todaysEvents([justAfterIsraelMidnight, stillThe24thInIsrael], ref).map((e) => e.id),
    ).toEqual(["a"]);
  });

  it("tones statuses so changes read as attention", () => {
    expect(statusTone("cancelled")).toBe("attention");
    expect(statusTone("delayed")).toBe("attention");
    expect(statusTone("moved")).toBe("attention");
    expect(statusTone("confirmed")).toBe("live");
    expect(statusTone("completed")).toBe("quiet");
    expect(statusTone("scheduled")).toBe("pending");
  });

  it("delays a start time by minutes", () => {
    expect(delayBy("2026-08-24T09:00:00.000Z", 45)).toBe("2026-08-24T09:45:00.000Z");
  });

  it("reports freshness honestly", () => {
    const now = Date.parse("2026-08-24T12:00:00.000Z");
    expect(updatedAgo(null, now)).toBeNull();
    expect(updatedAgo("2026-08-24T11:58:00.000Z", now)).toBe("Updated 2 min ago");
    expect(updatedAgo("2026-08-24T09:00:00.000Z", now)).toBe("Updated 3h ago");
    expect(updatedAgo("2026-08-22T12:00:00.000Z", now)).toBe("Updated 2d ago");
  });
});

/* ──────────────────────────── change history surfacing ───────────────────── */

describe("importantChanges", () => {
  const now = Date.parse("2026-08-24T12:00:00.000Z");
  const change = (over: Partial<ProgrammeHub["recentChanges"][number]>) => ({
    id: "c1",
    eventId: "e1",
    eventTitle: "Tiyul",
    field: "starts_at",
    before: "09:00",
    after: "10:00",
    note: null,
    notifyLevel: "notify" as const,
    changedAt: "2026-08-24T11:00:00.000Z",
    ...over,
  });

  it("keeps recent, non-silent changes", () => {
    const hub = { events: [], recentChanges: [change({})] };
    expect(importantChanges(hub, 48, now)).toHaveLength(1);
  });

  it("drops silent bookkeeping and stale changes", () => {
    const hub = {
      events: [],
      recentChanges: [
        change({ id: "silent", notifyLevel: "silent" }),
        change({ id: "old", changedAt: "2026-08-01T11:00:00.000Z" }),
      ],
    };
    expect(importantChanges(hub, 48, now)).toEqual([]);
  });
});

/* ──────────────────────────────────── votes ──────────────────────────────── */

describe("voteBlockedReason", () => {
  it("blocks a closed vote", () => {
    expect(voteBlockedReason(vote({ status: "closed" }))).toBe("This vote is closed");
  });

  it("enforces one response per participant unless changes are allowed", () => {
    expect(voteBlockedReason(vote({ myOptionId: "o2" }))).toBe("You have already voted");
    expect(voteBlockedReason(vote({ myOptionId: "o2", allowChange: true }))).toBeNull();
  });

  it("rejects unknown options", () => {
    expect(voteBlockedReason(vote(), "nope")).toBe("That option is not part of this vote");
  });

  it("respects per-option capacity", () => {
    expect(voteBlockedReason(vote(), "o1")).toBe("That option is full");
    expect(voteBlockedReason(vote(), "o2")).toBeNull();
  });

  it("lets a participant keep the full option they already hold", () => {
    expect(voteBlockedReason(vote({ myOptionId: "o1", allowChange: true }), "o1")).toBeNull();
  });

  it("lists only open votes", () => {
    expect(openVotes([vote(), vote({ id: "v2", status: "closed" })]).map((v) => v.id)).toEqual(["v1"]);
  });
});

/* ─────────────────────────── RSVP capacity + acks ────────────────────────── */

describe("RSVP capacity", () => {
  it("is never full without a capacity or a known count", () => {
    expect(eventFullForGoing(ev())).toBe(false);
    expect(eventFullForGoing(ev({ capacity: 10, goingCount: null }))).toBe(false);
  });

  it("blocks new going responses at capacity but not existing ones", () => {
    expect(eventFullForGoing(ev({ capacity: 2, goingCount: 2 }))).toBe(true);
    expect(eventFullForGoing(ev({ capacity: 2, goingCount: 2, myRsvp: "going" }))).toBe(false);
    expect(eventFullForGoing(ev({ capacity: 3, goingCount: 2 }))).toBe(false);
  });
});

describe("pendingAcknowledgements", () => {
  it("collects unacknowledged announcements and events, skipping cancelled and done", () => {
    const hub: ProgrammeHub = {
      ...emptyHub,
      announcements: [
        {
          id: "a1",
          title: "Curfew change",
          body: "b",
          pinned: false,
          priority: "urgent",
          publishedAt: "2026-08-24T10:00:00.000Z",
          requiresAck: true,
          audience: everyone,
          eventId: null,
          linkUrl: null,
          acknowledged: false,
          ackCount: null,
        },
        {
          id: "a2",
          title: "Already read",
          body: "b",
          pinned: false,
          priority: "normal",
          publishedAt: "2026-08-24T10:00:00.000Z",
          requiresAck: true,
          audience: everyone,
          eventId: null,
          linkUrl: null,
          acknowledged: true,
          ackCount: null,
        },
      ],
      events: [
        ev({ id: "e1", requiresAck: true, urgent: true }),
        ev({ id: "e2", requiresAck: true, status: "cancelled" }),
        ev({ id: "e3", requiresAck: true, acknowledged: true }),
      ],
    };
    expect(pendingAcknowledgements(hub)).toEqual([
      { subjectType: "announcement", id: "a1", title: "Curfew change", priority: "urgent" },
      { subjectType: "event", id: "e1", title: "Tiyul", priority: "urgent" },
    ]);
  });
});

/* ─────────────────────────── checklist + places UI ───────────────────────── */

describe("checklistProgress", () => {
  const item = (over: Partial<ChecklistItem>): ChecklistItem => ({
    id: "i",
    itemKey: "k",
    title: "t",
    details: null,
    dueOn: null,
    required: true,
    actionUrl: null,
    featureKey: null,
    audience: everyone,
    done: false,
    doneCount: null,
    ...over,
  });

  it("counts required progress separately", () => {
    const p = checklistProgress([
      item({ id: "a", done: true }),
      item({ id: "b" }),
      item({ id: "c", required: false, done: true }),
      item({ id: "d", required: false }),
    ]);
    expect(p).toEqual({ done: 2, total: 4, requiredDone: 1, requiredTotal: 2, percent: 50 });
  });

  it("handles an empty checklist without dividing by zero", () => {
    expect(checklistProgress([]).percent).toBe(0);
  });
});

describe("placeDirectionsUrl", () => {
  it("prefers coordinates plus the place id", () => {
    expect(placeDirectionsUrl({ latitude: 31.78, longitude: 35.22, googlePlaceId: "abc" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=31.78,35.22&destination_place_id=abc",
    );
  });

  it("falls back to address then label", () => {
    expect(placeDirectionsUrl({ address: "King George 1, Jerusalem" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=King%20George%201%2C%20Jerusalem",
    );
    expect(placeDirectionsUrl({ label: "Meeting point" })).toContain("destination=Meeting%20point");
  });

  it("returns null when there is nothing to navigate to", () => {
    expect(placeDirectionsUrl({})).toBeNull();
  });
});

describe("pickActiveProgrammeId", () => {
  const workspace = (over: Partial<StaffWorkspace>): StaffWorkspace => ({
    programmeId: "p1",
    programmeName: "Programme",
    organisation: null,
    role: "staff",
    permissions: [],
    cohort: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });

  it("returns null for no workspaces", () => {
    expect(pickActiveProgrammeId([])).toBeNull();
  });

  it("is the only workspace when there is exactly one", () => {
    expect(pickActiveProgrammeId([workspace({ programmeId: "solo" })])).toBe("solo");
  });

  it("picks the most recently granted staff row, regardless of input order", () => {
    const older = workspace({ programmeId: "older", createdAt: "2025-01-01T00:00:00.000Z" });
    const newer = workspace({ programmeId: "newer", createdAt: "2026-06-01T00:00:00.000Z" });
    expect(pickActiveProgrammeId([older, newer])).toBe("newer");
    expect(pickActiveProgrammeId([newer, older])).toBe("newer");
  });
});

describe("onboardingComplete", () => {
  const progress = (over: Partial<ChecklistProgress>): ChecklistProgress => ({
    done: 0,
    total: 0,
    requiredDone: 0,
    requiredTotal: 0,
    percent: 0,
    ...over,
  });

  it("is complete once every required item is done, optional items notwithstanding", () => {
    expect(
      onboardingComplete(progress({ requiredDone: 3, requiredTotal: 3, done: 3, total: 5, percent: 60 })),
    ).toBe(true);
  });

  it("is not complete while a required item is outstanding, even at a high overall percent", () => {
    expect(
      onboardingComplete(progress({ requiredDone: 3, requiredTotal: 4, done: 8, total: 9, percent: 88 })),
    ).toBe(false);
  });

  it("falls back to the overall percent when a cohort has zero required items", () => {
    expect(onboardingComplete(progress({ requiredTotal: 0, total: 2, done: 2, percent: 100 }))).toBe(true);
    expect(onboardingComplete(progress({ requiredTotal: 0, total: 2, done: 1, percent: 50 }))).toBe(false);
  });

  it("an empty checklist is not complete", () => {
    expect(onboardingComplete(progress({}))).toBe(false);
  });
});

describe("filterStaffStudents", () => {
  const student = (over: Partial<StaffStudentSummary>): StaffStudentSummary => ({
    userId: "u1",
    displayName: "Rachel Cohen",
    handle: "rachel",
    groups: [{ id: "g1", name: "Jerusalem A" }],
    lifecycleStatus: null,
    homeCountry: null,
    israelCity: null,
    accommodationArea: null,
    arrivalDate: null,
    joinedAt: "2026-01-01T00:00:00.000Z",
    checklist: { done: 1, total: 2, requiredDone: 1, requiredTotal: 2, percent: 50 },
    ...over,
  });

  it("matches search against display name and handle, case-insensitively", () => {
    const rows = [student({ userId: "a", displayName: "Rachel Cohen", handle: "rachel" })];
    expect(filterStaffStudents(rows, { q: "rachel", groupId: "", onboarding: "" })).toHaveLength(1);
    expect(filterStaffStudents(rows, { q: "COHEN", groupId: "", onboarding: "" })).toHaveLength(1);
    expect(filterStaffStudents(rows, { q: "nobody", groupId: "", onboarding: "" })).toHaveLength(0);
  });

  it("filters by group id", () => {
    const rows = [
      student({ userId: "a", groups: [{ id: "g1", name: "A" }] }),
      student({ userId: "b", groups: [{ id: "g2", name: "B" }] }),
    ];
    expect(filterStaffStudents(rows, { q: "", groupId: "g2", onboarding: "" }).map((s) => s.userId)).toEqual(["b"]);
  });

  it("filters by onboarding completion, respecting required-vs-optional", () => {
    const rows = [
      student({ userId: "done", checklist: { done: 2, total: 3, requiredDone: 2, requiredTotal: 2, percent: 67 } }),
      student({ userId: "not-done", checklist: { done: 1, total: 3, requiredDone: 1, requiredTotal: 2, percent: 33 } }),
    ];
    expect(filterStaffStudents(rows, { q: "", groupId: "", onboarding: "complete" }).map((s) => s.userId)).toEqual([
      "done",
    ]);
    expect(filterStaffStudents(rows, { q: "", groupId: "", onboarding: "incomplete" }).map((s) => s.userId)).toEqual([
      "not-done",
    ]);
  });

  it("combines filters", () => {
    const rows = [
      student({ userId: "a", displayName: "Rachel", groups: [{ id: "g1", name: "A" }] }),
      student({ userId: "b", displayName: "Rachel", groups: [{ id: "g2", name: "B" }] }),
    ];
    expect(
      filterStaffStudents(rows, { q: "rachel", groupId: "g2", onboarding: "" }).map((s) => s.userId),
    ).toEqual(["b"]);
  });
});

describe("onboardingStatus", () => {
  const now = new Date("2026-06-15T00:00:00.000Z");
  const progress = (over: Partial<ChecklistProgress>): ChecklistProgress => ({
    done: 0,
    total: 0,
    requiredDone: 0,
    requiredTotal: 0,
    percent: 0,
    ...over,
  });

  it("is not_started when nothing is done yet", () => {
    expect(onboardingStatus(progress({ done: 0, total: 3 }), [], now)).toBe("not_started");
  });

  it("is complete once every required item is done", () => {
    const items = [{ required: true, done: true, dueOn: null }];
    expect(
      onboardingStatus(progress({ done: 1, total: 1, requiredDone: 1, requiredTotal: 1 }), items, now),
    ).toBe("complete");
  });

  it("is needs_attention when a required item is overdue and undone", () => {
    const items = [
      { required: true, done: false, dueOn: "2026-01-01T00:00:00.000Z" },
      { required: false, done: true, dueOn: null },
    ];
    expect(
      onboardingStatus(progress({ done: 1, total: 2, requiredDone: 0, requiredTotal: 1 }), items, now),
    ).toBe("needs_attention");
  });

  it("is in_progress when partway through with nothing overdue", () => {
    const items = [
      { required: true, done: false, dueOn: "2026-12-01T00:00:00.000Z" },
      { required: false, done: true, dueOn: null },
    ];
    expect(
      onboardingStatus(progress({ done: 1, total: 2, requiredDone: 0, requiredTotal: 1 }), items, now),
    ).toBe("in_progress");
  });

  it("a required item with no due date is never treated as overdue", () => {
    const items = [{ required: true, done: false, dueOn: null }];
    expect(
      onboardingStatus(progress({ done: 0, total: 1, requiredDone: 0, requiredTotal: 1 }), items, now),
    ).toBe("not_started");
  });
});

describe("onboardingItemStats", () => {
  const student = (items: StaffOnboardingStudent["checklistItems"]) => ({ checklistItems: items });

  it("computes per-item completion percent across the students given", () => {
    const stats = onboardingItemStats([
      student([{ id: "i1", itemKey: "visa", title: "Visa", details: null, dueOn: null, required: true, done: true, actionUrl: null }]),
      student([{ id: "i1", itemKey: "visa", title: "Visa", details: null, dueOn: null, required: true, done: false, actionUrl: null }]),
    ]);
    expect(stats).toEqual([
      { itemId: "i1", itemKey: "visa", title: "Visa", required: true, doneCount: 1, percent: 50 },
    ]);
  });

  it("returns an empty list for no students", () => {
    expect(onboardingItemStats([])).toEqual([]);
  });
});

describe("overallOnboardingPercent", () => {
  it("weights by required items when any exist", () => {
    expect(
      overallOnboardingPercent([
        { done: 1, total: 4, requiredDone: 1, requiredTotal: 2, percent: 25 },
        { done: 2, total: 4, requiredDone: 2, requiredTotal: 2, percent: 50 },
      ]),
    ).toBe(75); // (1+2) done of (2+2) required
  });

  it("falls back to overall percent when nobody has required items", () => {
    expect(
      overallOnboardingPercent([
        { done: 2, total: 2, requiredDone: 0, requiredTotal: 0, percent: 100 },
        { done: 0, total: 2, requiredDone: 0, requiredTotal: 0, percent: 0 },
      ]),
    ).toBe(50);
  });

  it("is 0 for an empty cohort", () => {
    expect(overallOnboardingPercent([])).toBe(0);
  });
});

describe("countOnboardingStatuses", () => {
  it("tallies every status, including zero counts", () => {
    expect(countOnboardingStatuses(["complete", "complete", "not_started"])).toEqual({
      not_started: 1,
      in_progress: 0,
      needs_attention: 0,
      complete: 2,
    });
  });
});

describe("filterOnboardingStudents", () => {
  const student = (over: Partial<StaffOnboardingStudent>): StaffOnboardingStudent => ({
    userId: "u1",
    displayName: "Rachel Cohen",
    handle: "rachel",
    groups: [{ id: "g1", name: "Jerusalem A" }],
    lifecycleStatus: null,
    homeCountry: null,
    israelCity: null,
    accommodationArea: null,
    arrivalDate: null,
    joinedAt: "2026-01-01T00:00:00.000Z",
    checklist: { done: 1, total: 2, requiredDone: 1, requiredTotal: 2, percent: 50 },
    status: "in_progress",
    checklistItems: [],
    ...over,
  });

  it("matches search against display name and handle", () => {
    const rows = [student({ userId: "a", displayName: "Rachel Cohen", handle: "rachel" })];
    expect(filterOnboardingStudents(rows, { q: "rachel", groupId: "", status: "" })).toHaveLength(1);
    expect(filterOnboardingStudents(rows, { q: "nobody", groupId: "", status: "" })).toHaveLength(0);
  });

  it("filters by group id", () => {
    const rows = [
      student({ userId: "a", groups: [{ id: "g1", name: "A" }] }),
      student({ userId: "b", groups: [{ id: "g2", name: "B" }] }),
    ];
    expect(
      filterOnboardingStudents(rows, { q: "", groupId: "g2", status: "" }).map((s) => s.userId),
    ).toEqual(["b"]);
  });

  it("filters by status", () => {
    const rows = [
      student({ userId: "a", status: "needs_attention" }),
      student({ userId: "b", status: "complete" }),
    ];
    expect(
      filterOnboardingStudents(rows, { q: "", groupId: "", status: "needs_attention" }).map((s) => s.userId),
    ).toEqual(["a"]);
  });
});

describe("announcementAcknowledgementStats", () => {
  const member = (over: Partial<CommunicationsMember> = {}): CommunicationsMember => ({
    userId: "u1",
    displayName: "Rachel Cohen",
    handle: "rachel",
    groupIds: [],
    ...over,
  });

  it("everyone audience: eligible is the whole roster, not just those in a group", () => {
    const members = [
      member({ userId: "a", displayName: "Ann", groupIds: ["bus1"] }),
      member({ userId: "b", displayName: "Ben", groupIds: [] }),
    ];
    const stats = announcementAcknowledgementStats(everyone, members, []);
    expect(stats.eligibleCount).toBe(2);
    expect(stats.outstandingCount).toBe(2);
  });

  it("groups audience: only members of a targeted group are eligible", () => {
    const members = [
      member({ userId: "a", displayName: "Ann", groupIds: ["bus1"] }),
      member({ userId: "b", displayName: "Ben", groupIds: ["bus2"] }),
      member({ userId: "c", displayName: "Cara", groupIds: ["bus1", "bus2"] }),
    ];
    const audience: Audience = { kind: "groups", groupIds: ["bus1"], userIds: [] };
    const stats = announcementAcknowledgementStats(audience, members, []);
    expect(stats.eligibleCount).toBe(2);
    expect(stats.outstanding.map((s) => s.userId).sort()).toEqual(["a", "c"]);
  });

  it("individuals audience: only the named students are eligible", () => {
    const members = [
      member({ userId: "a", displayName: "Ann" }),
      member({ userId: "b", displayName: "Ben" }),
    ];
    const audience: Audience = { kind: "individuals", groupIds: [], userIds: ["b"] };
    const stats = announcementAcknowledgementStats(audience, members, []);
    expect(stats.eligibleCount).toBe(1);
    expect(stats.outstanding.map((s) => s.userId)).toEqual(["b"]);
  });

  it("the denominator is the eligible audience, not the whole cohort", () => {
    const members = [
      member({ userId: "a", displayName: "Ann", groupIds: ["bus1"] }),
      member({ userId: "b", displayName: "Ben", groupIds: ["bus2"] }),
      member({ userId: "c", displayName: "Cara", groupIds: ["bus2"] }),
    ];
    const audience: Audience = { kind: "groups", groupIds: ["bus2"], userIds: [] };
    const stats = announcementAcknowledgementStats(audience, members, ["b"]);
    // 2 eligible (b, c), not 3 — and 1 of those 2 has acknowledged.
    expect(stats.eligibleCount).toBe(2);
    expect(stats.ackCount).toBe(1);
    expect(stats.outstandingCount).toBe(1);
    expect(stats.outstanding.map((s) => s.userId)).toEqual(["c"]);
  });

  it("an acknowledgement from someone no longer eligible does not inflate ackCount", () => {
    const members = [member({ userId: "a", displayName: "Ann", groupIds: ["bus1"] })];
    const audience: Audience = { kind: "groups", groupIds: ["bus1"], userIds: [] };
    // "ghost" acknowledged but is not part of the current roster/eligible set.
    const stats = announcementAcknowledgementStats(audience, members, ["a", "ghost"]);
    expect(stats.eligibleCount).toBe(1);
    expect(stats.ackCount).toBe(1);
    expect(stats.outstandingCount).toBe(0);
  });

  it("outstanding list is sorted by display name", () => {
    const members = [
      member({ userId: "a", displayName: "Zara" }),
      member({ userId: "b", displayName: "Amit" }),
    ];
    const stats = announcementAcknowledgementStats(everyone, members, []);
    expect(stats.outstanding.map((s) => s.displayName)).toEqual(["Amit", "Zara"]);
  });
});

describe("eventResponseBreakdown", () => {
  const member = (over: Partial<CommunicationsMember> = {}): CommunicationsMember => ({
    userId: "u1",
    displayName: "Rachel Cohen",
    handle: "rachel",
    groupIds: [],
    ...over,
  });

  it("splits eligible members into going/maybe/not-going/no-response", () => {
    const members = [
      member({ userId: "a", displayName: "Ann" }),
      member({ userId: "b", displayName: "Ben" }),
      member({ userId: "c", displayName: "Cara" }),
      member({ userId: "d", displayName: "Dan" }),
    ];
    const responses = new Map<string, "going" | "maybe" | "not_going">([
      ["a", "going"],
      ["b", "maybe"],
      ["c", "not_going"],
      // d: no row at all
    ]);
    const b = eventResponseBreakdown(everyone, members, responses);
    expect(b.eligibleCount).toBe(4);
    expect(b.going.map((s) => s.userId)).toEqual(["a"]);
    expect(b.maybe.map((s) => s.userId)).toEqual(["b"]);
    expect(b.notGoing.map((s) => s.userId)).toEqual(["c"]);
    expect(b.noResponse.map((s) => s.userId)).toEqual(["d"]);
  });

  it("scopes the denominator to the eligible audience, not the whole cohort", () => {
    const members = [
      member({ userId: "a", displayName: "Ann", groupIds: ["bus1"] }),
      member({ userId: "b", displayName: "Ben", groupIds: ["bus2"] }),
    ];
    const audience: Audience = { kind: "groups", groupIds: ["bus1"], userIds: [] };
    const b = eventResponseBreakdown(audience, members, new Map());
    expect(b.eligibleCount).toBe(1);
    expect(b.noResponseCount).toBe(1);
  });

  it("a response from someone no longer eligible is not counted", () => {
    const members = [member({ userId: "a", displayName: "Ann", groupIds: ["bus1"] })];
    const audience: Audience = { kind: "groups", groupIds: ["bus1"], userIds: [] };
    const responses = new Map<string, "going" | "maybe" | "not_going">([
      ["a", "going"],
      ["ghost", "going"],
    ]);
    const b = eventResponseBreakdown(audience, members, responses);
    expect(b.eligibleCount).toBe(1);
    expect(b.goingCount).toBe(1);
  });
});

describe("Israel time helpers", () => {
  it("fmtIsraelTime reads Israel time regardless of the instant's UTC hour", () => {
    // 15:00 UTC in July is 18:00 in Israel (summer, UTC+3).
    expect(fmtIsraelTime("2026-07-15T15:00:00Z")).toBe("18:00");
    // 12:00 UTC in January is 14:00 in Israel (winter, UTC+2).
    expect(fmtIsraelTime("2026-01-15T12:00:00Z")).toBe("14:00");
  });

  it("israelDateKey reflects the Israel-local date even near a UTC day boundary", () => {
    // 22:30 Israel time (summer) on 10 Sept is 19:30 UTC the same day.
    expect(israelDateKey("2026-09-10T19:30:00Z")).toBe("2026-09-10");
    // 01:00 Israel time on 11 Sept is 22:00 UTC on the 10th — still "the 11th" in Israel.
    expect(israelDateKey("2026-09-10T22:00:00Z")).toBe("2026-09-11");
  });

  it("israelLocalInputToIso treats the input as Israel wall-clock time, not the runner's local time", () => {
    // "18:00 in Israel" on a summer date is 15:00 UTC (UTC+3).
    expect(israelLocalInputToIso("2026-07-15T18:00")).toBe("2026-07-15T15:00:00.000Z");
    // "18:00 in Israel" on a winter date is 16:00 UTC (UTC+2).
    expect(israelLocalInputToIso("2026-01-15T18:00")).toBe("2026-01-15T16:00:00.000Z");
  });

  it("isoToIsraelLocalInput and israelLocalInputToIso round-trip", () => {
    const iso = "2026-09-10T15:00:00.000Z";
    const local = isoToIsraelLocalInput(iso);
    expect(local).toBe("2026-09-10T18:00");
    expect(israelLocalInputToIso(local)).toBe(iso);
  });
});

/**
 * The whole point of the Israel-time helpers: a student or staff member
 * viewing from London, New York or Israel itself must all see the same
 * intended Israel time for the same event. process.env.TZ genuinely changes
 * what Date's un-timezoned local getters/formatters return in this Node
 * runtime (verified empirically), so switching it here is a faithful stand-in
 * for "a viewer whose browser is set to a different timezone" — anything
 * that reads correctly across all three has no dependency on the viewer's
 * own clock.
 */
describe("Israel time is independent of the viewer's own timezone", () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  const summerInstant = "2026-09-10T15:00:00.000Z"; // 18:00 in Israel
  const viewers = ["Europe/London", "America/New_York", "Asia/Jerusalem"];

  it.each(viewers)("fmtIsraelTime reads 18:00 for a %s viewer", (tz) => {
    process.env.TZ = tz;
    expect(fmtIsraelTime(summerInstant)).toBe("18:00");
  });

  it.each(viewers)("israelDateKey agrees on the Israel calendar day for a %s viewer", (tz) => {
    process.env.TZ = tz;
    expect(israelDateKey(summerInstant)).toBe("2026-09-10");
  });

  it.each(viewers)(
    "isoToIsraelLocalInput shows the same Israel wall-clock for a %s viewer",
    (tz) => {
      process.env.TZ = tz;
      expect(isoToIsraelLocalInput(summerInstant)).toBe("2026-09-10T18:00");
    },
  );

  it.each(viewers)(
    "israelLocalInputToIso resolves '18:00 Israel time' to the same instant for a %s staff member",
    (tz) => {
      process.env.TZ = tz;
      expect(israelLocalInputToIso("2026-09-10T18:00")).toBe(summerInstant);
    },
  );

  it("demonstrates the bug this replaces: un-timezoned formatting DOES vary by viewer", () => {
    const naiveFormat = (iso: string) =>
      new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    process.env.TZ = "Europe/London";
    const london = naiveFormat(summerInstant);
    process.env.TZ = "Asia/Jerusalem";
    const israel = naiveFormat(summerInstant);
    expect(london).not.toBe(israel); // the exact inconsistency being fixed
    expect(israel).toBe("18:00"); // Israel's own clock is still the correct answer
  });
});

describe("changeLine", () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it("describes a same-Israel-day delay by Israel clock time, for any viewer", () => {
    for (const tz of ["Europe/London", "America/New_York", "Asia/Jerusalem"]) {
      process.env.TZ = tz;
      const line = changeLine({
        field: "starts_at",
        before: "2026-09-10T15:00:00.000Z", // 18:00 Israel
        after: "2026-09-10T15:30:00.000Z", // 18:30 Israel
      });
      expect(line).toBe("Delayed 30 minutes · 18:00 → 18:30");
    }
  });

  it("treats a delay across Israel midnight as moving to a new day, even though the UTC date is unchanged", () => {
    // 23:45 Israel -> 00:15 Israel next day is a 30-minute delay that LOOKS
    // same-UTC-day (both instants are still "10 Sept" in UTC) but is a
    // different Israel calendar day — exactly the case a UTC or browser-local
    // .toDateString() comparison gets wrong.
    const line = changeLine({
      field: "starts_at",
      before: "2026-09-10T20:45:00.000Z", // 23:45 Israel, 10 Sept
      after: "2026-09-10T21:15:00.000Z", // 00:15 Israel, 11 Sept
    });
    expect(line).toContain("Moved to");
    expect(line).toContain("11 Sept");
  });

  it("says 'isToday' by the Israel calendar day, not the viewer's own", () => {
    // now = 09:00 Israel on 11 Sept; after = 00:15 Israel on 11 Sept — same
    // Israel day, so it should read as a bare time, not a full date.
    const nowIsraelMorning = new Date("2026-09-11T06:00:00.000Z");
    vi.useFakeTimers().setSystemTime(nowIsraelMorning);
    try {
      const line = changeLine({
        field: "starts_at",
        before: null,
        after: "2026-09-10T21:15:00.000Z",
      });
      expect(line).toBe("Time changed: 00:15");
    } finally {
      vi.useRealTimers();
    }
  });
});
