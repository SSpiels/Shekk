/**
 * The staff landing page: a glance at cohort health with shortcuts into
 * Students/Onboarding, plus a light preview of what's coming up and what's
 * recently gone out - not a second Calendar/Communications, just enough to
 * know whether to go check those. On a phone it leads with the everyday actions.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckSquare, Clock, LayoutDashboard, Megaphone, MapPin, UserCog, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlocks, MicroLabel, ProgressBar, StatusPill } from "@/components/Kit";
import { StaffQuickCreate } from "@/components/staff/StaffQuickCreate";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import { useStaffOverview } from "@/lib/useStaffOverview";
import { fmtIsraelDay, fmtIsraelTime, STATUS_LABEL, statusTone } from "@/lib/programme/logic";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const Route = createFileRoute("/staff/overview")({
  component: StaffOverview,
});

function Panel({
  title,
  to,
  children,
}: {
  title: string;
  to?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel className="text-muted-foreground">{title}</MicroLabel>
        {to ? (
          <Link to={to} className="shrink-0 text-[12px] font-semibold text-primary">
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function Stat({
  icon,
  value,
  label,
  children,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  children?: ReactNode;
}) {
  return (
    <Card className="h-full space-y-1.5 p-3 md:space-y-2 md:p-4">
      {icon}
      <p className="font-display text-xl font-bold tracking-tight md:text-2xl">{value}</p>
      <p className="text-[11.5px] leading-snug text-muted-foreground md:text-[12.5px]">{label}</p>
      {children}
    </Card>
  );
}

function StaffOverview() {
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;
  const programmeId = activeWorkspace?.programmeId ?? null;
  const { data, isLoading, error, refetch } = useStaffOverview(cohortId, programmeId);

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

  const { onboarding, upcomingEvents, recentAnnouncements, recentChanges, team } = data;
  const needsAttention = onboarding.statusCounts.needs_attention;
  const cohort = activeWorkspace?.cohort;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Tablet and desktop already name the cohort in the header and sidebar. */}
      {cohort ? (
        <p className="-mt-2 text-[13px] text-muted-foreground md:hidden">
          {cohort.name}
          {cohort.year ? ` · ${cohort.year}` : ""}
        </p>
      ) : null}

      <div className="md:hidden">
        <StaffQuickCreate variant="tiles" />
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Link to="/staff/students" search={{ q: "", group: "", onboarding: "" }} className="block">
          <Stat icon={<Users className="size-5 text-primary" />} value={onboarding.totalStudents} label="Active students" />
        </Link>
        <Link to="/staff/onboarding" search={{ q: "", group: "", status: "" }} className="block">
          <Stat
            icon={<CheckSquare className="size-5 text-primary" />}
            value={`${onboarding.overallPercent}%`}
            label="Onboarding complete"
          />
        </Link>
        <Link
          to="/staff/onboarding"
          search={{ q: "", group: "", status: needsAttention > 0 ? "needs_attention" : "" }}
          className="block"
        >
          <Stat icon={<CheckSquare className="size-5 text-warning" />} value={needsAttention} label="Need attention">
            <ProgressBar
              value={onboarding.totalStudents ? needsAttention / onboarding.totalStudents : 0}
              tone="primary"
            />
          </Stat>
        </Link>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel title="Coming up" to="/staff/calendar">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="w-[4.25rem] shrink-0 text-[12px] leading-tight">
                      <p className="font-bold">{fmtIsraelTime(ev.startsAt)}</p>
                      <p className="text-muted-foreground">{fmtIsraelDay(ev.startsAt)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                        <span className={ev.status === "cancelled" ? "line-through" : ""}>{ev.title}</span>
                        {ev.status !== "scheduled" ? (
                          <StatusPill tone={statusTone(ev.status)}>{STATUS_LABEL[ev.status]}</StatusPill>
                        ) : null}
                      </p>
                      {ev.locationLabel ? (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-muted-foreground">
                          <MapPin className="size-3 shrink-0" /> {ev.locationLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-5">
          <Panel title="Recent announcements" to="/staff/communications">
            {recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              <div className="space-y-2.5">
                {recentAnnouncements.map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    <Megaphone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-sm font-semibold">{a.title}</span>
                    <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted-foreground">
                      {fmtDate(a.publishedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent changes" to="/staff/calendar">
            {recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing&apos;s changed recently.</p>
            ) : (
              <div className="space-y-2.5">
                {recentChanges.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-sm">
                      <span className="font-semibold">{c.eventTitle}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {c.field === "status" ? "status" : c.field.replace(/_/g, " ")}
                        {c.notifyLevel === "urgent" ? " (urgent)" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[11.5px] text-muted-foreground">
                      {fmtDate(c.changedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {team ? (
            <Link to="/staff/team" className="block">
              <Card className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <MicroLabel className="text-muted-foreground">Team</MicroLabel>
                  <span className="text-[12px] font-semibold text-primary">View all</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <UserCog className="size-5 text-primary" />
                  <p className="text-sm">
                    <span className="font-semibold">
                      {team.memberCount} {team.memberCount === 1 ? "person" : "people"}
                    </span>
                    <span className="text-muted-foreground"> with access</span>
                  </p>
                </div>
                {team.canManage && team.pendingInvites > 0 ? (
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-warning">
                    <Clock className="size-3.5" />
                    {team.pendingInvites} pending invite{team.pendingInvites === 1 ? "" : "s"}
                  </p>
                ) : null}
              </Card>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
