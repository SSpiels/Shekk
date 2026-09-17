/**
 * Shekk social layer — server-only implementation.
 *
 * Handles, friends, chat, splits, programs and member-to-member money.
 * Everything here runs with the service role, so every single read and write
 * is scoped by hand to the member id taken from the verified token. The client
 * can ask; it can never assert who it is or how much it has.
 *
 * Money between members moves through one place only: the `transfer_post`
 * database routine, which debits and credits inside a single transaction.
 */

import { toAgorot, toShekels } from "./ledger.server";

/* ------------------------------------------------------------------ types --- */

export type MemberCard = {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  program: string | null;
  cohort: string | null;
};

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  blocked_by: string | null;
  created_at: string;
};

export type FriendsView = {
  me: MemberCard;
  friends: MemberCard[];
  incoming: Array<{ id: string; from: MemberCard; createdAt: string }>;
  outgoing: Array<{ id: string; to: MemberCard; createdAt: string }>;
  suggestions: MemberCard[];
  blocked: MemberCard[];
};

export type ConversationSummary = {
  id: string;
  kind: "dm" | "cohort" | "group";
  title: string;
  subtitle: string | null;
  avatarName: string;
  memberCount: number;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  otherUserId: string | null;
};

/** Only the small, JSON-safe extras a message can carry. */
export type MessageMeta = {
  amount?: number;
  toUserId?: string;
  entryId?: string | null;
  billId?: string;
  total?: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string;
  kind: "text" | "payment" | "request" | "system";
  body: string;
  meta: MessageMeta;
  createdAt: string;
  mine: boolean;
};

export type SplitShareView = {
  id: string;
  billId: string;
  member: MemberCard | null;
  amount: number;
  status: "pending" | "paid" | "declined";
  paidAt: string | null;
};

export type SplitBillView = {
  id: string;
  creator: MemberCard | null;
  mine: boolean;
  total: number;
  note: string;
  mode: string;
  status: "open" | "settled" | "cancelled";
  createdAt: string;
  shares: SplitShareView[];
  myShare: SplitShareView | null;
};

/* ----------------------------------------------------------------- client --- */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function fail(error: { message: string } | null, fallback: string): void {
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("insufficient balance")) throw new Error("Not enough money in your account");
  if (msg.includes("daily sending limit")) throw new Error("You have hit today's sending limit");
  if (msg.includes("cannot send to yourself")) throw new Error("That is your own account");
  if (msg.includes("cannot send to this member")) throw new Error("You cannot send money to this member");
  if (msg.includes("account is frozen")) throw new Error("This account is frozen");
  if (msg.includes("account is closed")) throw new Error("This account is closed");
  console.error(`[social] ${fallback}:`, msg);
  throw new Error(fallback);
}

/* ---------------------------------------------------------------- handles --- */

const RESERVED = new Set(["shekk", "admin", "support", "help", "root", "me", "system", "official"]);

export function normaliseHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

function seedHandle(source: string): string {
  const base = normaliseHandle(source.split("@")[0] ?? "");
  const padded = base.length >= 3 ? base : `shekk_${base}`;
  return padded.slice(0, 14);
}

/** Get the member's handle row, creating a sensible one the first time. */
export async function ensureHandle(userId: string): Promise<MemberCard> {
  const db = await admin();
  const existing = await db.from("member_handles").select("*").eq("user_id", userId).maybeSingle();
  if (existing.data) return decorateOne(userId, existing.data as HandleRow);

  const { data: profile } = await db
    .from("member_profiles")
    .select("legal_first_name, legal_last_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  const first = (profile?.legal_first_name ?? "").trim();
  const last = (profile?.legal_last_name ?? "").trim();
  const displayName = [first, last].filter(Boolean).join(" ") || "Shekk member";
  const seed = seedHandle(first || profile?.email || "member");

  for (let attempt = 0; attempt < 8; attempt++) {
    const handle = attempt === 0 ? seed : `${seed}${Math.floor(100 + Math.random() * 900)}`;
    if (RESERVED.has(handle)) continue;
    const { data, error } = await db
      .from("member_handles")
      .insert({ user_id: userId, handle, display_name: displayName })
      .select("*")
      .maybeSingle();
    if (!error && data) return decorateOne(userId, data as HandleRow);
  }
  throw new Error("Could not set up your Shekk handle");
}

type HandleRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  discoverable: boolean;
};

