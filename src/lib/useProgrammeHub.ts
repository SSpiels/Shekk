/**
 * Programme hub — browser data layer.
 *
 * One query holds the whole hub (`readHub` already returns exactly what the
 * signed-in member is allowed to see, participant or staff), and every mutation
 * adopts the fresh hub the server hands back. That keeps the UI honest: nothing
 * is optimistically "true" until the database agreed to it.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useApp } from "@/lib/store";
import {
  adminCohortCreate,
  adminCohortDetailFn,
  adminCohortUpdate,
  adminInviteRevoke,
  adminProgrammeUpdate,
  adminStaffRemove,
  adminStaffSetRole,
  adminTestProgrammeReset,
  adminTestProgrammeStatus,
  adminProgrammeAssignOwner,
  adminProgrammeCreate,
  adminProgrammeFlags,
  adminProgrammeInvite,
  adminProgrammeList,
  programmeAcceptInvite,
  programmeAcknowledge,
  programmeCastVote,
  programmeCodePreview,
  programmeHub,
  programmeJoin,
  programmeLeave,
  programmeMarkNotificationsRead,
  programmeSetChecklistDone,
  programmeSetRsvp,
  staffCloseVote,
  staffCohortInvite,
  staffCreateAnnouncement,
  staffCreateEvent,
  staffCreateGroup,
  staffCreateVote,
  staffDeleteAnnouncement,
  staffDeleteContent,
  staffDeleteEvent,
  staffDeleteGroup,
  staffApplyVoteWinner,
  staffListParticipants,
  staffSeedChecklist,
  staffSession,
  staffSetGroupMembership,
  staffUpdateEvent,
  staffUpsertContent,
} from "@/lib/programme-ops.functions";
import type {
  AnnouncementFieldsInput,
  CohortFieldsInput,
  ContentUpsertInput,
  EventFieldsInput,
  EventPatchInput,
  ProgrammeFieldsInput,
  VoteFieldsInput,
} from "@/lib/programme-ops.functions";
import {
  checklistProgress,
  emptyHub,
  emptyStaffSession,
  importantChanges,
  nextEvent,
  nowEvent,
  openVotes,
  pendingAcknowledgements,
  todaysEvents,
  type ProgrammeHub,
  type StaffSession,
} from "@/lib/programme/logic";

export const HUB_KEY = ["programme", "hub"] as const;

/** Freshly minted tokens can briefly read as "issued in the future". Retry. */
function isClockSkew(error: unknown) {
  return /issued at future|iat|Unauthorized/i.test(error instanceof Error ? error.message : String(error));
}

export function cleanError(e: unknown, fallback: string) {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const msg = raw.replace(/^Error:\s*/, "").trim();
  if (!msg || /\[object|fetch failed|Unexpected token/i.test(msg)) return fallback;
  return msg;
}

export function useProgrammeHub() {
  const { signedIn } = useApp();
  const qc = useQueryClient();
  const read = useServerFn(programmeHub);

  const query = useQuery<ProgrammeHub>({
    queryKey: HUB_KEY,
    queryFn: () => read(),
    enabled: signedIn,
    staleTime: 20_000,
    throwOnError: false,
    retry: (count, error) => count < 3 && isClockSkew(error),
    retryDelay: (count) => Math.min(1200 * (count + 1), 4000),
  });

  const hub = query.data ?? emptyHub;

  const derived = useMemo(() => {
    const events = hub.events;
    return {
      now: nowEvent(events),
      next: nextEvent(events),
      today: todaysEvents(events),
      changes: importantChanges(hub),
      votes: openVotes(hub.votes),
      pendingAcks: pendingAcknowledgements(hub),
      checklist: checklistProgress(hub.checklist),
      unread: hub.notifications.filter((n) => !n.readAt),
    };
  }, [hub]);

  return {
    hub,
    ...derived,
    joined: hub.joined,
    isStaff: Boolean(hub.staff),
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    adopt: (next: ProgrammeHub) => qc.setQueryData(HUB_KEY, next),
  };
}

/**
 * Which programme(s), if any, the signed-in user has staff access to — the
 * gate `/staff` runs before rendering anything else. Deliberately separate
 * from useProgrammeHub: a pure-staff account (no student membership) still
 * needs this to resolve, and a participant hub read shouldn't imply a staff
 * lookup happened.
 */
export function useStaffSession() {
  const { signedIn, authChecked } = useApp();
  const read = useServerFn(staffSession);

  const query = useQuery<StaffSession>({
    queryKey: ["staff", "session"],
    queryFn: () => read(),
    enabled: signedIn,
    staleTime: 30_000,
    retry: false,
  });

  return {
    session: query.data ?? emptyStaffSession,
    isStaff: (query.data?.workspaces.length ?? 0) > 0,
    // Loading until we actually know — never flash "not staff" while auth is still settling.
    loading: !authChecked || (signedIn && query.isLoading),
    error: query.error,
  };
}

/** Every hub-returning mutation shares this: adopt the server's fresh truth. */
function useHubMutation<TInput>(fn: (input: TInput) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (next) => {
      if (next && typeof next === "object" && "joined" in (next as Record<string, unknown>)) {
        qc.setQueryData(HUB_KEY, next as ProgrammeHub);
      } else {
        void qc.invalidateQueries({ queryKey: HUB_KEY });
      }
    },
  });
}

