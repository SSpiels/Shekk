/**
 * Programme operations — pure logic and shared types.
 *
 * Browser-safe on purpose: the hub UI, the staff console and the tests all
 * import from here, so nothing in this file may touch Supabase or `process`.
 * Every rule that decides "who may see this" or "who may change this" is
 * mirrored in RLS — this file exists so the UI can agree with the database,
 * never so it can replace it.
 */

/* ─────────────────────────────── Vocabulary ─────────────────────────────── */

export const STAFF_PERMISSIONS = [
  "events",
  "announcements",
  "participants",
  "groups",
  "documents",
  "votes",
  "acknowledgements",
  "checklists",
  "contacts",
  "places",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export type StaffRole = "owner" | "staff";

export type StaffContext = {
  programmeId: string;
  cohortId: string | null;
  role: StaffRole;
  permissions: StaffPermission[];
};

/**
 * Two different "status" fields live in the programme domain — do not fold
 * them into one, and do not let either drift to mean the other:
 *
 *  - `programme_memberships.status` ('active' | 'left') is membership-record
 *    bookkeeping: is this the row that currently makes someone in_cohort()?
 *    It backs a partial unique index (one active row per user) and the
 *    in_cohort()/my_cohort_id() RLS helpers everything else depends on.
 *
 *  - `programme_student_details.status` ('applicant' | 'pre_arrival' |
 *    'active' | 'temporarily_away' | 'completed' | 'withdrawn') is the
 *    operational lifecycle stage Programme OS staff assign and filter by.
 *    It has no bearing on cohort access.
 *
 * A student can be membership-status 'active' (they're in the cohort) while
 * lifecycle-status 'pre_arrival' (they haven't landed yet) — that's the
 * normal case, not a contradiction.
 */

/**
 * A programme's "current" cohort, as resolved server-side.
 *
 * V1 resolves this as the most-recently-created cohort under the programme —
 * a rule that breaks the moment a programme creates next year's cohort while
 * this year's is still running. That's a known, accepted V1 limitation, not
 * a design goal: the fix (an explicit active/current flag, cohort lifecycle
 * state, or a staff-chosen cohort) belongs in the resolver, in exactly one
 * place. Nothing outside the staff-session layer should ever compute "the
 * current cohort" itself — always read it from here.
 */
export type StaffCohortSummary = { id: string; name: string; year: string | null };

/** One programme a signed-in user has staff access to, and its current cohort. */
export type StaffWorkspace = {
  programmeId: string;
  programmeName: string;
  organisation: string | null;
  role: StaffRole;
  permissions: StaffPermission[];
  cohort: StaffCohortSummary | null;
  /** When this staff grant was created — the raw signal `pickActiveProgrammeId` sorts on. */
  createdAt: string;
};

export type StaffSession = {
  workspaces: StaffWorkspace[];
  /** Which workspace is "current" right now — never assume there's exactly one. */
  activeProgrammeId: string | null;
  /** The active workspace's cohort, already resolved — see StaffCohortSummary's note. */
  activeCohort: StaffCohortSummary | null;
};

export const emptyStaffSession: StaffSession = {
  workspaces: [],
  activeProgrammeId: null,
  activeCohort: null,
};

/**
 * Which workspace a staff member lands in when they haven't chosen one.
 *
 * DELIBERATE PLACEHOLDER, not permanent product behaviour. Multi-workspace
 * staff are a real, schema-supported case (programme_staff has no
 * uniqueness constraint on user_id) that V1 doesn't yet expose a switcher
 * for, so this picks the most recently granted staff row — deterministic,
 * but arbitrary from the user's point of view. When a switcher or a stored
 * "last active" preference exists, replace this function's body; don't just
 * delete it and let a single workspace be assumed again.
 */
export function pickActiveProgrammeId(workspaces: StaffWorkspace[]): string | null {
  if (!workspaces.length) return null;
  return [...workspaces].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].programmeId;
}

export type AudienceKind = "everyone" | "groups" | "individuals";

export type EventStatus =
  | "scheduled"
  | "confirmed"
  | "tentative"
  | "delayed"
  | "moved"
  | "cancelled"
  | "completed";

export type NotifyLevel = "silent" | "notify" | "urgent";

export type Priority = "normal" | "important" | "urgent";

export type RsvpResponse = "going" | "maybe" | "not_going";

export const EVENT_TYPES = [
  "activity",
  "class",
  "trip",
  "meal",
  "meeting",
  "travel",
  "free_time",
  "shabbat",
  "other",
] as const;

export const PLACE_CATEGORIES = [
  "accommodation",
  "campus",
  "classroom",
  "office",
  "meeting_point",
  "dining_hall",
  "bus_pickup",
  "synagogue",
  "venue",
  "other",
] as const;

export const CONTACT_CATEGORIES = [
  "director",
  "madrich",
  "coordinator",
  "emergency",
  "accommodation",
  "security",
  "medical",
  "other",
] as const;

/* ──────────────────────────────── Row shapes ─────────────────────────────── */

export type Audience = { kind: AudienceKind; groupIds: string[]; userIds: string[] };

export const everyone: Audience = { kind: "everyone", groupIds: [], userIds: [] };

export type ProgrammeGroup = { id: string; name: string; description: string | null; memberCount: number };

export type EventChange = {
  id: string;
  field: string;
  before: string | null;
  after: string | null;
  note: string | null;
  notifyLevel: NotifyLevel;
  changedAt: string;
};

