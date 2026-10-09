/**
 * Phone push — pieces shared by the browser, the service worker contract and
 * the server. Nothing in here touches the network or the database.
 */

export type PushCategory = "announcements" | "schedule" | "chat" | "reminders";

export const PUSH_CATEGORIES: { id: PushCategory; label: string; hint: string }[] = [
  { id: "announcements", label: "Announcements", hint: "Updates and requests from your programme team" },
  { id: "schedule", label: "Schedule", hint: "Changes to events, and a nudge before they start" },
  { id: "chat", label: "Messages", hint: "New messages and friend requests" },
  { id: "reminders", label: "Reminders", hint: "Outstanding checklist and onboarding items" },
];

export type PushPrefs = Record<PushCategory, boolean>;

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  announcements: true,
  schedule: true,
  chat: true,
  reminders: true,
};

/** What the service worker receives and shows. Keep it small: push payloads are capped at ~4KB. */
export type PushPayload = {
  title: string;
  body?: string;
  /** In-app path to open when the notification is tapped. */
  url?: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
};

/** Where a tap should land, and which switch controls it, for programme notifications. */
export function programmeSubject(subjectType: "event" | "announcement" | "vote"): {
  category: PushCategory;
  url: string;
} {
  switch (subjectType) {
    case "event":
      return { category: "schedule", url: "/programme/schedule" };
    case "announcement":
      return { category: "announcements", url: "/programme/inbox" };
    case "vote":
      return { category: "announcements", url: "/programme" };
  }
}

/** Members without a prefs row get everything on; a row can only switch categories off. */
export function usersWantingCategory(
  userIds: string[],
  prefRows: Array<Partial<PushPrefs> & { user_id: string }>,
  category: PushCategory,
): string[] {
  const off = new Set(prefRows.filter((r) => r[category] === false).map((r) => r.user_id));
  return userIds.filter((id) => !off.has(id));
}

/** Trim to something that fits a lock screen without cutting a word in half. */
export function clip(text: string | null | undefined, max = 110): string | undefined {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Only same-origin paths are ever put in a payload; anything else falls back to the home screen. */
export function safeUrl(url: string | undefined): string {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}
