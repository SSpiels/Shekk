/**
 * Session-scoped bookkeeping for "open in the experience you last used".
 *
 * Imported by the root layout so it runs when the app starts. The rule is: the app
 * opens in the last-used experience only when the FIRST screen of a session is the
 * home screen. If someone opens a deep link (a programme page, a join link, the
 * staff portal itself) the opening is already decided, so it counts as "landed"
 * straight away and a later tap on Home goes to the personal home as asked.
 */

import type { Experience } from "@/lib/workspace";

const LANDED_KEY = "shekk.landed.v1";
/** A device-side hint of the last experience, only so the home screen can avoid a flash. Keyed to the account. */
const HINT_KEY = "shekk.experience.v1";
const LAST_USER_KEY = "shekk.lastUser.v1";

/** Set for one screen: "your access changed" after a removed workspace sent someone back to personal. */
export const NOTICE_KEY = "shekk.notice.v1";

export function landedThisSession(): boolean {
  try {
    return sessionStorage.getItem(LANDED_KEY) === "1";
  } catch {
    return true; // storage blocked: never redirect repeatedly
  }
}

export function markLanded() {
  try {
    sessionStorage.setItem(LANDED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readHint(): Experience | null {
  try {
    const raw = localStorage.getItem(HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { u?: string; e?: string };
    // Only trust a hint written for the account that is signed in now.
    if (!parsed.u || parsed.u !== localStorage.getItem(LAST_USER_KEY)) return null;
    return parsed.e === "staff" ? "staff" : "personal";
  } catch {
    return null;
  }
}

export function writeHint(experience: Experience) {
  try {
    const u = localStorage.getItem(LAST_USER_KEY);
    if (u) localStorage.setItem(HINT_KEY, JSON.stringify({ u, e: experience }));
  } catch {
    /* ignore */
  }
}

export function setNotice(message: string) {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    /* ignore */
  }
}

/** Read the one-time notice and clear it. */
export function takeNotice(): string | null {
  try {
    const v = sessionStorage.getItem(NOTICE_KEY);
    if (v) sessionStorage.removeItem(NOTICE_KEY);
    return v;
  } catch {
    return null;
  }
}

// A session that opens anywhere other than the home screen has already chosen where to be.
if (typeof window !== "undefined" && window.location.pathname !== "/") markLanded();