export type ProgrammeEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  originalStartsAt: string | null;
  timezone: string;
  locationLabel: string | null;
  meetingPoint: string | null;
  googlePlaceId: string | null;
  latitude: number | null;
  longitude: number | null;
  onlineUrl: string | null;
  eventType: string;
  mandatory: boolean;
  status: EventStatus;
  statusNote: string | null;
  audience: Audience;
  rsvpEnabled: boolean;
  capacity: number | null;
  requiresAck: boolean;
  urgent: boolean;
  lastChangedAt: string | null;
  updatedAt: string;
  /** Participant view. */
  myRsvp: RsvpResponse | null;
  acknowledged: boolean;
  /** Staff view (null for participants). */
  goingCount: number | null;
  ackCount: number | null;
  changes: EventChange[];
};

export type ProgrammeAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  priority: Priority;
  publishedAt: string;
  requiresAck: boolean;
  audience: Audience;
  eventId: string | null;
  linkUrl: string | null;
  acknowledged: boolean;
  ackCount: number | null;
};

export type VoteOption = {
  id: string;
  label: string;
  detail: string | null;
  capacity: number | null;
  count: number | null;
};

/** How staff framed the ask: a choice poll, an open question, or a quick yes/no. */
export type VoteKind = "poll" | "question" | "yes_no";

export type ProgrammeVote = {
  id: string;
  eventId: string | null;
  question: string;
  description: string | null;
  voteKind: VoteKind;
  createdAt: string;
  status: "open" | "closed";
  anonymous: boolean;
  allowChange: boolean;
  resultsVisible: boolean;
  audience: Audience;
  closesAt: string | null;
  closedAt: string | null;
  winningOptionId: string | null;
  options: VoteOption[];
  myOptionId: string | null;
  responseCount: number | null;
};

export type ChecklistItem = {
  id: string;
  itemKey: string;
  title: string;
  details: string | null;
  dueOn: string | null;
  required: boolean;
  actionUrl: string | null;
  featureKey: string | null;
  audience: Audience;
  done: boolean;
  doneCount: number | null;
};

export type ProgrammeDoc = {
  id: string;
  label: string;
  description: string | null;
  linkUrl: string | null;
  storagePath: string | null;
  category: string;
  audience: Audience;
};

export type ProgrammeContactRow = {
  id: string;
  name: string;
  role: string | null;
  category: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  availability: string | null;
  isEmergency: boolean;
  audience: Audience;
};

export type ProgrammePlace = {
  id: string;
  label: string;
  category: string;
  notes: string | null;
  meetingInstructions: string | null;
  googlePlaceId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  audience: Audience;
};

