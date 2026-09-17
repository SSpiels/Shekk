/**
 * Events & tickets — server-only implementation.
 *
 * Events live in the database. Prices are read here, never taken from the
 * client, and a purchase runs through the `ticket_purchase` routine so
 * capacity, the per-person limit and the ledger debit happen atomically.
 *
 * `provider` lets partner-sourced listings coexist with ones created in the
 * Shekk Console. The partner seam lives in `events-provider.server.ts`.
 */

import type { PriceKind } from "./events-price";

/* ---------------------------------------------------------------- shapes --- */

export type EventKind = "shabbaton" | "tiyul" | "club" | "shiur" | "chesed" | "other";
export type EventStatus = "draft" | "published" | "cancelled";

export type IntegrationType = "internal_ticket" | "affiliate_link" | "widget" | "api";
export type ProgrammeStatus = "programme_included" | "programme_official" | "independent";

export type EventRow = {
  id: string;
  title: string;
  kind: EventKind;
  description: string | null;
  includes: string | null;
  host: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  /** NULL means the price is genuinely unknown — never render or treat that as free. */
  price_agorot: number | null;
  /** See lib/events-price.ts — richer price display alongside price_agorot. */
  price_kind: string;
  price_max_agorot: number | null;
  price_note: string | null;
  capacity: number;
  per_person_limit: number;
  cover_url: string | null;
  emoji: string;
  status: EventStatus;
  provider: string;
  provider_ref: string | null;
  created_at: string;
  /* provider-neutral commercial fields */
  external_provider_id: string | null;
  external_booking_url: string | null;
  integration_type: IntegrationType;
  affiliate_campaign_id: string | null;
  /** Internal/admin only — never shaped into a member response. */
  commission_type: string | null;
  commission_rate: number | null;
  source_category: string | null;
  /** A finer, optional classification under source_category — most rows have none. */
  subcategory: string | null;
  /** Controlled multi-value tags — see lib/events-classification.ts. */
  tags: string[];
  /** The source's own raw category/tag values, verbatim — metadata only, never shaped into PublicEvent. */
  source_tags: string[];
  programme_status: ProgrammeStatus;
  last_verified_at: string | null;
  availability_confidence: "live" | "recent" | "unknown" | null;
  terms_url: string | null;
  refund_summary: string | null;
  age_min: number | null;
};

/** What the app renders: shekels, and how many spots are actually left. */
export type PublicEvent = {
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
  /** null = genuinely unknown, never "free". Only 0 means free. */
  price: number | null;
  /** See lib/events-price.ts — richer price display alongside price/priceKind. */
  priceKind: PriceKind;
  priceMax: number | null;
  priceNote: string | null;
  capacity: number;
  sold: number;
  remaining: number | null;
  perPersonLimit: number;
  coverUrl: string | null;
  emoji: string;
  provider: string;
  /* commercial shape, minus anything commercially confidential */
  externalProviderId: string | null;
  externalBookingUrl: string | null;
  integrationType: IntegrationType;
  sourceCategory: string | null;
  subcategory: string | null;
  tags: string[];
  programmeStatus: ProgrammeStatus;
  lastVerifiedAt: string | null;
  availabilityConfidence: "live" | "recent" | "unknown" | null;
  termsUrl: string | null;
  refundSummary: string | null;
  ageMin: number | null;
};


export type TicketRow = {
  id: string;
  event_id: string;
  quantity: number;
  amount_agorot: number;
  code: string;
  status: "valid" | "used" | "cancelled";
  created_at: string;
};

export type MemberTicket = {
  id: string;
  code: string;
  quantity: number;
  amount: number;
  status: TicketRow["status"];
  boughtAt: string;
  event: {
    id: string;
    title: string;
    kind: EventKind;
    host: string;
    venue: string | null;
    city: string | null;
    startsAt: string;
    emoji: string;
    cancelled: boolean;
  };
};

/* -------------------------------------------------------------- db client --- */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const toShekels = (agorot: number) => agorot / 100;

