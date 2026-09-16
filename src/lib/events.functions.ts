/**
 * Events & tickets server functions.
 *
 * Thin wrappers only — the implementations live in `events.server.ts`,
 * `events-admin.server.ts` and `events-provider.server.ts`. The buyer is always
 * taken from the verified token: the client can ask to buy, it can never state
 * a price, a balance or who it is.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KINDS = ["shabbaton", "tiyul", "club", "shiur", "chesed", "other"] as const;
const STATUSES = ["draft", "published", "cancelled"] as const;

const draftSchema = z.object({
  title: z.string().trim().min(2).max(120),
  kind: z.enum(KINDS),
  description: z.string().trim().max(2000).nullish(),
  includes: z.string().trim().max(500).nullish(),
  host: z.string().trim().min(2).max(120),
  venue: z.string().trim().max(120).nullish(),
  city: z.string().trim().max(80).nullish(),
  startsAt: z.string().min(4),
  endsAt: z.string().min(4).nullish(),
  price: z.number().finite().min(0).max(20_000),
  capacity: z.number().int().min(0).max(100_000),
  perPersonLimit: z.number().int().min(1).max(20),
  coverUrl: z.string().trim().url().max(500).nullish(),
  emoji: z.string().trim().min(1).max(8),
  status: z.enum(STATUSES),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify operator access");
  if (!data) throw new Error("Forbidden");
}

/* ------------------------------------------------------------ member reads --- */

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listUpcoming } = await import("./events.server");
    return listUpcoming();
  });

export const getEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { readEvent, myHolding } = await import("./events.server");
    const event = await readEvent(data.eventId);
    if (!event) return { event: null, mine: 0 };
    return { event, mine: await myHolding(context.userId, data.eventId) };
  });

export const myTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listMyTickets } = await import("./events.server");
    return listMyTickets(context.userId);
  });

/* ---------------------------------------------------------------- purchase --- */

export const buyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        eventId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        idempotencyKey: z.string().max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { purchase } = await import("./events.server");
    return purchase(context.userId, data.eventId, data.quantity, data.idempotencyKey ?? null);
  });

/* --------------------------------------------------------- outbound tracking --- */

/**
 * Hand a member off to a partner's checkout and store the attribution record.
 * Returns the destination URL only when the listing really has one.
 */
export const trackOutboundBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { recordOutboundClick } = await import("./events.server");
    const result = await recordOutboundClick({ userId: context.userId, eventId: data.eventId });
    return { url: result?.url ?? null };
  });

/* ------------------------------------------------------------------- admin --- */

export const adminListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listAllEvents } = await import("./events-admin.server");
    return listAllEvents();
  });

export const adminCreateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => draftSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { createEvent } = await import("./events-admin.server");
    return createEvent(context.userId, data);
  });

export const adminUpdateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    draftSchema.extend({ eventId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { eventId, ...draft } = data;
    const { updateEvent } = await import("./events-admin.server");
    return updateEvent(eventId, draft);
  });

export const adminSetEventStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ eventId: z.string().uuid(), status: z.enum(STATUSES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { setEventStatus } = await import("./events-admin.server");
    return setEventStatus(data.eventId, data.status);
  });

export const adminEventTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ eventId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { listEventTickets } = await import("./events-admin.server");
    return listEventTickets(data.eventId);
  });

export const adminSyncPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ provider: z.enum(["eventer", "tickchak", "secret_tel_aviv", "nbn"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { partnerConfigured, syncPartnerEvents } = await import("./events-provider.server");
    if (!partnerConfigured(data.provider)) {
      return { synced: 0, configured: false as const };
    }
    const result = await syncPartnerEvents(data.provider);
    return { ...result, configured: true as const };
  });
