/**
 * Cohort-wide onboarding health: overall completion, a status breakdown
 * (clickable — sets the status filter, which is how "Needs attention" as a
 * dedicated view is implemented, rather than a second page), and per-item
 * completion so staff can see which checklist item is the actual bottleneck.
 */
import { Card } from "@/components/AppShell";
import { MicroLabel, ProgressBar } from "@/components/Kit";
import type { OnboardingItemStat, OnboardingStatus } from "@/lib/programme/logic";

const STATUS_LABEL: Record<OnboardingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_attention: "Needs attention",
  complete: "Complete",
};

const STATUS_ORDER: OnboardingStatus[] = ["needs_attention", "in_progress", "not_started", "complete"];

export function StaffOnboardingStats({
  overallPercent,
  totalStudents,
  statusCounts,
  itemStats,
  activeStatus,
  onStatusClick,
}: {
  overallPercent: number;
  totalStudents: number;
  statusCounts: Record<OnboardingStatus, number>;
  itemStats: OnboardingItemStat[];
  activeStatus: OnboardingStatus | "";
  onStatusClick: (status: OnboardingStatus) => void;
}) {
  const sortedItems = [...itemStats].sort((a, b) => a.percent - b.percent);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <MicroLabel className="text-muted-foreground">Cohort onboarding</MicroLabel>
          <span className="font-display text-2xl font-bold tracking-tight">{overallPercent}%</span>
        </div>
        <ProgressBar value={overallPercent / 100} tone={overallPercent === 100 ? "success" : "primary"} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {STATUS_ORDER.map((status) => {
            const active = activeStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusClick(status)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {STATUS_LABEL[status]} · {statusCounts[status]}
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-muted-foreground">{totalStudents} active students</p>
      </Card>

      <Card className="space-y-2.5">
        <MicroLabel className="text-muted-foreground">By checklist item</MicroLabel>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">This cohort hasn't set up a checklist.</p>
        ) : (
          <div className="space-y-2">
            {sortedItems.map((item) => (
              <div key={item.itemId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {item.title}
                  {item.required ? null : <span className="text-muted-foreground"> (optional)</span>}
                </span>
                <ProgressBar
                  value={item.percent / 100}
                  tone={item.percent === 100 ? "success" : "primary"}
                  className="w-20"
                />
                <span className="w-10 shrink-0 text-right text-[11.5px] text-muted-foreground">
                  {item.percent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
