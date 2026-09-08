import {
  sameEventValue,
  validateEventTime,
  validateEventInterval,
  type LocalEventTime,
} from "./programme/event-time";
/**
 * Programme operations — server only.
 *
 * Two rules run through this whole file:
 *  1. Reads for a participant go through *their* Supabase client, so RLS —
 *     not this code — decides what they are allowed to see.
 *  2. Anything that must touch other people's rows (notification fan-out,
 *     invites, internal onboarding) uses the service role, and only after the
 *     caller's staff permission has been proved against the database first.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  announcementAcknowledgementStats,
  checklistProgress,
  DEFAULT_CHECKLIST,
  type ChecklistProgress,
  type CommunicationsMember,
  emptyHub,
  emptyStaffSession,
  everyone,
  pickActiveProgrammeId,
  type Audience,
  type AudienceKind,
  type ChecklistItem,
  type EventChange,
  type EventStatus,
  eventResponseBreakdown,
  type NotifyLevel,
  onboardingStatus,
  onboardingItemStats,
  overallOnboardingPercent,
  countOnboardingStatuses,
  type Priority,
  type ProgrammeAnnouncementRow,
  type ProgrammeContactRow,
  type ProgrammeDoc,
  type ProgrammeEvent,
  type ProgrammeGroup,
  type ProgrammeHub,
  type ProgrammeNotification,
  type ProgrammePlace,
  type ProgrammeVote,
  type RsvpResponse,
  type StaffAnnouncementAcknowledgements,
  type StaffAnnouncementSummary,
  type StaffCalendarEvent,
  type StaffCalendarOverview,
  type StaffCommunicationsOverview,
  type StaffContext,
  type StaffEventResponses,
  type StaffOnboardingOverview,
  type StaffOnboardingStudent,
  type StaffOverviewAnnouncement,
  type StaffOverviewEvent,
  type StaffPermission,
  type StaffRole,
  type StaffSession,
  type StaffStudentChecklistItem,
  type StaffStudentGroupRef,
  type StaffStudentProfile,
  type StaffStudentSummary,
  type StaffWorkspace,
} from "./programme/logic";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, any, any>;
type Row = Record<string, any>;

const s = (row: Row, key: string): string | null => (row[key] == null ? null : String(row[key]));
const n = (row: Row, key: string): number | null => (row[key] == null ? null : Number(row[key]));

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/* ────────────────────────────── Audience plumbing ────────────────────────── */

type AudienceIndex = Map<string, Audience>;

function audienceFor(index: AudienceIndex, subjectType: string, id: string, kind: string | null): Audience {
  const stored = index.get(`${subjectType}:${id}`);
  return {
    kind: (kind ?? "everyone") as AudienceKind,
    groupIds: stored?.groupIds ?? [],
    userIds: stored?.userIds ?? [],
  };
}

async function loadAudiences(db: Db, cohortId: string): Promise<AudienceIndex> {
  const { data } = await db
    .from("programme_audiences")
    .select("subject_type, subject_id, group_id, user_id")
    .eq("cohort_id", cohortId);
  const index: AudienceIndex = new Map();
  for (const row of (data ?? []) as Row[]) {
    const key = `${row["subject_type"]}:${row["subject_id"]}`;
    const cur = index.get(key) ?? { kind: "everyone" as AudienceKind, groupIds: [], userIds: [] };
    if (row["group_id"]) cur.groupIds.push(String(row["group_id"]));
    if (row["user_id"]) cur.userIds.push(String(row["user_id"]));
    index.set(key, cur);
  }
  return index;
}

/** Replace a subject's audience rows. Staff permission must already be proved. */
async function writeAudience(
  db: Db,
  cohortId: string,
  subjectType: string,
  subjectId: string,
  audience: Audience | undefined,
) {
  if (!audience) return;
  await db.from("programme_audiences").delete().eq("subject_type", subjectType).eq("subject_id", subjectId);
  if (audience.kind === "everyone") return;
  const rows: Row[] = [
    ...audience.groupIds.map((g) => ({
      cohort_id: cohortId,
      subject_type: subjectType,
      subject_id: subjectId,
      group_id: g,
    })),
    ...audience.userIds.map((u) => ({
      cohort_id: cohortId,
      subject_type: subjectType,
      subject_id: subjectId,
      user_id: u,
    })),
  ];
  if (rows.length) {
    const { error } = await db.from("programme_audiences").insert(rows as never);
    if (error) throw error;
  }
}

/* ────────────────────────────── Staff context ────────────────────────────── */

export async function staffContext(db: Db, userId: string, cohortId: string | null): Promise<StaffContext | null> {
  const { data } = await db
    .from("programme_staff")
    .select("programme_id, role, permissions")
    .eq("user_id", userId);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return null;

  let programmeId: string | null = null;
  if (cohortId) {
    const { data: cohort } = await db
      .from("programme_cohorts")
      .select("programme_id")
      .eq("id", cohortId)
      .maybeSingle();
    programmeId = cohort ? String((cohort as Row)["programme_id"]) : null;
  }
  const row = programmeId ? rows.find((r) => String(r["programme_id"]) === programmeId) : rows[0];
  if (!row) return null;
  return {
    programmeId: String(row["programme_id"]),
    cohortId,
    role: String(row["role"]) as StaffRole,
    permissions: ((row["permissions"] ?? []) as string[]).map(String) as StaffPermission[],
  };
}

/**
 * Every programme a signed-in user has staff access to, plus which one is
 * active. Entirely self-scoped to the caller: programme_staff, programmes
 * and programme_cohorts all carry RLS policies keyed off auth.uid() ("Staff
 * read their programme staff list" / "Staff read their programmes" / "Staff
 * read their cohorts"), so this runs on the caller's own session client —
 * never the service role — and there is no client-supplied id to validate,
 * because none is accepted. Used to gate /staff; not the full programme hub.
 */
export async function resolveStaffSession(db: Db, userId: string): Promise<StaffSession> {
  const { data: staffRows, error } = await db
    .from("programme_staff")
    .select("programme_id, role, permissions, created_at")
    .eq("user_id", userId);
  if (error) throw error;
  const rows = (staffRows ?? []) as Row[];
  if (!rows.length) return emptyStaffSession;

  const programmeIds = [...new Set(rows.map((r) => String(r["programme_id"])))];
  const [{ data: programmes }, { data: cohorts }] = await Promise.all([
    db.from("programmes").select("id, name, organisation").in("id", programmeIds),
    db
      .from("programme_cohorts")
      .select("id, programme_id, name, year, created_at")
      .in("programme_id", programmeIds),
  ]);

  const programmeById = new Map(((programmes ?? []) as Row[]).map((p) => [String(p["id"]), p]));

  // Current cohort per programme = most recently created, same rule readHub() uses.
  const latestCohortByProgramme = new Map<string, Row>();
  for (const c of (cohorts ?? []) as Row[]) {
    const pid = String(c["programme_id"]);
    const existing = latestCohortByProgramme.get(pid);
    if (!existing || String(c["created_at"]) > String(existing["created_at"])) {
      latestCohortByProgramme.set(pid, c);
    }
  }

  const workspaces: StaffWorkspace[] = rows.flatMap((r): StaffWorkspace[] => {
    const programmeId = String(r["programme_id"]);
    const programme = programmeById.get(programmeId);
    // A staff row for a programme we couldn't read back (RLS or a dangling
    // row) is dropped rather than guessed at — never surface a workspace we
    // can't name.
    if (!programme) return [];
    const cohort = latestCohortByProgramme.get(programmeId) ?? null;
    return [
      {
        programmeId,
        programmeName: String(programme["name"]),
        organisation: (programme["organisation"] as string | null) ?? null,
        role: String(r["role"]) as StaffRole,
        permissions: ((r["permissions"] ?? []) as string[]).map(String) as StaffPermission[],
        cohort: cohort
          ? {
              id: String(cohort["id"]),
              name: String(cohort["name"]),
              year: (cohort["year"] as string | null) ?? null,
            }
          : null,
        createdAt: String(r["created_at"]),
      },
    ];
  });

  const activeProgrammeId = pickActiveProgrammeId(workspaces);
  const activeCohort = workspaces.find((w) => w.programmeId === activeProgrammeId)?.cohort ?? null;
  return { workspaces, activeProgrammeId, activeCohort };
}

/** Throws unless the caller really is staff on this cohort with this permission. */
async function requireStaff(db: Db, userId: string, cohortId: string, perm: StaffPermission) {
  const { data, error } = await db.rpc("cohort_staff_can" as never, {
    _cohort_id: cohortId,
    _user_id: userId,
    _perm: perm,
  } as never);
  if (error) throw new Error("Could not check your programme permissions");
  if (!data) throw new Error("You do not have permission to do that");
}

async function requireOwner(db: Db, userId: string, programmeId: string) {
  const { data, error } = await db.rpc("is_programme_owner" as never, {
    _programme_id: programmeId,
    _user_id: userId,
  } as never);
  if (error) throw new Error("Could not check your programme permissions");
  if (!data) throw new Error("Only the programme owner can do that");
}

/* ──────────────────────────────── The hub read ───────────────────────────── */

