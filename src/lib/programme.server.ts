/**
 * Programme platform — server only.
 *
 * A programme's content belongs to the people on it. Nothing here is readable
 * until a member has joined a cohort with a valid code, and the join itself is
 * decided by a checked database routine rather than by the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, any, any>;
type Row = Record<string, unknown>;

const s = (row: Row, key: string) => (row[key] == null ? null : String(row[key]));

export type TravelStyle = "programme" | "independent" | "unknown";

export type MemberTravel = {
  travelStyle: TravelStyle;
  arrivalDate: string | null;
  departureDate: string | null;
  fundingCurrency: string | null;
  israelCity: string | null;
  accommodationArea: string | null;
  homeCountry: string | null;
  displayName: string | null;
  onboardingStep: string | null;
  onboardingCompletedAt: string | null;
  /** What the member told us Shekk should help with — orders their home screen. */
  interests: string[];
};

export const emptyTravel: MemberTravel = {
  travelStyle: "unknown",
  arrivalDate: null,
  departureDate: null,
  fundingCurrency: null,
  israelCity: null,
  accommodationArea: null,
  homeCountry: null,
  displayName: null,
  onboardingStep: null,
  onboardingCompletedAt: null,
  interests: [],
};

export type ProgrammeAnnouncement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: string;
};

export type ProgrammeContact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  isEmergency: boolean;
};

export type ProgrammeDocument = {
  id: string;
  label: string;
  description: string | null;
  linkUrl: string | null;
  category: string;
};

export type ProgrammeScheduleItem = {
  id: string;
  title: string;
  details: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
};

export type ProgrammeChecklistItem = {
  id: string;
  itemKey: string;
  title: string;
  details: string | null;
  dueOn: string | null;
  done: boolean;
};

export type ProgrammeState = {
  joined: boolean;
  isDemo: boolean;
  programmeName: string | null;
  organisation: string | null;
  cohortName: string | null;
  city: string | null;
  welcomeMessage: string | null;
  startsOn: string | null;
  endsOn: string | null;
  joinedAt: string | null;
  announcements: ProgrammeAnnouncement[];
  contacts: ProgrammeContact[];
  documents: ProgrammeDocument[];
  schedule: ProgrammeScheduleItem[];
  checklist: ProgrammeChecklistItem[];
};

export const notJoined: ProgrammeState = {
  joined: false,
  isDemo: false,
  programmeName: null,
  organisation: null,
  cohortName: null,
  city: null,
  welcomeMessage: null,
  startsOn: null,
  endsOn: null,
  joinedAt: null,
  announcements: [],
  contacts: [],
  documents: [],
  schedule: [],
  checklist: [],
};

/* ─────────────────────────────── Travel ──────────────────────────────── */

export async function readTravel(db: Db, userId: string): Promise<MemberTravel> {
  const { data, error } = await db
    .from("member_travel")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return emptyTravel;
  const row = data as Row;
  const style = String(row["travel_style"] ?? "unknown");
  return {
    travelStyle: style === "programme" || style === "independent" ? style : "unknown",
    arrivalDate: s(row, "arrival_date"),
    departureDate: s(row, "departure_date"),
    fundingCurrency: s(row, "funding_currency"),
    israelCity: s(row, "israel_city"),
    accommodationArea: s(row, "accommodation_area"),
    homeCountry: s(row, "home_country"),
    displayName: s(row, "display_name"),
    onboardingStep: s(row, "onboarding_step"),
    onboardingCompletedAt: s(row, "onboarding_completed_at"),
    interests: Array.isArray(row["interests"]) ? (row["interests"] as string[]).map(String) : [],
  };
}

export type TravelPatch = Partial<{
  travelStyle: TravelStyle;
  arrivalDate: string | null;
  departureDate: string | null;
  fundingCurrency: string | null;
  israelCity: string | null;
  accommodationArea: string | null;
  homeCountry: string | null;
  displayName: string | null;
  onboardingStep: string | null;
  onboardingComplete: boolean;
  interests: string[];
}>;

export async function saveTravel(db: Db, userId: string, patch: TravelPatch): Promise<MemberTravel> {
  const payload: Row = { user_id: userId };
  if (patch.travelStyle !== undefined) payload["travel_style"] = patch.travelStyle;
  if (patch.arrivalDate !== undefined) payload["arrival_date"] = patch.arrivalDate || null;
  if (patch.departureDate !== undefined) payload["departure_date"] = patch.departureDate || null;
  if (patch.fundingCurrency !== undefined) payload["funding_currency"] = patch.fundingCurrency || null;
  if (patch.israelCity !== undefined) payload["israel_city"] = patch.israelCity || null;
  if (patch.accommodationArea !== undefined) payload["accommodation_area"] = patch.accommodationArea || null;
  if (patch.homeCountry !== undefined) payload["home_country"] = patch.homeCountry || null;
  if (patch.displayName !== undefined) payload["display_name"] = patch.displayName || null;
  if (patch.onboardingStep !== undefined) payload["onboarding_step"] = patch.onboardingStep || null;
  if (patch.interests !== undefined) payload["interests"] = patch.interests;
  if (patch.onboardingComplete !== undefined) {
    payload["onboarding_completed_at"] = patch.onboardingComplete ? new Date().toISOString() : null;
  }

  const { error } = await db.from("member_travel").upsert(payload as never, { onConflict: "user_id" });
  if (error) throw error;
  return readTravel(db, userId);
}

