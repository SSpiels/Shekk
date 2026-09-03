/**
 * Desktop-first shell for Programme OS. Deliberately not AppShell/PhoneFrame:
 * no 430px cap, no bottom tab bar, no phone-frame chrome — this is a
 * separate responsive surface over the same programme engine, not the
 * mobile app stretched wide. Sidebar from lg (1024px) up; a compact
 * horizontal nav below that, down to phone widths, so it degrades instead
 * of breaking rather than trying to be a great phone experience — the
 * existing mobile staff tools (routes/programme.staff.tsx) already own that.
 */
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { staffPageTitle } from "@/lib/staff-nav";
import { StaffMobileNav } from "./StaffMobileNav";
import { StaffSidebar } from "./StaffSidebar";

export function ProgrammeOSShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = staffPageTitle(pathname);

  return (
    <div className="min-h-screen bg-background lg:flex">
      <StaffSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffMobileNav />
        {/* Page title now; search/notifications/quick-create have an obvious home
            here later, once they're real — not stubbed in ahead of themselves. */}
        <header className="border-b border-border bg-card px-6 py-4 lg:px-10 lg:py-5">
          <h1 className="font-display text-xl font-bold tracking-tight lg:text-2xl">{title}</h1>
        </header>
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
