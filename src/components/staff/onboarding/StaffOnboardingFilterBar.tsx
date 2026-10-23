/**
 * Search + group + status filters for the Onboarding roster. Fully
 * controlled by the route (URL search params), same convention as
 * StaffFilterBar on the Students page.
 */
import { Search, X } from "lucide-react";
import type { StaffOnboardingStatusFilter } from "@/lib/programme/logic";

export function StaffOnboardingFilterBar({
  q,
  onQ,
  groupId,
  onGroupId,
  groups,
  status,
  onStatus,
}: {
  q: string;
  onQ: (v: string) => void;
  groupId: string;
  onGroupId: (v: string) => void;
  groups: { id: string; name: string }[];
  status: StaffOnboardingStatusFilter;
  onStatus: (v: StaffOnboardingStatusFilter) => void;
}) {
  const select = "min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm md:py-2";
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
      <label className="col-span-2 flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm md:min-w-[220px] md:flex-1 md:py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Search students…"
          className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        {q ? (
          <button
            type="button"
            onClick={() => onQ("")}
            aria-label="Clear search"
            className="shrink-0 text-muted-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </label>

      {groups.length > 0 ? (
        <select value={groupId} onChange={(e) => onGroupId(e.target.value)} className={select}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      ) : null}

      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as StaffOnboardingStatusFilter)}
        className={`${select} ${groups.length === 0 ? "col-span-2" : ""}`}
      >
        <option value="">Any status</option>
        <option value="not_started">Not started</option>
        <option value="in_progress">In progress</option>
        <option value="needs_attention">Needs attention</option>
        <option value="complete">Complete</option>
      </select>
    </div>
  );
}
