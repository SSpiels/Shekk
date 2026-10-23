/**
 * Programme OS: polls/questions and groups. Reads are cohort-scoped and permission-checked
 * on the server, and every write reuses the existing programme engine (staffCreateVote,
 * staffCloseVote, staffApplyVoteWinner, staffCreateGroup, …) — nothing new is invented here.
 * The writes' own responses describe the member's personal hub, so they are ignored; the
 * Programme OS queries below are simply refreshed.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffApplyVoteWinner,
  staffCloseVote,
  staffCreateGroup,
  staffCreateVote,
  staffDeleteGroup,
  staffGroupsOverview,
  staffPollsOverview,
  staffSetGroupMembership,
  type VoteFieldsInput,
} from "@/lib/programme-ops.functions";
import type { StaffGroupsOverview, StaffPollsOverview } from "@/lib/programme/logic";
import { HUB_KEY } from "@/lib/useProgrammeHub";

export function useStaffPolls(cohortId: string | null, enabled = true) {
  const fn = useServerFn(staffPollsOverview);
  return useQuery<StaffPollsOverview>({
    queryKey: ["staff", "polls", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId) && enabled,
    staleTime: 15_000,
    retry: false,
  });
}

export function useStaffPollActions(cohortId: string | null) {
  const createFn = useServerFn(staffCreateVote);
  const closeFn = useServerFn(staffCloseVote);
  const winnerFn = useServerFn(staffApplyVoteWinner);
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["staff", "polls", cohortId] });
    void qc.invalidateQueries({ queryKey: ["staff", "calendar", cohortId] });
    void qc.invalidateQueries({ queryKey: HUB_KEY });
  };
  return {
    create: useMutation({
      mutationFn: (input: VoteFieldsInput) => createFn({ data: { cohortId: cohortId as string, input } }),
      onSuccess: refresh,
    }),
    close: useMutation({
      mutationFn: (data: { voteId: string; winningOptionId: string | null }) => closeFn({ data }),
      onSuccess: refresh,
    }),
    pickWinner: useMutation({
      mutationFn: (data: { voteId: string; optionId: string }) => winnerFn({ data }),
      onSuccess: refresh,
    }),
  };
}

export function useStaffGroups(cohortId: string | null, enabled = true) {
  const fn = useServerFn(staffGroupsOverview);
  return useQuery<StaffGroupsOverview>({
    queryKey: ["staff", "groups", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId) && enabled,
    staleTime: 15_000,
    retry: false,
  });
}

export function useStaffGroupActions(cohortId: string | null) {
  const createFn = useServerFn(staffCreateGroup);
  const deleteFn = useServerFn(staffDeleteGroup);
  const memberFn = useServerFn(staffSetGroupMembership);
  const qc = useQueryClient();
  // Groups change who sees what, and the roster shows each student's groups.
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["staff", "groups", cohortId] });
    void qc.invalidateQueries({ queryKey: ["staff", "students", cohortId] });
    void qc.invalidateQueries({ queryKey: HUB_KEY });
  };
  return {
    create: useMutation({
      mutationFn: (name: string) => createFn({ data: { cohortId: cohortId as string, name } }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (groupId: string) => deleteFn({ data: { groupId } }),
      onSuccess: refresh,
    }),
    // Membership toggles are tapped in quick succession, so show the change at once and
    // put it back if the server refuses.
    setMember: useMutation({
      mutationFn: (data: { groupId: string; memberId: string; member: boolean }) => memberFn({ data }),
      onMutate: async (vars) => {
        const key = ["staff", "groups", cohortId];
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<StaffGroupsOverview>(key);
        if (previous) {
          qc.setQueryData<StaffGroupsOverview>(key, {
            ...previous,
            groups: previous.groups.map((g) =>
              g.id !== vars.groupId
                ? g
                : {
                    ...g,
                    memberIds: vars.member
                      ? [...new Set([...g.memberIds, vars.memberId])]
                      : g.memberIds.filter((id) => id !== vars.memberId),
                  },
            ),
          });
        }
        return { previous };
      },
      onError: (_e, _vars, ctx) => {
        if (ctx?.previous) qc.setQueryData(["staff", "groups", cohortId], ctx.previous);
      },
      onSettled: refresh,
    }),
  };
}
