/**
 * Events — console-side server helpers.
 *
 * Only ever reached from `events.functions.ts` after the caller's `admin` role
 * has been verified. Partner-sourced events (`provider <> 'shekk'`) are
 * read-only here: they are owned by the sync routine, not by an operator.
 */

import type { EventKind, EventRow, EventStatus } from "./events.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminEvent = {
  id: string;
  title: string;
  kind: EventKind;
  description: string | null;
  includes: string | null;
  host: string;
  venue: string | null;
  city: string | null;
  startsAt: string;
  endsAt: string | null;
  /** null = genuinely unknown (an imported listing that didn't state one), never "free". */
  price: number | null;
  capacity: number;
  perPersonLimit: number;
  coverUrl: string | null;
  emoji: string;
  status: EventStatus;
  provider: string;
  sold: number;
  revenue: number;
  createdAt: string;
};

export type EventDraft = {
  title: string;
  kind: EventKind;
  description?: string | null;
  includes?: string | null;
  host: string;
  venue?: string | null;
  city?: string | null;
  startsAt: string;
  endsAt?: string | null;
  price: number;
  capacity: number;
  perPersonLimit: number;
  coverUrl?: string | null;
  emoji: string;
  status: EventStatus;
};

function toRow(draft: EventDraft) {
  return {
    title: draft.title,
    kind: draft.kind,
    description: draft.description ?? null,
    includes: draft.includes ?? null,
    host: draft.host,
    venue: draft.venue ?? null,
    city: draft.city ?? null,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt ?? null,
    price_agorot: Math.round(draft.price * 100),
    capacity: Math.round(draft.capacity),
    per_person_limit: Math.round(draft.perPersonLimit),
    cover_url: draft.coverUrl ?? null,
    emoji: draft.emoji,
    status: draft.status,
  };
}

export async function listAllEvents(): Promise<AdminEvent[]> {
  const db = await admin();
  const [{ data: events, error }, { data: tickets }] = await Promise.all([
    db.from("events").select("*").order("starts_at", { ascending: false }).limit(300),
    db.from("event_tickets").select("event_id, quantity, amount_agorot, status"),
  ]);
  if (error) {
    console.error("[events] listAllEvents:", error.message);
    throw new Error("Could not load events");
  }

  const sold: Record<string, { n: number; revenue: number }> = {};
  for (const t of (tickets ?? []) as Array<{
    event_id: string;
    quantity: number;
    amount_agorot: number;
    status: string;
  }>) {
    if (t.status === "cancelled") continue;
    const at = (sold[t.event_id] ??= { n: 0, revenue: 0 });
    at.n += t.quantity;
    at.revenue += t.amount_agorot;
  }

  return ((events ?? []) as EventRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    description: r.description,
    includes: r.includes,
    host: r.host,
    venue: r.venue,
    city: r.city,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    price: r.price_agorot === null ? null : r.price_agorot / 100,
    capacity: r.capacity,
    perPersonLimit: r.per_person_limit,
    coverUrl: r.cover_url,
    emoji: r.emoji,
    status: r.status,
    provider: r.provider,
    sold: sold[r.id]?.n ?? 0,
    revenue: (sold[r.id]?.revenue ?? 0) / 100,
    createdAt: r.created_at,
  }));
}

export async function createEvent(operatorId: string, draft: EventDraft): Promise<{ id: string }> {
  const db = await admin();
  const { data, error } = await db
    .from("events")
    .insert({ ...toRow(draft), created_by: operatorId })
    .select("id")
    .single();
  if (error) {
    console.error("[events] createEvent:", error.message);
    throw new Error("Could not create this event");
  }
  return { id: (data as { id: string }).id };
}

async function assertOwnedByShekk(eventId: string) {
  const db = await admin();
  const { data } = await db.from("events").select("provider").eq("id", eventId).maybeSingle();
  if (data && (data as { provider: string }).provider !== "shekk") {
    throw new Error("Partner events are managed by the ticketing partner");
  }
}

export async function updateEvent(eventId: string, draft: EventDraft): Promise<{ ok: true }> {
  await assertOwnedByShekk(eventId);
  const db = await admin();
  const { error } = await db.from("events").update(toRow(draft)).eq("id", eventId);
  if (error) {
    console.error("[events] updateEvent:", error.message);
    throw new Error("Could not save this event");
  }
  return { ok: true };
}

export async function setEventStatus(eventId: string, status: EventStatus): Promise<{ ok: true }> {
  const db = await admin();
  const { error } = await db.from("events").update({ status }).eq("id", eventId);
  if (error) {
    console.error("[events] setEventStatus:", error.message);
    throw new Error("Could not change this event");
  }
  // Cancelling an event voids its tickets. Money is not returned automatically —
  // tickets are non-refundable, so staff resolve any goodwill out of band.
  if (status === "cancelled") {
    await db
      .from("event_tickets")
      .update({ status: "cancelled" })
      .eq("event_id", eventId)
      .eq("status", "valid");
  }
  return { ok: true };
}

export type EventTicketHolder = {
  id: string;
  userId: string;
  handle: string | null;
  name: string | null;
  quantity: number;
  amount: number;
  status: string;
  boughtAt: string;
  code: string;
};

export async function listEventTickets(eventId: string): Promise<EventTicketHolder[]> {
  const db = await admin();
  const { data, error } = await db
    .from("event_tickets")
    .select("id, user_id, quantity, amount_agorot, status, created_at, code")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[events] listEventTickets:", error.message);
    throw new Error("Could not load ticket holders");
  }

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    quantity: number;
    amount_agorot: number;
    status: string;
    created_at: string;
    code: string;
  }>;

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const handles: Record<string, { handle: string; display_name: string }> = {};
  if (ids.length) {
    const { data: hs } = await db
      .from("member_handles")
      .select("user_id, handle, display_name")
      .in("user_id", ids);
    for (const h of (hs ?? []) as Array<{ user_id: string; handle: string; display_name: string }>) {
      handles[h.user_id] = { handle: h.handle, display_name: h.display_name };
    }
  }

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    handle: handles[r.user_id]?.handle ?? null,
    name: handles[r.user_id]?.display_name ?? null,
    quantity: r.quantity,
    amount: r.amount_agorot / 100,
    status: r.status,
    boughtAt: r.created_at,
    code: r.code,
  }));
}
