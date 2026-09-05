/**
 * Programme OS: Onboarding data layer — cohort-wide, distinct from
 * useStaffStudents.ts's per-student profile queries.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffNotifyOnboardingReminder,
  staffOnboardingOverview,
} from "@/lib/programme-ops.functions";
import type { StaffOnboardingOverview } from "@/lib/programme/logic";

export function useStaffOnboardingOverview(cohortId: string | null) {
  const fn = useServerFn(staffOnboardingOverview);
  return useQuery<StaffOnboardingOverview>({
    queryKey: ["staff", "onboarding", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}

export function useNotifyOnboardingReminder(cohortId: string | null) {
  const fn = useServerFn(staffNotifyOnboardingReminder);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentIds: string[]) => fn({ data: { cohortId: cohortId as string, studentIds } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "onboarding", cohortId] });
    },
  });
}