export type ProgrammeNotification = {
  id: string;
  level: "notify" | "urgent";
  title: string;
  body: string | null;
  subjectType: string | null;
  subjectId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type ProgrammeHub = {
  joined: boolean;
  cohortId: string | null;
  programmeId: string | null;
  programmeName: string | null;
  organisation: string | null;
  cohortName: string | null;
  year: string | null;
  city: string | null;
  logoUrl: string | null;
  verified: boolean;
  /** True only for the internal Shekk sandbox programme. */
  isTest: boolean;
  timezone: string;
  welcomeMessage: string | null;
  startsOn: string | null;
  endsOn: string | null;
  myGroups: ProgrammeGroup[];
  staff: StaffContext | null;
  events: ProgrammeEvent[];
  announcements: ProgrammeAnnouncementRow[];
  votes: ProgrammeVote[];
  checklist: ChecklistItem[];
  documents: ProgrammeDoc[];
  contacts: ProgrammeContactRow[];
  places: ProgrammePlace[];
  notifications: ProgrammeNotification[];
  recentChanges: (EventChange & { eventId: string; eventTitle: string })[];
};

export const emptyHub: ProgrammeHub = {
  joined: false,
  cohortId: null,
  programmeId: null,
  programmeName: null,
  organisation: null,
  cohortName: null,
  year: null,
  city: null,
  logoUrl: null,
  verified: false,
  isTest: false,
  timezone: "Asia/Jerusalem",
  welcomeMessage: null,
  startsOn: null,
  endsOn: null,
  myGroups: [],
  staff: null,
  events: [],
  announcements: [],
  votes: [],
  checklist: [],
  documents: [],
  contacts: [],
  places: [],
  notifications: [],
  recentChanges: [],
};

/* ──────────────────────────────── Permissions ────────────────────────────── */

/**
 * The same rule as `public.staff_can`: owners may do anything, staff with an
 * empty permission list get the sensible default set, otherwise it must be
 * granted explicitly. UI only — the database decides for real.
 */
export function staffCan(staff: StaffContext | null, perm: StaffPermission): boolean {
  if (!staff) return false;
  if (staff.role === "owner") return true;
  if (staff.permissions.length === 0) return true;
  return staff.permissions.includes(perm);
}

/* ───────────────────────────── Audience filtering ────────────────────────── */

/** Mirror of `public.audience_allows` for anything already loaded client-side. */
export function audienceAllows(
  audience: Audience,
  viewer: { userId: string; groupIds: string[] },
): boolean {
  if (audience.kind === "everyone") return true;
  if (audience.userIds.includes(viewer.userId)) return true;
  return audience.groupIds.some((g) => viewer.groupIds.includes(g));
}

export function filterForViewer<T extends { audience: Audience }>(
  rows: T[],
  viewer: { userId: string; groupIds: string[] },
): T[] {
  return rows.filter((row) => audienceAllows(row.audience, viewer));
}

export function audienceLabel(audience: Audience, groups: { id: string; name: string }[]): string {
  if (audience.kind === "everyone") return "Everyone";
  if (audience.kind === "groups") {
    const names = audience.groupIds
      .map((id) => groups.find((g) => g.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (!names.length) return "Selected groups";
    return names.join(", ");
  }
  const n = audience.userIds.length;
  return n === 1 ? "1 person" : `${n} people`;
}

/* ─────────────────────────────── Event helpers ───────────────────────────── */

export const STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  tentative: "Tentative",
  delayed: "Delayed",
  moved: "Moved",
  cancelled: "Cancelled",
  completed: "Done",
};

export function statusTone(status: EventStatus): "live" | "pending" | "attention" | "quiet" {
  if (status === "cancelled") return "attention";
  if (status === "delayed" || status === "moved" || status === "tentative") return "attention";
  if (status === "confirmed") return "live";
  if (status === "completed") return "quiet";
  return "pending";
}

/** "Updated 12 min ago" — the participant's honest freshness signal. */
export function updatedAgo(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((now - then) / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

export function delayBy(startsAt: string, minutes: number): string {
  return new Date(new Date(startsAt).getTime() + minutes * 60_000).toISOString();
}

/**
 * Is `iso` the same programme day as `ref`? Deliberately Israel-local, not
 * the viewer's browser timezone — a student checking "what's today" from
 * London the night before they fly must see Israel's today, not London's.
 * Uses israelDateKey (defined further down this file) so this can never
 * quietly diverge from the Calendar grouping key.
 */
export function isSameIsraelDay(iso: string, ref = new Date()): boolean {
  return israelDateKey(iso) === israelDateKey(ref.toISOString());
}

const liveStatuses: EventStatus[] = ["scheduled", "confirmed", "tentative", "delayed", "moved"];

export function todaysEvents(events: ProgrammeEvent[], ref = new Date()): ProgrammeEvent[] {
  return events
    .filter((e) => isSameIsraelDay(e.startsAt, ref))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** What is happening right now, if anything. */
export function nowEvent(events: ProgrammeEvent[], at = Date.now()): ProgrammeEvent | null {
  return (
    events.find((e) => {
      if (!liveStatuses.includes(e.status)) return false;
      const start = new Date(e.startsAt).getTime();
      const end = e.endsAt ? new Date(e.endsAt).getTime() : start + 60 * 60_000;
      return start <= at && at < end;
    }) ?? null
  );
}

export function nextEvent(events: ProgrammeEvent[], at = Date.now()): ProgrammeEvent | null {
  return (
    [...events]
      .filter((e) => liveStatuses.includes(e.status) && new Date(e.startsAt).getTime() > at)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
  );
}

/** Changes a participant should notice: recent, and not silent bookkeeping. */
export function importantChanges(
  hub: Pick<ProgrammeHub, "events" | "recentChanges">,
  withinHours = 48,
  now = Date.now(),
) {
  const cutoff = now - withinHours * 3_600_000;
  return hub.recentChanges.filter(
    (c) => c.notifyLevel !== "silent" && new Date(c.changedAt).getTime() >= cutoff,
  );
}

export function openVotes(votes: ProgrammeVote[]): ProgrammeVote[] {
  return votes.filter((v) => v.status === "open");
}

export function pendingAcknowledgements(hub: ProgrammeHub) {
  return [
    ...hub.announcements.filter((a) => a.requiresAck && !a.acknowledged).map((a) => ({
      subjectType: "announcement" as const,
      id: a.id,
      title: a.title,
      priority: a.priority,
    })),
    ...hub.events
      .filter((e) => e.requiresAck && !e.acknowledged && e.status !== "cancelled")
      .map((e) => ({
        subjectType: "event" as const,
        id: e.id,
        title: e.title,
        priority: (e.urgent ? "urgent" : "important") as Priority,
      })),
  ];
}

export type ChecklistProgress = {
  done: number;
  total: number;
  requiredDone: number;
  requiredTotal: number;
  percent: number;
};

/**
 * Structural on purpose (Pick, not the full ChecklistItem) so a per-student
 * staff query can reuse this without fabricating audience/doneCount/etc
 * fields it never fetched — see StaffStudentSummary in programme-ops.server.ts.
 */
export function checklistProgress(
  items: Pick<ChecklistItem, "required" | "done">[],
): ChecklistProgress {
  const required = items.filter((i) => i.required);
  const done = items.filter((i) => i.done).length;
  const requiredDone = required.filter((i) => i.done).length;
  return {
    done,
    total: items.length,
    requiredDone,
    requiredTotal: required.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}

/**
 * "Onboarding complete" respects required-vs-optional: a student with every
 * required item done is complete even with optional items outstanding. If a
 * cohort somehow has zero required items, fall back to the overall percent
 * rather than declaring everyone complete by default.
 */
export function onboardingComplete(c: ChecklistProgress): boolean {
  if (c.requiredTotal === 0) return c.total > 0 && c.percent === 100;
  return c.requiredDone === c.requiredTotal;
}

/* ─────────────────────── Students (Programme OS staff view) ──────────────────────
 * DTOs the server projects onto — never a raw member_profiles/member_travel row.
 * See lib/programme-ops.server.ts's staffStudentRoster/staffStudentProfile for
 * where these are actually assembled, and its module comment for why
 * member_profiles (KYC/financial) is never touched by any of it. */

export type StaffStudentGroupRef = { id: string; name: string };

export type StaffStudentSummary = {
  userId: string;
  displayName: string;
  handle: string | null;
  /** A student may belong to more than one group — never assume [0] is "the" group. */
  groups: StaffStudentGroupRef[];
  /** null = programme_student_details has no row yet, or the table isn't live in this
   *  environment. Never backfilled from programme_memberships.status — see the note
   *  on that column's two meanings further up this file. */
  lifecycleStatus: string | null;
  homeCountry: string | null;
  israelCity: string | null;
  accommodationArea: string | null;
  arrivalDate: string | null;
  joinedAt: string;
  checklist: ChecklistProgress;
};

export type StaffStudentChecklistItem = {
  id: string;
  itemKey: string;
  title: string;
  details: string | null;
  dueOn: string | null;
  required: boolean;
  done: boolean;
  actionUrl: string | null;
};

export type StaffStudentProfile = StaffStudentSummary & {
  programmeId: string;
  programmeName: string;
  cohortId: string;
  cohortName: string;
  checklistItems: StaffStudentChecklistItem[];
};

export type StaffOnboardingFilter = "" | "complete" | "incomplete";

export type StaffStudentFilters = {
  q: string;
  groupId: string;
  onboarding: StaffOnboardingFilter;
};

export const emptyStaffStudentFilters: StaffStudentFilters = { q: "", groupId: "", onboarding: "" };

/** Pure so /staff/students can stay URL-driven — filters are search params, not local state. */
export function filterStaffStudents(
  students: StaffStudentSummary[],
  filters: StaffStudentFilters,
): StaffStudentSummary[] {
  const q = filters.q.trim().toLowerCase();
  return students.filter((s) => {
    if (q && !`${s.displayName} ${s.handle ?? ""}`.toLowerCase().includes(q)) return false;
    if (filters.groupId && !s.groups.some((g) => g.id === filters.groupId)) return false;
    if (filters.onboarding) {
      const complete = onboardingComplete(s.checklist);
      if (filters.onboarding === "complete" && !complete) return false;
      if (filters.onboarding === "incomplete" && complete) return false;
    }
    return true;
  });
}

/* ─────────────────────── Onboarding (Programme OS staff view) ──────────────────────
 * The cohort-wide companion to the Students profile's per-student checklist tab —
 * same StaffStudentChecklistItem shape, same checklistProgress/onboardingComplete
 * maths, just aggregated across everyone instead of shown one student at a time.
 * See lib/programme-ops.server.ts's staffOnboardingOverview for assembly. */

export type OnboardingStatus = "not_started" | "in_progress" | "needs_attention" | "complete";

/**
 * "Needs attention" is the operationally useful distinction from plain
 * "in progress": a required item that's actually overdue is something staff
 * need to chase, whereas being partway through with no overdue item yet is
 * just normal progress.
 */
export function onboardingStatus(
  checklist: ChecklistProgress,
  items: Pick<StaffStudentChecklistItem, "required" | "done" | "dueOn">[],
  now: Date = new Date(),
): OnboardingStatus {
  if (checklist.done === 0) return "not_started";
  if (onboardingComplete(checklist)) return "complete";
  const overdue = items.some(
    (i) => i.required && !i.done && i.dueOn !== null && new Date(i.dueOn) < now,
  );
  return overdue ? "needs_attention" : "in_progress";
}

export type StaffOnboardingStudent = StaffStudentSummary & {
  status: OnboardingStatus;
  checklistItems: StaffStudentChecklistItem[];
};

export type OnboardingItemStat = {
  itemId: string;
  itemKey: string;
  title: string;
  required: boolean;
  doneCount: number;
  percent: number;
};

/** One row per checklist item (first-seen order), aggregated across the students passed in. */
export function onboardingItemStats(
  students: Pick<StaffOnboardingStudent, "checklistItems">[],
): OnboardingItemStat[] {
  const total = students.length;
  const byItem = new Map<
    string,
    { itemKey: string; title: string; required: boolean; doneCount: number }
  >();
  for (const st of students) {
    for (const item of st.checklistItems) {
      const entry = byItem.get(item.id) ?? {
        itemKey: item.itemKey,
        title: item.title,
        required: item.required,
        doneCount: 0,
      };
      if (item.done) entry.doneCount += 1;
      byItem.set(item.id, entry);
    }
  }
  return [...byItem.entries()].map(([itemId, v]) => ({
    itemId,
    itemKey: v.itemKey,
    title: v.title,
    required: v.required,
    doneCount: v.doneCount,
    percent: total ? Math.round((v.doneCount / total) * 100) : 0,
  }));
}

/** Cohort-wide completion %, weighted by required items the same way a single student's is. */
export function overallOnboardingPercent(checklists: ChecklistProgress[]): number {
  const requiredTotal = checklists.reduce((sum, c) => sum + c.requiredTotal, 0);
  if (requiredTotal > 0) {
    const requiredDone = checklists.reduce((sum, c) => sum + c.requiredDone, 0);
    return Math.round((requiredDone / requiredTotal) * 100);
  }
  const total = checklists.reduce((sum, c) => sum + c.total, 0);
  if (total === 0) return 0;
  const done = checklists.reduce((sum, c) => sum + c.done, 0);
  return Math.round((done / total) * 100);
}

export function countOnboardingStatuses(
  statuses: OnboardingStatus[],
): Record<OnboardingStatus, number> {
  const counts: Record<OnboardingStatus, number> = {
    not_started: 0,
    in_progress: 0,
    needs_attention: 0,
    complete: 0,
  };
  for (const s of statuses) counts[s] += 1;
  return counts;
}

export type StaffOnboardingOverview = {
  cohortId: string;
  totalStudents: number;
  overallPercent: number;
  statusCounts: Record<OnboardingStatus, number>;
  itemStats: OnboardingItemStat[];
  students: StaffOnboardingStudent[];
};

export type StaffOnboardingStatusFilter = "" | OnboardingStatus;

export type StaffOnboardingFilters = {
  q: string;
  groupId: string;
  status: StaffOnboardingStatusFilter;
};

export const emptyStaffOnboardingFilters: StaffOnboardingFilters = {
  q: "",
  groupId: "",
  status: "",
};

/** Pure so /staff/onboarding can stay URL-driven, same convention as filterStaffStudents. */
export function filterOnboardingStudents(
  students: StaffOnboardingStudent[],
  filters: StaffOnboardingFilters,
): StaffOnboardingStudent[] {
  const q = filters.q.trim().toLowerCase();
  return students.filter((st) => {
    if (q && !`${st.displayName} ${st.handle ?? ""}`.toLowerCase().includes(q)) return false;
    if (filters.groupId && !st.groups.some((g) => g.id === filters.groupId)) return false;
    if (filters.status && st.status !== filters.status) return false;
    return true;
  });
}

/* ─────────────────────── Overview (Programme OS staff view) ──────────────────────
 * The staff landing page: a glance at student/onboarding health plus what's
 * coming up, not a second events/announcements management surface - those
 * are Calendar's and Communications' jobs. Deliberately lighter-weight than
 * ProgrammeEvent/ProgrammeAnnouncementRow (no RSVP/ack joins): this is a
 * preview list, not the real thing. */

export type StaffOverviewEvent = {
  id: string;
  title: string;
  startsAt: string;
  locationLabel: string | null;
};

export type StaffOverviewAnnouncement = {
  id: string;
  title: string;
  publishedAt: string;
  pinned: boolean;
};

/* ─────────────────────── Communications (Programme OS staff view) ──────────────────────
 * Built directly on the announcement/audience/acknowledgement engine the
 * mobile hub already uses (ProgrammeAnnouncementRow, Audience,
 * programme_acknowledgements) — the one thing that didn't already exist is
 * the staff-side rollup: of an announcement's *actual eligible audience*
 * (not the whole cohort), how many have acknowledged it, and who hasn't.
 * announcementAcknowledgementStats is that rollup, kept pure so it can be
 * unit tested without a database and can never drift from audienceAllows(),
 * the same predicate the RLS policy and notifyAudience() targeting use. */

export type StaffAnnouncementSummary = {
  id: string;
  title: string;
  bodyPreview: string;
  priority: Priority;
  pinned: boolean;
  requiresAck: boolean;
  audience: Audience;
  publishedAt: string;
  linkUrl: string | null;
  eligibleCount: number;
  ackCount: number;
  outstandingCount: number;
};

export type StaffCommunicationsOverview = {
  cohortId: string;
  totalStudents: number;
  announcements: StaffAnnouncementSummary[];
};

export type StaffAnnouncementStudentRef = {
  userId: string;
  displayName: string;
  handle: string | null;
};

export type StaffAnnouncementAcknowledgements = {
  announcementId: string;
  eligibleCount: number;
  ackCount: number;
  outstandingCount: number;
  outstanding: StaffAnnouncementStudentRef[];
};

/** The roster shape announcementAcknowledgementStats needs — nothing more. */
export type CommunicationsMember = {
  userId: string;
  displayName: string;
  handle: string | null;
  groupIds: string[];
};

/**
 * Given an announcement's audience and the cohort roster, who is actually
 * eligible, how many of those have acknowledged, and — by name — who is
 * still outstanding. `eligible` is computed with the same audienceAllows()
 * predicate used everywhere else in this file, so this can never quietly
 * diverge into counting "everyone in the cohort" instead of "everyone this
 * announcement was actually sent to."
 */
export function announcementAcknowledgementStats(
  audience: Audience,
  members: CommunicationsMember[],
  ackedUserIds: Set<string> | string[],
): {
  eligibleCount: number;
  ackCount: number;
  outstandingCount: number;
  outstanding: StaffAnnouncementStudentRef[];
} {
  const acked = ackedUserIds instanceof Set ? ackedUserIds : new Set(ackedUserIds);
  const eligible = members.filter((m) => audienceAllows(audience, m));
  const outstanding = eligible
    .filter((m) => !acked.has(m.userId))
    .map((m) => ({ userId: m.userId, displayName: m.displayName, handle: m.handle }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return {
    eligibleCount: eligible.length,
    ackCount: eligible.length - outstanding.length,
    outstandingCount: outstanding.length,
    outstanding,
  };
}

/** Can this participant cast (or change) a vote right now, and why not? */
export function voteBlockedReason(
  vote: ProgrammeVote,
  optionId: string | null = null,
): string | null {
  if (vote.status !== "open") return "This vote is closed";
  if (vote.myOptionId && !vote.allowChange) return "You have already voted";
  if (optionId) {
    const option = vote.options.find((o) => o.id === optionId);
    if (!option) return "That option is not part of this vote";
    if (
      option.capacity &&
      option.count !== null &&
      option.count >= option.capacity &&
      vote.myOptionId !== optionId
    ) {
      return "That option is full";
    }
  }
  return null;
}

export function eventFullForGoing(event: ProgrammeEvent): boolean {
  if (!event.capacity || event.capacity <= 0) return false;
  if (event.goingCount === null) return false;
  return event.goingCount >= event.capacity && event.myRsvp !== "going";
}

/** Directions deep link, reusing the same Google target as Shekk Maps. */
export function placeDirectionsUrl(place: {
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  label?: string | null;
}): string | null {
  const base = "https://www.google.com/maps/dir/?api=1";
  if (place.latitude != null && place.longitude != null) {
    const pid = place.googlePlaceId ? `&destination_place_id=${encodeURIComponent(place.googlePlaceId)}` : "";
    return `${base}&destination=${place.latitude},${place.longitude}${pid}`;
  }
  const text = place.address || place.label;
  if (!text) return null;
  const pid = place.googlePlaceId ? `&destination_place_id=${encodeURIComponent(place.googlePlaceId)}` : "";
  return `${base}&destination=${encodeURIComponent(text)}${pid}`;
}

/** Sensible, fully editable "Before you fly" defaults for a new cohort. */
export const DEFAULT_CHECKLIST: {
  itemKey: string;
  title: string;
  details: string;
  featureKey: string | null;
  actionUrl: string | null;
  required: boolean;
}[] = [
  {
    itemKey: "passport",
    title: "Check your passport is valid",
    details: "Most programmes need at least six months of validity beyond your return date.",
    featureKey: null,
    actionUrl: null,
    required: true,
  },
  {
    itemKey: "visa",
    title: "Sort your visa or entry paperwork",
    details: "Check what your nationality and programme length require.",
    featureKey: "visa",
    actionUrl: "/explore/visa",
    required: true,
  },
  {
    itemKey: "insurance",
    title: "Arrange travel and health insurance",
    details: "Bring the policy number and hotline with you, not just the email.",
    featureKey: "insurance",
    actionUrl: "/services/insurance",
    required: true,
  },
  {
    itemKey: "esim",
    title: "Get an eSIM or SIM for Israel",
    details: "Have data working the moment you land, before you look for wifi.",
    featureKey: "esim",
    actionUrl: "/services/esim",
    required: true,
  },
  {
    itemKey: "emergency_contact",
    title: "Give us an emergency contact",
    details: "One person at home your programme can reach.",
    featureKey: null,
    actionUrl: null,
    required: true,
  },
  {
    itemKey: "flight_info",
    title: "Send your flight details",
    details: "Flight number, landing time and terminal so pickups can be planned.",
    featureKey: null,
    actionUrl: null,
    required: true,
  },
  {
    itemKey: "medication",
    title: "Documentation for any medication",
    details: "A letter or prescription copy for anything you fly with.",
    featureKey: null,
    actionUrl: null,
    required: false,
  },
  {
    itemKey: "packing",
    title: "Pack for the season",
    details: "Check the weather for your dates and what your programme asks you to bring.",
    featureKey: null,
    actionUrl: null,
    required: false,
  },
  {
    itemKey: "programme_forms",
    title: "Return your programme forms",
    details: "Whatever your programme office still needs signed.",
    featureKey: null,
    actionUrl: null,
    required: true,
  },
];

/* ─────────────────────── Calendar (Programme OS staff view) ──────────────────────
 * Built directly on the existing event/audience/RSVP/change engine
 * (ProgrammeEvent, Audience, programme_event_rsvps, programme_event_changes)
 * — the one thing that didn't already exist is the staff-side response
 * rollup: of an event's actual eligible audience, who's going/maybe/not
 * going/hasn't responded, kept pure and mirroring
 * announcementAcknowledgementStats' shape exactly. */

export type StaffCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  originalStartsAt: string | null;
  locationLabel: string | null;
  meetingPoint: string | null;
  onlineUrl: string | null;
  eventType: string;
  mandatory: boolean;
  status: EventStatus;
  statusNote: string | null;
  audience: Audience;
  rsvpEnabled: boolean;
  capacity: number | null;
  requiresAck: boolean;
  urgent: boolean;
  changes: EventChange[];
  eligibleCount: number;
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  noResponseCount: number;
  /** Staff preview only — who acknowledged, by name, is Communications' job. */
  ackCount: number;
};

export type StaffCalendarOverview = {
  cohortId: string;
  totalStudents: number;
  events: StaffCalendarEvent[];
};

export type StaffEventResponses = {
  eventId: string;
  eligibleCount: number;
  capacity: number | null;
  going: StaffAnnouncementStudentRef[];
  maybe: StaffAnnouncementStudentRef[];
  notGoing: StaffAnnouncementStudentRef[];
  noResponse: StaffAnnouncementStudentRef[];
};

/**
 * Given an event's audience and the cohort roster, split eligible members
 * into going/maybe/not-going/no-response. "No response" is an eligible
 * member with no programme_event_rsvps row at all — never confused with
 * "not going", and never counted for someone the event wasn't even aimed at.
 */
export function eventResponseBreakdown(
  audience: Audience,
  members: CommunicationsMember[],
  responses: Map<string, RsvpResponse> | Record<string, RsvpResponse>,
): {
  eligibleCount: number;
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  noResponseCount: number;
  going: StaffAnnouncementStudentRef[];
  maybe: StaffAnnouncementStudentRef[];
  notGoing: StaffAnnouncementStudentRef[];
  noResponse: StaffAnnouncementStudentRef[];
} {
  const responseFor = (userId: string): RsvpResponse | undefined =>
    responses instanceof Map ? responses.get(userId) : responses[userId];
  const eligible = members.filter((m) => audienceAllows(audience, m));
  const ref = (m: CommunicationsMember): StaffAnnouncementStudentRef => ({
    userId: m.userId,
    displayName: m.displayName,
    handle: m.handle,
  });
  const byName = (a: StaffAnnouncementStudentRef, b: StaffAnnouncementStudentRef) =>
    a.displayName.localeCompare(b.displayName);

  const going = eligible
    .filter((m) => responseFor(m.userId) === "going")
    .map(ref)
    .sort(byName);
  const maybe = eligible
    .filter((m) => responseFor(m.userId) === "maybe")
    .map(ref)
    .sort(byName);
  const notGoing = eligible
    .filter((m) => responseFor(m.userId) === "not_going")
    .map(ref)
    .sort(byName);
  const noResponse = eligible
    .filter((m) => responseFor(m.userId) === undefined)
    .map(ref)
    .sort(byName);

  return {
    eligibleCount: eligible.length,
    goingCount: going.length,
    maybeCount: maybe.length,
    notGoingCount: notGoing.length,
    noResponseCount: noResponse.length,
    going,
    maybe,
    notGoing,
    noResponse,
  };
}

/* ───────────────────────── Israel time (explicit, DST-safe) ─────────────────────
 * Programme events happen in Israel; staff and students may be viewing from
 * anywhere before they fly. Every existing date helper (fmtTime/fmtDay in
 * components/programme/Bits.tsx, the datetime-local round-trip the mobile
 * EventEditor uses) reads/writes in the VIEWER's browser-local timezone, not
 * explicitly Israel time — correct only by coincidence when the viewer
 * happens to already be on Israel time. That's a real, pre-existing gap
 * (flagged, not fixed here — fixing it touches the mobile editor and is out
 * of scope for Calendar). The functions below are the explicit, DST-safe
 * alternative, used only by the new desktop Calendar: they always format
 * against — and always parse wall-clock input as — Asia/Jerusalem,
 * regardless of the viewer's own timezone. */

export const ISRAEL_TIMEZONE = "Asia/Jerusalem";

/** Asia/Jerusalem's UTC offset, in minutes, at a given instant — positive east of UTC. */
function israelOffsetMinutesAt(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ISRAEL_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - utcMs) / 60_000);
}

/** A UTC instant, formatted as it reads on a clock in Israel — e.g. "18:00". */
export function fmtIsraelTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ISRAEL_TIMEZONE,
  });
}

/** e.g. "Wed 10 Sep". */
export function fmtIsraelDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ISRAEL_TIMEZONE,
  });
}

