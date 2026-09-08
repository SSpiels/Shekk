import { Link, useRouterState, useRouter, useCanGoBack, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Compass, Tag, Users, User, ChevronLeft, Info, Menu, X, Settings, LifeBuoy, Home, ShieldCheck, PlaneTakeoff, PartyPopper, GraduationCap } from "lucide-react";
import { useApp } from "@/lib/store";
import { ils } from "@/lib/mock";
import { refIn } from "@/lib/currencies";
import { MembershipDunningBanner } from "@/components/MembershipDunningBanner";
import { useUnreadChats } from "@/lib/useSocial";
import { MiniAppSplash } from "@/components/MiniAppSplash";
import { miniAppFor } from "@/lib/mini-apps";
import { activeTabFor, keepsChrome, TAB_EXPLORE, TAB_PROGRAMME, TAB_TODAY, TAB_WHATS_ON, TAB_YOU } from "@/lib/nav";
import { MONEY_ENABLED } from "@/lib/flags";



/**
 * Five tabs for the launch product: getting set up, what's on, and living here.
 * Money is intentionally not a tab or a link — the regulated work is paused, so
 * /money stays reachable by URL only. Services is two tools plus links, so it
 * lives on Home, Explore and the quick menu rather than holding a tab.
 */
const TABS = [
  { to: TAB_TODAY, label: "Today", Icon: Home },
  { to: TAB_PROGRAMME, label: "Programme", Icon: GraduationCap },
  { to: TAB_WHATS_ON, label: "What's on", Icon: PartyPopper },
  { to: TAB_EXPLORE, label: "Explore", Icon: Compass },
  { to: TAB_YOU, label: "You", Icon: User },
];

const SIDEBAR_TABS = TABS;




export function PhoneFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`flex min-h-screen justify-center bg-ink/95 px-0 py-0 sm:px-4 sm:py-8 ${
        wide ? "lg:min-h-0 lg:bg-background lg:px-0 lg:py-0" : ""
      }`}
    >
      <div
        className={`relative flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-background shadow-lift sm:min-h-[860px] sm:rounded-[2.5rem] sm:border-8 sm:border-ink ${
          wide ? "lg:min-h-[75vh] lg:max-w-none lg:rounded-none lg:border-0 lg:shadow-none" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Full-page flows (top-up, terms, re-verify) that sit outside the tab shell.
 * Mobile keeps the phone frame; desktop gets a centered card on the app canvas.
 */
export function FocusScreen({
  children,
  /** Sign-in and other pre-account screens have no app navigation yet. */
  nav = true,
}: {
  children: ReactNode;
  nav?: boolean;
}) {
  return (
    <div className="flex min-h-screen justify-center bg-ink/95 px-0 py-0 sm:px-4 sm:py-8 lg:bg-ink/[0.03] lg:px-8 lg:py-12">
      <div className="relative flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-background shadow-lift sm:min-h-[860px] sm:rounded-[2.5rem] sm:border-8 sm:border-ink lg:min-h-0 lg:max-w-2xl lg:rounded-3xl lg:border lg:border-border lg:shadow-card">
        <div className={`flex-1 ${nav ? "pb-28 lg:pb-6" : "pb-6"}`}>{children}</div>
        {nav ? (
          <>
            <QuickMenu />
            <MobileNav />
          </>
        ) : null}

      </div>
    </div>
  );
}

/** Highlighted notice / key-info block — deliberately off-palette so it stands out. */
export function Notice({
  children,
  title,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-notice-border bg-notice-soft px-4 py-3 text-notice-foreground ${className}`}
    >
      {title ? (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
          <Info className="size-3.5" /> {title}
        </p>
      ) : null}
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}

/**
 * Bottom tab bar, shared by every screen (mobile). Tabs render left-to-right in
 * the same order as TAB_ORDER in nav.ts: Today, Programme, What's on, Explore, You.
 */
