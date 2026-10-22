import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { STAFF_NAV, STAFF_SETTINGS_NAV, activeStaffNavId, type StaffNavId } from "@/lib/staff-nav";
import { WorkspaceMenu } from "@/components/workspace/WorkspaceMenu";
import { useWorkspace } from "@/lib/useWorkspace";
import { useStaffOS } from "./StaffSessionContext";

/* Icons live here, not in the pure lib/staff-nav.ts — same split as
   lib/nav.ts (pure) vs AppShell.tsx's TABS array (React + icons). */
const ICONS: Record<StaffNavId, LucideIcon> = {
  overview: LayoutDashboard,
  students: Users,
  onboarding: CheckSquare,
  communications: Megaphone,
  calendar: CalendarDays,
  content: FileText,
  team: UserCog,
  settings: Settings,
};

function NavLink({
  id,
  label,
  to,
  active,
}: {
  id: StaffNavId;
  label: string;
  to: string;
  active: boolean;
}) {
  const Icon = ICONS[id];
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.8} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function StaffProfile() {
  const { activeWorkspace } = useStaffOS();
  const { openPersonal, switching } = useWorkspace();
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
        {(activeWorkspace?.role ?? "S").slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold capitalize">
          {activeWorkspace?.role ?? "Staff"}
        </p>
        <button
          type="button"
          onClick={() => void openPersonal()}
          disabled={switching}
          className="truncate text-left text-[11px] text-muted-foreground hover:underline disabled:opacity-60"
        >
          Switch to personal Shekk
        </button>
      </div>
    </div>
  );
}

export function StaffSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeStaffNavId(pathname);

  return (
    <aside className="hidden shrink-0 flex-col gap-5 border-r border-border bg-card px-4 py-5 lg:flex lg:w-64">
      <div className="flex items-center gap-2 px-1">
        <img
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-lg border border-border bg-white"
        />
        <div className="min-w-0">
          <p className="font-display text-[15px] font-bold leading-none">Shekk</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Programme OS
          </p>
        </div>
      </div>

      <WorkspaceMenu variant="card" />

      <nav className="flex flex-1 flex-col gap-0.5">
        {STAFF_NAV.map((item) => (
          <NavLink key={item.id} {...item} active={active === item.id} />
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border pt-3">
        <NavLink {...STAFF_SETTINGS_NAV} active={active === "settings"} />
        <StaffProfile />
      </div>
    </aside>
  );
}