/* ─────────────────────────── Participant mutations ────────────────────────── */

export function useParticipantActions() {
  const rsvpFn = useServerFn(programmeSetRsvp);
  const ackFn = useServerFn(programmeAcknowledge);
  const voteFn = useServerFn(programmeCastVote);
  const tickFn = useServerFn(programmeSetChecklistDone);
  const readFn = useServerFn(programmeMarkNotificationsRead);
  const leaveFn = useServerFn(programmeLeave);

  return {
    rsvp: useHubMutation((data: { eventId: string; response: "going" | "maybe" | "not_going" }) => rsvpFn({ data })),
    acknowledge: useHubMutation((data: { subjectType: "event" | "announcement"; subjectId: string }) => ackFn({ data })),
    vote: useHubMutation((data: { voteId: string; optionId: string }) => voteFn({ data })),
    tick: useHubMutation((data: { itemId: string; done: boolean }) => tickFn({ data })),
    markRead: useHubMutation((data: { ids: string[] }) => readFn({ data })),
    leave: useHubMutation(() => leaveFn()),
  };
}

/* ──────────────────────────────── Join / claim ────────────────────────────── */

export function useJoinFlow() {
  const previewFn = useServerFn(programmeCodePreview);
  const joinFn = useServerFn(programmeJoin);
  const acceptFn = useServerFn(programmeAcceptInvite);

  return {
    preview: useMutation({ mutationFn: (code: string) => previewFn({ data: { code } }) }),
    join: useHubMutation((code: string) => joinFn({ data: { code } })),
    accept: useHubMutation((code: string) => acceptFn({ data: { code } })),
  };
}

export function useCodePreview(code: string | null) {
  const previewFn = useServerFn(programmeCodePreview);
  return useQuery({
    queryKey: ["programme", "code", code],
    queryFn: () => previewFn({ data: { code: code as string } }),
    enabled: Boolean(code && code.length >= 3),
    retry: false,
    staleTime: 60_000,
  });
}

/* ─────────────────────────────── Staff actions ────────────────────────────── */

export function useStaffActions() {
  const createEventFn = useServerFn(staffCreateEvent);
  const updateEventFn = useServerFn(staffUpdateEvent);
  const deleteEventFn = useServerFn(staffDeleteEvent);
  const createAnnFn = useServerFn(staffCreateAnnouncement);
  const deleteAnnFn = useServerFn(staffDeleteAnnouncement);
  const createVoteFn = useServerFn(staffCreateVote);
  const closeVoteFn = useServerFn(staffCloseVote);
  const applyWinnerFn = useServerFn(staffApplyVoteWinner);
  const createGroupFn = useServerFn(staffCreateGroup);
  const deleteGroupFn = useServerFn(staffDeleteGroup);
  const groupMemberFn = useServerFn(staffSetGroupMembership);
  const upsertFn = useServerFn(staffUpsertContent);
  const deleteContentFn = useServerFn(staffDeleteContent);
  const seedFn = useServerFn(staffSeedChecklist);
  const qc = useQueryClient();

  return {
    createEvent: useHubMutation((data: { cohortId: string; input: EventFieldsInput }) => createEventFn({ data })),
    updateEvent: useHubMutation((data: { eventId: string; patch: EventPatchInput }) => updateEventFn({ data })),
    deleteEvent: useHubMutation((data: { eventId: string }) => deleteEventFn({ data })),
    createAnnouncement: useHubMutation((data: { cohortId: string; input: AnnouncementFieldsInput }) => createAnnFn({ data })),
    deleteAnnouncement: useHubMutation((data: { id: string }) => deleteAnnFn({ data })),
    createVote: useHubMutation((data: { cohortId: string; input: VoteFieldsInput }) => createVoteFn({ data })),
    closeVote: useHubMutation((data: { voteId: string; winningOptionId: string | null }) => closeVoteFn({ data })),
    applyWinner: useHubMutation((data: { voteId: string; optionId: string }) => applyWinnerFn({ data })),
    createGroup: useHubMutation((data: { cohortId: string; name: string; description?: string | null }) =>
      createGroupFn({ data }),
    ),
    deleteGroup: useHubMutation((data: { groupId: string }) => deleteGroupFn({ data })),
    setGroupMember: useMutation({
      mutationFn: (data: { groupId: string; memberId: string; member: boolean }) => groupMemberFn({ data }),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["programme"] });
      },
    }),
    upsertContent: useHubMutation((data: ContentUpsertInput) => upsertFn({ data })),
    deleteContent: useHubMutation(
      (data: { kind: "checklist_item" | "document" | "contact" | "place"; cohortId: string; id: string }) =>
        deleteContentFn({ data }),
    ),
    seedChecklist: useHubMutation((data: { cohortId: string }) => seedFn({ data })),
  };
}

