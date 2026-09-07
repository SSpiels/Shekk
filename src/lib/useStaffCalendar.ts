/**
 * Programme OS: Calendar data layer — the event list/response rollup and the
 * per-event RSVP drill-down. Creating, updating and deleting events reuses
 * staffCreateEvent/staffUpdateEvent/staffDeleteEvent and their
 * EventFieldsInput/EventPatchInput types from programme-ops.functions.ts
 * directly — there is no separate Calendar write path or a second event
 * system.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffCalendarOverview,
  staffCreateEvent,
  staffDeleteEvent,
  staffEventResponses,
  staffUpdateEvent,
  type EventFieldsInput,
  type EventPatchInput,
} from "@/lib/programme-ops.functions";
import type { StaffCalendarOverview, StaffEventResponses } from "@/lib/programme/logic";
import { HUB_KEY } from "@/lib/useProgrammeHub";

export function useStaffCalendarOverview(cohortId: string | null) {
  const fn = useServerFn(staffCalendarOverview);
  return useQuery<StaffCalendarOverview>({
    queryKey: ["staff", "calendar", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}

export function useStaffEventResponses(cohortId: string | null, eventId: string | null) {
  const fn = useServerFn(staffEventResponses);
  return useQuery<StaffEventResponses | null>({
    queryKey: ["staff", "calendar", "responses", cohortId, eventId],
    queryFn: () => fn({ data: { cohortId: cohortId as string, eventId: eventId as string } }),
    enabled: Boolean(cohortId) && Boolean(eventId),
    retry: false,
  });
}

/** Invalidates every surface that shows events: Calendar itself, Overview's
 *  "today's programme" preview, and the mobile hub / student Schedule tab. */
function useInvalidateCalendar(cohortId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["staff", "calendar", cohortId] });
    void qc.invalidateQueries({ queryKey: ["staff", "overview", cohortId] });
    void qc.invalidateQueries({ queryKey: HUB_KEY });
  };
}

export function useStaffCreateEvent(cohortId: string | null) {
  const fn = useServerFn(staffCreateEvent);
  const invalidate = useInvalidateCalendar(cohortId);
  return useMutation({
    mutationFn: (input: EventFieldsInput) => fn({ data: { cohortId: cohortId as string, input } }),
    onSuccess: invalidate,
  });
}

export function useStaffUpdateEvent(cohortId: string | null) {
  const fn = useServerFn(staffUpdateEvent);
  const invalidate = useInvalidateCalendar(cohortId);
  return useMutation({
    mutationFn: (data: { eventId: string; patch: EventPatchInput }) => fn({ data }),
    onSuccess: invalidate,
  });
}

export function useStaffDeleteEvent(cohortId: string | null) {
  const fn = useServerFn(staffDeleteEvent);
  const invalidate = useInvalidateCalendar(cohortId);
  return useMutation({
    mutationFn: (data: { eventId: string }) => fn({ data }),
    onSuccess: invalidate,
  });
}
