/**
 * Programme OS: Content data layer — checklist configuration, documents,
 * contacts and places, plus the cohort welcome message. Writes reuse
 * staffUpsertContent/staffDeleteContent/staffSeedChecklist from
 * programme-ops.functions.ts as-is (the same server functions the mobile
 * staff ContentEditor already calls) — there is no second content system
 * here, desktop or otherwise.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffContentOverview,
  staffDeleteContent,
  staffSeedChecklist,
  staffUpdateProgrammeInfo,
  staffUpsertContent,
  type ContentUpsertInput,
} from "@/lib/programme-ops.functions";
import type { StaffContentOverview } from "@/lib/programme/logic";
import { HUB_KEY } from "@/lib/useProgrammeHub";

export function useStaffContentOverview(cohortId: string | null) {
  const fn = useServerFn(staffContentOverview);
  return useQuery<StaffContentOverview>({
    queryKey: ["staff", "content", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}

/** Invalidates Content itself, Onboarding (checklist items feed its stats)
 *  and Overview's "today" preview, plus the mobile hub / student Info tab. */
function useInvalidateContent(cohortId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["staff", "content", cohortId] });
    void qc.invalidateQueries({ queryKey: ["staff", "onboarding", cohortId] });
    void qc.invalidateQueries({ queryKey: ["staff", "overview", cohortId] });
    void qc.invalidateQueries({ queryKey: HUB_KEY });
  };
}

export function useStaffUpdateProgrammeInfo(cohortId: string | null) {
  const fn = useServerFn(staffUpdateProgrammeInfo);
  const invalidate = useInvalidateContent(cohortId);
  return useMutation({
    mutationFn: (welcomeMessage: string | null) =>
      fn({ data: { cohortId: cohortId as string, welcomeMessage } }),
    onSuccess: invalidate,
  });
}

export function useStaffUpsertContent(cohortId: string | null) {
  const fn = useServerFn(staffUpsertContent);
  const invalidate = useInvalidateContent(cohortId);
  return useMutation({
    mutationFn: (input: ContentUpsertInput) => fn({ data: input }),
    onSuccess: invalidate,
  });
}

export function useStaffDeleteContent(cohortId: string | null) {
  const fn = useServerFn(staffDeleteContent);
  const invalidate = useInvalidateContent(cohortId);
  return useMutation({
    mutationFn: (data: { kind: "checklist_item" | "document" | "contact" | "place"; id: string }) =>
      fn({ data: { ...data, cohortId: cohortId as string } }),
    onSuccess: invalidate,
  });
}

export function useStaffSeedChecklist(cohortId: string | null) {
  const fn = useServerFn(staffSeedChecklist);
  const invalidate = useInvalidateContent(cohortId);
  return useMutation({
    mutationFn: () => fn({ data: { cohortId: cohortId as string } }),
    onSuccess: invalidate,
  });
}