/** e.g. "Wednesday 10 September". */
export function fmtIsraelDayLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ISRAEL_TIMEZONE,
  });
}

/** "2026-09-10" as the date reads on a clock in Israel — a stable grouping/grid key. */
export function israelDateKey(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ISRAEL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** A UTC instant → the "YYYY-MM-DDTHH:mm" an Israel wall clock shows — feeds a datetime-local input. */
export function isoToIsraelLocalInput(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ISRAEL_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * A datetime-local value TYPED AS ISRAEL WALL-CLOCK TIME (e.g. "2026-09-10T18:00"
 * meaning 6pm in Israel, regardless of what timezone the browser is in) → the
 * correct UTC instant. Two-pass fixed point on the offset: stable for every real
 * instant except the ~1-hour skipped/repeated window at the exact DST changeover,
 * which is an accepted, documented limitation (programme events aren't scheduled
 * at 2am on a DST-transition night).
 */
export function israelLocalInputToIso(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart!.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  const wallAsUtcMs = Date.UTC(y!, m! - 1, d!, hh, mm, 0);
  let candidate = wallAsUtcMs;
  for (let i = 0; i < 2; i++) {
    candidate = wallAsUtcMs - israelOffsetMinutesAt(candidate) * 60_000;
  }
  return new Date(candidate).toISOString();
}

/* ─────────────────────────── V2: one feed, one to-do list ─────────────────── */

/**
 * Programme V2 speaks in "posts", not database tables. An announcement, a
 * confirmation request, an urgent notice, a poll, an open question and a
 * yes/no ask are all posts — the participant only ever sees a chronological
 * list with a clear label and, where relevant, one thing to tap.
 */
export type PostKind = "announcement" | "confirmation" | "urgent" | "poll" | "question" | "yes_no";

export const POST_LABEL: Record<PostKind, string> = {
  announcement: "Announcement",
  confirmation: "Please confirm",
  urgent: "Urgent",
  poll: "Vote",
  question: "Question",
  yes_no: "Yes / no",
};

export type FeedItem = {
  key: string;
  kind: PostKind;
  title: string;
  at: string;
  needsAction: boolean;
  pinned: boolean;
  announcement: ProgrammeAnnouncementRow | null;
  vote: ProgrammeVote | null;
};

export function announcementKind(a: Pick<ProgrammeAnnouncementRow, "priority" | "requiresAck">): PostKind {
  if (a.priority === "urgent") return "urgent";
  if (a.requiresAck) return "confirmation";
  return "announcement";
}

/** Everything staff has posted, newest first, pinned first. */
export function feedItems(hub: Pick<ProgrammeHub, "announcements" | "votes">): FeedItem[] {
  const posts: FeedItem[] = [
    ...hub.announcements.map((a) => ({
      key: `announcement:${a.id}`,
      kind: announcementKind(a),
      title: a.title,
      at: a.publishedAt,
      needsAction: a.requiresAck && !a.acknowledged,
      pinned: a.pinned,
      announcement: a,
      vote: null,
    })),
    ...hub.votes.map((v) => ({
      key: `vote:${v.id}`,
      kind: v.voteKind as PostKind,
      title: v.question,
      at: v.createdAt,
      needsAction: v.status === "open" && !v.myOptionId,
      pinned: false,
      announcement: null,
      vote: v,
    })),
  ];
  return posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
    return b.at.localeCompare(a.at);
  });
}