export async function updateHandle(
  userId: string,
  input: { handle?: string; displayName?: string; discoverable?: boolean; avatarUrl?: string | null },
): Promise<MemberCard> {
  const db = await admin();
  await ensureHandle(userId);

  const patch: {
    updated_at: string;
    handle?: string;
    display_name?: string;
    discoverable?: boolean;
    avatar_url?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (input.handle != null) {
    const handle = normaliseHandle(input.handle);
    if (handle.length < 3) throw new Error("Handles need at least 3 letters or numbers");
    if (RESERVED.has(handle)) throw new Error("That handle is reserved");
    const taken = await db
      .from("member_handles")
      .select("user_id")
      .ilike("handle", handle)
      .neq("user_id", userId)
      .maybeSingle();
    if (taken.data) throw new Error("That handle is already taken");
    patch.handle = handle;
  }
  if (input.displayName != null) patch.display_name = input.displayName.trim().slice(0, 60);
  if (input.discoverable != null) patch.discoverable = input.discoverable;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  const { data, error } = await db
    .from("member_handles")
    .update(patch)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error || !data) fail(error, "Could not save your handle");
  return decorateOne(userId, data as HandleRow);
}

export async function isHandleFree(userId: string, raw: string): Promise<boolean> {
  const handle = normaliseHandle(raw);
  if (handle.length < 3 || RESERVED.has(handle)) return false;
  const db = await admin();
  const { data } = await db
    .from("member_handles")
    .select("user_id")
    .ilike("handle", handle)
    .neq("user_id", userId)
    .maybeSingle();
  return !data;
}

/* ------------------------------------------------------- member decoration --- */

type Membership = { program: string | null; cohort: string | null; cohortId: string | null };

async function membershipsFor(userIds: string[]): Promise<Map<string, Membership>> {
  const out = new Map<string, Membership>();
  if (userIds.length === 0) return out;
  const db = await admin();
  const { data } = await db
    .from("cohort_members")
    .select("user_id, cohort_id, cohorts(name, programs(name))")
    .in("user_id", userIds);
  for (const row of (data ?? []) as Array<{
    user_id: string;
    cohort_id: string;
    cohorts: { name: string; programs: { name: string } | null } | null;
  }>) {
    if (out.has(row.user_id)) continue;
    out.set(row.user_id, {
      program: row.cohorts?.programs?.name ?? null,
      cohort: row.cohorts?.name ?? null,
      cohortId: row.cohort_id,
    });
  }
  return out;
}

async function decorate(rows: HandleRow[]): Promise<MemberCard[]> {
  const memberships = await membershipsFor(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    userId: r.user_id,
    handle: r.handle,
    displayName: r.display_name || `@${r.handle}`,
    avatarUrl: r.avatar_url,
    program: memberships.get(r.user_id)?.program ?? null,
    cohort: memberships.get(r.user_id)?.cohort ?? null,
  }));
}

async function decorateOne(userId: string, row: HandleRow): Promise<MemberCard> {
  const [card] = await decorate([row]);
  return card ?? {
    userId,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    program: null,
    cohort: null,
  };
}

/** Cards for a set of ids, whether or not they have claimed a handle. */
export async function cardsFor(userIds: string[]): Promise<Map<string, MemberCard>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, MemberCard>();
  if (ids.length === 0) return map;
  const db = await admin();
  const { data } = await db.from("member_handles").select("*").in("user_id", ids);
  const cards = await decorate((data ?? []) as HandleRow[]);
  for (const c of cards) map.set(c.userId, c);
  for (const id of ids) {
    if (!map.has(id)) {
      map.set(id, { userId: id, handle: "member", displayName: "Shekk member", avatarUrl: null, program: null, cohort: null });
    }
  }
  return map;
}

/* ----------------------------------------------------------------- search --- */

export async function searchMembers(userId: string, rawQuery: string): Promise<MemberCard[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const db = await admin();
  await ensureHandle(userId);

  const found = new Map<string, HandleRow>();

  const handleQuery = normaliseHandle(q);
  if (handleQuery.length >= 2) {
    const { data } = await db
      .from("member_handles")
      .select("*")
      .eq("discoverable", true)
      .ilike("handle", `${handleQuery}%`)
      .neq("user_id", userId)
      .limit(20);
    for (const row of (data ?? []) as HandleRow[]) found.set(row.user_id, row);
  }

  // Exact contact lookup — never a prefix, so nobody can crawl the directory.
  const looksLikeEmail = q.includes("@") && q.includes(".");
  const digits = q.replace(/[^0-9]/g, "");
  if (looksLikeEmail || digits.length >= 7) {
    const contacts = looksLikeEmail
      ? await db.from("member_profiles").select("user_id").ilike("email", q).limit(3)
      : await db.from("member_profiles").select("user_id").ilike("phone_number", `%${digits.slice(-9)}`).limit(3);
    const ids = ((contacts.data ?? []) as Array<{ user_id: string }>)
      .map((r) => r.user_id)
      .filter((id) => id !== userId);
    if (ids.length) {
      const { data } = await db
        .from("member_handles")
        .select("*")
        .in("user_id", ids)
        .eq("discoverable", true);
      for (const row of (data ?? []) as HandleRow[]) found.set(row.user_id, row);
    }
  }

  const blockedIds = await blockedSet(userId);
  const rows = [...found.values()].filter((r) => !blockedIds.has(r.user_id));
  return decorate(rows);
}