export function MobileNav() {
  const isActive = useActive();

  return (
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-card lg:hidden">
      <nav className="flex items-end justify-between px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map(({ to, label, Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`tap-flat flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="size-6" strokeWidth={active ? 2.6 : 1.8} />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}


/** Top-right quick menu (mobile): Israel setup, Services, Community, Benefits, Settings, Help. */
export function QuickMenu() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadChats();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <div className="pointer-events-none fixed left-1/2 top-0 z-50 w-full max-w-[430px] -translate-x-1/2">
        <button
          type="button"
          aria-label={open ? "Close quick menu" : "Open quick menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="tap pointer-events-auto absolute right-3 top-3 rounded-full border border-border bg-card p-2.5 text-foreground shadow-card"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>


      {open ? (
        <>
          <button
            type="button"
            aria-label="Close quick menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="fixed left-1/2 top-16 z-50 ml-[-15px] w-60 max-w-[calc(100vw-1.5rem)] translate-x-[calc(215px-100%)] overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
            <Link to="/before-you-fly" className="tap-flat flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold text-primary">
              <PlaneTakeoff className="size-4" /> Israel setup
            </Link>
            <Link to="/services" className="tap-flat flex items-center gap-2 px-4 py-3 text-sm font-semibold">
              <ShieldCheck className="size-4 text-muted-foreground" /> Services
            </Link>
            <Link to="/social" className="tap-flat flex items-center gap-2 px-4 py-3 text-sm font-semibold">
              <Users className="size-4 text-muted-foreground" /> Community
              {unread > 0 ? (
                <span
                  aria-label={`${unread > 9 ? "More than 9" : unread} unread message${unread === 1 ? "" : "s"}`}
                  className="ml-auto min-w-5 rounded-full bg-destructive px-1.5 text-center text-[11px] font-bold leading-5 text-white"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <Link to="/benefits" className="tap-flat flex items-center gap-2 px-4 py-3 text-sm font-semibold">
              <Tag className="size-4 text-muted-foreground" /> Benefits
            </Link>
            <Link to="/settings" className="tap-flat flex items-center gap-2 px-4 py-3 text-sm font-semibold">
              <Settings className="size-4 text-muted-foreground" /> Settings
            </Link>
            <Link to="/help" className="tap-flat flex items-center gap-2 border-t border-border px-4 py-3 text-sm font-semibold">
              <LifeBuoy className="size-4 text-muted-foreground" /> Help
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tab = activeTabFor(pathname);
  return (to: string) => tab === to;
}


/**
 * The one balance figure in the navigation. Kept for the preserved wallet
 * screens; it is no longer part of the launch navigation.
 */
export function BalanceMini({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { state } = useApp();
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest opacity-60">Your shekels</p>
      <p className={`font-display font-bold leading-tight ${size === "lg" ? "text-2xl" : "text-xl"}`}>
        {ils(state.balance)}
      </p>
      <p className="text-[11px] opacity-60">≈ {refIn(state.settings.payCurrency, state.balance)}</p>
    </>
  );
}

/** Desktop sidebar footer: the two things everyone has to buy before flying. */
function NavBalance({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/services"
      onClick={onNavigate}
      className="tap mt-auto block rounded-2xl bg-ink px-4 py-4 text-ink-foreground"
    >
      <p className="text-[10px] uppercase tracking-widest opacity-60">Sort before you fly</p>
      <p className="mt-1 font-display text-lg font-bold leading-tight">Services</p>
      <p className="mt-1 text-[11px] opacity-70">An eSIM or Israeli number, and travel and medical cover.</p>
      <span className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wide">Open services →</span>
    </Link>
  );
}


/**
 * The Explore tab's home. The path is /israel for published-URL reasons; every
 * user-facing string for it says "Explore", so referring to it by name here
 * keeps the intent readable wherever we fall back to it.
 */
export const EXPLORE_HOME = "/israel";

/** Lets a ScreenHeader tell its AppShell that a back control already exists. */
const HeaderRegistry = createContext<((v: boolean) => void) | null>(null);

/** Floating back control for standalone screens that render no header of their own. */
function FloatingBack() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-label="Back to Shekk"
      onClick={() => (canGoBack ? router.history.back() : navigate({ to: "/" }))}
      className="tap fixed left-4 top-3 z-40 rounded-full bg-card/85 p-2 text-foreground shadow-card ring-1 ring-border backdrop-blur lg:absolute"
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const isActive = useActive();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  /* Tab roots get the Shekk chrome. Anything deeper is a mini app or info page:
     no tab bar, no Shekk quick menu — it runs as its own little app. */
  const isTabRoot = keepsChrome(pathname);
  const mini = isTabRoot ? null : miniAppFor(pathname);
  const standalone = !isTabRoot;
  const [hasHeader, setHasHeader] = useState(false);

  useEffect(() => {
    setHasHeader(false);
  }, [pathname]);


  return (
    <div className="lg:flex lg:min-h-screen lg:bg-ink/[0.03]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-r lg:border-border lg:bg-card lg:px-4 lg:py-8">
        <div className="mb-4 flex items-center gap-2 px-3">
          <img src="/logo.png" alt="Shekk logo" width={32} height={32} className="size-8 rounded-lg border border-border bg-white" />
          <p className="font-display text-xl font-bold">Shekk</p>
        </div>

        {SIDEBAR_TABS.map(({ to, label, Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`tap-flat flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 1.8} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <NavBalance />
      </aside>

      <div className="lg:flex lg:min-w-0 lg:flex-1 lg:justify-center lg:px-8 lg:py-8">
        <div className="lg:w-full lg:max-w-3xl lg:overflow-hidden lg:rounded-3xl lg:border lg:border-border lg:bg-background lg:shadow-card">
          <PhoneFrame wide>
            {standalone ? null : (
              <>
                <QuickMenu />
                <MobileNav />
              </>
            )}

            <div className={`flex-1 lg:pb-6 ${standalone ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : "pb-28"}`}>
              {standalone ? null : <MembershipDunningBanner />}
              {standalone && !hasHeader ? (
                <>
                  <div className="h-11 lg:h-4" aria-hidden />
                  <FloatingBack />
                </>
              ) : null}
              <HeaderRegistry.Provider value={setHasHeader}>{children}</HeaderRegistry.Provider>
            </div>


            {mini ? <MiniAppSplash key={mini.id} app={mini} /> : null}
          </PhoneFrame>

        </div>
      </div>
    </div>
  );
}



export function ScreenHeader({
  title,
  subtitle,
  back = EXPLORE_HOME,
  onBack,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  /* Inside a mini app there is no Shekk banner at all — the app owns its whole
     screen and gets one small floating back button, like a real app. */
  const inMiniApp = !keepsChrome(pathname) && miniAppFor(pathname) !== null;
  const register = useContext(HeaderRegistry);

  useEffect(() => {
    register?.(true);
    return () => register?.(false);
  }, [register]);



  const goBack = () => {
    if (onBack) { onBack(); return; }
    if (canGoBack) router.history.back();
    else navigate({ to: back });
  };

  if (inMiniApp) {
    return (
      <>
        <div className="h-11 lg:h-4" aria-hidden />
        <button
          type="button"
          aria-label="Back to Shekk"
          onClick={goBack}
          className="tap fixed left-4 top-3 z-40 rounded-full bg-card/85 p-2 text-foreground shadow-card ring-1 ring-border backdrop-blur lg:absolute"
        >
          <ChevronLeft className="size-5" />
        </button>
      </>
    );
  }

  return (
    <>
      {/* spacer keeps content clear of the fixed header on mobile */}
      <div className="h-[60px] lg:hidden" aria-hidden />
      <header className="fixed left-1/2 top-0 z-40 flex w-full max-w-[430px] -translate-x-1/2 items-center gap-3 border-b border-border bg-card px-4 py-3 pr-16 lg:sticky lg:left-auto lg:max-w-none lg:translate-x-0 lg:pr-4">
        <button
          type="button"
          aria-label="Go back"
          onClick={goBack}
          className="tap shrink-0 rounded-full bg-muted p-2 text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </header>
    </>
  );

}


export function ReverifyBanner() {
  const { daysLeft } = useApp();
  if (!MONEY_ENABLED || daysLeft === null) return null;
  return (
    <Link
      to="/reverify"
      className="tap mx-4 mb-3 flex items-center justify-between gap-3 rounded-2xl border border-notice-border bg-notice-soft px-4 py-3 text-notice-foreground"
    >
      <div>
        <p className="text-sm font-semibold">{daysLeft} days left to re-verify</p>
        <p className="text-xs opacity-80">A quick annual ID check keeps your money available.</p>
      </div>
      <span className="rounded-full bg-notice-foreground px-3 py-1.5 text-xs font-semibold text-notice-soft">
        Re-verify
      </span>
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 shadow-card ${className}`}>{children}</div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`tap w-full rounded-2xl bg-primary px-5 py-4 text-base font-semibold text-primary-foreground disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
