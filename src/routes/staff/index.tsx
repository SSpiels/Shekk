/**
 * Programme OS placeholder — Phase 2 scope is the gate, not the product.
 * The real desktop shell (sidebar, Overview, etc.) lands in Phase 3; this
 * just proves an authorised staff member reaches somewhere real, and shows
 * what resolveStaffSession actually resolved for them.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Card } from "@/components/AppShell";
import { MicroLabel } from "@/components/Kit";
import { useStaffSession } from "@/lib/useProgrammeHub";

export const Route = createFileRoute("/staff/")({
  component: StaffPlaceholder,
});

function StaffPlaceholder() {
  const { session } = useStaffSession();
  const active =
    session.workspaces.find((w) => w.programmeId === session.activeProgrammeId) ?? null;

  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <MicroLabel className="text-muted-foreground">Programme OS</MicroLabel>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
        {active ? active.programmeName : "Welcome"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The desktop console lands here in the next phase. For now, this confirms your programme
        staff access resolved correctly.
      </p>

      {active ? (
        <Card className="mt-6 space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{active.programmeName}</p>
          </div>
          {active.organisation ? (
            <p className="text-xs text-muted-foreground">{active.organisation}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Role: {active.role}
            {active.cohort
              ? ` · ${active.cohort.name}${active.cohort.year ? ` · ${active.cohort.year}` : ""}`
              : ""}
          </p>
        </Card>
      ) : null}

      {session.workspaces.length > 1 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          You have staff access to {session.workspaces.length} programmes. A workspace switcher
          isn&rsquo;t built yet — you&rsquo;re seeing {active?.programmeName ?? "one"} for now.
        </p>
      ) : null}
    </div>
  );
}