/** Resolve a scanned pay code (`shekk:u/<handle>` or a bare handle). */
export async function resolveHandle(userId: string, raw: string): Promise<MemberCard | null> {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/[^/]+\/(?:u|pay)\//i, "")
    .replace(/^shekk:(?:\/\/)?(?:u\/|pay\/)?/i, "")
    .split(/[?#]/)[0];
  const handle = normaliseHandle(cleaned);
  if (handle.length < 3) return null;
  const db = await admin();
  const { data } = await db.from("member_handles").select("*").ilike("handle", handle).maybeSingle();
  if (!data) return null;
  const row = data as HandleRow;
  if (row.user_id === userId) return null;
  if ((await blockedSet(userId)).has(row.user_id)) return null;
  return decorateOne(row.user_id, row);
}

/* ---------------------------------------------------------------- friends --- */

async function blockedSet(userId: string): Promise<Set<string>> {
  const db = await admin();
  const { data } = await db
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .eq("status", "blocked")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  const out = new Set<string>();
  for (const row of (data ?? []) as FriendshipRow[]) {
    out.add(row.requester_id === userId ? row.addressee_id : row.requester_id);
  }
  return out;
}

async function myFriendships(userId: string): Promise<FriendshipRow[]> {
  const db = await admin();
  const { data } = await db
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as FriendshipRow[];
}

export async function friendIds(userId: string): Promise<string[]> {
  const rows = await myFriendships(userId);
  return rows
    .filter((r) => r.status === "accepted")
    .map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
}

export async function listFriends(userId: string): Promise<FriendsView> {
  const db = await admin();
  const me = await ensureHandle(userId);
  const rows = await myFriendships(userId);

  const ids = new Set<string>();
  for (const r of rows) ids.add(r.requester_id === userId ? r.addressee_id : r.requester_id);

  // Cohort mates who are not yet connected.
  const myCohorts = await db.from("cohort_members").select("cohort_id").eq("user_id", userId);
  const cohortIds = ((myCohorts.data ?? []) as Array<{ cohort_id: string }>).map((r) => r.cohort_id);
  let suggestionIds: string[] = [];
  if (cohortIds.length) {
    const mates = await db
      .from("cohort_members")
      .select("user_id")
      .in("cohort_id", cohortIds)
      .neq("user_id", userId)
      .limit(50);
    suggestionIds = ((mates.data ?? []) as Array<{ user_id: string }>)
      .map((r) => r.user_id)
      .filter((id) => !ids.has(id));
  }

  const cards = await cardsFor([...ids, ...suggestionIds]);
  const known = (id: string) => cards.get(id) ?? null;

  const friends: MemberCard[] = [];
  const blocked: MemberCard[] = [];
  const incoming: FriendsView["incoming"] = [];
  const outgoing: FriendsView["outgoing"] = [];

  for (const r of rows) {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
    const card = known(otherId);
    if (!card) continue;
    if (r.status === "accepted") friends.push(card);
    else if (r.status === "blocked") blocked.push(card);
    else if (r.status === "pending" && r.addressee_id === userId) {
      incoming.push({ id: r.id, from: card, createdAt: r.created_at });
    } else if (r.status === "pending") {
      outgoing.push({ id: r.id, to: card, createdAt: r.created_at });
    }
  }

  const suggestions = suggestionIds
    .map((id) => known(id))
    .filter((c): c is MemberCard => Boolean(c))
    .slice(0, 12);

  friends.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { me, friends, incoming, outgoing, suggestions, blocked };
}

export async function requestFriend(userId: string, targetId: string): Promise<{ status: string }> {
  if (userId === targetId) throw new Error("That is you");
  const db = await admin();
  await ensureHandle(userId);

  const existing = await db
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`,
    )
    .maybeSingle();

  const row = existing.data as FriendshipRow | null;
  if (row) {
    if (row.status === "blocked") throw new Error("You cannot add this member");
    if (row.status === "accepted") return { status: "accepted" };
    if (row.status === "pending" && row.addressee_id === userId) {
      return respondFriend(userId, row.id, "accept");
    }
    if (row.status === "declined") {
      const { error } = await db
        .from("friendships")
        .update({ requester_id: userId, addressee_id: targetId, status: "pending", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      fail(error, "Could not send that request");
      return { status: "pending" };
    }
    return { status: "pending" };
  }

  // Light rate limit: 30 outbound requests a day.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= 30) throw new Error("Too many friend requests today — try again tomorrow");

  const { error } = await db
    .from("friendships")
    .insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
  fail(error, "Could not send that request");
  return { status: "pending" };
}

export async function respondFriend(
  userId: string,
  friendshipId: string,
  action: "accept" | "decline",
): Promise<{ status: string }> {
  const db = await admin();
  const { data } = await db.from("friendships").select("*").eq("id", friendshipId).maybeSingle();
  const row = data as FriendshipRow | null;
  if (!row || row.addressee_id !== userId) throw new Error("That request is no longer waiting");

  const status = action === "accept" ? "accepted" : "declined";
  const { error } = await db
    .from("friendships")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", friendshipId);
  fail(error, "Could not update that request");

  if (status === "accepted") await ensureDm(userId, row.requester_id);
  return { status };
}

export async function removeFriend(userId: string, otherId: string): Promise<{ ok: true }> {
  const db = await admin();
  const { error } = await db
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
    );
  fail(error, "Could not remove that friend");
  return { ok: true };
}

export async function setBlocked(userId: string, otherId: string, blocked: boolean): Promise<{ ok: true }> {
  const db = await admin();
  if (!blocked) {
    const { error } = await db
      .from("friendships")
      .delete()
      .eq("status", "blocked")
      .eq("blocked_by", userId)
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
      );
    fail(error, "Could not unblock this member");
    return { ok: true };
  }

  const existing = await db
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${userId})`,
    )
    .maybeSingle();

  if (existing.data) {
    const { error } = await db
      .from("friendships")
      .update({ status: "blocked", blocked_by: userId, updated_at: new Date().toISOString() })
      .eq("id", (existing.data as { id: string }).id);
    fail(error, "Could not block this member");
  } else {
    const { error } = await db
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: otherId, status: "blocked", blocked_by: userId });
    fail(error, "Could not block this member");
  }
  return { ok: true };
}

