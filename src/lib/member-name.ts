/**
 * Who a signed-in member is, by name.
 *
 * A member's name belongs to their ACCOUNT, so for a signed-in member it comes
 * only from the server: the display name they chose (handle), the name they gave
 * at onboarding (travel), or their verified legal name. It must never come from
 * the device — the app also keeps a local copy of the name typed during
 * onboarding, and that copy belongs to whoever last onboarded on this phone or
 * browser, not necessarily to the account that is signed in now. Reading it made
 * one member greet another by the wrong name, and "switch" accounts when a server
 * value finally arrived.
 */

/** The placeholder the server stores when a member has not chosen a name. */
export const DEFAULT_MEMBER_NAME = "Shekk member";

/** A real name, or "" for anything empty or a placeholder. */
export function usableName(value: string | null | undefined): string {
  const name = (value ?? "").replace(/\s+/g, " ").trim();
  if (!name) return "";
  if (name.toLowerCase() === DEFAULT_MEMBER_NAME.toLowerCase()) return "";
  return name;
}

export type NameSources = {
  /** The display name on the member's Shekk handle. */
  handleName?: string | null;
  /** The name the member entered during onboarding. */
  travelName?: string | null;
  /** Legal first / last name, once the member has verified. */
  legalFirst?: string | null;
  legalLast?: string | null;
};

/** The best name the account itself knows. First wins; nothing is invented. */
export function resolveMemberName(sources: NameSources): { full: string; first: string } {
  const legal = usableName([sources.legalFirst, sources.legalLast].filter(Boolean).join(" "));
  const full = usableName(sources.handleName) || usableName(sources.travelName) || legal;
  return { full, first: full.split(" ")[0] ?? "" };
}

/**
 * Whether the account signed in now is a different one from the account that last
 * used this device — in which case anything cached for the previous account must
 * be dropped before it can be shown to the new one.
 */
export function isDifferentAccount(previousUserId: string | null, nextUserId: string | null): boolean {
  return Boolean(previousUserId && nextUserId && previousUserId !== nextUserId);
}
