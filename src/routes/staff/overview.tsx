/**
 * The staff landing page: a glance at cohort health with shortcuts into
 * Students/Onboarding, plus a light preview of what's coming up and what's
 * recently gone out - not a second Calendar/Communications, just enough to
 * know whether to go check those.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckSquare, LayoutDashboard, Megaphone, Users } from "lucide-react";
import { Card } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlocks, MicroLabel, ProgressBar } from "@/components/Kit";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import { useStaffOverview } from "@/lib/useStaffOverview";

function fmtEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const Route = createFileRoute("/staff/overview")({
  component: StaffOverview,
});

function StaffOverview() {
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;
  const { data, isLoading, error, refetch } = useStaffOverview(cohortId);

  if (!cohortId) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  if (isLoading) return <LoadingBlocks rows={4} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load your overview. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return null;

  const { onboarding, upcomingEvents, recentAnnouncements } = data;
  const needsAttention = onboarding.statusCounts.needs_attention;

  return (
    <div className="space-y-4">
      <div>
        <MicroLabel className="text-muted-foreground">{activeWorkspace?.programmeName}</MicroLabel>
        <h2 className="font-display text-xl font-bold tracking-tight">
          {activeWorkspace?.cohort?.name}
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link to="/staff/students" search={{ q: "", group: "", onboarding: "" }} className="block">
          <Card className="space-y-2 p-4">
            <Users className="size-5 text-primary" />
            <p className="font-display text-2xl font-bold tracking-tight">
              {onboarding.totalStudents}
            </p>
            <p className="text-[12.5px] text-muted-foreground">Active students</p>
          </Card>
        </Link>
        <Link
          to="/staff/onboarding"
          search={{ q: "", group: "", status: "" }}
          className="block"
        >
          <Card className="space-y-2 p-4">
            <CheckSquare className="size-5 text-primary" />
            <p className="font-display text-2xl font-bold tracking-tight">
              {onboarding.overallPercent}%
            </p>
            <p className="text-[12.5px] text-muted-foreground">Onboarding complete</p>
          </Card>
        </Link>
        <Link
          to="/staff/onboarding"
          search={{ q: "", group: "", status: needsAttention > 0 ? "needs_attention" : "" }}
          className="block"
        >
          <Card className="space-y-2 p-4">
            <CheckSquare className="size-5 text-warning" />
            <p className="font-display text-2xl font-bold tracking-tight">{needsAttention}</p>
            <p className="text-[12.5px] text-muted-foreground">Need attention</p>
            <ProgressBar
              value={onboarding.totalStudents ? needsAttention / onboarding.totalStudents : 0}
              tone="primary"
            />
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="space-y-2.5">
          <div className="flex items-center justify-between">
            <MicroLabel className="text-muted-foreground">Today's programme</MicroLabel>
            <Link to="/staff/calendar" className="text-[12px] font-semibold text-primary">
              View all
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">{ev.title}</span>
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted-foreground">
                    {fmtEventDate(ev.startsAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-2.5">
          <div className="flex items-center justify-between">
            <MicroLabel className="text-muted-foreground">Recent activity</MicroLabel>
            <Link to="/staff/communications" className="text-[12px] font-semibold text-primary">
              View all
            </Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <div className="space-y-2">
              {recentAnnouncements.map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <Megaphone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</span>
                  <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted-foreground">
                    {fmtDate(a.publishedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