/* ────────────────────────────── Programme ────────────────────────────── */

export async function readProgramme(db: Db, userId: string): Promise<ProgrammeState> {
  const { data: membership, error: mErr } = await db
    .from("programme_memberships")
    .select("cohort_id, joined_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership) return notJoined;

  const cohortId = String((membership as Row)["cohort_id"]);

  const [cohortRes, annRes, conRes, docRes, schRes, chkRes, progRes] = await Promise.all([
    db
      .from("programme_cohorts")
      .select("id, name, welcome_message, starts_on, ends_on, is_demo, programme_id")
      .eq("id", cohortId)
      .maybeSingle(),
    db
      .from("programme_announcements")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false }),
    db.from("programme_contacts").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_documents").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db
      .from("programme_schedule_items")
      .select("*")
      .eq("cohort_id", cohortId)
      .order("starts_at", { ascending: true }),
    db.from("programme_checklist_items").select("*").eq("cohort_id", cohortId).order("sort_order"),
    db.from("programme_checklist_progress").select("item_id, done").eq("user_id", userId),
  ]);

  const cohort = (cohortRes.data ?? null) as Row | null;
  if (!cohort) return notJoined;

  let programmeName: string | null = null;
  let organisation: string | null = null;
  let city: string | null = null;
  const programmeId = s(cohort, "programme_id");
  if (programmeId) {
    const { data: programme } = await db
      .from("programmes")
      .select("name, organisation, city")
      .eq("id", programmeId)
      .maybeSingle();
    if (programme) {
      const p = programme as Row;
      programmeName = s(p, "name");
      organisation = s(p, "organisation");
      city = s(p, "city");
    }
  }

  const doneIds = new Set(
    ((progRes.data ?? []) as Row[]).filter((r) => Boolean(r["done"])).map((r) => String(r["item_id"])),
  );

  return {
    joined: true,
    isDemo: Boolean(cohort["is_demo"]),
    programmeName,
    organisation,
    cohortName: s(cohort, "name"),
    city,
    welcomeMessage: s(cohort, "welcome_message"),
    startsOn: s(cohort, "starts_on"),
    endsOn: s(cohort, "ends_on"),
    joinedAt: s(membership as Row, "joined_at"),
    announcements: ((annRes.data ?? []) as Row[]).map((r) => ({
      id: String(r["id"]),
      title: String(r["title"]),
      body: String(r["body"]),
      pinned: Boolean(r["pinned"]),
      publishedAt: String(r["published_at"]),
    })),
    contacts: ((conRes.data ?? []) as Row[]).map((r) => ({
      id: String(r["id"]),
      name: String(r["name"]),
      role: s(r, "role"),
      phone: s(r, "phone"),
      email: s(r, "email"),
      isEmergency: Boolean(r["is_emergency"]),
    })),
    documents: ((docRes.data ?? []) as Row[]).map((r) => ({
      id: String(r["id"]),
      label: String(r["label"]),
      description: s(r, "description"),
      linkUrl: s(r, "link_url"),
      category: String(r["category"] ?? "other"),
    })),
    schedule: ((schRes.data ?? []) as Row[]).map((r) => ({
      id: String(r["id"]),
      title: String(r["title"]),
      details: s(r, "details"),
      location: s(r, "location"),
      startsAt: String(r["starts_at"]),
      endsAt: s(r, "ends_at"),
    })),
    checklist: ((chkRes.data ?? []) as Row[]).map((r) => ({
      id: String(r["id"]),
      itemKey: String(r["item_key"]),
      title: String(r["title"]),
      details: s(r, "details"),
      dueOn: s(r, "due_on"),
      done: doneIds.has(String(r["id"])),
    })),
  };
}

export type CodePreview = {
  programmeName: string;
  cohortName: string;
  organisation: string | null;
  city: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isDemo: boolean;
};

/** Safe, pre-join peek: only enough to confirm you typed the right code. */
export async function previewCode(db: Db, code: string): Promise<CodePreview | null> {
  const { data, error } = await db.rpc("programme_code_preview" as never, { _code: code } as never);
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row) return null;
  return {
    programmeName: String(row["programme_name"]),
    cohortName: String(row["cohort_name"]),
    organisation: s(row, "organisation"),
    city: s(row, "city"),
    startsOn: s(row, "starts_on"),
    endsOn: s(row, "ends_on"),
    isDemo: Boolean(row["is_demo"]),
  };
}

/** Joining is a privileged routine — the code, not the client, decides. */
export async function joinWithCode(userDb: Db, userId: string, code: string): Promise<ProgrammeState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as unknown as Db).rpc("programme_join" as never, {
    _user_id: userId,
    _code: code,
  } as never);
  if (error) throw new Error(error.message || "That programme code was not recognised");
  return readProgramme(userDb, userId);
}

/**
 * Members cannot write their own membership row through the API (that is what
 * let a student rewrite their cohort), so leaving is a server action: the
 * caller is the verified user from the auth middleware, and the update can only
 * ever touch that user's own active membership.
 */
export async function leaveProgramme(db: Db, userId: string): Promise<ProgrammeState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as unknown as Db)
    .from("programme_memberships")
    .update({ status: "left" } as never)
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return readProgramme(db, userId);
}

export async function setChecklistDone(
  db: Db,
  userId: string,
  itemId: string,
  done: boolean,
): Promise<ProgrammeState> {
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
  return readProgramme(db, userId);
}