export async function reportMember(
  userId: string,
  input: { targetUserId?: string | null; messageId?: string | null; reason: string; detail?: string | null },
): Promise<{ ok: true }> {
  const db = await admin();
  const { error } = await db.from("member_reports").insert({
    reporter_id: userId,
    target_user_id: input.targetUserId ?? null,
    message_id: input.messageId ?? null,
    reason: input.reason.slice(0, 120),
    detail: input.detail?.slice(0, 1000) ?? null,
  });
  fail(error, "Could not send that report");
  return { ok: true };
}

/* ------------------------------------------------------------------ money --- */

async function assertCanTransact(userId: string): Promise<void> {
  const db = await admin();
  const { data } = await db
    .from("member_profiles")
    .select("kyc_status, airwallex_account_status")
    .eq("user_id", userId)
    .maybeSingle();
  const status = (data as { kyc_status?: string } | null)?.kyc_status ?? "not_started";
  if (status !== "verified") throw new Error("Finish verification before sending money");
}

export async function sendToMember(
  userId: string,
  input: { toUserId: string; amount: number; note?: string | null; idempotencyKey?: string | null; conversationId?: string | null },
) {
  if (userId === input.toUserId) throw new Error("That is your own account");
  await assertCanTransact(userId);

  const db = await admin();
  const canSend = (await friendIds(userId)).includes(input.toUserId);
  if (!canSend) throw new Error("Add each other as friends before sending money");

  const { data, error } = await db.rpc("transfer_post", {
    _sender: userId,
    _recipient: input.toUserId,
    _amount_agorot: toAgorot(input.amount),
    _note: input.note ?? undefined,
    _idempotency_key: input.idempotencyKey ?? undefined,
  });
  fail(error, "That payment could not be sent");

  const entry = data as unknown as { id: string } | null;

  if (input.conversationId) {
    await postSystemMessage(input.conversationId, userId, "payment", input.note ?? "", {
      amount: input.amount,
      toUserId: input.toUserId,
      entryId: entry?.id ?? null,
    });
  }

  const { readSnapshot } = await import("./ledger.server");
  return { snapshot: await readSnapshot(userId), entryId: entry?.id ?? null };
}

/* -------------------------------------------------------------------- chat --- */

export async function ensureDm(userId: string, otherId: string): Promise<string> {
  const db = await admin();
  const mine = await db.from("conversation_members").select("conversation_id").eq("user_id", userId);
  const myIds = ((mine.data ?? []) as Array<{ conversation_id: string }>).map((r) => r.conversation_id);
  if (myIds.length) {
    const shared = await db
      .from("conversation_members")
      .select("conversation_id, conversations!inner(kind)")
      .eq("user_id", otherId)
      .in("conversation_id", myIds);
    for (const row of (shared.data ?? []) as Array<{ conversation_id: string; conversations: { kind: string } }>) {
      if (row.conversations?.kind === "dm") return row.conversation_id;
    }
  }

  const { data, error } = await db
    .from("conversations")
    .insert({ kind: "dm", created_by: userId })
    .select("id")
    .maybeSingle();
  fail(error, "Could not open that chat");
  const conversationId = (data as { id: string }).id;
  await db.from("conversation_members").insert([
    { conversation_id: conversationId, user_id: userId },
    { conversation_id: conversationId, user_id: otherId },
  ]);
  return conversationId;
}

