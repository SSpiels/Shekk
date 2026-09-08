/**
 * Programme OS: Settings data layer. Currently just the cohort's join
 * code/enrollment state — the one piece of "settings" that had real,
 * already-written backend behaviour (cohortInviteDetails already existed,
 * unused by any UI) and was the actual missing piece for a pilot: nowhere
 * in Programme OS could an owner find their own cohort's join code.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffCohortInvite,
  staffCohortRegenerateJoinCode,
  staffCohortSetJoinable,
} from "@/lib/programme-ops.functions";

export type StaffCohortSettings = {
  code: string;
  path: string;
  status: string;
  canManage: boolean;
};

export function useStaffCohortSettings(cohortId: string | null) {
  const fn = useServerFn(staffCohortInvite);
  return useQuery<StaffCohortSettings>({
    queryKey: ["staff", "settings", "cohort", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}

function useInvalidateCohortSettings(cohortId: string | null) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ["staff", "settings", "cohort", cohortId] });
}

export function useStaffRegenerateJoinCode(cohortId: string | null) {
  const fn = useServerFn(staffCohortRegenerateJoinCode);
  const invalidate = useInvalidateCohortSettings(cohortId);
  return useMutation({
    mutationFn: () => fn({ data: { cohortId: cohortId as string } }),
    onSuccess: invalidate,
  });
}

export function useStaffSetCohortJoinable(cohortId: string | null) {
  const fn = useServerFn(staffCohortSetJoinable);
  const invalidate = useInvalidateCohortSettings(cohortId);
  return useMutation({
    mutationFn: (open: boolean) => fn({ data: { cohortId: cohortId as string, open } }),
    onSuccess: invalidate,
  });
}
