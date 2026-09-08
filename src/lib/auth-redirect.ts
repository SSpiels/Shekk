/**
 * Where auth sends someone next — shared by the student /auth screen and the
 * Programme OS /staff-login screen, and exported on their own so the
 * open-redirect protection has focused tests instead of only living inside a
 * page component.
 */

/**
 * A same-origin, path-only destination, or "/" if the input can't be trusted.
 *
 * Must start with a single "/" — not "//" (protocol-relative) and not a
 * backslash variant of the same trick ("/\evil.com", "\\evil.com"), which
 * some browsers normalise to "//evil.com" and then treat as an external
 * origin. Normalising backslashes to slashes before the check (without
 * altering the value we actually return) closes that without rejecting any
 * real in-app path, which never contains a backslash.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "/";
  const normalized = value.replace(/\\/g, "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/";
  return value;
}

/** New student sessions land in the staged setup; it resumes or exits instantly if done. */
export function afterAuthPath(next: string): string {
  return next === "/" ? "/welcome" : next;
}

/** New staff sessions land in Programme OS, never the student onboarding wizard. */
export function afterStaffAuthPath(next: string): string {
  return next === "/" ? "/staff" : next;
}