/* ─────────────────────────── V2: the participant to-do ───────────────────── */

export type PendingAction = {
  key: string;
  kind: "ack" | "rsvp" | "vote" | "checklist";
  title: string;
  detail: string;
  urgent: boolean;
  eventId?: string;
  voteId?: string;
  itemId?: string;
};

/**
 * The short, honest list of things only this participant can clear. Ordered so
 * the loudest thing is first: urgent, then confirmations, then RSVPs, votes and
 * finally the pre-arrival checklist.
 */
export function pendingActions(hub: ProgrammeHub, now = Date.now()): PendingAction[] {
  const soon = now + 72 * 3_600_000;
  const live = (e: ProgrammeEvent) => e.status !== "cancelled" && new Date(e.startsAt).getTime() > now;

  const acks: PendingAction[] = [
    ...hub.announcements
      .filter((a) => a.requiresAck && !a.acknowledged)
      .map((a) => ({
        key: `ack:announcement:${a.id}`,
        kind: "ack" as const,
        title: a.title,
        detail: "Tap to confirm you've read it",
        urgent: a.priority === "urgent",
      })),
    ...hub.events
      .filter((e) => e.requiresAck && !e.acknowledged && e.status !== "cancelled")
      .map((e) => ({
        key: `ack:event:${e.id}`,
        kind: "ack" as const,
        title: e.title,
        detail: "Confirm you've seen this",
        urgent: e.urgent,
        eventId: e.id,
      })),
  ];

  const rsvps: PendingAction[] = hub.events
    .filter((e) => e.rsvpEnabled && !e.myRsvp && live(e) && new Date(e.startsAt).getTime() < soon)
    .map((e) => ({
      key: `rsvp:${e.id}`,
      kind: "rsvp" as const,
      title: e.title,
      detail: "Are you coming?",
      urgent: e.mandatory,
      eventId: e.id,
    }));

  const votes: PendingAction[] = hub.votes
    .filter((v) => v.status === "open" && !v.myOptionId)
    .map((v) => ({
      key: `vote:${v.id}`,
      kind: "vote" as const,
      title: v.question,
      detail: v.voteKind === "yes_no" ? "Answer yes or no" : "Your programme is asking",
      urgent: false,
      voteId: v.id,
    }));

  const checklist: PendingAction[] = hub.checklist
    .filter((i) => i.required && !i.done)
    .slice(0, 3)
    .map((i) => ({
      key: `checklist:${i.id}`,
      kind: "checklist" as const,
      title: i.title,
      detail: i.dueOn ? `Due ${i.dueOn}` : "Before you fly",
      urgent: false,
      itemId: i.id,
    }));

  return [...acks, ...rsvps, ...votes, ...checklist].sort(
    (a, b) => Number(b.urgent) - Number(a.urgent),
  );
}

