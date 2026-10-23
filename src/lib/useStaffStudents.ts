/**
 * Programme OS: Students data layer. Kept separate from useProgrammeHub.ts —
 * that file is the mobile/participant hub; this is Programme-OS-only and
 * expected to grow as Onboarding/Communications/etc. need student data too.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { staffStudentProfile, staffStudentRoster } from "@/lib/programme-ops.functions";
import type { StaffStudentProfile, StaffStudentSummary } from "@/lib/programme/logic";

export function useStaffStudentRoster(cohortId: string | null) {
  const fn = useServerFn(staffStudentRoster);
  return useQuery<StaffStudentSummary[]>({
    queryKey: ["staff", "students", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}

/**
 * The groups and students a composer needs to target an audience. Shares the roster query
 * with the Students page, so it costs nothing extra once either has loaded.
 */
export function useStaffAudienceRefs(cohortId: string | null) {
  const roster = useStaffStudentRoster(cohortId);
  return useMemo(() => {
    const students = roster.data ?? [];
    const byId = new Map<string, string>();
    for (const st of students) for (const g of st.groups) byId.set(g.id, g.name);
    return {
      groups: [...byId.entries()].map(([id, name]) => ({ id, name })),
      students: students.map((st) => ({
        userId: st.userId,
        displayName: st.displayName,
        handle: st.handle,
      })),
      ready: !roster.isLoading,
    };
  }, [roster.data, roster.isLoading]);
}

export function useStaffStudentProfile(cohortId: string | null, studentId: string | null) {
  const fn = useServerFn(staffStudentProfile);
  return useQuery<StaffStudentProfile | null>({
    queryKey: ["staff", "students", cohortId, studentId],
    queryFn: () => fn({ data: { cohortId: cohortId as string, studentId: studentId as string } }),
    enabled: Boolean(cohortId && studentId),
    staleTime: 20_000,
    retry: false,
  });
}
