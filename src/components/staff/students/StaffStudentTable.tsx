/**
 * The Students roster. On a phone it is a list of tappable cards (a table cannot be read at
 * 390px); from tablet up it is a scannable table. Either way: one row per student, the whole
 * row clickable, and just enough to answer "who are they, what group, what needs attention."
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ProgressBar } from "@/components/Kit";
import { onboardingComplete, type StaffStudentSummary } from "@/lib/programme/logic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StudentAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-bold text-primary md:size-9 md:text-[13px]">
      {initial}
    </span>
  );
}

function GroupsCell({ groups }: { groups: StaffStudentSummary["groups"] }) {
  if (!groups.length) return <span className="text-muted-foreground">No group</span>;
  const [first, ...rest] = groups;
  return (
    <span>
      {first.name}
      {rest.length ? <span className="ml-1 text-[11px] text-muted-foreground">+{rest.length}</span> : null}
    </span>
  );
}

function LifecycleChip({ status }: { status: string }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold capitalize">
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StudentCard({ st, showLifecycle }: { st: StaffStudentSummary; showLifecycle: boolean }) {
  const complete = onboardingComplete(st.checklist);
  return (
    <Link
      to="/staff/students/$studentId"
      params={{ studentId: st.userId }}
      className="tap-flat flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card"
    >
      <StudentAvatar name={st.displayName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate font-semibold">{st.displayName}</span>
          {showLifecycle && st.lifecycleStatus ? <LifecycleChip status={st.lifecycleStatus} /> : null}
        </span>
        <span className="block truncate text-[12px] text-muted-foreground">
          {st.handle ? `@${st.handle} · ` : ""}
          {st.groups.length ? st.groups.map((g) => g.name).join(", ") : "No group"}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <ProgressBar
            value={st.checklist.percent / 100}
            tone={complete ? "success" : "primary"}
            className="flex-1"
          />
          <span className="shrink-0 text-[11.5px] text-muted-foreground">
            {complete ? "Onboarded" : `${st.checklist.requiredDone}/${st.checklist.requiredTotal || st.checklist.total}`}
          </span>
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function StaffStudentTable({
  students,
  showLifecycle,
}: {
  students: StaffStudentSummary[];
  /** Only rendered when at least one row actually has a lifecycle status — see students.index.tsx. */
  showLifecycle: boolean;
}) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {students.map((st) => (
          <StudentCard key={st.userId} st={st} showLifecycle={showLifecycle} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-bold">Student</th>
              <th className="px-4 py-2.5 font-bold">Group</th>
              {showLifecycle ? <th className="px-4 py-2.5 font-bold">Status</th> : null}
              <th className="px-4 py-2.5 font-bold">Onboarding</th>
              <th className="hidden px-4 py-2.5 font-bold lg:table-cell">Arrival</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const complete = onboardingComplete(st.checklist);
              return (
                <tr key={st.userId} className="border-b border-border last:border-0 hover:bg-muted/40">
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
                    <GroupsCell groups={st.groups} />
                  </td>
                  {showLifecycle ? (
                    <td className="px-4 py-3">
                      {st.lifecycleStatus ? (
                        <LifecycleChip status={st.lifecycleStatus} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={st.checklist.percent / 100}
                        tone={complete ? "success" : "primary"}
                        className="w-20"
                      />
                      <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
                        {st.checklist.requiredDone}/{st.checklist.requiredTotal || st.checklist.total}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{fmtDate(st.arrivalDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