/* ───────────────────── V2: plain-English activity + changes ───────────────── */

/** Three choices a madrich actually makes, instead of four separate toggles. */
export type ActivityKind = "mandatory" | "optional" | "limited";

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  mandatory: "Everyone must come",
  optional: "Optional",
  limited: "Limited spaces",
};

export function activityKindOf(event: Pick<ProgrammeEvent, "mandatory" | "capacity">): ActivityKind {
  if (event.capacity && event.capacity > 0) return "limited";
  return event.mandatory ? "mandatory" : "optional";
}

/** Field flags implied by the chosen kind — the composer writes these for you. */
export function activityKindFields(kind: ActivityKind): {
  mandatory: boolean;
  rsvpEnabled: boolean;
} {
  if (kind === "mandatory") return { mandatory: true, rsvpEnabled: false };
  if (kind === "limited") return { mandatory: false, rsvpEnabled: true };
  return { mandatory: false, rsvpEnabled: true };
}

const CHANGE_FIELD_LABEL: Record<string, string> = {
  starts_at: "Time changed",
  startsAt: "Time changed",
  ends_at: "End time changed",
  location_label: "Location changed",
  locationLabel: "Location changed",
  meeting_point: "Meeting point changed",
  status: "Status",
  title: "Renamed",
  capacity: "Spaces",
};

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;