export async function createGroup(userId: string, title: string, memberIds: string[]): Promise<string> {
  const db = await admin();
  const clean = title.trim().slice(0, 60) || "New group";
  const friends = new Set(await friendIds(userId));
  const invited = [...new Set(memberIds)].filter((id) => id !== userId && friends.has(id)).slice(0, 50);

  const { data, error } = await db
    .from("conversations")
    .insert({ kind: "group", title: clean, created_by: userId })
    .select("id")
    .maybeSingle();
  fail(error, "Could not create that group");
  const conversationId = (data as { id: string }).id;

  await db.from("conversation_members").insert([
    { conversation_id: conversationId, user_id: userId, role: "owner" },
    ...invited.map((id) => ({ conversation_id: conversationId, user_id: id })),
  ]);
  await postSystemMessage(conversationId, null, "system", `${clean} started`, {});
  return conversationId;
}

export async function addToGroup(userId: string, conversationId: string, memberIds: string[]) {
  const db = await admin();
  await assertMember(userId, conversationId);
  const friends = new Set(await friendIds(userId));
  const invited = [...new Set(memberIds)].filter((id) => friends.has(id));
  if (!invited.length) return { ok: true as const };
  await db
    .from("conversation_members")
    .upsert(
      invited.map((id) => ({ conversation_id: conversationId, user_id: id })),
      { onConflict: "conversation_id,user_id", ignoreDuplicates: true },
    );
  return { ok: true as const };
}

export async function leaveConversation(userId: string, conversationId: string) {
  const db = await admin();
  await db.from("conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", userId);
  return { ok: true as const };
}