export async function readHub(db: Db, userId: string): Promise<ProgrammeHub> {
  const { data: membership } = await db
    .from("programme_memberships")
    .select("cohort_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  let cohortId = membership ? String((membership as Row)["cohort_id"]) : null;

  // Staff who are not enrolled as participants still need their cohort.
  if (!cohortId) {
    const { data: staffRows } = await db.from("programme_staff").select("programme_id").eq("user_id", userId);
    const programmeId = staffRows?.[0] ? String((staffRows[0] as Row)["programme_id"]) : null;
    if (!programmeId) return emptyHub;
    const { data: cohort } = await db
      .from("programme_cohorts")
      .select("id")
      .eq("programme_id", programmeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cohort) return emptyHub;
    cohortId = String((cohort as Row)["id"]);
  }

  const { data: cohortRow } = await db
    .from("programme_cohorts")
    .select("id, programme_id, name, year, timezone, welcome_message, starts_on, ends_on")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohortRow) return emptyHub;
  const cohort = cohortRow as Row;
  const programmeId = String(cohort["programme_id"]);

  const staff = await staffContext(db, userId, cohortId);
  const isStaff = staff !== null;

  const [
    programmeRes,
    groupRes,
    myGroupRes,
    eventRes,
    annRes,
    voteRes,
    optionRes,
    myVoteRes,
    checklistRes,
    progressRes,
    docRes,
    contactRes,
    placeRes,
    ackRes,
    rsvpRes,
    changeRes,
    notifRes,
  ] = await Promise.all([
    db.from("programmes").select("*").eq("id", programmeId).maybeSingle(),
    db.from("programme_groups").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_group_members").select("group_id, user_id"),
    db.from("programme_events").select("*").eq("cohort_id", cohortId).order("starts_at"),
    db
      .from("programme_announcements")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false }),
    db.from("programme_votes").select("*").eq("cohort_id", cohortId).order("created_at", { ascending: false }),
    db.from("programme_vote_options").select("*").order("sort_order"),
    db.from("programme_vote_responses").select("vote_id, option_id, user_id"),
    db.from("programme_checklist_items").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_checklist_progress").select("item_id, done, user_id"),
    db.from("programme_documents").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_contacts").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_places").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_acknowledgements").select("subject_type, subject_id, user_id").eq("cohort_id", cohortId),
    db.from("programme_event_rsvps").select("event_id, user_id, response"),
    db
      .from("programme_event_changes")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("changed_at", { ascending: false })
      .limit(120),
    db
      .from("programme_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const audiences = await loadAudiences(db, cohortId);
  const programme = (programmeRes.data ?? {}) as Row;

  const groupRows = (groupRes.data ?? []) as Row[];
  const groupMembers = (myGroupRes.data ?? []) as Row[];
  const memberCount = new Map<string, number>();
  const myGroupIds = new Set<string>();
  for (const gm of groupMembers) {
    const gid = String(gm["group_id"]);
    memberCount.set(gid, (memberCount.get(gid) ?? 0) + 1);
    if (String(gm["user_id"]) === userId) myGroupIds.add(gid);
  }
  const groups: ProgrammeGroup[] = groupRows.map((g) => ({
    id: String(g["id"]),
    name: String(g["name"]),
    description: s(g, "description"),
    memberCount: memberCount.get(String(g["id"])) ?? 0,
  }));

  const acks = (ackRes.data ?? []) as Row[];
  const myAcks = new Set(
    acks.filter((a) => String(a["user_id"]) === userId).map((a) => `${a["subject_type"]}:${a["subject_id"]}`),
  );
  const ackCounts = new Map<string, number>();
  for (const a of acks) {
    const key = `${a["subject_type"]}:${a["subject_id"]}`;
    ackCounts.set(key, (ackCounts.get(key) ?? 0) + 1);
  }

  const rsvps = (rsvpRes.data ?? []) as Row[];
  const myRsvp = new Map<string, string>();
  const goingCount = new Map<string, number>();
  for (const r of rsvps) {
    if (String(r["user_id"]) === userId) myRsvp.set(String(r["event_id"]), String(r["response"]));
    if (String(r["response"]) === "going") {
      const id = String(r["event_id"]);
      goingCount.set(id, (goingCount.get(id) ?? 0) + 1);
    }
  }

  const changeRows = (changeRes.data ?? []) as Row[];
  const changesByEvent = new Map<string, EventChange[]>();
  for (const c of changeRows) {
    const id = String(c["event_id"]);
    const list = changesByEvent.get(id) ?? [];
    list.push({
      id: String(c["id"]),
      field: String(c["field"]),
      before: s(c, "before_value"),
      after: s(c, "after_value"),
      note: s(c, "note"),
      notifyLevel: String(c["notify_level"]) as NotifyLevel,
      changedAt: String(c["changed_at"]),
    });
    changesByEvent.set(id, list);
  }

  const events: ProgrammeEvent[] = ((eventRes.data ?? []) as Row[]).map((e) => {
    const id = String(e["id"]);
    return {
      id,
      title: String(e["title"]),
      description: s(e, "description"),
      startsAt: String(e["starts_at"]),
      endsAt: s(e, "ends_at"),
      originalStartsAt: s(e, "original_starts_at"),
      timezone: String(e["timezone"] ?? "Asia/Jerusalem"),
      locationLabel: s(e, "location_label"),
      meetingPoint: s(e, "meeting_point"),
      googlePlaceId: s(e, "google_place_id"),
      latitude: n(e, "latitude"),
      longitude: n(e, "longitude"),
      onlineUrl: s(e, "online_url"),
      eventType: String(e["event_type"] ?? "activity"),
      mandatory: Boolean(e["mandatory"]),
      status: String(e["status"]) as EventStatus,
      statusNote: s(e, "status_note"),
      audience: audienceFor(audiences, "event", id, s(e, "audience_kind")),
      rsvpEnabled: Boolean(e["rsvp_enabled"]),
      capacity: n(e, "capacity"),
      requiresAck: Boolean(e["requires_ack"]),
      urgent: Boolean(e["urgent"]),
      lastChangedAt: s(e, "last_changed_at"),
      updatedAt: String(e["updated_at"]),
      myRsvp: (myRsvp.get(id) as ProgrammeEvent["myRsvp"]) ?? null,
      acknowledged: myAcks.has(`event:${id}`),
      goingCount: goingCount.get(id) ?? 0,
      ackCount: isStaff ? (ackCounts.get(`event:${id}`) ?? 0) : null,
      changes: changesByEvent.get(id) ?? [],
    };
  });

  const eventTitle = new Map(events.map((e) => [e.id, e.title]));
  const recentChanges = changeRows
    .filter((c) => eventTitle.has(String(c["event_id"])))
    .slice(0, 30)
    .map((c) => ({
      id: String(c["id"]),
      eventId: String(c["event_id"]),
      eventTitle: eventTitle.get(String(c["event_id"])) ?? "Event",
      field: String(c["field"]),
      before: s(c, "before_value"),
      after: s(c, "after_value"),
      note: s(c, "note"),
      notifyLevel: String(c["notify_level"]) as NotifyLevel,
      changedAt: String(c["changed_at"]),
    }));

  const announcements: ProgrammeAnnouncementRow[] = ((annRes.data ?? []) as Row[]).map((a) => {
    const id = String(a["id"]);
    return {
      id,
      title: String(a["title"]),
      body: String(a["body"]),
      pinned: Boolean(a["pinned"]),
      priority: (s(a, "priority") ?? "normal") as ProgrammeAnnouncementRow["priority"],
      publishedAt: String(a["published_at"]),
      requiresAck: Boolean(a["requires_ack"]),
      audience: audienceFor(audiences, "announcement", id, s(a, "audience_kind")),
      eventId: s(a, "event_id"),
      linkUrl: s(a, "link_url"),
      acknowledged: myAcks.has(`announcement:${id}`),
      ackCount: isStaff ? (ackCounts.get(`announcement:${id}`) ?? 0) : null,
    };
  });

  const optionRows = (optionRes.data ?? []) as Row[];
  const responseRows = (myVoteRes.data ?? []) as Row[];
  const optionCounts = new Map<string, number>();
  const responseTotals = new Map<string, number>();
  const myOption = new Map<string, string>();
  for (const r of responseRows) {
    const oid = String(r["option_id"]);
    optionCounts.set(oid, (optionCounts.get(oid) ?? 0) + 1);
    const vid = String(r["vote_id"]);
    responseTotals.set(vid, (responseTotals.get(vid) ?? 0) + 1);
    if (String(r["user_id"]) === userId) myOption.set(vid, oid);
  }

  const votes: ProgrammeVote[] = ((voteRes.data ?? []) as Row[]).map((v) => {
    const id = String(v["id"]);
    const showResults = Boolean(v["results_visible"]) || isStaff || String(v["status"]) === "closed";
    return {
      id,
      eventId: s(v, "event_id"),
      question: String(v["question"]),
      description: s(v, "description"),
      voteKind: (s(v, "vote_kind") ?? "poll") as ProgrammeVote["voteKind"],
      createdAt: String(v["created_at"]),
      status: String(v["status"]) as "open" | "closed",
      anonymous: Boolean(v["anonymous"]),
      allowChange: Boolean(v["allow_change"]),
      resultsVisible: Boolean(v["results_visible"]),
      audience: audienceFor(audiences, "vote", id, s(v, "audience_kind")),
      closesAt: s(v, "closes_at"),
      closedAt: s(v, "closed_at"),
      winningOptionId: s(v, "winning_option_id"),
      options: optionRows
        .filter((o) => String(o["vote_id"]) === id)
        .map((o) => ({
          id: String(o["id"]),
          label: String(o["label"]),
          detail: s(o, "detail"),
          capacity: n(o, "capacity"),
          count: showResults ? (optionCounts.get(String(o["id"])) ?? 0) : null,
        })),
      myOptionId: myOption.get(id) ?? null,
      responseCount: showResults ? (responseTotals.get(id) ?? 0) : null,
    };
  });

  const progressRows = (progressRes.data ?? []) as Row[];
  const myDone = new Set(
    progressRows.filter((p) => String(p["user_id"]) === userId && p["done"]).map((p) => String(p["item_id"])),
  );
  const doneCounts = new Map<string, number>();
  for (const p of progressRows) {
    if (!p["done"]) continue;
    const id = String(p["item_id"]);
    doneCounts.set(id, (doneCounts.get(id) ?? 0) + 1);
  }

  const checklist: ChecklistItem[] = ((checklistRes.data ?? []) as Row[]).map((c) => {
    const id = String(c["id"]);
    return {
      id,
      itemKey: String(c["item_key"]),
      title: String(c["title"]),
      details: s(c, "details"),
      dueOn: s(c, "due_on"),
      required: c["required"] == null ? true : Boolean(c["required"]),
      actionUrl: s(c, "action_url"),
      featureKey: s(c, "feature_key"),
      audience: audienceFor(audiences, "checklist_item", id, s(c, "audience_kind")),
      done: myDone.has(id),
      doneCount: isStaff ? (doneCounts.get(id) ?? 0) : null,
    };
  });

  const documents: ProgrammeDoc[] = ((docRes.data ?? []) as Row[]).map((d) => {
    const id = String(d["id"]);
    return {
      id,
      label: String(d["label"]),
      description: s(d, "description"),
      linkUrl: s(d, "link_url"),
      storagePath: s(d, "storage_path"),
      category: String(d["category"] ?? "other"),
      audience: audienceFor(audiences, "document", id, s(d, "audience_kind")),
    };
  });

  const contacts: ProgrammeContactRow[] = ((contactRes.data ?? []) as Row[]).map((c) => {
    const id = String(c["id"]);
    return {
      id,
      name: String(c["name"]),
      role: s(c, "role"),
      category: String(c["category"] ?? "other"),
      phone: s(c, "phone"),
      whatsapp: s(c, "whatsapp"),
      email: s(c, "email"),
      notes: s(c, "notes"),
      availability: s(c, "availability"),
      isEmergency: Boolean(c["is_emergency"]),
      audience: audienceFor(audiences, "contact", id, s(c, "audience_kind")),
    };
  });

  const places: ProgrammePlace[] = ((placeRes.data ?? []) as Row[]).map((p) => {
    const id = String(p["id"]);
    return {
      id,
      label: String(p["label"]),
      category: String(p["category"] ?? "other"),
      notes: s(p, "notes"),
      meetingInstructions: s(p, "meeting_instructions"),
      googlePlaceId: s(p, "google_place_id"),
      address: s(p, "address"),
      latitude: n(p, "latitude"),
      longitude: n(p, "longitude"),
      audience: audienceFor(audiences, "place", id, s(p, "audience_kind")),
    };
  });

  const notifications: ProgrammeNotification[] = ((notifRes.data ?? []) as Row[]).map((x) => ({
    id: String(x["id"]),
    level: String(x["level"]) as "notify" | "urgent",
    title: String(x["title"]),
    body: s(x, "body"),
    subjectType: s(x, "subject_type"),
    subjectId: s(x, "subject_id"),
    createdAt: String(x["created_at"]),
    readAt: s(x, "read_at"),
  }));

  return {
    joined: Boolean(membership),
    cohortId,
    programmeId,
    programmeName: s(programme, "name"),
    organisation: s(programme, "organisation"),
    cohortName: s(cohort, "name"),
    year: s(cohort, "year"),
    city: s(programme, "city"),
    logoUrl: s(programme, "logo_url"),
    verified: Boolean(programme["verified_at"]),
    isTest: s(programme, "slug") === "shekk-test-programme",
    timezone: String(cohort["timezone"] ?? "Asia/Jerusalem"),
    welcomeMessage: s(cohort, "welcome_message"),
    startsOn: s(cohort, "starts_on"),
    endsOn: s(cohort, "ends_on"),
    myGroups: groups.filter((g) => myGroupIds.has(g.id)),
    staff,
    events,
    announcements,
    votes,
    checklist,
    documents,
    contacts,
    places,
    notifications,
    recentChanges,
  };
}

/* ─────────────────────────── Participant mutations ───────────────────────── */

export async function setRsvp(db: Db, userId: string, eventId: string, response: string) {
  const { error } = await db
    .from("programme_event_rsvps")
    .upsert({ event_id: eventId, user_id: userId, response } as never, { onConflict: "event_id,user_id" });
  if (error) throw new Error(error.message || "We couldn't save your RSVP");
  return readHub(db, userId);
}

