/**
 * The cohort-wide Onboarding dashboard: aggregate completion, a per-item
 * bottleneck view, and a filterable/searchable student list that answers
 * "who isn't ready and what do I need to chase" — the per-student checklist
 * detail itself already lives on the Students profile page, so clicking a
 * row here goes there rather than duplicating that view.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { StaffOnboardingStats } from "@/components/staff/onboarding/StaffOnboardingStats";
import { StaffOnboardingFilterBar } from "@/components/staff/onboarding/StaffOnboardingFilterBar";
import { StaffOnboardingTable } from "@/components/staff/onboarding/StaffOnboardingTable";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import { useNotifyOnboardingReminder, useStaffOnboardingOverview } from "@/lib/useStaffOnboarding";
import { filterOnboardingStudents, type StaffOnboardingStatusFilter } from "@/lib/programme/logic";

type OnboardingSearch = { q: string; group: string; status: StaffOnboardingStatusFilter };

const STATUS_VALUES: StaffOnboardingStatusFilter[] = [
  "not_started",
  "in_progress",
  "needs_attention",
  "complete",
];

export const Route = createFileRoute("/staff/onboarding")({
  validateSearch: (s: Record<string, unknown>): OnboardingSearch => ({
    q: typeof s.q === "string" ? s.q : "",
    group: typeof s.group === "string" ? s.group : "",
    status: STATUS_VALUES.includes(s.status as StaffOnboardingStatusFilter)
      ? (s.status as StaffOnboardingStatusFilter)
      : "",
  }),
  component: OnboardingDashboard,
});

function OnboardingDashboard() {
  const { activeWorkspace } = useStaffOS();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cohortId = activeWorkspace?.cohort?.id ?? null;

  const { data, isLoading, error, refetch } = useStaffOnboardingOverview(cohortId);
  const remind = useNotifyOnboardingReminder(cohortId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const students = useMemo(() => data?.students ?? [], [data]);

  const groups = useMemo(() => {
    const byId = new Map<string, string>();
    for (const st of students) for (const g of st.groups) byId.set(g.id, g.name);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [students]);

  const filtered = useMemo(
    () =>
      filterOnboardingStudents(students, {
        q: search.q,
        groupId: search.group,
        status: search.status,
      }),
    [students, search.q, search.group, search.status],
  );

  const setSearch = (patch: Partial<OnboardingSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const toggleSelected = (userId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const sendReminder = () => {
    const ids = [...selected];
    remind.mutate(ids, {
      onSuccess: ({ notified }) => {
        toast.success(notified === 1 ? "Reminder sent to 1 student" : `Reminder sent to ${notified} students`);
        setSelected(new Set());
      },
      onError: () => toast.error("Couldn't send the reminder — try again."),
    });
  };

  if (!cohortId) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  if (isLoading) return <LoadingBlocks rows={4} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load onboarding data. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data || data.totalStudents === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="Nobody's joined yet"
        body="Once students join with your programme's code, their onboarding progress shows up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <StaffOnboardingStats
        overallPercent={data.overallPercent}
        totalStudents={data.totalStudents}
        statusCounts={data.statusCounts}
        itemStats={data.itemStats}
        activeStatus={search.status}
        onStatusClick={(status) => setSearch({ status: search.status === status ? "" : status })}
      />

      <StaffOnboardingFilterBar
        q={search.q}
        onQ={(q) => setSearch({ q })}
        groupId={search.group}
        onGroupId={(group) => setSearch({ group })}
        groups={groups}
        status={search.status}
        onStatus={(status) => setSearch({ status })}
      />

      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary-soft px-4 py-2.5">
          <span className="text-[13px] font-semibold">
            {selected.size} student{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[12.5px] font-semibold text-muted-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={sendReminder}
              disabled={remind.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {remind.isPending ? "Sending…" : "Send reminder"}
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No students match those filters"
          body="Try clearing search or filters."
        />
      ) : (
        <>
          <p className="text-[12.5px] text-muted-foreground">
            {filtered.length} of {students.length} student{students.length === 1 ? "" : "s"}
          </p>
          <StaffOnboardingTable students={filtered} selected={selected} onToggle={toggleSelected} />
        </>
      )}
    </div>
  );
}