export function useParticipants(cohortId: string | null, enabled: boolean) {
  const fn = useServerFn(staffListParticipants);
  return useQuery({
    queryKey: ["programme", "participants", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId) && enabled,
    retry: false,
  });
}

export function useCohortInvite(cohortId: string | null, enabled: boolean) {
  const fn = useServerFn(staffCohortInvite);
  return useQuery({
    queryKey: ["programme", "invite", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId) && enabled,
    retry: false,
    staleTime: 300_000,
  });
}

/* ────────────────────────── Internal Shekk admin ─────────────────────────── */

export function useAdminProgrammes(enabled = true) {
  const fn = useServerFn(adminProgrammeList);
  return useQuery({ queryKey: ["admin", "programmes"], queryFn: () => fn(), enabled, retry: false });
}

export function useAdminProgrammeActions() {
  const qc = useQueryClient();
  const createFn = useServerFn(adminProgrammeCreate);
  const cohortFn = useServerFn(adminCohortCreate);
  const ownerFn = useServerFn(adminProgrammeAssignOwner);
  const inviteFn = useServerFn(adminProgrammeInvite);
  const flagsFn = useServerFn(adminProgrammeFlags);
  const after = { onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "programmes"] }) };

  return {
    createProgramme: useMutation({
      mutationFn: (data: ProgrammeFieldsInput) => createFn({ data }),
      ...after,
    }),
    createCohort: useMutation({
      mutationFn: (data: CohortFieldsInput) => cohortFn({ data }),
      ...after,
    }),
    assignOwner: useMutation({
      mutationFn: (data: { programmeId: string; email: string; role?: "owner" | "staff" }) => ownerFn({ data }),
      ...after,
    }),
    createInvite: useMutation({
      mutationFn: (data: { programmeId: string; cohortId?: string | null; role?: "owner" | "staff"; email?: string | null }) =>
        inviteFn({ data }),
      ...after,
    }),
    setFlags: useMutation({
      mutationFn: (data: { programmeId: string; verified?: boolean; active?: boolean }) => flagsFn({ data }),
      ...after,
    }),
  };
}

export function useAdminCohortDetail(cohortId: string | null) {
  const fn = useServerFn(adminCohortDetailFn);
  return useQuery({
    queryKey: ["admin", "programmes", "cohort", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    retry: false,
  });
}

/** Editing, archiving, staff and invite management — internal Shekk admin only. */
export function useAdminProgrammeEditing() {
  const qc = useQueryClient();
  const progFn = useServerFn(adminProgrammeUpdate);
  const cohortFn = useServerFn(adminCohortUpdate);
  const roleFn = useServerFn(adminStaffSetRole);
  const removeFn = useServerFn(adminStaffRemove);
  const revokeFn = useServerFn(adminInviteRevoke);
  const after = {
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "programmes"] }),
  };

  return {
    updateProgramme: useMutation({
      mutationFn: (data: Partial<ProgrammeFieldsInput> & { programmeId: string; status?: "active" | "inactive" | "archived" }) =>
        progFn({ data }),
      ...after,
    }),
    updateCohort: useMutation({
      mutationFn: (
        data: Partial<Omit<CohortFieldsInput, "programmeId">> & {
          cohortId: string;
          status?: "open" | "closed" | "archived";
          regenerateJoinCode?: boolean;
        },
      ) => cohortFn({ data }),
      ...after,
    }),
    setStaffRole: useMutation({
      mutationFn: (data: { programmeId: string; userId: string; role: "owner" | "staff" }) => roleFn({ data }),
      ...after,
    }),
    removeStaff: useMutation({
      mutationFn: (data: { programmeId: string; userId: string }) => removeFn({ data }),
      ...after,
    }),
    revokeInvite: useMutation({
      mutationFn: (data: { inviteId: string }) => revokeFn({ data }),
      ...after,
    }),
  };
}

/* ─────────────────────── Internal Shekk testing sandbox ───────────────────── */

/**
 * The operator-only programme sandbox: read its state, and create/reset it with
 * the signed-in operator as owner-staff plus participant.
 */
export function useAdminTestProgramme() {
  const qc = useQueryClient();
  const statusFn = useServerFn(adminTestProgrammeStatus);
  const resetFn = useServerFn(adminTestProgrammeReset);

  const status = useQuery({
    queryKey: ["admin", "programmes", "testbed"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const reset = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "programmes"] });
      void qc.invalidateQueries({ queryKey: HUB_KEY });
    },
  });

  return { status, reset };
}
