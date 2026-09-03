/**
 * Search + filters row for the Students roster. Fully controlled — the
 * route owns the actual state (as URL search params) so other modules can
 * later deep-link into a filtered population; this component never holds
 * filter state itself.
 */
import { Search, X } from "lucide-react";
import type { StaffOnboardingFilter } from "@/lib/programme/logic";

export function StaffFilterBar({
  q,
  onQ,
  groupId,
  onGroupId,
  groups,
  onboarding,
  onOnboarding,
}: {
  q: string;
  onQ: (v: string) => void;
  groupId: string;
  onGroupId: (v: string) => void;
  groups: { id: string; name: string }[];
  onboarding: StaffOnboardingFilter;
  onOnboarding: (v: StaffOnboardingFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
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
        <select
          value={groupId}
          onChange={(e) => onGroupId(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
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
        className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">Any onboarding state</option>
        <option value="incomplete">Onboarding incomplete</option>
        <option value="complete">Onboarding complete</option>
      </select>
    </div>
  );
}
