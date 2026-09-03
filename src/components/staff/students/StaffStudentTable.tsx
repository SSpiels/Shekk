/**
 * The Students roster table. Scannable, not CRM-dense: one row per student,
 * the whole row clickable (no tiny buttons), a handful of columns that
 * answer "who are they, what group, what needs attention."
 */
import { Link } from "@tanstack/react-router";
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
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary">
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
      {rest.length ? (
        <span className="ml-1 text-[11px] text-muted-foreground">+{rest.length}</span>
      ) : null}
    </span>
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
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-bold">Student</th>
            <th className="px-4 py-2.5 font-bold">Group</th>
            {showLifecycle ? <th className="px-4 py-2.5 font-bold">Status</th> : null}
            <th className="px-4 py-2.5 font-bold">Onboarding</th>
            <th className="px-4 py-2.5 font-bold">Arrival</th>
          </tr>
        </thead>
        <tbody>
          {students.map((st) => {
            const complete = onboardingComplete(st.checklist);
            return (
              <tr
                key={st.userId}
                className="border-b border-border last:border-0 hover:bg-muted/40"
              >
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
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          @{st.handle}
                        </span>
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
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
                        {st.lifecycleStatus.replace(/_/g, " ")}
                      </span>
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
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(st.arrivalDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
