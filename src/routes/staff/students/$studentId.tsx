/**
 * One student's staff-facing profile. Two tabs for V1: Overview (programme-
 * safe info that actually exists) and Onboarding (the same checklist engine
 * the dedicated Onboarding dashboard will use — this page establishes that
 * relationship rather than inventing a second onboarding model).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Users } from "lucide-react";
import { Card } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingBlocks, MicroLabel, StatusPill } from "@/components/Kit";
import { useStaffStudentProfile } from "@/lib/useStaffStudents";
import { useStaffOS } from "@/components/staff/StaffSessionContext";

export const Route = createFileRoute("/staff/students/$studentId")({
  component: StudentProfile,
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function OverviewTab({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useStaffStudentProfile>["data"]>;
}) {
  const hasTravelInfo =
    profile.homeCountry || profile.israelCity || profile.accommodationArea || profile.arrivalDate;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <MicroLabel className="text-muted-foreground">Programme</MicroLabel>
        <InfoRow label="Programme" value={profile.programmeName} />
        <InfoRow label="Cohort" value={profile.cohortName} />
        <InfoRow label="Group" value={profile.groups.map((g) => g.name).join(", ") || null} />
        <InfoRow label="Joined" value={fmtDate(profile.joinedAt)} />
      </Card>

      {hasTravelInfo ? (
        <Card className="space-y-3">
          <MicroLabel className="text-muted-foreground">Travel</MicroLabel>
          <InfoRow label="Home country" value={profile.homeCountry} />
          <InfoRow label="Israel city" value={profile.israelCity} />
          <InfoRow label="Accommodation area" value={profile.accommodationArea} />
          <InfoRow label="Arrival date" value={fmtDate(profile.arrivalDate)} />
        </Card>
      ) : (
        <Card>
          <MicroLabel className="text-muted-foreground">Travel</MicroLabel>
          <p className="mt-2 text-sm text-muted-foreground">
            No travel details yet — nothing has been filled in on their side.
          </p>
        </Card>
      )}
    </div>
  );
}

function OnboardingTab({
  profile,
}: {
  profile: NonNullable<ReturnType<typeof useStaffStudentProfile>["data"]>;
}) {
  if (!profile.checklistItems.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No checklist yet"
        body="This cohort hasn't set up a checklist."
      />
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-muted-foreground">
        {profile.checklist.requiredDone} of {profile.checklist.requiredTotal} required items done
        {profile.checklist.total > profile.checklist.requiredTotal
          ? ` · ${profile.checklist.done - profile.checklist.requiredDone} of ${profile.checklist.total - profile.checklist.requiredTotal} optional`
          : ""}
      </p>
      {profile.checklistItems.map((item) => (
        <Card key={item.id} className="flex items-start gap-3">
          {item.done ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{item.title}</p>
            {item.details ? (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{item.details}</p>
            ) : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {item.required ? "Required" : "Optional"}
              {item.dueOn ? ` · due ${fmtDate(item.dueOn)}` : ""}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StudentProfile() {
  const { studentId } = Route.useParams();
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;
  const { data: profile, isLoading, error, refetch } = useStaffStudentProfile(cohortId, studentId);
  const [tab, setTab] = useState<"overview" | "onboarding">("overview");

  return (
    <div className="space-y-5">
      <Link
        to="/staff/students"
        search={{ q: "", group: "", onboarding: "" }}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Students
      </Link>

      {isLoading ? (
        <LoadingBlocks rows={3} />
      ) : error ? (
        <ErrorState body="We couldn't load this student." onRetry={() => void refetch()} />
      ) : !profile ? (
        <EmptyState
          icon={Users}
          title="Not found in this cohort"
          body="This student doesn't belong to your active programme's cohort."
          actionLabel="Back to Students"
          actionTo="/staff/students"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
              {profile.displayName.trim().slice(0, 1).toUpperCase() || "?"}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold tracking-tight">
                {profile.displayName}
              </h2>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {profile.cohortName}
                {profile.groups.length ? ` · ${profile.groups.map((g) => g.name).join(", ")}` : ""}
              </p>
            </div>
            {profile.lifecycleStatus ? (
              <StatusPill tone="quiet" className="ml-auto capitalize">
                {profile.lifecycleStatus.replace(/_/g, " ")}
              </StatusPill>
            ) : null}
          </div>

          <div className="flex gap-1 border-b border-border">
            {(["overview", "onboarding"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold capitalize ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <OverviewTab profile={profile} />
          ) : (
            <OnboardingTab profile={profile} />
          )}
        </>
      )}
    </div>
  );
}