async function assertMember(userId: string, conversationId: string): Promise<void> {
  const db = await admin();
  const { data } = await db
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You are not in that chat");
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const db = await admin();
  await ensureHandle(userId);

  const { data: memberRows } = await db
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);
  const rows = (memberRows ?? []) as Array<{ conversation_id: string; last_read_at: string }>;
  if (!rows.length) return [];

  const ids = rows.map((r) => r.conversation_id);
  const [{ data: convs }, { data: everyone }, { data: recent }] = await Promise.all([
    db.from("conversations").select("*").in("id", ids).order("last_message_at", { ascending: false }),
    db.from("conversation_members").select("conversation_id, user_id").in("conversation_id", ids),
    db
      .from("messages")
      .select("conversation_id, body, kind, created_at, sender_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const others = new Map<string, string[]>();
  for (const row of (everyone ?? []) as Array<{ conversation_id: string; user_id: string }>) {
    const list = others.get(row.conversation_id) ?? [];
    list.push(row.user_id);
    others.set(row.conversation_id, list);
  }

  const cards = await cardsFor(
    [...others.values()].flat().filter((id) => id !== userId),
  );

  const latest = new Map<string, { body: string; kind: string; created_at: string }>();
  const unread = new Map<string, number>();
  const readAt = new Map(rows.map((r) => [r.conversation_id, new Date(r.last_read_at).getTime()]));
  for (const m of (recent ?? []) as Array<{
    conversation_id: string;
    body: string;
    kind: string;
    created_at: string;
    sender_id: string | null;
  }>) {
    if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m);
    const seenBefore = readAt.get(m.conversation_id) ?? 0;
    if (m.sender_id !== userId && new Date(m.created_at).getTime() > seenBefore) {
      unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return ((convs ?? []) as Array<{
    id: string;
    kind: "dm" | "cohort" | "group";
    title: string | null;
    last_message_at: string;
  }>).map((c) => {
    const memberIds = others.get(c.id) ?? [];
    const otherIds = memberIds.filter((id) => id !== userId);
    const partner = c.kind === "dm" ? cards.get(otherIds[0] ?? "") ?? null : null;
    const last = latest.get(c.id);
    return {
      id: c.id,
      kind: c.kind,
      title: c.kind === "dm" ? partner?.displayName ?? "Shekk member" : c.title ?? "Chat",
      subtitle:
        c.kind === "dm"
          ? partner
            ? `@${partner.handle}`
            : null
          : `${memberIds.length} member${memberIds.length === 1 ? "" : "s"}`,
      avatarName: c.kind === "dm" ? partner?.displayName ?? "Shekk" : c.title ?? "Chat",
      memberCount: memberIds.length,
      lastMessage: last ? previewOf(last) : null,
      lastMessageAt: last?.created_at ?? c.last_message_at,
      unread: unread.get(c.id) ?? 0,
      otherUserId: partner?.userId ?? null,
    };
  });
}

function previewOf(m: { body: string; kind: string }): string {
  if (m.kind === "payment") return "💸 Sent money";
  if (m.kind === "request") return "🧾 Split request";
  return m.body;
}

export type ConversationView = {
  id: string;
  kind: "dm" | "cohort" | "group";
  title: string;
  subtitle: string | null;
  members: MemberCard[];
  otherUserId: string | null;
  messages: ChatMessage[];
};

export async function readConversation(userId: string, conversationId: string): Promise<ConversationView> {
  const db = await admin();
  await assertMember(userId, conversationId);

  const [{ data: conv }, { data: memberRows }, { data: msgs }] = await Promise.all([
    db.from("conversations").select("*").eq("id", conversationId).maybeSingle(),
    db.from("conversation_members").select("user_id").eq("conversation_id", conversationId),
    db
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(300),
  ]);

  const c = conv as { id: string; kind: "dm" | "cohort" | "group"; title: string | null };
  const memberIds = ((memberRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  const cards = await cardsFor(memberIds);
  const otherId = c.kind === "dm" ? memberIds.find((id) => id !== userId) ?? null : null;
  const partner = otherId ? cards.get(otherId) ?? null : null;

  await db
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  return {
    id: c.id,
    kind: c.kind,
    title: c.kind === "dm" ? partner?.displayName ?? "Shekk member" : c.title ?? "Chat",
    subtitle:
      c.kind === "dm"
        ? partner
          ? `@${partner.handle}`
          : null
        : `${memberIds.length} member${memberIds.length === 1 ? "" : "s"}`,
    members: memberIds.map((id) => cards.get(id)!).filter(Boolean),
    otherUserId: otherId,
    messages: ((msgs ?? []) as Array<{
      id: string;
      conversation_id: string;
      sender_id: string | null;
      kind: ChatMessage["kind"];
      body: string;
      meta: MessageMeta | null;
      created_at: string;
    }>).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.sender_id ? cards.get(m.sender_id)?.displayName ?? "Shekk member" : "Shekk",
      kind: m.kind,
      body: m.body,
      meta: m.meta ?? {},
      createdAt: m.created_at,
      mine: m.sender_id === userId,
    })),
  };
}

export async function sendMessage(userId: string, conversationId: string, body: string): Promise<ChatMessage> {
  const db = await admin();
  await assertMember(userId, conversationId);
  const text = body.trim().slice(0, 2000);
  if (!text) throw new Error("Write something first");

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= 40) throw new Error("Slow down a moment");

  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: userId, kind: "text", body: text })
    .select("*")
    .maybeSingle();
  fail(error, "Could not send that message");

  await db
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  const row = data as { id: string; created_at: string };
  const me = await ensureHandle(userId);
  return {
    id: row.id,
    conversationId,
    senderId: userId,
    senderName: me.displayName,
    kind: "text",
    body: text,
    meta: {},
    createdAt: row.created_at,
    mine: true,
  };
}

async function postSystemMessage(
  conversationId: string,
  senderId: string | null,
  kind: ChatMessage["kind"],
  body: string,
  meta: MessageMeta,
) {
  const db = await admin();
  await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    kind,
    body,
    meta: meta as never,
  });
  await db.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function markRead(userId: string, conversationId: string) {
  const db = await admin();
  await db
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  return { ok: true as const };
}

/* ------------------------------------------------------------------ splits --- */

export async function createSplit(
  userId: string,
  input: {
    note: string;
    total: number;
    mode: "even" | "custom";
    shares: Array<{ userId: string; amount: number }>;
    conversationId?: string | null;
  },
): Promise<SplitBillView> {
  const db = await admin();
  await ensureHandle(userId);
  const friends = new Set(await friendIds(userId));
  const shares = input.shares.filter((s) => s.userId !== userId && friends.has(s.userId) && s.amount > 0);
  if (!shares.length) throw new Error("Pick at least one friend to split with");

  const { data, error } = await db
    .from("split_bills")
    .insert({
      creator_id: userId,
      total_agorot: toAgorot(input.total),
      note: input.note.trim().slice(0, 120),
      mode: input.mode,
      conversation_id: input.conversationId ?? null,
    })
    .select("*")
    .maybeSingle();
  fail(error, "Could not start that split");
  const bill = data as { id: string };

  const { error: shareError } = await db.from("split_shares").insert(
    shares.map((s) => ({ bill_id: bill.id, user_id: s.userId, amount_agorot: toAgorot(s.amount) })),
  );
  fail(shareError, "Could not send those requests");

  if (input.conversationId) {
    await postSystemMessage(input.conversationId, userId, "request", input.note, {
      billId: bill.id,
      total: input.total,
    });
  }

  const views = await listSplits(userId);
  return views.find((b) => b.id === bill.id)!;
}

