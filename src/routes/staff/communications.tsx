/**
 * Programme OS Communications: what staff have sent the cohort and what they've asked it —
 * who a message reached, who still needs to acknowledge it, and how each poll is going.
 * Built entirely on the existing announcement/vote/audience/acknowledgement engine (see
 * lib/programme-ops.server.ts) — there is no second messaging system here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, Megaphone, Plus } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { useStaffCan, useStaffOS } from "@/components/staff/StaffSessionContext";
import { StaffAnnouncementComposer } from "@/components/staff/communications/StaffAnnouncementComposer";
import { StaffAnnouncementDrilldown } from "@/components/staff/communications/StaffAnnouncementDrilldown";
import { StaffAnnouncementList } from "@/components/staff/communications/StaffAnnouncementList";
import { StaffPollComposer } from "@/components/staff/communications/StaffPollComposer";
import { StaffPollList } from "@/components/staff/communications/StaffPollList";
import { useStaffCommunicationsOverview } from "@/lib/useStaffCommunications";
import { useStaffPolls } from "@/lib/useStaffEngagement";
import { useStaffAudienceRefs } from "@/lib/useStaffStudents";
import type { StaffAnnouncementSummary } from "@/lib/programme/logic";

export const Route = createFileRoute("/staff/communications")({
  component: CommunicationsScreen,
});

type Tab = "announcements" | "polls";

function CommunicationsScreen() {
  const { activeWorkspace } = useStaffOS();
  const can = useStaffCan();
  const cohortId = activeWorkspace?.cohort?.id ?? null;
  const canAnnounce = can("announcements");
  const canPoll = can("votes");

  const { data, isLoading, error, refetch } = useStaffCommunicationsOverview(cohortId);
  const polls = useStaffPolls(cohortId, canPoll);
  // The roster is shared with the Students page — same query key, no second round trip.
  const refs = useStaffAudienceRefs(cohortId);

  const [tab, setTab] = useState<Tab>("announcements");
  const [composerOpen, setComposerOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
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

  const pollCount = polls.data?.polls.length ?? 0;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "announcements", label: "Announcements", count: data.announcements.length },
    ...(canPoll ? [{ id: "polls" as const, label: "Polls & questions", count: pollCount }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Communications"
          className="inline-flex max-w-full rounded-xl border border-border bg-card p-1"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 ${tab === t.id ? "opacity-80" : "opacity-60"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {tab === "announcements" && canAnnounce ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="tap inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> New announcement
            </button>
          ) : null}
          {tab === "polls" && canPoll ? (
            <button
              type="button"
              onClick={() => setPollOpen(true)}
              className="tap inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> New poll
            </button>
          ) : null}
        </div>
      </div>

      {tab === "announcements" ? (
        <>
          <p className="text-[12.5px] text-muted-foreground">
            {data.announcements.length} announcement{data.announcements.length === 1 ? "" : "s"} ·{" "}
            {data.totalStudents} active student{data.totalStudents === 1 ? "" : "s"}
          </p>
          {data.announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              body="Post one and it lands in every eligible student's Programme inbox."
            />
          ) : (
            <StaffAnnouncementList
              announcements={data.announcements}
              groups={refs.groups}
              onOpen={(a) => setDrilldown(a)}
            />
          )}
        </>
      ) : polls.isLoading ? (
        <LoadingBlocks rows={2} />
      ) : polls.error ? (
        <ErrorState
          body="We couldn't load your polls. Check your connection and try again."
          onRetry={() => void polls.refetch()}
        />
      ) : pollCount === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No polls yet"
          body="Ask the cohort which tiyul to do, or send a quick yes/no. Results come in live."
        />
      ) : (
        <StaffPollList
          polls={polls.data!.polls}
          cohortId={cohortId}
          groups={refs.groups}
          canManage={canPoll}
        />
      )}

      <StaffAnnouncementComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        cohortId={cohortId}
        groups={refs.groups}
        students={refs.students}
      />

      <StaffPollComposer
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        cohortId={cohortId}
        groups={refs.groups}
        students={refs.students}
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