/** Turn a Postgres error into something safe and plain to show a member. */
function rethrow(message: string, fallback: string): never {
  const known = [
    "not enough spots left",
    "this event is not on sale",
    "this event has already started",
    "event not found",
    "quantity must be at least 1",
  ];
  if (message.includes("insufficient balance")) throw new Error("Not enough money in your account");
  if (message.includes("account is frozen")) throw new Error("This account is frozen");
  if (message.includes("account is closed")) throw new Error("This account is closed");
  if (message.includes("limit of")) {
    const m = message.match(/limit of (\d+) per person/);
    throw new Error(m ? `There's a limit of ${m[1]} ticket${m[1] === "1" ? "" : "s"} per person` : "Ticket limit reached");
  }
  const hit = known.find((k) => message.includes(k));
  if (hit) throw new Error(hit.charAt(0).toUpperCase() + hit.slice(1));
  console.error(`[events] ${fallback}:`, message);
  throw new Error(fallback);
}

/* ---------------------------------------------------------------- mapping --- */

function shape(row: EventRow, sold: number): PublicEvent {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    includes: row.includes,
    host: row.host,
    venue: row.venue,
    city: row.city,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    price: row.price_agorot === null ? null : toShekels(row.price_agorot),
    priceKind: (row.price_kind ?? "unknown") as PriceKind,
    priceMax: row.price_max_agorot === null || row.price_max_agorot === undefined ? null : toShekels(row.price_max_agorot),
    priceNote: row.price_note ?? null,
    capacity: row.capacity,
    sold,
    remaining: row.capacity > 0 ? Math.max(0, row.capacity - sold) : null,
    perPersonLimit: row.per_person_limit,
    coverUrl: row.cover_url,
    emoji: row.emoji,
    provider: row.provider,
    externalProviderId: row.external_provider_id ?? null,
    externalBookingUrl: row.external_booking_url ?? null,
    integrationType: (row.integration_type ?? "internal_ticket") as IntegrationType,
    sourceCategory: row.source_category ?? null,
    subcategory: row.subcategory ?? null,
    tags: row.tags ?? [],
    programmeStatus: (row.programme_status ?? "independent") as ProgrammeStatus,
    lastVerifiedAt: row.last_verified_at ?? null,
    availabilityConfidence: row.availability_confidence ?? null,
    termsUrl: row.terms_url ?? null,
    refundSummary: row.refund_summary ?? null,
    ageMin: row.age_min ?? null,
  };
}

/**
 * Record a tap-through to a provider's own checkout.
 *
 * A click is a click: this is attribution groundwork, never a confirmed booking
 * and never a confirmed commission.
 */
export async function recordOutboundClick(input: {
  userId: string;
  eventId: string;
}): Promise<{ url: string } | null> {
  const db = await admin();
  const { data } = await db
    .from("events")
    .select("id, provider, external_provider_id, external_booking_url, affiliate_campaign_id, status")
    .eq("id", input.eventId)
    .maybeSingle();

  const row = data as Pick<
    EventRow,
    "id" | "provider" | "external_provider_id" | "external_booking_url" | "affiliate_campaign_id" | "status"
  > | null;
  if (!row || row.status !== "published" || !row.external_booking_url) return null;

  const { error } = await db.from("activity_outbound_clicks").insert({
    user_id: input.userId,
    event_id: row.id,
    provider: row.provider,
    external_provider_id: row.external_provider_id,
    destination_url: row.external_booking_url,
    affiliate_campaign_id: row.affiliate_campaign_id,
  });
  if (error) console.error("[events] outbound click:", error.message);

  return { url: row.external_booking_url };
}


async function soldByEvent(eventIds: string[]): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const db = await admin();
  const { data } = await db
    .from("event_tickets")
    .select("event_id, quantity, status")
    .in("event_id", eventIds)
    .neq("status", "cancelled");
  const out: Record<string, number> = {};
  for (const t of (data ?? []) as Array<{ event_id: string; quantity: number }>) {
    out[t.event_id] = (out[t.event_id] ?? 0) + t.quantity;
  }
  return out;
}

/* ------------------------------------------------------------------ reads --- */

/** How long a no-end-time event still counts as "upcoming" after it started. */
const NO_END_TIME_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * A published event still belongs on "what's upcoming": either it hasn't
 * ended yet — a real `endsAt` still in the future, however long ago it
 * started — or, when no end time is known at all, it started recently
 * enough to still plausibly be relevant.
 */
export function isStillUpcoming(
  event: { startsAt: string; endsAt: string | null },
  now: Date = new Date(),
): boolean {
  if (event.endsAt) return new Date(event.endsAt).getTime() >= now.getTime();
  return new Date(event.startsAt).getTime() >= now.getTime() - NO_END_TIME_GRACE_MS;
}