function parseWhen(value: string): Date | null {
  if (!ISO_LIKE.test(value.trim())) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Event-change copy is always about Israel-scheduled programme time, so —
// like fmtIsraelTime/fmtIsraelDay — these read the clock in Asia/Jerusalem
// regardless of the viewer's own browser timezone.
const clockOf = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ISRAEL_TIMEZONE });
const dateOf = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ISRAEL_TIMEZONE,
  });

function shiftWords(minutes: number): string {
  const abs = Math.abs(minutes);
  const unit =
    abs % 60 === 0 && abs >= 60
      ? `${abs / 60} ${abs / 60 === 1 ? "hour" : "hours"}`
      : `${abs} ${abs === 1 ? "minute" : "minutes"}`;
  return `${minutes > 0 ? "Delayed" : "Moved earlier"} ${unit}`;
}

/**
 * Participant-facing change copy. Never prints raw ISO timestamps or database
 * field names — "Delayed 30 minutes · 16:30 → 17:00", "Location changed:
 * Old City → Jaffa Port".
 */
export function changeLine(change: Pick<EventChange, "field" | "before" | "after">): string {
  const label = CHANGE_FIELD_LABEL[change.field] ?? change.field.replace(/_/g, " ");
  const before = change.before?.trim() ? parseWhen(change.before) : null;
  const after = change.after?.trim() ? parseWhen(change.after) : null;

  if (after && before) {
    // Same Israel-calendar day, not the viewer's own — a delay from 23:30 to
    // 00:10 Israel time is still "today" in Israel even if the viewer's
    // browser has already rolled over to the next date.
    const sameDay = israelDateKey(before.toISOString()) === israelDateKey(after.toISOString());
    if (sameDay) {
      const minutes = Math.round((after.getTime() - before.getTime()) / 60000);
      const head = minutes === 0 ? label : shiftWords(minutes);
      return `${head} · ${clockOf(before)} → ${clockOf(after)}`;
    }
    return `Moved to ${dateOf(after)} · ${clockOf(before)} → ${dateOf(after)} ${clockOf(after)}`;
  }
  if (after) {
    const isToday = israelDateKey(after.toISOString()) === israelDateKey(new Date().toISOString());
    return `${label}: ${isToday ? clockOf(after) : `${dateOf(after)} ${clockOf(after)}`}`;
  }
  if (change.after && change.before) return `${label}: ${change.before} → ${change.after}`;
  if (change.after) return `${label}: ${change.after}`;
  return label;
}
