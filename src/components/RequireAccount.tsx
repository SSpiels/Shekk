/**
 * The front door.
 *
 * Shekk is a regulated money account, not a browsable site: nothing behind the
 * door is visible until someone has an account. This wraps the whole app and
 * sends anyone without a session to sign up, keeping only the handful of
 * routes that must work signed-out — auth, password reset, and the terms —
 * open.
 */

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useApp } from "@/lib/store";
import { Splash } from "@/components/Splash";

/** Routes a signed-out visitor is allowed to reach. */
const OPEN_PREFIXES = [
  "/auth",
  "/staff-login",
  "/reset-password",
  "/terms",
  "/welcome",
  "/admin",
  "/api",
  "/sitemap.xml",
];

function isOpen(pathname: string) {
  return OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function RequireAccount({ children }: { children: ReactNode }) {
  const { signedIn, authChecked } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const open = isOpen(pathname);
  const locked = authChecked && !signedIn && !open;

  useEffect(() => {
    if (!locked) return;
    void navigate({
      to: "/auth",
      search: { next: pathname },
      replace: true,
    });
  }, [locked, navigate, pathname]);

  // Hold the door shut while we check, so no signed-out flash of the app.
  if (!open && (!authChecked || !signedIn)) {
    return <Splash message={authChecked ? "Taking you to sign in…" : "Getting your Israel setup…"} />;
  }

  return <>{children}</>;
}
