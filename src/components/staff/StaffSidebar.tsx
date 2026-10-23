/**
 * Programme OS navigation for tablet and desktop. From md (768px) it is a slim icon rail
 * that gives the page almost the whole width; from lg (1024px) it opens out into the full
 * sidebar. Below md there is no sidebar at all — the bottom bar (StaffBottomNav) takes over.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { House } from "lucide-react";
import { STAFF_NAV, STAFF_SETTINGS_NAV, activeStaffNavId, type StaffNavId } from "@/lib/staff-nav";
import { WorkspaceMenu } from "@/components/workspace/WorkspaceMenu";
import { useWorkspace } from "@/lib/useWorkspace";
import { STAFF_ICONS } from "./nav-icons";
import { useStaffOS } from "./StaffSessionContext";

function NavLink({
  id,
  label,
  short,
  to,
  active,
}: {
  id: StaffNavId;
  label: string;
  short: string;
  to: string;
  active: boolean;
}) {
  const Icon = STAFF_ICONS[id];
  return (
    <Link
      to={to}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold leading-none transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm ${
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-5 shrink-0 lg:size-[18px]" strokeWidth={active ? 2.3 : 1.8} />
      <span className="max-w-full truncate lg:hidden">{short}</span>
      <span className="hidden truncate lg:inline">{label}</span>
    </Link>
  );
}

function PersonalLink() {
  const { openPersonal, switching } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => void openPersonal()}
      disabled={switching}
      title="Switch to personal Shekk"
      className="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60 lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm"
    >
      <House className="size-5 shrink-0 lg:size-[18px]" strokeWidth={1.8} />
      <span className="max-w-full truncate lg:hidden">Personal</span>
      <span className="hidden truncate lg:inline">Personal Shekk</span>
    </button>
  );
}

function StaffProfile() {
  const { activeWorkspace } = useStaffOS();
  return (
    <div className="hidden items-center gap-2.5 rounded-xl px-2 py-2 lg:flex">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
        {(activeWorkspace?.role ?? "S").slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold capitalize">{activeWorkspace?.role ?? "Staff"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{activeWorkspace?.programmeName}</p>
      </div>
    </div>
  );
}

export function StaffSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeStaffNavId(pathname);

  return (
    <aside className="sticky top-0 hidden h-screen shrink-0 flex-col gap-4 border-r border-border bg-card px-2 py-4 md:flex md:w-[84px] lg:w-64 lg:gap-5 lg:px-4 lg:py-5">
      <div className="flex items-center justify-center gap-2 px-1 lg:justify-start">
        <img
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-lg border border-border bg-white"
        />
        <div className="hidden min-w-0 lg:block">
          <p className="font-display text-[15px] font-bold leading-none">Shekk</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Programme OS
          </p>
        </div>
      </div>

      <div className="flex justify-center lg:hidden">
        <WorkspaceMenu variant="rail" />
      </div>
      <div className="hidden lg:block">
        <WorkspaceMenu variant="card" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {STAFF_NAV.map((item) => (
          <NavLink key={item.id} {...item} active={active === item.id} />
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border pt-3">
        <NavLink {...STAFF_SETTINGS_NAV} active={active === "settings"} />
        <PersonalLink />
        <StaffProfile />
      </div>
    </aside>
  );
}
