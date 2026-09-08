import { fmtDateOnly } from "@/lib/programme/logic";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Inbox, Info, LayoutDashboard, Settings2 } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { LoadingBlocks, PageHeader } from "@/components/Kit";
import { useApp } from "@/lib/store";
import { useProgrammeHub } from "@/lib/useProgrammeHub";
import { JoinPanel } from "@/components/programme/Join";
import { fmtDay } from "@/components/programme/Bits";

export const Route = createFileRoute("/programme")({
  head: () => ({
    meta: [
      { title: "Your programme · Shekk" },
      {
        name: "description",
        content:
          "Your live programme hub: what's happening now, timetable changes, announcements, staff contacts, documents and your checklist.",
      },
      { property: "og:title", content: "Your programme · Shekk" },
      {
        property: "og:description",
        content: "Join with your programme code to see today's plan, live changes and the people to call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgrammeLayout,
});

const TABS = [
  { to: "/programme", label: "Today", Icon: LayoutDashboard, exact: true },
  { to: "/programme/schedule", label: "Schedule", Icon: CalendarDays },
  { to: "/programme/inbox", label: "Updates", Icon: Inbox },
  { to: "/programme/info", label: "Info", Icon: Info },
] as const;

function ProgrammeLayout() {
  const { signedIn, authChecked } = useApp();
  const { hub, joined, isStaff, loading, unread } = useProgrammeHub();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!authChecked) {
    return (
      <AppShell>
        <LoadingBlocks rows={3} />
      </AppShell>
    );
  }

  if (!signedIn) {
    return (
      <AppShell>
        <PageHeader title="Programme" subtitle="Join with your programme code and everything lands in one place." />
        <div className="px-4 pt-4">
          <Card className="space-y-3">
            <p className="text-sm font-semibold">Sign in to join your programme</p>
            <p className="text-xs text-muted-foreground">
              Your membership lives on your Shekk account, so it follows you between devices.
            </p>
            <Link
              to="/auth"
              search={{ next: "/programme" }}
              className="tap block w-full rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Programme" />
        <LoadingBlocks rows={3} />
      </AppShell>
    );
  }

  if (!joined) {
    return (
      <AppShell>
        <PageHeader
          title="Programme"
          subtitle="Your timetable, announcements and the people to call — in one place."
        />
        <div className="pt-4">
          <JoinPanel />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 pt-4">
        <div className="grad-balance relative overflow-hidden rounded-[1.5rem] px-5 py-5 text-ink-foreground shadow-lift">
          <span className="card-sheen pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            {hub.isTest ? (
              <p className="mb-1.5 inline-block rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                Test sandbox
              </p>
            ) : null}
            <p className="font-display text-xl font-bold leading-tight">{hub.programmeName}</p>
            <p className="mt-0.5 text-sm opacity-80">
              {hub.cohortName}
              {hub.year ? ` · ${hub.year}` : ""}
            </p>
            {hub.startsOn ? (
              <p className="mt-2 text-[11px] opacity-70">
                {fmtDateOnly(hub.startsOn)}
                {hub.endsOn ? ` – ${fmtDateOnly(hub.endsOn)}` : ""}
                {hub.city ? ` · ${hub.city}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="scrollbar-none sticky top-[60px] z-30 mt-4 flex gap-1.5 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur lg:top-0">
        {TABS.map(({ to, label, Icon, ...rest }) => {
          const active = "exact" in rest ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`tap-flat flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold ${
                active ? "bg-ink text-ink-foreground" : "border border-border bg-card text-muted-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              {to === "/programme/inbox" && unread.length > 0 ? (
                <span className="ml-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {unread.length}
                </span>
              ) : null}
            </Link>
          );
        })}
        {isStaff ? (
          <Link
            to="/programme/staff"
            className={`tap-flat flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold ${
              pathname.startsWith("/programme/staff")
                ? "bg-primary text-primary-foreground"
                : "border border-primary/40 bg-primary-soft text-primary"
            }`}
          >
            <Settings2 className="size-3.5" /> Staff
          </Link>
        ) : null}
      </nav>

      <Outlet />
    </AppShell>
  );
}
