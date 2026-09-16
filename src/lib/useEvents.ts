/**
 * Events & tickets — client hooks.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminCreateEvent,
  adminEventTickets,
  adminListEvents,
  adminSetEventStatus,
  adminSyncPartner,
  adminUpdateEvent,
  buyTicket,
  getEvent,
  listEvents,
  myTickets,
  trackOutboundBooking,
} from "./events.functions";

export const EVENT_KIND_LABEL: Record<string, string> = {
  shabbaton: "Shabbaton",
  tiyul: "Tiyul",
  club: "Club night",
  shiur: "Shiur",
  chesed: "Chesed",
  other: "Event",
};

/** "Thu 14 Aug · 18:30" */
export function eventWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  if (same(d, today)) return "Today";
  if (same(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function useEvents() {
  const fn = useServerFn(listEvents);
  return useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useEvent(eventId: string) {
  const fn = useServerFn(getEvent);
  return useQuery({
    queryKey: ["events", "one", eventId],
    queryFn: () => fn({ data: { eventId } }),
    retry: 1,
  });
}

export function useMyTickets() {
  const fn = useServerFn(myTickets);
  return useQuery({
    queryKey: ["events", "tickets"],
    queryFn: () => fn(),
    retry: 1,
  });
}

export function useBuyTicket() {
  const fn = useServerFn(buyTicket);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { eventId: string; quantity: number }) =>
      fn({
        data: {
          ...vars,
          idempotencyKey: `ticket:${vars.eventId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    },
  });
}

/**
 * Hand off to a partner checkout. The attribution record is written server-side
 * first, then we open the provider's page — a click, never a booking.
 */
export function useOutboundBooking() {
  const fn = useServerFn(trackOutboundBooking);
  return useMutation({
    mutationFn: (vars: { eventId: string }) => fn({ data: vars }),
  });
}

/* ------------------------------------------------------------------- admin --- */

export function useAdminEvents(enabled: boolean) {
  const fn = useServerFn(adminListEvents);
  return useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => fn(),
    enabled,
    retry: false,
  });
}

export function useAdminEventTickets(eventId: string | null) {
  const fn = useServerFn(adminEventTickets);
  return useQuery({
    queryKey: ["admin", "events", "tickets", eventId],
    queryFn: () => fn({ data: { eventId: eventId! } }),
    enabled: Boolean(eventId),
    retry: false,
  });
}

export type EventDraft = {
  title: string;
  kind: "shabbaton" | "tiyul" | "club" | "shiur" | "chesed" | "other";
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
  status: "draft" | "published" | "cancelled";
};

export function useSaveEvent() {
  const create = useServerFn(adminCreateEvent);
  const update = useServerFn(adminUpdateEvent);
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { eventId?: string | null; draft: EventDraft }>({
    mutationFn: async (vars) => {
      if (vars.eventId) {
        await update({ data: { ...vars.draft, eventId: vars.eventId } });
      } else {
        await create({ data: vars.draft });
      }
      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSetEventStatus() {
  const fn = useServerFn(adminSetEventStatus);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { eventId: string; status: "draft" | "published" | "cancelled" }) =>
      fn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export type EventSourceId = "eventer" | "tickchak" | "secret_tel_aviv" | "nbn";

export function useSyncPartner() {
  const fn = useServerFn(adminSyncPartner);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: EventSourceId) => fn({ data: { provider } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "events"] }),
  });
}
