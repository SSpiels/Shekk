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

/** Programme + cohort context. Not yet a switcher — see the note on StaffCohortSummary
 *  in lib/programme/logic.ts. Designed to become one without a layout change: a real
 *  switcher trigger replaces this card's content, not its position or shape. */
function WorkspaceContext() {
  const { activeWorkspace, session } = useStaffOS();
  if (!activeWorkspace) return null;

  return (
    <div className="grad-balance relative overflow-hidden rounded-2xl px-4 py-3.5 text-ink-foreground shadow-card">
      <span className="card-sheen pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative min-w-0">
        <p className="truncate text-[13.5px] font-bold leading-tight">
          {activeWorkspace.programmeName}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] opacity-75">
          {activeWorkspace.cohort
            ? `${activeWorkspace.cohort.name}${activeWorkspace.cohort.year ? ` · ${activeWorkspace.cohort.year}` : ""}`
            : "No cohort yet"}
        </p>
        {session.workspaces.length > 1 ? (
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-60">
            +{session.workspaces.length - 1} more workspace
            {session.workspaces.length > 2 ? "s" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StaffProfile() {
  const { activeWorkspace } = useStaffOS();
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
        {(activeWorkspace?.role ?? "S").slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold capitalize">
          {activeWorkspace?.role ?? "Staff"}
        </p>
        <Link to="/" className="truncate text-[11px] text-muted-foreground hover:underline">
          Back to Shekk
        </Link>
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

      <WorkspaceContext />

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