export async function acknowledge(db: Db, userId: string, subjectType: "event" | "announcement", subjectId: string) {
  const cohortId = await subjectCohort(db, subjectType, subjectId);
  if (!cohortId) throw new Error("That item is no longer available");
  const { error } = await db
    .from("programme_acknowledgements")
    .upsert(
      { cohort_id: cohortId, subject_type: subjectType, subject_id: subjectId, user_id: userId } as never,
      { onConflict: "subject_type,subject_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message || "We couldn't record that");
  return readHub(db, userId);
}

async function subjectCohort(db: Db, subjectType: string, subjectId: string): Promise<string | null> {
  const table = subjectType === "event" ? "programme_events" : "programme_announcements";
  const { data } = await db.from(table).select("cohort_id").eq("id", subjectId).maybeSingle();
  return data ? String((data as Row)["cohort_id"]) : null;
}

export async function castVote(db: Db, userId: string, voteId: string, optionId: string) {
  const { error } = await db
    .from("programme_vote_responses")
    .upsert({ vote_id: voteId, option_id: optionId, user_id: userId } as never, { onConflict: "vote_id,user_id" });
  if (error) throw new Error(error.message || "We couldn't record your vote");
  return readHub(db, userId);
}

export async function setChecklistItemDone(db: Db, userId: string, itemId: string, done: boolean) {
  if (done) {
    const { error } = await db.from("programme_checklist_progress").upsert(
      { user_id: userId, item_id: itemId, done: true, done_at: new Date().toISOString() } as never,
      { onConflict: "user_id,item_id" },
    );
    if (error) throw error;
  } else {
    const { error } = await db
      .from("programme_checklist_progress")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId);
    if (error) throw error;
  }
  return readHub(db, userId);
}

export async function markNotificationsRead(db: Db, userId: string, ids: string[]) {
  if (!ids.length) return { ok: true };
  const { error } = await db
    .from("programme_notifications")
    .update({ read_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw error;
  return { ok: true };
}

/* ─────────────────────────────── Join / invites ──────────────────────────── */

export type JoinPreview = {
  cohortId: string;
  programmeName: string;
  cohortName: string;
  organisation: string | null;
  city: string | null;
  logoUrl: string | null;
  verified: boolean;
  startsOn: string | null;
  endsOn: string | null;
  year: string | null;
};

/** Pre-join peek: only enough to confirm the code is the right one. */
export async function previewJoinCode(code: string): Promise<JoinPreview | null> {
  const db = await adminDb();
  const { data } = await db
    .from("programme_cohorts")
    .select("id, name, year, starts_on, ends_on, status, programme_id")
    .ilike("join_code", code.trim())
    .maybeSingle();
  if (!data) return null;
  const cohort = data as Row;
  if (String(cohort["status"]) !== "open") return null;
  const { data: prog } = await db
    .from("programmes")
    .select("name, organisation, city, logo_url, verified_at, status")
    .eq("id", cohort["programme_id"])
    .maybeSingle();
  if (!prog || String((prog as Row)["status"]) !== "active") return null;
  const p = prog as Row;
  return {
    cohortId: String(cohort["id"]),
    programmeName: String(p["name"]),
    cohortName: String(cohort["name"]),
    organisation: s(p, "organisation"),
    city: s(p, "city"),
    logoUrl: s(p, "logo_url"),
    verified: Boolean(p["verified_at"]),
    startsOn: s(cohort, "starts_on"),
    endsOn: s(cohort, "ends_on"),
    year: s(cohort, "year"),
  };
}

export async function joinWithCode(userDb: Db, userId: string, code: string): Promise<ProgrammeHub> {
  const db = await adminDb();
  const { error } = await db.rpc("programme_join" as never, { _user_id: userId, _code: code } as never);
  if (error) throw new Error(error.message || "That programme code was not recognised");
  return readHub(userDb, userId);
}

export async function leaveProgramme(db: Db, userId: string): Promise<ProgrammeHub> {
  const { error } = await db
    .from("programme_memberships")
    .update({ status: "left" } as never)
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return readHub(db, userId);
}

export type InvitePreview = {
  code: string;
  kind: "claim" | "staff";
  role: StaffRole;
  programmeName: string;
  cohortName: string | null;
  organisation: string | null;
  expired: boolean;
  accepted: boolean;
};

export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const db = await adminDb();
  const { data } = await db.from("programme_invites").select("*").eq("code", code.trim()).maybeSingle();
  if (!data) return null;
  const invite = data as Row;
  const { data: prog } = await db
    .from("programmes")
    .select("name, organisation")
    .eq("id", invite["programme_id"])
    .maybeSingle();
  let cohortName: string | null = null;
  if (invite["cohort_id"]) {
    const { data: cohort } = await db
      .from("programme_cohorts")
      .select("name")
      .eq("id", invite["cohort_id"])
      .maybeSingle();
    cohortName = cohort ? String((cohort as Row)["name"]) : null;
  }
  return {
    code: String(invite["code"]),
    kind: String(invite["kind"]) as "claim" | "staff",
    role: String(invite["role"]) as StaffRole,
    programmeName: prog ? String((prog as Row)["name"]) : "Programme",
    cohortName,
    organisation: prog ? s(prog as Row, "organisation") : null,
    expired: Boolean(invite["expires_at"] && new Date(String(invite["expires_at"])) < new Date()),
    accepted: Boolean(invite["accepted_at"]),
  };
}

/** A director claims their programme (or a staff invite is accepted). */
export async function acceptInvite(userDb: Db, userId: string, code: string): Promise<ProgrammeHub> {
  const db = await adminDb();
  const { data } = await db.from("programme_invites").select("*").eq("code", code.trim()).maybeSingle();
  if (!data) throw new Error("That invite was not recognised");
  const invite = data as Row;
  if (invite["accepted_at"]) throw new Error("That invite has already been used");
  if (invite["expires_at"] && new Date(String(invite["expires_at"])) < new Date()) {
    throw new Error("That invite has expired");
  }

  const { error } = await db.from("programme_staff").upsert(
    {
      programme_id: invite["programme_id"],
      user_id: userId,
      role: String(invite["role"]),
      permissions: [],
    } as never,
    { onConflict: "programme_id,user_id" },
  );
  if (error) throw new Error(error.message || "We couldn't accept that invite");

  await db
    .from("programme_invites")
    .update({ accepted_by: userId, accepted_at: new Date().toISOString() } as never)
    .eq("id", invite["id"]);

  return readHub(userDb, userId);
}

/* ──────────────────────────── Notification fan-out ───────────────────────── */

/**
 * The honest notification model: there is no push or email infrastructure
 * wired up, so "notify" writes a row into each participant's in-app inbox and
 * nothing else. Nothing here claims a push was sent.
 */
async function notifyAudience(
  cohortId: string,
  audienceKind: string,
  subjectType: "event" | "announcement" | "vote",
  subjectId: string,
  level: "notify" | "urgent",
  title: string,
  body: string | null,
) {
  const db = await adminDb();
  const { data: members } = await db
    .from("programme_memberships")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .eq("status", "active");
  let userIds = ((members ?? []) as Row[]).map((m) => String(m["user_id"]));

  if (audienceKind !== "everyone") {
    const { data: rows } = await db
      .from("programme_audiences")
      .select("group_id, user_id")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId);
    const targeted = new Set<string>();
    const groupIds: string[] = [];
    for (const r of (rows ?? []) as Row[]) {
      if (r["user_id"]) targeted.add(String(r["user_id"]));
      if (r["group_id"]) groupIds.push(String(r["group_id"]));
    }
    if (groupIds.length) {
      const { data: gm } = await db
        .from("programme_group_members")
        .select("user_id")
        .in("group_id", groupIds);
      for (const r of (gm ?? []) as Row[]) targeted.add(String(r["user_id"]));
    }
    userIds = userIds.filter((u) => targeted.has(u));
  }

  if (!userIds.length) return 0;
  await db.from("programme_notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      cohort_id: cohortId,
      level,
      title,
      body,
      subject_type: subjectType,
      subject_id: subjectId,
    })) as never,
  );
  return userIds.length;
}

/* ───────────────────────────────── Staff: events ─────────────────────────── */

export type EventInput = {
  startsLocal?: LocalEventTime;
  endsLocal?: LocalEventTime;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  locationLabel?: string | null;
  meetingPoint?: string | null;
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onlineUrl?: string | null;
  eventType?: string;
  mandatory?: boolean;
  status?: EventStatus;
  statusNote?: string | null;
  rsvpEnabled?: boolean;
  capacity?: number | null;
  requiresAck?: boolean;
  urgent?: boolean;
  audience?: Audience;
};

