/**
 * Programme OS: Communications data layer — the announcement list/rollup and
 * the per-announcement acknowledgement drill-down. Publishing reuses
 * staffCreateAnnouncement and announcementFields from programme-ops.functions
 * directly; there is no separate Communications write path or a second
 * announcement system.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  staffAnnouncementAcknowledgements,
  staffCommunicationsOverview,
  staffCreateAnnouncement,
  type AnnouncementFieldsInput,
} from "@/lib/programme-ops.functions";
import type {
  StaffAnnouncementAcknowledgements,
  StaffCommunicationsOverview,
} from "@/lib/programme/logic";
import { HUB_KEY } from "@/lib/useProgrammeHub";

export function useStaffCommunicationsOverview(cohortId: string | null) {
  const fn = useServerFn(staffCommunicationsOverview);
  return useQuery<StaffCommunicationsOverview>({
    queryKey: ["staff", "communications", cohortId],
    queryFn: () => fn({ data: { cohortId: cohortId as string } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}

export function useStaffAnnouncementAcknowledgements(
  cohortId: string | null,
  announcementId: string | null,
) {
  const fn = useServerFn(staffAnnouncementAcknowledgements);
  return useQuery<StaffAnnouncementAcknowledgements | null>({
    queryKey: ["staff", "communications", "ack", cohortId, announcementId],
    queryFn: () =>
      fn({ data: { cohortId: cohortId as string, announcementId: announcementId as string } }),
    enabled: Boolean(cohortId) && Boolean(announcementId),
    retry: false,
  });
}

/**
 * Publishing invalidates every surface that shows announcements: this
 * module's own list, the Overview "recent activity" preview, and the mobile
 * hub — so a student's Programme inbox picks up the new announcement without
 * a manual refresh.
 */
export function useStaffCreateAnnouncement(cohortId: string | null) {
  const fn = useServerFn(staffCreateAnnouncement);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementFieldsInput) =>
      fn({ data: { cohortId: cohortId as string, input } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", "communications", cohortId] });
      void qc.invalidateQueries({ queryKey: ["staff", "overview", cohortId] });
      void qc.invalidateQueries({ queryKey: HUB_KEY });
    },
  });
}
