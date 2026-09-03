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

export function isSameLocalDay(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

const liveStatuses: EventStatus[] = ["scheduled", "confirmed", "tentative", "delayed", "moved"];

export function todaysEvents(events: ProgrammeEvent[], ref = new Date()): ProgrammeEvent[] {
  return events
    .filter((e) => isSameLocalDay(e.startsAt, ref))
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

const clockOf = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dateOf = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

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
    const sameDay = before.toDateString() === after.toDateString();
    if (sameDay) {
      const minutes = Math.round((after.getTime() - before.getTime()) / 60000);
      const head = minutes === 0 ? label : shiftWords(minutes);
      return `${head} · ${clockOf(before)} → ${clockOf(after)}`;
    }
    return `Moved to ${dateOf(after)} · ${clockOf(before)} → ${dateOf(after)} ${clockOf(after)}`;
  }
  if (after) {
    const isToday = after.toDateString() === new Date().toDateString();
    return `${label}: ${isToday ? clockOf(after) : `${dateOf(after)} ${clockOf(after)}`}`;
  }
  if (change.after && change.before) return `${label}: ${change.before} → ${change.after}`;
  if (change.after) return `${label}: ${change.after}`;
  return label;
}