/** Every published event still to come, soonest first. */
export async function listUpcoming(): Promise<PublicEvent[]> {
  const db = await admin();
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - NO_END_TIME_GRACE_MS).toISOString();
  const { data, error } = await db
    .from("events")
    .select("*")
    .eq("status", "published")
    // A coarse, efficient pre-filter matching `isStillUpcoming`'s shape —
    // the exact decision (including the no-end-time grace window) is made
    // in JS below via that same tested function, so this only needs to be a
    // safe superset, not the source of truth.
    .or(`ends_at.gte.${now.toISOString()},and(ends_at.is.null,starts_at.gte.${graceCutoff})`)
    .order("starts_at", { ascending: true })
    .limit(200);

  if (error) rethrow(error.message, "Could not load events");

  // A row flagged as a likely cross-source duplicate (see events-dedupe.ts)
  // never reaches students — only its canonical counterpart does. Both rows
  // stay in the database either way; this only affects what's shown here.
  const { suppressedDuplicateEventIds } = await import("./events-dedupe.server");
  const suppressed = await suppressedDuplicateEventIds();

  const rows = ((data ?? []) as EventRow[]).filter(
    (r) => isStillUpcoming({ startsAt: r.starts_at, endsAt: r.ends_at }, now) && !suppressed.has(r.id),
  );
  const sold = await soldByEvent(rows.map((r) => r.id));
  return rows.map((r) => shape(r, sold[r.id] ?? 0));
}

export async function readEvent(eventId: string): Promise<PublicEvent | null> {
  const db = await admin();
  const { data, error } = await db
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (error) rethrow(error.message, "Could not load this event");
  if (!data) return null;

  const row = data as EventRow;
  const sold = await soldByEvent([row.id]);
  return shape(row, sold[row.id] ?? 0);
}

/** How many admissions this member already holds for an event. */
export async function myHolding(userId: string, eventId: string): Promise<number> {
  const db = await admin();
  const { data } = await db
    .from("event_tickets")
    .select("quantity")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .neq("status", "cancelled");
  return ((data ?? []) as Array<{ quantity: number }>).reduce((n, t) => n + t.quantity, 0);
}

export async function listMyTickets(userId: string): Promise<MemberTicket[]> {
  const db = await admin();
  const { data, error } = await db
    .from("event_tickets")
    .select(
      "id, code, quantity, amount_agorot, status, created_at, event_id, events(id, title, kind, host, venue, city, starts_at, emoji, status)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) rethrow(error.message, "Could not load your tickets");

  type Joined = TicketRow & {
    events: {
      id: string;
      title: string;
      kind: EventKind;
      host: string;
      venue: string | null;
      city: string | null;
      starts_at: string;
      emoji: string;
      status: EventStatus;
    } | null;
  };

  return ((data ?? []) as unknown as Joined[])
    .filter((t) => t.events)
    .map((t) => ({
      id: t.id,
      code: t.code,
      quantity: t.quantity,
      amount: toShekels(t.amount_agorot),
      status: t.status,
      boughtAt: t.created_at,
      event: {
        id: t.events!.id,
        title: t.events!.title,
        kind: t.events!.kind,
        host: t.events!.host,
        venue: t.events!.venue,
        city: t.events!.city,
        startsAt: t.events!.starts_at,
        emoji: t.events!.emoji,
        cancelled: t.events!.status === "cancelled",
      },
    }));
}

/* --------------------------------------------------------------- purchase --- */

export async function purchase(
  userId: string,
  eventId: string,
  quantity: number,
  idempotencyKey?: string | null,
): Promise<{ ticketId: string; code: string; quantity: number; amount: number }> {
  const db = await admin();
  const { data, error } = await db.rpc("ticket_purchase", {
    _user_id: userId,
    _event_id: eventId,
    _quantity: quantity,
    _idempotency_key: idempotencyKey ?? undefined,
  });

  if (error) rethrow(error.message ?? "", "Could not buy this ticket");

  const row = data as unknown as TicketRow;
  return {
    ticketId: row.id,
    code: row.code,
    quantity: row.quantity,
    amount: toShekels(row.amount_agorot),
  };
}
