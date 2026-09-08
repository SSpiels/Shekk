/**
 * Programme OS: staff landing-page data. Just composes staffOverview's
 * result - onboarding stats are the same shape useStaffOnboardingOverview
 * returns under `.onboarding`, so both pages stay visibly in sync.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { staffOverview } from "@/lib/programme-ops.functions";
import type {
  StaffOnboardingOverview,
  StaffOverviewAnnouncement,
  StaffOverviewChange,
  StaffOverviewEvent,
  StaffOverviewTeam,
} from "@/lib/programme/logic";

export function useStaffOverview(cohortId: string | null, programmeId: string | null) {
  const fn = useServerFn(staffOverview);
  return useQuery<{
    onboarding: StaffOnboardingOverview;
    upcomingEvents: StaffOverviewEvent[];
    recentAnnouncements: StaffOverviewAnnouncement[];
    recentChanges: StaffOverviewChange[];
    team: StaffOverviewTeam | null;
  }>({
    queryKey: ["staff", "overview", cohortId],
    queryFn: () =>
      fn({ data: { cohortId: cohortId as string, ...(programmeId ? { programmeId } : {}) } }),
    enabled: Boolean(cohortId),
    staleTime: 20_000,
    retry: false,
  });
}
