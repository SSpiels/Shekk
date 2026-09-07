/**
 * Programme OS Communications: the announcement history staff already
 * create on mobile, presented for the office — who a message reached, and
 * who still needs to acknowledge it. Built entirely on the existing
 * announcement/audience/acknowledgement engine (see lib/programme-ops.server
 * .ts's staffCommunicationsOverview/staffAnnouncementAcknowledgements) —
 * there is no second announcement system here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import { StaffAnnouncementComposer } from "@/components/staff/communications/StaffAnnouncementComposer";
import { StaffAnnouncementDrilldown } from "@/components/staff/communications/StaffAnnouncementDrilldown";
import { StaffAnnouncementList } from "@/components/staff/communications/StaffAnnouncementList";
import { useStaffCommunicationsOverview } from "@/lib/useStaffCommunications";
import { useStaffStudentRoster } from "@/lib/useStaffStudents";
import type { StaffAnnouncementSummary } from "@/lib/programme/logic";

export const Route = createFileRoute("/staff/communications")({
  component: CommunicationsScreen,
});

function CommunicationsScreen() {
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;

  const { data, isLoading, error, refetch } = useStaffCommunicationsOverview(cohortId);
  // Roster is already fetched by the Students page too — same query key, so
  // this doesn't cost a second round trip once either page has loaded.
  const roster = useStaffStudentRoster(cohortId);
  const students = useMemo(() => roster.data ?? [], [roster.data]);

  const groups = useMemo(() => {
    const byId = new Map<string, string>();
    for (const st of students) for (const g of st.groups) byId.set(g.id, g.name);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [students]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [drilldown, setDrilldown] = useState<StaffAnnouncementSummary | null>(null);

  if (!cohortId) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  if (isLoading) return <LoadingBlocks rows={4} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load Communications. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">
          {data.announcements.length} announcement{data.announcements.length === 1 ? "" : "s"} ·{" "}
          {data.totalStudents} active student{data.totalStudents === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> New announcement
        </button>
      </div>

      {data.announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          body="Post one above and it lands in every eligible student's Programme inbox."
        />
      ) : (
        <StaffAnnouncementList
          announcements={data.announcements}
          groups={groups}
          onOpen={(a) => setDrilldown(a)}
        />
      )}

      <StaffAnnouncementComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        cohortId={cohortId}
        groups={groups}
        students={students.map((st) => ({
          userId: st.userId,
          displayName: st.displayName,
          handle: st.handle,
        }))}
      />

      <StaffAnnouncementDrilldown
        open={drilldown !== null}
        onClose={() => setDrilldown(null)}
        cohortId={cohortId}
        announcementId={drilldown?.id ?? null}
        announcementTitle={drilldown?.title ?? ""}
      />
    </div>
  );
}
