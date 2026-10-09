import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  BarChart3,
  Boxes,
  Coins,
  Crown,
  GraduationCap,
  LayoutGrid,
  MapPin,
  Megaphone,
  Settings2,
  Signal,
  Ticket,
  Users,
} from "lucide-react";
import { useAdminSession } from "@/lib/admin-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Shekk" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", Icon: BarChart3, exact: true },
  { to: "/admin/money", label: "Money flow", Icon: Coins },
  { to: "/admin/accounts", label: "Accounts", Icon: Users },
  { to: "/admin/memberships", label: "Memberships", Icon: Crown },
  { to: "/admin/programmes", label: "Programmes", Icon: GraduationCap },
  { to: "/admin/apps", label: "Apps & services", Icon: LayoutGrid },
  { to: "/admin/sim", label: "SIM & eSIM", Icon: Signal },
  { to: "/admin/places", label: "Places & venues", Icon: MapPin },
  { to: "/admin/events", label: "Events & tickets", Icon: Ticket },
  { to: "/admin/promotions", label: "Promotions", Icon: Megaphone },
  { to: "/admin/controls", label: "Controls", Icon: Settings2 },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <ConsoleAccess>
    <div className="flex min-h-screen bg-ink/[0.04]">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-ink px-3 py-6 text-ink-foreground md:flex">
        <div className="mb-5 px-3">
          <p className="font-display text-lg font-bold leading-tight">Shekk Console</p>
          <p className="text-[11px] uppercase tracking-widest opacity-50">Internal only</p>
        </div>
        {NAV.map(({ to, label, Icon, ...rest }) => {
          const active = "exact" in rest && rest.exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-ink-foreground/15 text-ink-foreground" : "text-ink-foreground/60 hover:bg-ink-foreground/10"
              }`}
            >
              <Icon className="size-4.5 shrink-0" />
              {label}
            </Link>
          );
        })}
        <div className="mt-auto space-y-1 px-1 pt-6">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-foreground/60 hover:bg-ink-foreground/10"
          >
            <Boxes className="size-4.5" /> Back to app
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-ink px-3 py-2 text-ink-foreground md:hidden">
          <Link
            to="/"
            className="sticky left-0 whitespace-nowrap rounded-full bg-ink-foreground px-3 py-1.5 text-xs font-bold text-ink"
          >
            ← Back to app
          </Link>
          {NAV.map(({ to, label, ...rest }) => {
            const active = "exact" in rest && rest.exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-ink-foreground/20" : "text-ink-foreground/60"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
    </ConsoleAccess>
  );
}

/**
 * Access is decided by the server: a signed-in account holding the "admin"
 * role (checked again inside every console server function). Anyone else is
 * sent to sign in, or shown an ordinary 404 so the console isn't advertised.
 */
function ConsoleAccess({ children }: { children: React.ReactNode }) {
  const { data, isLoading, error } = useAdminSession();

  if (isLoading) return <div className="min-h-screen bg-background" aria-busy />;
  if (error || !data) return <Navigate to="/auth" search={{ next: "/admin" }} replace />;
  if (!data.isAdmin) return <NotFoundScreen />;
  return (
    <>
      <ConsoleTitle />
      {children}
    </>
  );
}

/** The tab title names the console only once access is confirmed. */
function ConsoleTitle() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Shekk Console";
    return () => {
      document.title = previous;
    };
  }, []);
  return null;
}

function NotFoundScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
