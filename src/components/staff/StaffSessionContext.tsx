/**
 * Programme OS's staff/programme/cohort context — resolved once, at the
 * shell/layout level (see routes/staff/route.tsx), and read from here by
 * every child page. No page under /staff should call useStaffSession()
 * itself or independently decide "my programme" / "the current cohort" —
 * that defeats the point of resolving it in one place (see the note on
 * StaffCohortSummary in lib/programme/logic.ts for why that matters).
 */
import { createContext, useContext, type ReactNode } from "react";
import { staffCan, type StaffPermission, type StaffSession, type StaffWorkspace } from "@/lib/programme/logic";

type StaffOSContextValue = {
  session: StaffSession;
  /** The workspace session.activeProgrammeId points at — null only when workspaces is empty, which never happens past the /staff gate. */
  activeWorkspace: StaffWorkspace | null;
};

const StaffOSContext = createContext<StaffOSContextValue | null>(null);

export function StaffOSProvider({
  session,
  children,
}: {
  session: StaffSession;
  children: ReactNode;
}) {
  const activeWorkspace =
    session.workspaces.find((w) => w.programmeId === session.activeProgrammeId) ?? null;
  return (
    <StaffOSContext.Provider value={{ session, activeWorkspace }}>
      {children}
    </StaffOSContext.Provider>
  );
}

export function useStaffOS(): StaffOSContextValue {
  const ctx = useContext(StaffOSContext);
  if (!ctx) throw new Error("useStaffOS must be used inside StaffOSProvider (i.e. under /staff)");
  return ctx;
}

/**
 * Whether the active workspace's role allows an action — the same rule the server applies.
 * This only decides which controls to show; the server is what actually enforces it.
 */
export function useStaffCan(): (perm: StaffPermission) => boolean {
  const { activeWorkspace } = useStaffOS();
  return (perm) =>
    activeWorkspace
      ? staffCan(
          {
            programmeId: activeWorkspace.programmeId,
            cohortId: activeWorkspace.cohort?.id ?? null,
            role: activeWorkspace.role,
            permissions: activeWorkspace.permissions,
          },
          perm,
        )
      : false;
}