export async function listSplits(userId: string): Promise<SplitBillView[]> {
  const db = await admin();
  const [{ data: mineRows }, { data: owedRows }] = await Promise.all([
    db.from("split_bills").select("*").eq("creator_id", userId).order("created_at", { ascending: false }).limit(40),
    db.from("split_shares").select("bill_id").eq("user_id", userId).limit(80),
  ]);

  const ids = new Set<string>(((mineRows ?? []) as Array<{ id: string }>).map((r) => r.id));
  for (const r of (owedRows ?? []) as Array<{ bill_id: string }>) ids.add(r.bill_id);
  if (!ids.size) return [];

  const [{ data: bills }, { data: shares }] = await Promise.all([
    db.from("split_bills").select("*").in("id", [...ids]).order("created_at", { ascending: false }),
    db.from("split_shares").select("*").in("bill_id", [...ids]),
  ]);

  const billRows = (bills ?? []) as Array<{
    id: string;
    creator_id: string;
    total_agorot: number;
    note: string;
    mode: string;
    status: SplitBillView["status"];
    created_at: string;
  }>;
  const shareRows = (shares ?? []) as Array<{
    id: string;
    bill_id: string;
    user_id: string;
    amount_agorot: number;
    status: SplitShareView["status"];
    paid_at: string | null;
  }>;

  const cards = await cardsFor([
    ...billRows.map((b) => b.creator_id),
    ...shareRows.map((s) => s.user_id),
  ]);

  return billRows.map((b) => {
    const mine = b.creator_id === userId;
    const views: SplitShareView[] = shareRows
      .filter((s) => s.bill_id === b.id)
      .map((s) => ({
        id: s.id,
        billId: s.bill_id,
        member: cards.get(s.user_id) ?? null,
        amount: toShekels(s.amount_agorot),
        status: s.status,
        paidAt: s.paid_at,
      }));
    return {
      id: b.id,
      creator: cards.get(b.creator_id) ?? null,
      mine,
      total: toShekels(b.total_agorot),
      note: b.note,
      mode: b.mode,
      status: b.status,
      createdAt: b.created_at,
      shares: views,
      myShare: views.find((s) => s.member?.userId === userId) ?? null,
    };
  });
}

export async function paySplitShare(userId: string, shareId: string) {
  const db = await admin();
  const { data } = await db.from("split_shares").select("*, split_bills(*)").eq("id", shareId).maybeSingle();
  const share = data as
    | {
        id: string;
        user_id: string;
        amount_agorot: number;
        status: string;
        bill_id: string;
        split_bills: { creator_id: string; note: string; conversation_id: string | null };
      }
    | null;
  if (!share || share.user_id !== userId) throw new Error("That request is not yours");
  if (share.status === "paid") throw new Error("You have already paid this");

  const result = await sendToMember(userId, {
    toUserId: share.split_bills.creator_id,
    amount: toShekels(share.amount_agorot),
    note: share.split_bills.note || "Split the bill",
    idempotencyKey: `share:${share.id}`,
  });

  await db
    .from("split_shares")
    .update({ status: "paid", paid_at: new Date().toISOString(), entry_id: result.entryId })
    .eq("id", share.id);

  const { data: remaining } = await db
    .from("split_shares")
    .select("id")
    .eq("bill_id", share.bill_id)
    .eq("status", "pending");
  if (!((remaining ?? []) as unknown[]).length) {
    await db.from("split_bills").update({ status: "settled", updated_at: new Date().toISOString() }).eq("id", share.bill_id);
  }

  return result;
}

export async function declineSplitShare(userId: string, shareId: string) {
  const db = await admin();
  const { data } = await db.from("split_shares").select("id, user_id, status").eq("id", shareId).maybeSingle();
  const share = data as { id: string; user_id: string; status: string } | null;
  if (!share || share.user_id !== userId) throw new Error("That request is not yours");
  if (share.status === "paid") throw new Error("You have already paid this");
  await db.from("split_shares").update({ status: "declined" }).eq("id", shareId);
  return { ok: true as const };
}

export async function cancelSplit(userId: string, billId: string) {
  const db = await admin();
  const { data } = await db.from("split_bills").select("id, creator_id").eq("id", billId).maybeSingle();
  if (!data || (data as { creator_id: string }).creator_id !== userId) throw new Error("That split is not yours");
  await db.from("split_bills").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", billId);
  return { ok: true as const };
}

/* ---------------------------------------------------------------- programs --- */

export type ProgramView = {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  cohorts: Array<{ id: string; name: string; isPublic: boolean; joined: boolean }>;
};

