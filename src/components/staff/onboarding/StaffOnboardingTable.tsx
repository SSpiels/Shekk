/**
 * The Onboarding roster. Same shape as the Students roster plus two things that page doesn't
 * need: a status pill tuned for "what needs chasing" and a selection checkbox for the bulk
 * reminder action. A table from tablet up, tappable cards on a phone.
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ProgressBar, StatusPill } from "@/components/Kit";
import type { OnboardingStatus, StaffOnboardingStudent } from "@/lib/programme/logic";

const STATUS_TONE: Record<OnboardingStatus, "live" | "pending" | "preview" | "attention" | "quiet"> = {
  complete: "live",
  in_progress: "pending",
  needs_attention: "attention",
  not_started: "quiet",
};

const STATUS_LABEL: Record<OnboardingStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_attention: "Needs attention",
  complete: "Complete",
};

function StudentAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-bold text-primary md:size-9 md:text-[13px]">
      {initial}
    </span>
  );
}

function missingOf(items: StaffOnboardingStudent["checklistItems"]) {
  return items.filter((i) => i.required && !i.done);
}

function MissingCell({ items }: { items: StaffOnboardingStudent["checklistItems"] }) {
  const missing = missingOf(items);
  if (!missing.length) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = missing;
  return (
    <span className="text-[12.5px]">
      {first.title}
      {rest.length ? <span className="ml-1 text-[11px] text-muted-foreground">+{rest.length} more</span> : null}
    </span>
  );
}

export function StaffOnboardingTable({
  students,
  selected,
  onToggle,
}: {
  students: StaffOnboardingStudent[];
  selected: Set<string>;
  onToggle: (userId: string) => void;
}) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {students.map((st) => {
          const missing = missingOf(st.checklistItems);
          const isSelected = selected.has(st.userId);
          return (
            <div
              key={st.userId}
              className={`flex items-stretch rounded-2xl border bg-card shadow-card ${
                isSelected ? "border-primary" : "border-border"
              }`}
            >
              <label className="flex w-11 shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(st.userId)}
                  aria-label={`Select ${st.displayName}`}
                  className="size-4"
                />
              </label>
              <Link
                to="/staff/students/$studentId"
                params={{ studentId: st.userId }}
                className="tap-flat flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-3.5"
              >
                <StudentAvatar name={st.displayName} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{st.displayName}</span>
                    <StatusPill tone={STATUS_TONE[st.status]} className="shrink-0 !px-2 !py-0.5 !text-[10px]">
                      {STATUS_LABEL[st.status]}
                    </StatusPill>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <ProgressBar
                      value={st.checklist.percent / 100}
                      tone={st.status === "complete" ? "success" : "primary"}
                      className="flex-1"
                    />
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                      {st.checklist.requiredDone}/{st.checklist.requiredTotal || st.checklist.total}
                    </span>
                  </span>
                  {missing.length > 0 ? (
                    <span className="mt-1 block truncate text-[12px] text-muted-foreground">
                      Missing: {missing[0].title}
                      {missing.length > 1 ? ` +${missing.length - 1} more` : ""}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2.5" />
              <th className="px-4 py-2.5 font-bold">Student</th>
              <th className="px-4 py-2.5 font-bold">Status</th>
              <th className="px-4 py-2.5 font-bold">Onboarding</th>
              <th className="hidden px-4 py-2.5 font-bold lg:table-cell">Missing</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.userId} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(st.userId)}
                    onChange={() => onToggle(st.userId)}
                    aria-label={`Select ${st.displayName}`}
                  />
                </td>
                <td className="p-0">
                  <Link
                    to="/staff/students/$studentId"
                    params={{ studentId: st.userId }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <StudentAvatar name={st.displayName} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{st.displayName}</span>
                      {st.handle ? (
                        <span className="block truncate text-[11.5px] text-muted-foreground">@{st.handle}</span>
                      ) : null}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusPill tone={STATUS_TONE[st.status]}>{STATUS_LABEL[st.status]}</StatusPill>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={st.checklist.percent / 100}
                      tone={st.status === "complete" ? "success" : "primary"}
                      className="w-20"
                    />
                    <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
                      {st.checklist.requiredDone}/{st.checklist.requiredTotal || st.checklist.total}
                    </span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <MissingCell items={st.checklistItems} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
