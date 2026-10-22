/**
 * Opens the app in the experience the member last used.
 *
 * Runs once per browser session, and only when the session's first screen is the
 * home screen (see landing-session.ts). A member who last used a programme
 * workspace (and still has access) is taken there; everyone else — new members,
 * personal-app users, anyone whose access was removed — stays on the personal home.
 * After that first open nothing moves them: if they are on the personal home later
 * in the same session, that is where they chose to be, so it is remembered.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { landedThisSession, markLanded, readHint, writeHint } from "@/lib/landing-session";
import { useWorkspace } from "@/lib/useWorkspace";
import { decideLanding, landingPath } from "@/lib/workspace";

export function useWorkspaceLanding() {
  const { signedIn, authChecked } = useApp();
  const { prefs, workspaces, loading, remember } = useWorkspace();
  const navigate = useNavigate();

  // Hold the personal home back ONLY when we already expect to leave it, so personal-app
  // members never wait on this and staff don't see the home screen flash first. (The home
  // screen shows its loading state until the app has hydrated, so reading storage here
  // cannot produce a visible mismatch.)
  const [pending, setPending] = useState(
    () => typeof window !== "undefined" && !landedThisSession() && readHint() === "staff",
  );

  useEffect(() => {
    if (!authChecked) return;
    if (!signedIn) {
      setPending(false);
      return;
    }
    if (loading) return;
    writeHint(prefs.lastExperience);

    if (!landedThisSession()) {
      markLanded();
      const landing = decideLanding(prefs, workspaces);
      if (landing.experience === "staff") {
        void navigate({ to: landingPath(landing), replace: true });
        return; // keep `pending` until the move happens, so the personal home never flashes
      }
      setPending(false);
      return;
    }
    // Not the first open: they are on the personal home on purpose — remember it.
    setPending(false);
    if (prefs.lastExperience === "staff") remember({ experience: "personal" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, signedIn, loading, prefs.lastExperience, prefs.lastProgrammeId, workspaces.length]);

  return { pending };
}
