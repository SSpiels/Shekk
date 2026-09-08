/**
 * Programme OS: Team data layer. Reads/writes go through
 * staffTeamOverview/staffInviteTeamMember/staffUpdateTeamMember/
 * staffRemoveTeamMember/staffRevokeTeamInvite in programme-ops.functions.ts
 * — new server functions built for this module, owner-gated, but the same
 * invite/accept engine (programme_invites, previewInvite/acceptInvite,
 * Join.tsx's JoinPanel) every other staff-claim invite already uses.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffTeamInvite,
  staffTeamOverview,
  staffTeamRemoveMember,
  staffTeamRevokeInvite,
  staffTeamUpdateMember,
} from "@/lib/programme-ops.functions";
import type { StaffPermission, StaffRole, StaffTeamOverview } from "@/lib/programme/logic";

export function useStaffTeamOverview(programmeId: string | null) {
  const fn = useServerFn(staffTeamOverview);
  return useQuery<StaffTeamOverview>({
    queryKey: ["staff", "team", programmeId],
    queryFn: () => fn({ data: { programmeId: programmeId as string } }),
    enabled: Boolean(programmeId),
    staleTime: 20_000,
    retry: false,
  });
}

function useInvalidateTeam(programmeId: string | null) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["staff", "team", programmeId] });
}

export function useStaffInviteTeamMember(programmeId: string | null) {
  const fn = useServerFn(staffTeamInvite);
  const invalidate = useInvalidateTeam(programmeId);
  return useMutation({
    mutationFn: (input: { email: string; role: StaffRole; note: string | null }) =>
      fn({ data: { ...input, programmeId: programmeId as string } }),
    onSuccess: invalidate,
  });
}

export function useStaffUpdateTeamMember(programmeId: string | null) {
  const fn = useServerFn(staffTeamUpdateMember);
  const invalidate = useInvalidateTeam(programmeId);
  return useMutation({
    mutationFn: (input: { userId: string; role?: StaffRole; permissions?: StaffPermission[] }) =>
      fn({ data: { ...input, programmeId: programmeId as string } }),
    onSuccess: invalidate,
  });
}

export function useStaffRemoveTeamMember(programmeId: string | null) {
  const fn = useServerFn(staffTeamRemoveMember);
  const invalidate = useInvalidateTeam(programmeId);
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { programmeId: programmeId as string, userId } }),
    onSuccess: invalidate,
  });
}

export function useStaffRevokeTeamInvite(programmeId: string | null) {
  const fn = useServerFn(staffTeamRevokeInvite);
  const invalidate = useInvalidateTeam(programmeId);
  return useMutation({
    mutationFn: (inviteId: string) => fn({ data: { inviteId } }),
    onSuccess: invalidate,
  });
}
