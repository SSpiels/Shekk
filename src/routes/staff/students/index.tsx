/**
 * The Students roster. Filters live in the URL (q/group/onboarding search
 * params), not local component state — so Onboarding/Communications/Overview
 * can later deep-link straight into a filtered population, e.g.
 * /staff/students?onboarding=incomplete.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { StaffFilterBar } from "@/components/staff/students/StaffFilterBar";
import { StaffStudentTable } from "@/components/staff/students/StaffStudentTable";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import { useStaffStudentRoster } from "@/lib/useStaffStudents";
import { filterStaffStudents, type StaffOnboardingFilter } from "@/lib/programme/logic";

type StudentsSearch = { q: string; group: string; onboarding: StaffOnboardingFilter };

export const Route = createFileRoute("/staff/students/")({
  validateSearch: (s: Record<string, unknown>): StudentsSearch => ({
    q: typeof s.q === "string" ? s.q : "",
    group: typeof s.group === "string" ? s.group : "",
    onboarding: s.onboarding === "complete" || s.onboarding === "incomplete" ? s.onboarding : "",
  }),
  component: StudentsRoster,
});

function StudentsRoster() {
  const { activeWorkspace } = useStaffOS();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cohortId = activeWorkspace?.cohort?.id ?? null;

  const { data, isLoading, error, refetch } = useStaffStudentRoster(cohortId);
  const students = useMemo(() => data ?? [], [data]);

  const groups = useMemo(() => {
    const byId = new Map<string, string>();
    for (const st of students) for (const g of st.groups) byId.set(g.id, g.name);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [students]);

  const showLifecycle = students.some((st) => st.lifecycleStatus !== null);

  const filtered = useMemo(
    () =>
      filterStaffStudents(students, {
        q: search.q,
        groupId: search.group,
        onboarding: search.onboarding,
      }),
    [students, search.q, search.group, search.onboarding],
  );

  const setSearch = (patch: Partial<StudentsSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  if (!cohortId) {
    return (
      <EmptyState
        icon={Users}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  return (
    <div className="space-y-4">
      <StaffFilterBar
        q={search.q}
        onQ={(q) => setSearch({ q })}
        groupId={search.group}
        onGroupId={(group) => setSearch({ group })}
        groups={groups}
        onboarding={search.onboarding}
        onOnboarding={(onboarding) => setSearch({ onboarding })}
      />

      {isLoading ? (
        <LoadingBlocks rows={4} />
      ) : error ? (
        <ErrorState
          body="We couldn't load your students. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody's joined yet"
          body="Once students join with your programme's code, they'll show up here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students match those filters"
          body="Try clearing search or filters."
        />
      ) : (
        <>
          <p className="text-[12.5px] text-muted-foreground">
            {filtered.length} of {students.length} student{students.length === 1 ? "" : "s"}
          </p>
          <StaffStudentTable students={filtered} showLifecycle={showLifecycle} />
        </>
      )}
    </div>
  );
}