export type MyProgramView = {
  cohortId: string;
  cohortName: string;
  programId: string;
  programName: string;
  role: string;
  conversationId: string | null;
  memberCount: number;
} | null;

export async function listPrograms(userId: string, search?: string): Promise<ProgramView[]> {
  const db = await admin();
  let query = db.from("programs").select("*, cohorts(*)").eq("is_public", true).limit(40);
  if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
  const { data } = await query;

  const joined = await db.from("cohort_members").select("cohort_id").eq("user_id", userId);
  const joinedIds = new Set(((joined.data ?? []) as Array<{ cohort_id: string }>).map((r) => r.cohort_id));

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    kind: string;
    city: string | null;
    cohorts: Array<{ id: string; name: string; is_public: boolean }>;
  }>).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    city: p.city,
    cohorts: (p.cohorts ?? [])
      .filter((c) => c.is_public || joinedIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, isPublic: c.is_public, joined: joinedIds.has(c.id) })),
  }));
}

export async function myProgram(userId: string): Promise<MyProgramView> {
  const db = await admin();
  const { data } = await db
    .from("cohort_members")
    .select("cohort_id, role, cohorts(id, name, programs(id, name))")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    cohort_id: string;
    role: string;
    cohorts: { id: string; name: string; programs: { id: string; name: string } | null } | null;
  };
  const [{ data: conv }, { count }] = await Promise.all([
    db.from("conversations").select("id").eq("cohort_id", row.cohort_id).maybeSingle(),
    db.from("cohort_members").select("id", { count: "exact", head: true }).eq("cohort_id", row.cohort_id),
  ]);
  return {
    cohortId: row.cohort_id,
    cohortName: row.cohorts?.name ?? "Cohort",
    programId: row.cohorts?.programs?.id ?? "",
    programName: row.cohorts?.programs?.name ?? "Program",
    role: row.role,
    conversationId: (conv as { id: string } | null)?.id ?? null,
    memberCount: count ?? 0,
  };
}

/** Join a cohort by its short code, or by id when the cohort is public. */
export async function joinCohort(
  userId: string,
  input: { code?: string | null; cohortId?: string | null },
): Promise<MyProgramView> {
  const db = await admin();
  await ensureHandle(userId);

  let cohort: { id: string; name: string } | null = null;
  if (input.code?.trim()) {
    const code = input.code.trim().toUpperCase();
    const { data } = await db.from("cohorts").select("id, name").ilike("join_code", code).maybeSingle();
    cohort = (data as { id: string; name: string } | null) ?? null;
    if (!cohort) throw new Error("That join code does not match a cohort");
  } else if (input.cohortId) {
    const { data } = await db
      .from("cohorts")
      .select("id, name, is_public")
      .eq("id", input.cohortId)
      .maybeSingle();
    const row = data as { id: string; name: string; is_public: boolean } | null;
    if (!row?.is_public) throw new Error("That cohort needs a join code");
    cohort = { id: row.id, name: row.name };
  }
  if (!cohort) throw new Error("Pick a cohort or enter a code");

  await db
    .from("cohort_members")
    .upsert({ cohort_id: cohort.id, user_id: userId }, { onConflict: "cohort_id,user_id", ignoreDuplicates: true });

  await ensureCohortConversation(cohort.id, cohort.name);
  const conv = await db.from("conversations").select("id").eq("cohort_id", cohort.id).maybeSingle();
  const conversationId = (conv.data as { id: string } | null)?.id;
  if (conversationId) {
    await db
      .from("conversation_members")
      .upsert(
        { conversation_id: conversationId, user_id: userId },
        { onConflict: "conversation_id,user_id", ignoreDuplicates: true },
      );
  }

  await db
    .from("member_profiles")
    .update({ cohort: cohort.name, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return myProgram(userId);
}

export async function leaveCohort(userId: string, cohortId: string) {
  const db = await admin();
  await db.from("cohort_members").delete().eq("cohort_id", cohortId).eq("user_id", userId);
  const conv = await db.from("conversations").select("id").eq("cohort_id", cohortId).maybeSingle();
  const conversationId = (conv.data as { id: string } | null)?.id;
  if (conversationId) {
    await db
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
  }
  return { ok: true as const };
}

export async function ensureCohortConversation(cohortId: string, cohortName: string): Promise<string> {
  const db = await admin();
  const existing = await db.from("conversations").select("id").eq("cohort_id", cohortId).maybeSingle();
  if (existing.data) return (existing.data as { id: string }).id;
  const { data, error } = await db
    .from("conversations")
    .insert({ kind: "cohort", title: cohortName, cohort_id: cohortId })
    .select("id")
    .maybeSingle();
  fail(error, "Could not open the cohort thread");
  return (data as { id: string }).id;
}