export async function createEvent(db: Db, userId: string, cohortId: string, input: EventInput) {
  await requireStaff(db, userId, cohortId, "events");
  input = {
    ...input,
    startsAt: validateEventTime(input.startsAt, input.startsLocal),
    endsAt: input.endsAt == null ? input.endsAt : validateEventTime(input.endsAt, input.endsLocal),
  };
  if (input.endsLocal && input.endsAt == null) throw new Error("End time is missing.");
  validateEventInterval(input.startsAt, input.endsAt);
  const audience = input.audience ?? everyone;
  const { data, error } = await db
    .from("programme_events")
    .insert({
      cohort_id: cohortId,
      title: input.title,
      description: input.description ?? null,
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      original_starts_at: input.startsAt,
      location_label: input.locationLabel ?? null,
      meeting_point: input.meetingPoint ?? null,
      google_place_id: input.googlePlaceId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      online_url: input.onlineUrl ?? null,
      event_type: input.eventType ?? "activity",
      mandatory: input.mandatory ?? false,
      status: input.status ?? "scheduled",
      status_note: input.statusNote ?? null,
      audience_kind: audience.kind,
      rsvp_enabled: input.rsvpEnabled ?? false,
      capacity: input.capacity ?? null,
      requires_ack: input.requiresAck ?? false,
      urgent: input.urgent ?? false,
      created_by: userId,
      updated_by: userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message || "We couldn't create that event");
  const eventId = String((data as Row)["id"]);
  await writeAudience(db, cohortId, "event", eventId, audience);
  return readHub(db, userId);
}

const FIELD_LABEL: Record<string, string> = {
  starts_at: "Start time",
  ends_at: "End time",
  status: "Status",
  location_label: "Location",
  meeting_point: "Meeting point",
  title: "Title",
  mandatory: "Attendance",
  capacity: "Capacity",
  audience_kind: "Audience",
  requires_ack: "Acknowledgement",
  description: "Details",
};

export type EventUpdate = Partial<EventInput> & { notifyLevel?: NotifyLevel; note?: string | null };

export async function updateEvent(db: Db, userId: string, eventId: string, patch: EventUpdate) {
  const { data: existing } = await db
    .from("programme_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (!existing) throw new Error("That event no longer exists");
  const before = existing as Row;
  const cohortId = String(before["cohort_id"]);
  await requireStaff(db, userId, cohortId, "events");

  patch = { ...patch };
  if (patch.startsLocal && patch.startsAt === undefined) throw new Error("Start time is missing.");
  if (patch.endsLocal && patch.endsAt == null) throw new Error("End time is missing.");
  if (patch.startsAt !== undefined)
    patch.startsAt = validateEventTime(
      patch.startsAt,
      patch.startsLocal,
      String(before["starts_at"]),
    );
  if (patch.endsAt != null)
    patch.endsAt = validateEventTime(patch.endsAt, patch.endsLocal, s(before, "ends_at"));
  validateEventInterval(
    patch.startsAt ?? String(before["starts_at"]),
    patch.endsAt === undefined ? s(before, "ends_at") : patch.endsAt,
  );

  const map: [keyof EventInput, string][] = [
    ["title", "title"],
    ["description", "description"],
    ["startsAt", "starts_at"],
    ["endsAt", "ends_at"],
    ["locationLabel", "location_label"],
    ["meetingPoint", "meeting_point"],
    ["googlePlaceId", "google_place_id"],
    ["latitude", "latitude"],
    ["longitude", "longitude"],
    ["onlineUrl", "online_url"],
    ["eventType", "event_type"],
    ["mandatory", "mandatory"],
    ["status", "status"],
    ["statusNote", "status_note"],
    ["rsvpEnabled", "rsvp_enabled"],
    ["capacity", "capacity"],
    ["requiresAck", "requires_ack"],
    ["urgent", "urgent"],
  ];

  const update: Row = {
    updated_by: userId,
    last_changed_at: new Date().toISOString(),
  };
  const diffs: {
    field: string;
    before: string | null;
    after: string | null;
  }[] = [];
  for (const [key, column] of map) {
    const value = (patch as Row)[key as string];
    if (value === undefined) continue;
    const prev = before[column] ?? null;
    if (!sameEventValue(column, prev, value)) {
      update[column] = value;
      diffs.push({
        field: column,
        before: prev == null ? null : String(prev),
        after: value == null ? null : String(value),
      });
    }
  }
  let audienceChanged = false;
  if (patch.audience) {
    // Read only this event's targets; fail closed instead of treating a read error as empty.
    const { data: rows, error: audienceError } = await db
      .from("programme_audiences")
      .select("group_id, user_id")
      .eq("subject_type", "event")
      .eq("subject_id", eventId);
    if (audienceError) throw new Error("Could not check the event audience.");
    const previous: Audience = {
      kind: String(before["audience_kind"]) as AudienceKind,
      groupIds: (rows ?? [])
        .filter((r: Row) => r["group_id"])
        .map((r: Row) => String(r["group_id"])),
      userIds: (rows ?? []).filter((r: Row) => r["user_id"]).map((r: Row) => String(r["user_id"])),
    };
    const semantic = (a: Audience) =>
      JSON.stringify({
        kind: a.kind,
        groupIds: a.kind === "everyone" ? [] : [...new Set(a.groupIds)].sort(),
        userIds: a.kind === "everyone" ? [] : [...new Set(a.userIds)].sort(),
      });
    audienceChanged = semantic(previous) !== semantic(patch.audience);
    if (audienceChanged) {
      update["audience_kind"] = patch.audience.kind;
      diffs.push({
        field: "audience_kind",
        before: previous.kind !== patch.audience.kind ? previous.kind : null,
        after: previous.kind !== patch.audience.kind ? patch.audience.kind : "Recipients updated",
      });
    }
  }

  // A save is not a change. Do not touch timestamps, audiences, history or notifications.
  if (!diffs.length) return readHub(db, userId);

  const { error } = await db
    .from("programme_events")
    .update(update as never)
    .eq("id", eventId);
  if (error) throw new Error(error.message || "We couldn't update that event");

  if (audienceChanged) await writeAudience(db, cohortId, "event", eventId, patch.audience);

  const level: NotifyLevel = patch.notifyLevel ?? "silent";
  if (diffs.length) {
    await db.from("programme_event_changes").insert(
      diffs.map((d) => ({
        event_id: eventId,
        cohort_id: cohortId,
        field: d.field,
        before_value: d.before,
        after_value: d.after,
        note: patch.note ?? null,
        notify_level: level,
        changed_by: userId,
      })) as never,
    );
  }

  if (level !== "silent" && diffs.length) {
    const headline = diffs.map((d) => FIELD_LABEL[d.field] ?? d.field).join(", ");
    await notifyAudience(
      cohortId,
      String(update["audience_kind"] ?? before["audience_kind"]),
      "event",
      eventId,
      level === "urgent" ? "urgent" : "notify",
      `${String(before["title"])} — updated`,
      patch.note ?? `${headline} changed.`,
    );
  }

  return readHub(db, userId);
}

export async function deleteEvent(db: Db, userId: string, eventId: string) {
  const { data: existing } = await db.from("programme_events").select("cohort_id").eq("id", eventId).maybeSingle();
  if (!existing) return readHub(db, userId);
  await requireStaff(db, userId, String((existing as Row)["cohort_id"]), "events");
  const { error } = await db.from("programme_events").delete().eq("id", eventId);
  if (error) throw error;
  return readHub(db, userId);
}

/* ────────────────────────── Staff: announcements ─────────────────────────── */

export type AnnouncementInput = {
  title: string;
  body: string;
  priority?: "normal" | "important" | "urgent";
  pinned?: boolean;
  requiresAck?: boolean;
  eventId?: string | null;
  linkUrl?: string | null;
  audience?: Audience;
  notify?: boolean;
};

export async function createAnnouncement(db: Db, userId: string, cohortId: string, input: AnnouncementInput) {
  await requireStaff(db, userId, cohortId, "announcements");
  const audience = input.audience ?? everyone;
  const { data, error } = await db
    .from("programme_announcements")
    .insert({
      cohort_id: cohortId,
      title: input.title,
      body: input.body,
      priority: input.priority ?? "normal",
      pinned: input.pinned ?? false,
      requires_ack: input.requiresAck ?? false,
      event_id: input.eventId ?? null,
      link_url: input.linkUrl ?? null,
      audience_kind: audience.kind,
      created_by: userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message || "We couldn't post that announcement");
  const id = String((data as Row)["id"]);
  await writeAudience(db, cohortId, "announcement", id, audience);

  if (input.notify !== false) {
    await notifyAudience(
      cohortId,
      audience.kind,
      "announcement",
      id,
      input.priority === "urgent" ? "urgent" : "notify",
      input.title,
      input.body.slice(0, 200),
    );
  }
  return readHub(db, userId);
}

export async function deleteAnnouncement(db: Db, userId: string, id: string) {
  const { data } = await db.from("programme_announcements").select("cohort_id").eq("id", id).maybeSingle();
  if (!data) return readHub(db, userId);
  await requireStaff(db, userId, String((data as Row)["cohort_id"]), "announcements");
  const { error } = await db.from("programme_announcements").delete().eq("id", id);
  if (error) throw error;
  return readHub(db, userId);
}

/* ─────────────────────────────── Staff: votes ────────────────────────────── */

export type VoteInput = {
  question: string;
  voteKind?: "poll" | "question" | "yes_no";
  description?: string | null;
  options: { label: string; detail?: string | null; capacity?: number | null }[];
  eventId?: string | null;
  anonymous?: boolean;
  allowChange?: boolean;
  resultsVisible?: boolean;
  closesAt?: string | null;
  audience?: Audience;
  notify?: boolean;
};

export async function createVote(db: Db, userId: string, cohortId: string, input: VoteInput) {
  await requireStaff(db, userId, cohortId, "votes");
  const audience = input.audience ?? everyone;
  const { data, error } = await db
    .from("programme_votes")
    .insert({
      cohort_id: cohortId,
      event_id: input.eventId ?? null,
      question: input.question,
      description: input.description ?? null,
      vote_kind: input.voteKind ?? "poll",
      anonymous: input.anonymous ?? true,
      allow_change: input.allowChange ?? true,
      results_visible: input.resultsVisible ?? true,
      closes_at: input.closesAt ?? null,
      audience_kind: audience.kind,
      created_by: userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message || "We couldn't create that vote");
  const voteId = String((data as Row)["id"]);

  const { error: optErr } = await db.from("programme_vote_options").insert(
    input.options.map((o, i) => ({
      vote_id: voteId,
      label: o.label,
      detail: o.detail ?? null,
      capacity: o.capacity ?? null,
      sort_order: i,
    })) as never,
  );
  if (optErr) throw new Error(optErr.message || "We couldn't save the vote options");

  await writeAudience(db, cohortId, "vote", voteId, audience);
  if (input.notify !== false) {
    const heading =
      input.voteKind === "question" || input.voteKind === "yes_no" ? "A question for you" : "New vote";
    await notifyAudience(cohortId, audience.kind, "vote", voteId, "notify", heading, input.question);
  }
  return readHub(db, userId);
}

export async function closeVote(db: Db, userId: string, voteId: string, winningOptionId: string | null) {
  const { data } = await db.from("programme_votes").select("cohort_id").eq("id", voteId).maybeSingle();
  if (!data) throw new Error("That vote no longer exists");
  await requireStaff(db, userId, String((data as Row)["cohort_id"]), "votes");
  const { error } = await db
    .from("programme_votes")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      winning_option_id: winningOptionId,
    } as never)
    .eq("id", voteId);
  if (error) throw new Error(error.message || "We couldn't close that vote");
  return readHub(db, userId);
}

/** Turn the winning option into the event's confirmed plan. */
export async function applyVoteWinnerToEvent(db: Db, userId: string, voteId: string, optionId: string) {
  const { data: vote } = await db.from("programme_votes").select("*").eq("id", voteId).maybeSingle();
  if (!vote) throw new Error("That vote no longer exists");
  const v = vote as Row;
  const cohortId = String(v["cohort_id"]);
  await requireStaff(db, userId, cohortId, "votes");
  const { data: option } = await db.from("programme_vote_options").select("*").eq("id", optionId).maybeSingle();
  if (!option) throw new Error("That option no longer exists");
  const label = String((option as Row)["label"]);

  await closeVote(db, userId, voteId, optionId);

  if (v["event_id"]) {
    return updateEvent(db, userId, String(v["event_id"]), {
      title: label,
      status: "confirmed",
      notifyLevel: "notify",
      note: `The vote closed — we're doing ${label}.`,
    });
  }
  return readHub(db, userId);
}

/* ──────────────────── Staff: groups, participants, content ───────────────── */

export async function createGroup(db: Db, userId: string, cohortId: string, name: string, description: string | null) {
  await requireStaff(db, userId, cohortId, "groups");
  const { error } = await db
    .from("programme_groups")
    .insert({ cohort_id: cohortId, name, description } as never);
  if (error) throw new Error(error.message || "We couldn't create that group");
  return readHub(db, userId);
}

export async function deleteGroup(db: Db, userId: string, groupId: string) {
  const { data } = await db.from("programme_groups").select("cohort_id").eq("id", groupId).maybeSingle();
  if (!data) return readHub(db, userId);
  await requireStaff(db, userId, String((data as Row)["cohort_id"]), "groups");
  const { error } = await db.from("programme_groups").delete().eq("id", groupId);
  if (error) throw error;
  return readHub(db, userId);
}

export async function setGroupMembership(db: Db, userId: string, groupId: string, memberId: string, member: boolean) {
  const { data } = await db.from("programme_groups").select("cohort_id").eq("id", groupId).maybeSingle();
  if (!data) throw new Error("That group no longer exists");
  await requireStaff(db, userId, String((data as Row)["cohort_id"]), "groups");
  if (member) {
    const { error } = await db
      .from("programme_group_members")
      .upsert({ group_id: groupId, user_id: memberId } as never, { onConflict: "group_id,user_id" });
    if (error) throw error;
  } else {
    const { error } = await db
      .from("programme_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberId);
    if (error) throw error;
  }
  return { ok: true };
}

export type Participant = {
  userId: string;
  name: string;
  handle: string | null;
  joinedAt: string;
  groupIds: string[];
  checklistDone: number;
};

/** The roster, with just enough to run a programme — no sensitive personal data. */
export async function listParticipants(db: Db, userId: string, cohortId: string): Promise<Participant[]> {
  await requireStaff(db, userId, cohortId, "participants");
  return rosterForCohort(cohortId);
}

/**
 * The same roster, without the staff check — callers must already have proved
 * either programme-staff permission or the internal Shekk `admin` role.
 */
export async function rosterForCohort(cohortId: string): Promise<Participant[]> {
  const service = await adminDb();
  const raw = await loadCohortRosterRaw(service, cohortId);
  const itemIds = new Set(raw.checklistItems.map((i) => String(i["id"])));

  return raw.memberships.map((r) => {
    const uid = String(r["user_id"]);
    const h = raw.handleBy.get(uid);
    const t = raw.travelBy.get(uid);
    const name =
      (t && s(t, "display_name")) ||
      (h && s(h, "display_name")) ||
      (h ? `@${h["handle"]}` : "Participant");
    const doneCount = (raw.progressByUser.get(uid) ?? []).filter(
      (p) => p["done"] && itemIds.has(String(p["item_id"])),
    ).length;
    return {
      userId: uid,
      name: name ?? "Participant",
      handle: h ? String(h["handle"]) : null,
      joinedAt: String(r["joined_at"]),
      groupIds: raw.groupsByUser.get(uid) ?? [],
      checklistDone: doneCount,
    };
  });
}

/* ─────────────────────── Students (Programme OS staff view) ──────────────────────
 * Never touches member_profiles (KYC/financial) — only member_handles and
 * member_travel, the same two tables rosterForCohort() above already reads.
 * Every function here returns the DTOs from lib/programme/logic.ts, never a
 * raw table row.
 */

type CohortRosterRaw = {
  memberships: Row[];
  handleBy: Map<string, Row>;
  travelBy: Map<string, Row>;
  groups: Row[];
  groupsByUser: Map<string, string[]>;
  checklistItems: Row[];
  progressByUser: Map<string, Row[]>;
  /** null = programme_student_details isn't live in this environment — see tryLoadStudentDetails. */
  detailsByUser: Map<string, Row> | null;
};

/**
 * One round trip per table for the whole cohort — never one query per
 * student. Shared by rosterForCohort() (mobile "People" tab) and
 * staffStudentRoster() (Programme OS) so neither duplicates the join logic.
 */
async function loadCohortRosterRaw(service: Db, cohortId: string): Promise<CohortRosterRaw> {
  const empty: CohortRosterRaw = {
    memberships: [],
    handleBy: new Map(),
    travelBy: new Map(),
    groups: [],
    groupsByUser: new Map(),
    checklistItems: [],
    progressByUser: new Map(),
    detailsByUser: new Map(),
  };

  const { data: members } = await service
    .from("programme_memberships")
    .select("user_id, joined_at")
    .eq("cohort_id", cohortId)
    .eq("status", "active");
  const memberships = (members ?? []) as Row[];
  if (!memberships.length) return empty;
  const ids = memberships.map((r) => String(r["user_id"]));

  const [
    { data: handles },
    { data: travel },
    { data: groups },
    { data: items },
    { data: progress },
  ] = await Promise.all([
    service.from("member_handles").select("user_id, handle, display_name").in("user_id", ids),
    service
      .from("member_travel")
      .select("user_id, display_name, home_country, israel_city, accommodation_area, arrival_date")
      .in("user_id", ids),
    service
      .from("programme_groups")
      .select("id, name")
      .eq("cohort_id", cohortId)
      .order("sort_order"),
    service
      .from("programme_checklist_items")
      .select("id, item_key, title, details, due_on, required, action_url")
      .eq("cohort_id", cohortId)
      .order("sort_order"),
    service
      .from("programme_checklist_progress")
      .select("user_id, item_id, done")
      .in("user_id", ids),
  ]);

  const groupRows = (groups ?? []) as Row[];
  const groupIds = groupRows.map((g) => String(g["id"]));
  const { data: gm } = groupIds.length
    ? await service.from("programme_group_members").select("group_id, user_id").in("group_id", groupIds)
    : { data: [] as Row[] };

  const groupsByUser = new Map<string, string[]>();
  for (const g of (gm ?? []) as Row[]) {
    const uid = String(g["user_id"]);
    groupsByUser.set(uid, [...(groupsByUser.get(uid) ?? []), String(g["group_id"])]);
  }

  const progressByUser = new Map<string, Row[]>();
  for (const p of (progress ?? []) as Row[]) {
    const uid = String(p["user_id"]);
    progressByUser.set(uid, [...(progressByUser.get(uid) ?? []), p]);
  }

  return {
    memberships,
    handleBy: new Map(((handles ?? []) as Row[]).map((h) => [String(h["user_id"]), h])),
    travelBy: new Map(((travel ?? []) as Row[]).map((t) => [String(t["user_id"]), t])),
    groups: groupRows,
    groupsByUser,
    checklistItems: (items ?? []) as Row[],
    progressByUser,
    detailsByUser: await tryLoadStudentDetails(service, cohortId, ids),
  };
}

/**
 * programme_student_details may not exist in this environment yet (its
 * migration isn't applied everywhere) — degrade to "lifecycle data
 * unavailable" rather than failing the whole roster/profile. PGRST205 is
 * PostgREST's "table not in schema cache" — genuinely absent, not a
 * permission problem. Any other error is unexpected and worth knowing about,
 * but still shouldn't take down a page that doesn't strictly need it.
 */
async function tryLoadStudentDetails(
  service: Db,
  cohortId: string,
  userIds: string[],
): Promise<Map<string, Row> | null> {
  if (!userIds.length) return new Map();
  const { data, error } = await service
    .from("programme_student_details")
    .select("user_id, status")
    .eq("cohort_id", cohortId)
    .in("user_id", userIds);
  if (error) {
    if (error.code !== "PGRST205") {
      console.error("[programme] programme_student_details query failed", error);
    }
    return null;
  }
  return new Map(((data ?? []) as Row[]).map((d) => [String(d["user_id"]), d]));
}

function summariseStudent(
  uid: string,
  membershipRow: Row,
  raw: Pick<CohortRosterRaw, "handleBy" | "travelBy" | "groups" | "groupsByUser" | "detailsByUser">,
  checklist: ChecklistProgress,
): StaffStudentSummary {
  const h = raw.handleBy.get(uid);
  const t = raw.travelBy.get(uid);
  const displayName =
    (t && s(t, "display_name")) ||
    (h && s(h, "display_name")) ||
    (h ? `@${h["handle"]}` : "Student");
  const groupsById = new Map(raw.groups.map((g) => [String(g["id"]), g]));
  const groups: StaffStudentGroupRef[] = (raw.groupsByUser.get(uid) ?? [])
    .map((gid) => groupsById.get(gid))
    .filter((g): g is Row => Boolean(g))
    .map((g) => ({ id: String(g["id"]), name: String(g["name"]) }));
  const details = raw.detailsByUser?.get(uid) ?? null;

  return {
    userId: uid,
    displayName: displayName ?? "Student",
    handle: h ? String(h["handle"]) : null,
    groups,
    lifecycleStatus: details ? String(details["status"]) : null,
    homeCountry: t ? s(t, "home_country") : null,
    israelCity: t ? s(t, "israel_city") : null,
    accommodationArea: t ? s(t, "accommodation_area") : null,
    arrivalDate: t ? s(t, "arrival_date") : null,
    joinedAt: String(membershipRow["joined_at"]),
    checklist,
  };
}

/**
 * The lighter roster shape Communications needs (no checklist join) —
 * fed straight into announcementAcknowledgementStats()'s audienceAllows()
 * check, so eligibility here can never drift from Students'/Onboarding's.
 */
function rosterMembers(
  raw: Pick<CohortRosterRaw, "memberships" | "groupsByUser" | "handleBy" | "travelBy">,
): CommunicationsMember[] {
  return raw.memberships.map((m) => {
    const uid = String(m["user_id"]);
    const h = raw.handleBy.get(uid);
    const t = raw.travelBy.get(uid);
    const displayName =
      (t && s(t, "display_name")) ||
      (h && s(h, "display_name")) ||
      (h ? `@${h["handle"]}` : "Student");
    return {
      userId: uid,
      displayName: displayName ?? "Student",
      handle: h ? String(h["handle"]) : null,
      groupIds: raw.groupsByUser.get(uid) ?? [],
    };
  });
}

/** The Students roster: one summary row per active member, no per-student round trips. */
export async function staffStudentRoster(
  db: Db,
  userId: string,
  cohortId: string,
): Promise<StaffStudentSummary[]> {
  await requireStaff(db, userId, cohortId, "participants");
  const service = await adminDb();
  const raw = await loadCohortRosterRaw(service, cohortId);
  const itemIds = new Set(raw.checklistItems.map((i) => String(i["id"])));

  return raw.memberships.map((m) => {
    const uid = String(m["user_id"]);
    const doneItemIds = new Set(
      (raw.progressByUser.get(uid) ?? [])
        .filter((p) => p["done"] && itemIds.has(String(p["item_id"])))
        .map((p) => String(p["item_id"])),
    );
    const checklist = checklistProgress(
      raw.checklistItems.map((i) => ({
        required: Boolean(i["required"]),
        done: doneItemIds.has(String(i["id"])),
      })),
    );
    return summariseStudent(uid, m, raw, checklist);
  });
}

/**
 * One student's full staff-facing profile. Never trusts the caller's claim
 * that `studentId` belongs to `cohortId` — the active-membership lookup
 * below is the check, not the input. Returns null (→ 404 in the route) for
 * a student who isn't an active member of this specific cohort, whether
 * they don't exist, belong to a different cohort, or already left.
 */
export async function staffStudentProfile(
  db: Db,
  userId: string,
  cohortId: string,
  studentId: string,
): Promise<StaffStudentProfile | null> {
  await requireStaff(db, userId, cohortId, "participants");
  const service = await adminDb();

  const { data: membership } = await service
    .from("programme_memberships")
    .select("user_id, joined_at")
    .eq("cohort_id", cohortId)
    .eq("user_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return null;

  const [
    { data: cohortRow },
    { data: handle },
    { data: travel },
    { data: memberGroups },
    { data: items },
    { data: progress },
  ] = await Promise.all([
    service
      .from("programme_cohorts")
      .select("id, name, programme_id")
      .eq("id", cohortId)
      .maybeSingle(),
    service
      .from("member_handles")
      .select("user_id, handle, display_name")
      .eq("user_id", studentId)
      .maybeSingle(),
    service
      .from("member_travel")
      .select("user_id, display_name, home_country, israel_city, accommodation_area, arrival_date")
      .eq("user_id", studentId)
      .maybeSingle(),
    service.from("programme_group_members").select("group_id").eq("user_id", studentId),
    service
      .from("programme_checklist_items")
      .select("id, item_key, title, details, due_on, required, action_url")
      .eq("cohort_id", cohortId)
      .order("sort_order"),
    service.from("programme_checklist_progress").select("item_id, done").eq("user_id", studentId),
  ]);

  const cohort = cohortRow as Row | null;
  if (!cohort) return null;

  const groupIds = ((memberGroups ?? []) as Row[]).map((g) => String(g["group_id"]));
  const { data: groupRows } = groupIds.length
    ? await service.from("programme_groups").select("id, name").in("id", groupIds)
    : { data: [] as Row[] };

  const [{ data: programmeRow }, detailsByUser] = await Promise.all([
    service
      .from("programmes")
      .select("id, name")
      .eq("id", String(cohort["programme_id"]))
      .maybeSingle(),
    tryLoadStudentDetails(service, cohortId, [studentId]),
  ]);
  const programme = programmeRow as Row | null;

  const doneItemIds = new Set(
    ((progress ?? []) as Row[]).filter((p) => p["done"]).map((p) => String(p["item_id"])),
  );
  const itemRows = (items ?? []) as Row[];
  const checklistItems: StaffStudentChecklistItem[] = itemRows.map((i) => ({
    id: String(i["id"]),
    itemKey: String(i["item_key"]),
    title: String(i["title"]),
    details: s(i, "details"),
    dueOn: s(i, "due_on"),
    required: Boolean(i["required"]),
    done: doneItemIds.has(String(i["id"])),
    actionUrl: s(i, "action_url"),
  }));
  const checklist = checklistProgress(
    itemRows.map((i) => ({
      required: Boolean(i["required"]),
      done: doneItemIds.has(String(i["id"])),
    })),
  );

  const raw: Pick<
    CohortRosterRaw,
    "handleBy" | "travelBy" | "groups" | "groupsByUser" | "detailsByUser"
  > = {
    handleBy: handle ? new Map([[studentId, handle as Row]]) : new Map(),
    travelBy: travel ? new Map([[studentId, travel as Row]]) : new Map(),
    groups: (groupRows ?? []) as Row[],
    groupsByUser: new Map([[studentId, groupIds]]),
    detailsByUser,
  };
  const summary = summariseStudent(studentId, membership as Row, raw, checklist);

  return {
    ...summary,
    programmeId: String(programme?.["id"] ?? cohort["programme_id"]),
    programmeName: String(programme?.["name"] ?? "Programme"),
    cohortId: String(cohort["id"]),
    cohortName: String(cohort["name"]),
    checklistItems,
  };
}

/**
 * The cohort-wide Onboarding dashboard: every active student's checklist
 * status and per-item completion, in one batched load — same
 * loadCohortRosterRaw() the Students roster uses, so this never duplicates
 * the join logic or adds a second round of per-student queries.
 */
export async function staffOnboardingOverview(
  db: Db,
  userId: string,
  cohortId: string,
): Promise<StaffOnboardingOverview> {
  await requireStaff(db, userId, cohortId, "participants");
  const service = await adminDb();
  const raw = await loadCohortRosterRaw(service, cohortId);

  const students: StaffOnboardingStudent[] = raw.memberships.map((m) => {
    const uid = String(m["user_id"]);
    const doneItemIds = new Set(
      (raw.progressByUser.get(uid) ?? []).filter((p) => p["done"]).map((p) => String(p["item_id"])),
    );
    const checklistItems: StaffStudentChecklistItem[] = raw.checklistItems.map((i) => ({
      id: String(i["id"]),
      itemKey: String(i["item_key"]),
      title: String(i["title"]),
      details: s(i, "details"),
      dueOn: s(i, "due_on"),
      required: Boolean(i["required"]),
      done: doneItemIds.has(String(i["id"])),
      actionUrl: s(i, "action_url"),
    }));
    const checklist = checklistProgress(checklistItems);
    const summary = summariseStudent(uid, m, raw, checklist);
    return {
      ...summary,
      status: onboardingStatus(checklist, checklistItems),
      checklistItems,
    };
  });

  return {
    cohortId,
    totalStudents: students.length,
    overallPercent: overallOnboardingPercent(students.map((st) => st.checklist)),
    statusCounts: countOnboardingStatuses(students.map((st) => st.status)),
    itemStats: onboardingItemStats(students),
    students,
  };
}

/* ─────────────────────── Programme OS: Communications ─────────────────────── */

/**
 * Every announcement in the cohort, each with how many of its *actual
 * eligible audience* (not the whole cohort) have acknowledged it. Read
 * access is gated on the `announcements` permission — the same one that
 * gates creating them; the per-student identity of who's outstanding is a
 * separate, narrower permission (`acknowledgements`), granted only by
 * staffAnnouncementAcknowledgements below.
 */
export async function staffCommunicationsOverview(
  db: Db,
  userId: string,
  cohortId: string,
): Promise<StaffCommunicationsOverview> {
  await requireStaff(db, userId, cohortId, "announcements");
  const service = await adminDb();

  const [raw, audiences, annRes, ackRes] = await Promise.all([
    loadCohortRosterRaw(service, cohortId),
    loadAudiences(service, cohortId),
    service
      .from("programme_announcements")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false }),
    service
      .from("programme_acknowledgements")
      .select("subject_id, user_id")
      .eq("cohort_id", cohortId)
      .eq("subject_type", "announcement"),
  ]);

  const members = rosterMembers(raw);
  const ackByAnnouncement = new Map<string, Set<string>>();
  for (const a of (ackRes.data ?? []) as Row[]) {
    const key = String(a["subject_id"]);
    const set = ackByAnnouncement.get(key) ?? new Set<string>();
    set.add(String(a["user_id"]));
    ackByAnnouncement.set(key, set);
  }

  const announcements: StaffAnnouncementSummary[] = ((annRes.data ?? []) as Row[]).map((a) => {
    const id = String(a["id"]);
    const audience = audienceFor(audiences, "announcement", id, s(a, "audience_kind"));
    const stats = announcementAcknowledgementStats(
      audience,
      members,
      ackByAnnouncement.get(id) ?? new Set(),
    );
    return {
      id,
      title: String(a["title"]),
      bodyPreview: String(a["body"]).slice(0, 200),
      priority: (s(a, "priority") ?? "normal") as Priority,
      pinned: Boolean(a["pinned"]),
      requiresAck: Boolean(a["requires_ack"]),
      audience,
      publishedAt: String(a["published_at"]),
      linkUrl: s(a, "link_url"),
      eligibleCount: stats.eligibleCount,
      ackCount: stats.ackCount,
      outstandingCount: stats.outstandingCount,
    };
  });

  return { cohortId, totalStudents: members.length, announcements };
}

/**
 * One announcement's acknowledgement drill-down: eligible/ack/outstanding
 * counts plus the outstanding students by name, for staff to act on. Gated
 * on the `acknowledgements` permission, separately from `announcements`
 * (composing/publishing) — a role can be given one without the other.
 *
 * Never trusts the caller's claim that announcementId belongs to cohortId;
 * the row is re-read and its own cohort_id checked, same defensive pattern
 * as staffStudentProfile.
 */
export async function staffAnnouncementAcknowledgements(
  db: Db,
  userId: string,
  cohortId: string,
  announcementId: string,
): Promise<StaffAnnouncementAcknowledgements | null> {
  await requireStaff(db, userId, cohortId, "acknowledgements");
  const service = await adminDb();

  const { data: annRow } = await service
    .from("programme_announcements")
    .select("id, audience_kind, cohort_id")
    .eq("id", announcementId)
    .maybeSingle();
  if (!annRow || String((annRow as Row)["cohort_id"]) !== cohortId) return null;

  const [raw, audiences, ackRes] = await Promise.all([
    loadCohortRosterRaw(service, cohortId),
    loadAudiences(service, cohortId),
    service
      .from("programme_acknowledgements")
      .select("user_id")
      .eq("cohort_id", cohortId)
      .eq("subject_type", "announcement")
      .eq("subject_id", announcementId),
  ]);

  const audience = audienceFor(
    audiences,
    "announcement",
    announcementId,
    s(annRow as Row, "audience_kind"),
  );
  const members = rosterMembers(raw);
  const acked = new Set(((ackRes.data ?? []) as Row[]).map((r) => String(r["user_id"])));
  const stats = announcementAcknowledgementStats(audience, members, acked);

  return { announcementId, ...stats };
}

/* ───────────────────────────── Programme OS: Calendar ──────────────────────── */

/**
 * Every event in the cohort, each with a response rollup scoped to its
 * *actual eligible audience* — same principle as Communications' ack rollup.
 * Read access is gated on `events`, the same permission that gates
 * creating/updating/deleting them; who specifically went/didn't (by name) is
 * a separate, narrower read via staffEventResponses below.
 */
export async function staffCalendarOverview(
  db: Db,
  userId: string,
  cohortId: string,
): Promise<StaffCalendarOverview> {
  await requireStaff(db, userId, cohortId, "events");
  const service = await adminDb();

  const [raw, audiences, eventRes, ackRes, changeRes] = await Promise.all([
    loadCohortRosterRaw(service, cohortId),
    loadAudiences(service, cohortId),
    service.from("programme_events").select("*").eq("cohort_id", cohortId).order("starts_at"),
    service
      .from("programme_acknowledgements")
      .select("subject_id, user_id")
      .eq("cohort_id", cohortId)
      .eq("subject_type", "event"),
    service
      .from("programme_event_changes")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("changed_at", { ascending: false }),
  ]);

  const eventIds = ((eventRes.data ?? []) as Row[]).map((e) => String(e["id"]));
  const { data: rsvpRows } = eventIds.length
    ? await service
        .from("programme_event_rsvps")
        .select("event_id, user_id, response")
        .in("event_id", eventIds)
    : { data: [] as Row[] };

  const members = rosterMembers(raw);

  const rsvpsByEvent = new Map<string, Map<string, RsvpResponse>>();
  for (const r of (rsvpRows ?? []) as Row[]) {
    const key = String(r["event_id"]);
    const map = rsvpsByEvent.get(key) ?? new Map<string, RsvpResponse>();
    map.set(String(r["user_id"]), String(r["response"]) as RsvpResponse);
    rsvpsByEvent.set(key, map);
  }

  const ackCountByEvent = new Map<string, number>();
  for (const a of (ackRes.data ?? []) as Row[]) {
    const key = String(a["subject_id"]);
    ackCountByEvent.set(key, (ackCountByEvent.get(key) ?? 0) + 1);
  }

  const changesByEvent = new Map<string, EventChange[]>();
  for (const c of (changeRes.data ?? []) as Row[]) {
    const key = String(c["event_id"]);
    const list = changesByEvent.get(key) ?? [];
    list.push({
      id: String(c["id"]),
      field: String(c["field"]),
      before: s(c, "before_value"),
      after: s(c, "after_value"),
      note: s(c, "note"),
      notifyLevel: String(c["notify_level"]) as NotifyLevel,
      changedAt: String(c["changed_at"]),
    });
    changesByEvent.set(key, list);
  }

  const events: StaffCalendarEvent[] = ((eventRes.data ?? []) as Row[]).map((e) => {
    const id = String(e["id"]);
    const audience = audienceFor(audiences, "event", id, s(e, "audience_kind"));
    const breakdown = eventResponseBreakdown(audience, members, rsvpsByEvent.get(id) ?? new Map());
    return {
      id,
      title: String(e["title"]),
      description: s(e, "description"),
      startsAt: String(e["starts_at"]),
      endsAt: s(e, "ends_at"),
      originalStartsAt: s(e, "original_starts_at"),
      locationLabel: s(e, "location_label"),
      meetingPoint: s(e, "meeting_point"),
      onlineUrl: s(e, "online_url"),
      eventType: String(e["event_type"] ?? "activity"),
      mandatory: Boolean(e["mandatory"]),
      status: String(e["status"]) as EventStatus,
      statusNote: s(e, "status_note"),
      audience,
      rsvpEnabled: Boolean(e["rsvp_enabled"]),
      capacity: n(e, "capacity"),
      requiresAck: Boolean(e["requires_ack"]),
      urgent: Boolean(e["urgent"]),
      changes: changesByEvent.get(id) ?? [],
      eligibleCount: breakdown.eligibleCount,
      goingCount: breakdown.goingCount,
      maybeCount: breakdown.maybeCount,
      notGoingCount: breakdown.notGoingCount,
      noResponseCount: breakdown.noResponseCount,
      ackCount: ackCountByEvent.get(id) ?? 0,
    };
  });

  return { cohortId, totalStudents: members.length, events };
}

/**
 * One event's RSVP drill-down: eligible/going/maybe/not-going/no-response,
 * each by name, for staff to act on. Gated on `events` — the same
 * permission as managing the event itself, since RSVP response is core
 * event-operations data (unlike Communications' acknowledgement identity,
 * which sits behind the narrower `acknowledgements` permission).
 *
 * Never trusts the caller's claim that eventId belongs to cohortId; the row
 * is re-read and its own cohort_id checked, same defensive pattern as
 * staffStudentProfile / staffAnnouncementAcknowledgements.
 */
export async function staffEventResponses(
  db: Db,
  userId: string,
  cohortId: string,
  eventId: string,
): Promise<StaffEventResponses | null> {
  await requireStaff(db, userId, cohortId, "events");
  const service = await adminDb();

  const { data: eventRow } = await service
    .from("programme_events")
    .select("id, audience_kind, capacity, cohort_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!eventRow || String((eventRow as Row)["cohort_id"]) !== cohortId) return null;

  const [raw, audiences, rsvpRes] = await Promise.all([
    loadCohortRosterRaw(service, cohortId),
    loadAudiences(service, cohortId),
    service.from("programme_event_rsvps").select("user_id, response").eq("event_id", eventId),
  ]);

  const audience = audienceFor(audiences, "event", eventId, s(eventRow as Row, "audience_kind"));
  const members = rosterMembers(raw);
  const responses = new Map<string, RsvpResponse>();
  for (const r of (rsvpRes.data ?? []) as Row[]) {
    responses.set(String(r["user_id"]), String(r["response"]) as RsvpResponse);
  }
  const breakdown = eventResponseBreakdown(audience, members, responses);

  return {
    eventId,
    eligibleCount: breakdown.eligibleCount,
    capacity: n(eventRow as Row, "capacity"),
    going: breakdown.going,
    maybe: breakdown.maybe,
    notGoing: breakdown.notGoing,
    noResponse: breakdown.noResponse,
  };
}

/**
 * The staff landing page. Events/announcements read through the caller's own
 * session client, not the service role - "Participants read events aimed at
 * them" and "Cohort members read announcements" both already OR in
 * is_cohort_staff(), so RLS covers staff here without a bypass (see the
 * Phase 4.5 audit note on staffStudentRoster/staffStudentProfile for why
 * member_handles/member_travel are the exception, not the rule).
 */
export async function staffOverview(
  db: Db,
  userId: string,
  cohortId: string,
): Promise<{
  onboarding: StaffOnboardingOverview;
  upcomingEvents: StaffOverviewEvent[];
  recentAnnouncements: StaffOverviewAnnouncement[];
}> {
  const [onboarding, { data: events }, { data: announcements }] = await Promise.all([
    staffOnboardingOverview(db, userId, cohortId),
    db
      .from("programme_events")
      .select("id, title, starts_at, location_label")
      .eq("cohort_id", cohortId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(5),
    db
      .from("programme_announcements")
      .select("id, title, published_at, pinned")
      .eq("cohort_id", cohortId)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  return {
    onboarding,
    upcomingEvents: ((events ?? []) as Row[]).map((e) => ({
      id: String(e["id"]),
      title: String(e["title"]),
      startsAt: String(e["starts_at"]),
      locationLabel: s(e, "location_label"),
    })),
    recentAnnouncements: ((announcements ?? []) as Row[]).map((a) => ({
      id: String(a["id"]),
      title: String(a["title"]),
      publishedAt: String(a["published_at"]),
      pinned: Boolean(a["pinned"]),
    })),
  };
}

/**
 * The one bulk action Phase 5 ships with: an in-app nudge, reusing the same
 * inbox every other programme_notifications write already lands in (see
 * notifyAudience above) — no email/push infrastructure exists, so this
 * doesn't pretend to send either. Never trusts the caller's student-id list
 * on its own — re-checks active membership before writing anything.
 */
export async function notifyOnboardingReminder(
  db: Db,
  userId: string,
  cohortId: string,
  studentIds: string[],
): Promise<{ notified: number }> {
  await requireStaff(db, userId, cohortId, "participants");
  if (!studentIds.length) return { notified: 0 };
  const service = await adminDb();

  const { data: members } = await service
    .from("programme_memberships")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .eq("status", "active")
    .in("user_id", studentIds);
  const validIds = ((members ?? []) as Row[]).map((m) => String(m["user_id"]));
  if (!validIds.length) return { notified: 0 };

  const { error } = await service.from("programme_notifications").insert(
    validIds.map((student_user_id) => ({
      user_id: student_user_id,
      cohort_id: cohortId,
      level: "notify",
      title: "Finish your onboarding checklist",
      body: "Your programme team noticed you still have outstanding onboarding items — take a look when you get a chance.",
    })) as never,
  );
  if (error) throw error;
  return { notified: validIds.length };
}

export type SimpleContentInput = {
  kind: "checklist_item" | "document" | "contact" | "place";
  cohortId: string;
  id?: string;
  audience?: Audience;
  values: Row;
};

const CONTENT_TABLE: Record<SimpleContentInput["kind"], { table: string; perm: StaffPermission }> = {
  checklist_item: { table: "programme_checklist_items", perm: "checklists" },
  document: { table: "programme_documents", perm: "documents" },
  contact: { table: "programme_contacts", perm: "contacts" },
  place: { table: "programme_places", perm: "places" },
};

export async function upsertContent(db: Db, userId: string, input: SimpleContentInput) {
  const spec = CONTENT_TABLE[input.kind];
  await requireStaff(db, userId, input.cohortId, spec.perm);
  const audience = input.audience ?? everyone;
  const values: Row = { ...input.values, cohort_id: input.cohortId, audience_kind: audience.kind };

  let id = input.id ?? null;
  if (id) {
    const { error } = await db.from(spec.table).update(values as never).eq("id", id);
    if (error) throw new Error(error.message || "We couldn't save that");
  } else {
    const { data, error } = await db.from(spec.table).insert(values as never).select("id").single();
    if (error) throw new Error(error.message || "We couldn't save that");
    id = String((data as Row)["id"]);
  }
  await writeAudience(db, input.cohortId, input.kind, id, audience);
  return readHub(db, userId);
}

export async function deleteContent(
  db: Db,
  userId: string,
  kind: SimpleContentInput["kind"],
  cohortId: string,
  id: string,
) {
  const spec = CONTENT_TABLE[kind];
  await requireStaff(db, userId, cohortId, spec.perm);
  const { error } = await db.from(spec.table).delete().eq("id", id);
  if (error) throw error;
  await db.from("programme_audiences").delete().eq("subject_type", kind).eq("subject_id", id);
  return readHub(db, userId);
}

/** Drop the editable "Before you fly" defaults into an empty cohort. */
export async function seedDefaultChecklist(db: Db, userId: string, cohortId: string) {
  await requireStaff(db, userId, cohortId, "checklists");
  const { data: existing } = await db.from("programme_checklist_items").select("item_key").eq("cohort_id", cohortId);
  const have = new Set(((existing ?? []) as Row[]).map((r) => String(r["item_key"])));
  const rows = DEFAULT_CHECKLIST.filter((d) => !have.has(d.itemKey)).map((d, i) => ({
    cohort_id: cohortId,
    item_key: d.itemKey,
    title: d.title,
    details: d.details,
    required: d.required,
    action_url: d.actionUrl,
    feature_key: d.featureKey,
    sort_order: have.size + i,
  }));
  if (rows.length) {
    const { error } = await db.from("programme_checklist_items").insert(rows as never);
    if (error) throw new Error(error.message || "We couldn't add the checklist");
  }
  return readHub(db, userId);
}

/* ─────────────────────── Staff: invites for participants ─────────────────── */

export async function cohortInviteDetails(db: Db, userId: string, cohortId: string) {
  await requireStaff(db, userId, cohortId, "participants");
  const service = await adminDb();
  const { data } = await service
    .from("programme_cohorts")
    .select("join_code, name")
    .eq("id", cohortId)
    .maybeSingle();
  if (!data) throw new Error("That cohort no longer exists");
  const code = String((data as Row)["join_code"]);
  return { code, path: `/join/${code}` };
}

/* ─────────────────────────── Internal Shekk admin ────────────────────────── */

function randomCode(prefix: string, length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${prefix}${out}`;
}

export type AdminProgrammeRow = {
  id: string;
  name: string;
  slug: string | null;
  organisation: string | null;
  city: string | null;
  programmeType: string;
  status: string;
  verified: boolean;
  cohorts: {
    id: string;
    name: string;
    year: string | null;
    joinCode: string;
    status: string;
    participants: number;
    events: number;
  }[];
  staff: { userId: string; role: string; email: string | null }[];
  invites: { id: string; code: string; kind: string; role: string; accepted: boolean; expiresAt: string | null }[];
};

export async function adminListProgrammes(): Promise<AdminProgrammeRow[]> {
  const db = await adminDb();
  const [{ data: programmes }, { data: cohorts }, { data: memberships }, { data: events }, { data: staff }, { data: invites }] =
    await Promise.all([
      db.from("programmes").select("*").order("created_at", { ascending: false }),
      db.from("programme_cohorts").select("*"),
      db.from("programme_memberships").select("cohort_id, status"),
      db.from("programme_events").select("cohort_id"),
      db.from("programme_staff").select("*"),
      db.from("programme_invites").select("*").order("created_at", { ascending: false }),
    ]);

  const staffIds = [...new Set(((staff ?? []) as Row[]).map((s2) => String(s2["user_id"])))];
  const emails = new Map<string, string>();
  if (staffIds.length) {
    const { data: profiles } = await db.from("member_profiles").select("user_id, email").in("user_id", staffIds);
    for (const p of (profiles ?? []) as Row[]) {
      if (p["email"]) emails.set(String(p["user_id"]), String(p["email"]));
    }
  }

  const participantCount = new Map<string, number>();
  for (const m of (memberships ?? []) as Row[]) {
    if (String(m["status"]) !== "active") continue;
    const id = String(m["cohort_id"]);
    participantCount.set(id, (participantCount.get(id) ?? 0) + 1);
  }
  const eventCount = new Map<string, number>();
  for (const e of (events ?? []) as Row[]) {
    const id = String(e["cohort_id"]);
    eventCount.set(id, (eventCount.get(id) ?? 0) + 1);
  }

  return ((programmes ?? []) as Row[]).map((p) => {
    const id = String(p["id"]);
    return {
      id,
      name: String(p["name"]),
      slug: s(p, "slug"),
      organisation: s(p, "organisation"),
      city: s(p, "city"),
      programmeType: String(p["programme_type"] ?? "other"),
      status: String(p["status"]),
      verified: Boolean(p["verified_at"]),
      cohorts: ((cohorts ?? []) as Row[])
        .filter((c) => String(c["programme_id"]) === id)
        .map((c) => ({
          id: String(c["id"]),
          name: String(c["name"]),
          year: s(c, "year"),
          joinCode: String(c["join_code"]),
          status: String(c["status"]),
          participants: participantCount.get(String(c["id"])) ?? 0,
          events: eventCount.get(String(c["id"])) ?? 0,
        })),
      staff: ((staff ?? []) as Row[])
        .filter((x) => String(x["programme_id"]) === id)
        .map((x) => ({
          userId: String(x["user_id"]),
          role: String(x["role"]),
          email: emails.get(String(x["user_id"])) ?? null,
        })),
      invites: ((invites ?? []) as Row[])
        .filter((x) => String(x["programme_id"]) === id)
        .map((x) => ({
          id: String(x["id"]),
          code: String(x["code"]),
          kind: String(x["kind"]),
          role: String(x["role"]),
          accepted: Boolean(x["accepted_at"]),
          expiresAt: s(x, "expires_at"),
        })),
    };
  });
}

export async function adminCreateProgramme(input: {
  name: string;
  organisation?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  description?: string | null;
  programmeType?: string;
  slug?: string | null;
}) {
  const db = await adminDb();
  const { data, error } = await db
    .from("programmes")
    .insert({
      name: input.name,
      organisation: input.organisation ?? null,
      city: input.city ?? null,
      country: input.country ?? null,
      website: input.website ?? null,
      description: input.description ?? null,
      programme_type: input.programmeType ?? "other",
      slug: input.slug ?? null,
      status: "active",
      is_demo: false,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message || "We couldn't create that programme");
  return { id: String((data as Row)["id"]) };
}

export async function adminCreateCohort(input: {
  programmeId: string;
  name: string;
  year?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  welcomeMessage?: string | null;
  joinCode?: string | null;
}) {
  const db = await adminDb();
  const code = (input.joinCode ?? randomCode("")).toUpperCase();
  const { data, error } = await db
    .from("programme_cohorts")
    .insert({
      programme_id: input.programmeId,
      name: input.name,
      year: input.year ?? null,
      starts_on: input.startsOn ?? null,
      ends_on: input.endsOn ?? null,
      welcome_message: input.welcomeMessage ?? null,
      join_code: code,
      status: "open",
      is_demo: false,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message || "We couldn't create that cohort");
  return { id: String((data as Row)["id"]), joinCode: code };
}

export async function adminAssignOwnerByEmail(programmeId: string, email: string, role: StaffRole = "owner") {
  const db = await adminDb();
  const { data } = await db
    .from("member_profiles")
    .select("user_id")
    .ilike("email", email.trim())
    .maybeSingle();
  if (!data) {
    throw new Error("No Shekk account with that email yet — send a claim invite instead");
  }
  const userId = String((data as Row)["user_id"]);
  const { error } = await db
    .from("programme_staff")
    .upsert({ programme_id: programmeId, user_id: userId, role, permissions: [] } as never, {
      onConflict: "programme_id,user_id",
    });
  if (error) throw new Error(error.message || "We couldn't assign that owner");
  return { userId };
}

export async function adminCreateInvite(input: {
  programmeId: string;
  cohortId?: string | null;
  role?: StaffRole;
  email?: string | null;
  note?: string | null;
  createdBy: string;
}) {
  const db = await adminDb();
  const code = randomCode("CLAIM-", 8);
  const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const { error } = await db.from("programme_invites").insert({
    programme_id: input.programmeId,
    cohort_id: input.cohortId ?? null,
    kind: "claim",
    role: input.role ?? "owner",
    code,
    email: input.email ?? null,
    note: input.note ?? null,
    expires_at: expires,
    created_by: input.createdBy,
  } as never);
  if (error) throw new Error(error.message || "We couldn't create that invite");
  return { code, path: `/join/${code}`, expiresAt: expires };
}

export async function adminSetProgrammeFlags(input: {
  programmeId: string;
  verified?: boolean;
  active?: boolean;
  adminUserId: string;
}) {
  const db = await adminDb();
  const patch: Row = {};
  if (input.verified !== undefined) {
    patch["verified_at"] = input.verified ? new Date().toISOString() : null;
    patch["verified_by"] = input.verified ? input.adminUserId : null;
  }
  if (input.active !== undefined) patch["status"] = input.active ? "active" : "inactive";
  const { error } = await db.from("programmes").update(patch as never).eq("id", input.programmeId);
  if (error) throw new Error(error.message || "We couldn't update that programme");
  return { ok: true };
}

/* ─────────────── Internal Shekk admin: editing and deep inspection ────────── */

export async function adminUpdateProgramme(input: {
  programmeId: string;
  name?: string;
  organisation?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  description?: string | null;
  programmeType?: string;
  slug?: string | null;
  status?: string;
}) {
  const db = await adminDb();
  const patch: Row = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch["name"] = input.name;
  if (input.organisation !== undefined) patch["organisation"] = input.organisation;
  if (input.city !== undefined) patch["city"] = input.city;
  if (input.country !== undefined) patch["country"] = input.country;
  if (input.website !== undefined) patch["website"] = input.website;
  if (input.description !== undefined) patch["description"] = input.description;
  if (input.programmeType !== undefined) patch["programme_type"] = input.programmeType;
  if (input.slug !== undefined) patch["slug"] = input.slug;
  if (input.status !== undefined) patch["status"] = input.status;
  const { error } = await db.from("programmes").update(patch as never).eq("id", input.programmeId);
  if (error) throw new Error(error.message || "We couldn't update that programme");
  return { ok: true };
}

export async function adminUpdateCohort(input: {
  cohortId: string;
  name?: string;
  year?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  welcomeMessage?: string | null;
  status?: string;
  joinCode?: string | null;
  regenerateJoinCode?: boolean;
}) {
  const db = await adminDb();
  const patch: Row = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch["name"] = input.name;
  if (input.year !== undefined) patch["year"] = input.year;
  if (input.startsOn !== undefined) patch["starts_on"] = input.startsOn;
  if (input.endsOn !== undefined) patch["ends_on"] = input.endsOn;
  if (input.welcomeMessage !== undefined) patch["welcome_message"] = input.welcomeMessage;
  if (input.status !== undefined) patch["status"] = input.status;
  if (input.regenerateJoinCode) patch["join_code"] = randomCode("", 6);
  else if (input.joinCode) patch["join_code"] = input.joinCode.trim().toUpperCase();

  if (patch["join_code"]) {
    const { data: clash } = await db
      .from("programme_cohorts")
      .select("id")
      .ilike("join_code", String(patch["join_code"]))
      .neq("id", input.cohortId)
      .maybeSingle();
    if (clash) throw new Error("That join code is already in use");
  }

  const { error } = await db.from("programme_cohorts").update(patch as never).eq("id", input.cohortId);
  if (error) throw new Error(error.message || "We couldn't update that cohort");
  return { ok: true, joinCode: (patch["join_code"] as string | undefined) ?? null };
}

export async function adminRemoveStaff(programmeId: string, userId: string) {
  const db = await adminDb();
  const { error } = await db
    .from("programme_staff")
    .delete()
    .eq("programme_id", programmeId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message || "We couldn't remove that staff member");
  return { ok: true };
}

export async function adminSetStaffRole(programmeId: string, userId: string, role: StaffRole) {
  const db = await adminDb();
  const { error } = await db
    .from("programme_staff")
    .update({ role, updated_at: new Date().toISOString() } as never)
    .eq("programme_id", programmeId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message || "We couldn't change that role");
  return { ok: true };
}

export async function adminRevokeInvite(inviteId: string) {
  const db = await adminDb();
  const { error } = await db.from("programme_invites").delete().eq("id", inviteId).is("accepted_at", null);
  if (error) throw new Error(error.message || "We couldn't revoke that invite");
  return { ok: true };
}

export type AdminCohortDetail = {
  cohort: {
    id: string;
    programmeId: string;
    programmeName: string;
    name: string;
    year: string | null;
    startsOn: string | null;
    endsOn: string | null;
    welcomeMessage: string | null;
    joinCode: string;
    status: string;
  };
  participants: Participant[];
  groups: { id: string; name: string; members: number }[];
  content: {
    events: { id: string; title: string; startsAt: string; status: string; audienceKind: string }[];
    announcements: { id: string; title: string; priority: string; createdAt: string }[];
    votes: { id: string; question: string; status: string; responses: number }[];
    checklist: { id: string; title: string; category: string | null }[];
    documents: { id: string; title: string; category: string | null }[];
    contacts: { id: string; name: string; role: string | null }[];
    places: { id: string; name: string; category: string | null }[];
  };
};

/** Everything the internal console shows for one cohort. Admin-role only. */
export async function adminCohortDetail(cohortId: string): Promise<AdminCohortDetail> {
  const db = await adminDb();
  const { data: cohortRow } = await db.from("programme_cohorts").select("*").eq("id", cohortId).maybeSingle();
  if (!cohortRow) throw new Error("That cohort no longer exists");
  const cohort = cohortRow as Row;

  const [
    { data: programme },
    { data: events },
    { data: announcements },
    { data: votes },
    { data: voteResponses },
    { data: checklist },
    { data: documents },
    { data: contacts },
    { data: places },
    { data: groups },
    { data: groupMembers },
  ] = await Promise.all([
    db.from("programmes").select("id, name").eq("id", String(cohort["programme_id"])).maybeSingle(),
    db
      .from("programme_events")
      .select("id, title, starts_at, status, audience_kind")
      .eq("cohort_id", cohortId)
      .order("starts_at", { ascending: true }),
    db
      .from("programme_announcements")
      .select("id, title, priority, created_at")
      .eq("cohort_id", cohortId)
      .order("created_at", { ascending: false }),
    db.from("programme_votes").select("id, question, status").eq("cohort_id", cohortId),
    db.from("programme_vote_responses").select("vote_id"),
    db.from("programme_checklist_items").select("id, title, category").eq("cohort_id", cohortId),
    db.from("programme_documents").select("id, label, category").eq("cohort_id", cohortId),
    db.from("programme_contacts").select("id, name, role").eq("cohort_id", cohortId),
    db.from("programme_places").select("id, label, category").eq("cohort_id", cohortId),
    db.from("programme_groups").select("id, name").eq("cohort_id", cohortId),
    db.from("programme_group_members").select("group_id"),
  ]);

  const voteIds = new Set(((votes ?? []) as Row[]).map((v) => String(v["id"])));
  const responseCount = new Map<string, number>();
  for (const r of (voteResponses ?? []) as Row[]) {
    const id = String(r["vote_id"]);
    if (!voteIds.has(id)) continue;
    responseCount.set(id, (responseCount.get(id) ?? 0) + 1);
  }
  const groupRows = (groups ?? []) as Row[];
  const groupIds = new Set(groupRows.map((g) => String(g["id"])));
  const memberCount = new Map<string, number>();
  for (const m of (groupMembers ?? []) as Row[]) {
    const id = String(m["group_id"]);
    if (!groupIds.has(id)) continue;
    memberCount.set(id, (memberCount.get(id) ?? 0) + 1);
  }

  return {
    cohort: {
      id: cohortId,
      programmeId: String(cohort["programme_id"]),
      programmeName: programme ? String((programme as Row)["name"]) : "Programme",
      name: String(cohort["name"]),
      year: s(cohort, "year"),
      startsOn: s(cohort, "starts_on"),
      endsOn: s(cohort, "ends_on"),
      welcomeMessage: s(cohort, "welcome_message"),
      joinCode: String(cohort["join_code"]),
      status: String(cohort["status"]),
    },
    participants: await rosterForCohort(cohortId),
    groups: groupRows.map((g) => ({
      id: String(g["id"]),
      name: String(g["name"]),
      members: memberCount.get(String(g["id"])) ?? 0,
    })),
    content: {
      events: ((events ?? []) as Row[]).map((e) => ({
        id: String(e["id"]),
        title: String(e["title"]),
        startsAt: String(e["starts_at"]),
        status: String(e["status"]),
        audienceKind: String(e["audience_kind"] ?? "everyone"),
      })),
      announcements: ((announcements ?? []) as Row[]).map((a) => ({
        id: String(a["id"]),
        title: String(a["title"]),
        priority: String(a["priority"] ?? "normal"),
        createdAt: String(a["created_at"]),
      })),
      votes: ((votes ?? []) as Row[]).map((v) => ({
        id: String(v["id"]),
        question: String(v["question"]),
        status: String(v["status"]),
        responses: responseCount.get(String(v["id"])) ?? 0,
      })),
      checklist: ((checklist ?? []) as Row[]).map((c) => ({
        id: String(c["id"]),
        title: String(c["title"]),
        category: s(c, "category"),
      })),
      documents: ((documents ?? []) as Row[]).map((d) => ({
        id: String(d["id"]),
        title: String(d["label"]),
        category: s(d, "category"),
      })),
      contacts: ((contacts ?? []) as Row[]).map((c) => ({
        id: String(c["id"]),
        name: String(c["name"]),
        role: s(c, "role"),
      })),
      places: ((places ?? []) as Row[]).map((p) => ({
        id: String(p["id"]),
        name: String(p["label"]),
        category: s(p, "category"),
      })),
    },
  };
}
