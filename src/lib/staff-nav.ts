/**
 * Programme OS navigation map — pure, so it can be unit tested without React,
 * mirroring lib/nav.ts's split for the student app. Icons live with the
 * sidebar component, not here.
 *
 * V1 primary nav only. Future modules (Attendance, Forms, Requests, Tasks &
 * Cases, Services, Analytics) are intentionally absent — add them here when
 * they're real, not as placeholders.
 */

export type StaffNavId =
  | "overview"
  | "students"
  | "onboarding"
  | "communications"
  | "calendar"
  | "content"
  | "team"
  | "settings";

export type StaffNavItem = { id: StaffNavId; label: string; to: string };

export const STAFF_NAV: StaffNavItem[] = [
  { id: "overview", label: "Overview", to: "/staff/overview" },
  { id: "students", label: "Students", to: "/staff/students" },
  { id: "onboarding", label: "Onboarding", to: "/staff/onboarding" },
  { id: "communications", label: "Communications", to: "/staff/communications" },
  { id: "calendar", label: "Calendar", to: "/staff/calendar" },
  { id: "content", label: "Content", to: "/staff/content" },
  { id: "team", label: "Team", to: "/staff/team" },
];

export const STAFF_SETTINGS_NAV: StaffNavItem = {
  id: "settings",
  label: "Settings",
  to: "/staff/settings",
};

const ALL_NAV: StaffNavItem[] = [...STAFF_NAV, STAFF_SETTINGS_NAV];

function clean(pathname: string): string {
  const p = pathname.replace(/\/+$/, "");
  return p || "/staff";
}

/** Which sidebar item (including Settings) should be highlighted for a path, or null. */
export function activeStaffNavId(pathname: string): StaffNavId | null {
  const path = clean(pathname);
  let best: { id: StaffNavId; len: number } | null = null;
  for (const item of ALL_NAV) {
    if (path === item.to || path.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.len) best = { id: item.id, len: item.to.length };
    }
  }
  return best?.id ?? null;
}

/** The page title for the current path, for the shell's header. */
export function staffPageTitle(pathname: string): string {
  const active = activeStaffNavId(pathname);
  return ALL_NAV.find((i) => i.id === active)?.label ?? "Programme OS";
}
