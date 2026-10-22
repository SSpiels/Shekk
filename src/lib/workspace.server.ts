/**
 * Remembering which experience a member last used. Server only.
 *
 * Members can read their own row (row-level security) but cannot write it: every
 * write comes through here, with the service client, AFTER checking the member
 * really has staff access to the programme they are switching to. A saved
 * preference is therefore never a claim the browser can forge — and it is a hint
 * only. Whether someone may enter a workspace is always decided by programme_staff.
 */

import {
  defaultWorkspacePrefs,
  preferenceIsStale,
  type SwitchInput,
  type WorkspacePrefs,
  type WorkspaceRef,
} from "./workspace";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = { from: (t: string) => any };

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

type PrefsRow = { last_experience?: string; last_programme_id?: string | null; staff_intent?: boolean };

export function prefsFromRow(row: PrefsRow | null | undefined): WorkspacePrefs {
  if (!row) return defaultWorkspacePrefs;
  return {
    lastExperience: row.last_experience === "staff" ? "staff" : "personal",
    lastProgrammeId: row.last_programme_id ? String(row.last_programme_id) : null,
    staffIntent: Boolean(row.staff_intent),
  };
}

/** The member's saved preferences, read with whichever client the caller has (their own is enough). */
export async function readWorkspacePrefs(db: Db, userId: string): Promise<WorkspacePrefs> {
  const { data } = await db
    .from("member_workspace_prefs")
    .select("last_experience, last_programme_id, staff_intent")
    .eq("user_id", userId)
    .maybeSingle();
  return prefsFromRow(data as PrefsRow | null);
}

/**
 * Remember a switch. A move to a workspace is refused unless the member is staff
 * on that programme. A move to the personal side keeps the last workspace on file,
 * so "Open workspace" still lands in the right one.
 */
export async function saveWorkspaceSwitch(userId: string, input: SwitchInput): Promise<WorkspacePrefs> {
  const service = await adminDb();

  if (input.experience === "staff") {
    const { data } = await service
      .from("programme_staff")
      .select("programme_id")
      .eq("user_id", userId)
      .eq("programme_id", input.programmeId)
      .maybeSingle();
    if (!data) throw new Error("You don't have access to that workspace.");
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    last_experience: input.experience,
    updated_at: new Date().toISOString(),
    ...(input.experience === "staff" ? { last_programme_id: input.programmeId } : {}),
  };
  const { error } = await service.from("member_workspace_prefs").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error("We couldn't remember that just now.");
  return readWorkspacePrefs(service, userId);
}

/** "I work for a programme", said at sign-up. Shows the invite-code entry; grants nothing. */
export async function saveStaffIntent(userId: string, intent: boolean): Promise<WorkspacePrefs> {
  const service = await adminDb();
  const { error } = await service
    .from("member_workspace_prefs")
    .upsert({ user_id: userId, staff_intent: intent, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error("We couldn't save that just now.");
  return readWorkspacePrefs(service, userId);
}

/**
 * If the member last used a workspace but has no staff access left (they were
 * removed), put them back on the personal side for good. Best effort — a failure
 * here never blocks anything; the landing decision already falls back safely.
 */
export async function healStalePrefs(
  userId: string,
  prefs: WorkspacePrefs,
  workspaces: readonly WorkspaceRef[],
): Promise<WorkspacePrefs> {
  if (!preferenceIsStale(prefs, workspaces)) return prefs;
  try {
    const service = await adminDb();
    await service
      .from("member_workspace_prefs")
      .upsert({ user_id: userId, last_experience: "personal", last_programme_id: null }, { onConflict: "user_id" });
  } catch (e) {
    console.error("[workspace] could not clear a stale workspace preference:", e);
  }
  return { ...prefs, lastExperience: "personal", lastProgrammeId: null };
}
