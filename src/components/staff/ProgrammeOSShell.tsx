/**
 * Responsive shell for Programme OS — deliberately not AppShell/PhoneFrame. It is one
 * surface for staff on every device, laid out for each rather than stretched:
 *
 *  - phone (< 768px): slim top bar, bottom tab bar, a floating "+" for the everyday tasks;
 *  - tablet (768–1023px): an icon rail and a header with the "+ New" menu;
 *  - desktop (1024px+): the full sidebar, with the content given the rest of the width.
 */
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { activeStaffNavId, staffPageTitle } from "@/lib/staff-nav";
import { StaffBottomNav, StaffTopBar } from "./StaffMobileChrome";
import { StaffQuickCreate } from "./StaffQuickCreate";
import { StaffSidebar } from "./StaffSidebar";
import { useStaffOS } from "./StaffSessionContext";

export function ProgrammeOSShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = staffPageTitle(pathname);
  const { activeWorkspace } = useStaffOS();
  const cohort = activeWorkspace?.cohort;

  return (
    <div className="os-root min-h-screen bg-background md:flex">
      <StaffSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopBar />
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-border bg-card/95 px-6 py-3.5 backdrop-blur md:flex lg:px-10 lg:py-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight lg:text-2xl">{title}</h1>
            {activeWorkspace ? (
              <p className="truncate text-[12px] text-muted-foreground lg:hidden">
                {activeWorkspace.programmeName}
                {cohort ? ` · ${cohort.name}${cohort.year ? ` ${cohort.year}` : ""}` : ""}
              </p>
            ) : null}
          </div>
          <StaffQuickCreate variant="button" />
        </header>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-8 md:pt-6 lg:px-10 lg:py-8">
          <h1 className="mb-4 font-display text-2xl font-bold tracking-tight md:hidden">{title}</h1>
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
      <StaffBottomNav />
      {/* The Overview already leads with the same actions as big tiles. */}
      {activeStaffNavId(pathname) !== "overview" ? (
        <div className="md:hidden">
          <StaffQuickCreate variant="fab" />
        </div>
      ) : null}
    </div>
  );
}
