/**
 * Programme OS on a phone: a slim top bar (which workspace am I in, and a way back to my
 * personal Shekk) and a bottom tab bar carrying the four things staff reach for on the move,
 * with everything else behind "More". Hidden from md (768px), where the rail takes over.
 */
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Ellipsis, House } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceMenu } from "@/components/workspace/WorkspaceMenu";
import { activeStaffNavId, staffMoreNav, staffPrimaryNav } from "@/lib/staff-nav";
import { useWorkspace } from "@/lib/useWorkspace";
import { STAFF_ICONS } from "./nav-icons";

export function StaffTopBar() {
  const { openPersonal, switching } = useWorkspace();
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-2 backdrop-blur md:hidden">
      <WorkspaceMenu variant="pill" />
      <button
        type="button"
        onClick={() => void openPersonal()}
        disabled={switching}
        aria-label="Switch to personal Shekk"
        className="tap ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12.5px] font-bold text-muted-foreground disabled:opacity-60"
      >
        <House className="size-3.5" /> Personal
      </button>
    </div>
  );
}

export function StaffBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeStaffNavId(pathname);
  const primary = staffPrimaryNav();
  const more = staffMoreNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const { openPersonal, switching } = useWorkspace();

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = more.some((i) => i.id === active);
  const tab = (isActive: boolean) =>
    `tap-flat flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${
      isActive ? "text-primary" : "text-muted-foreground"
    }`;

  return (
    <>
      <nav
        aria-label="Programme OS"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-xl items-stretch px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
          {primary.map((item) => {
            const Icon = STAFF_ICONS[item.id];
            const isActive = active === item.id;
            return (
              <Link key={item.id} to={item.to} aria-current={isActive ? "page" : undefined} className={tab(isActive)}>
                <Icon className="size-6" strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{item.short}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={tab(moreActive)}>
            <Ellipsis className="size-6" strokeWidth={moreActive ? 2.5 : 1.8} />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5">
            {more.map((item) => {
              const Icon = STAFF_ICONS[item.id];
              const isActive = active === item.id;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`tap flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold ${
                    isActive
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <Icon className="size-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void openPersonal()}
            disabled={switching}
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-muted px-4 py-3.5 text-sm font-semibold disabled:opacity-60"
          >
            <House className="size-4" /> Switch to personal Shekk
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
