/**
 * Search + filters row for the Students roster. Fully controlled — the
 * route owns the actual state (as URL search params) so other modules can
 * later deep-link into a filtered population; this component never holds
 * filter state itself.
 */
import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import type { StaffOnboardingFilter } from "@/lib/programme/logic";

export function StaffFilterBar({
  q,
  onQ,
  groupId,
  onGroupId,
  groups,
  onboarding,
  onOnboarding,
  actions,
}: {
  q: string;
  onQ: (v: string) => void;
  groupId: string;
  onGroupId: (v: string) => void;
  groups: { id: string; name: string }[];
  onboarding: StaffOnboardingFilter;
  onOnboarding: (v: StaffOnboardingFilter) => void;
  /** Page-level buttons that sit at the end of the row (e.g. Manage groups). */
  actions?: ReactNode;
}) {
  const select =
    "min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm md:py-2";
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
        value={onboarding}
        onChange={(e) => onOnboarding(e.target.value as StaffOnboardingFilter)}
        className={`${select} ${groups.length === 0 ? "col-span-2" : ""}`}
      >
        <option value="">Any onboarding</option>
        <option value="incomplete">Incomplete</option>
        <option value="complete">Complete</option>
      </select>

      {actions}
    </div>
  );
}
