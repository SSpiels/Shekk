/**
 * "I work for a programme", ticked at sign-up.
 *
 * It is only a hint. It is held on the device until the new account has a
 * session (which may be after an email confirmation), then saved to the account so
 * the invite-code entry is shown. It never grants anything: staff access comes only
 * from a programme invitation.
 */

const KEY = "shekk.pendingStaffIntent.v1";

export function setPendingStaffIntent() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable: the choice simply isn't remembered */
  }
}

export function clearPendingStaffIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** True once, then cleared. */
export function takePendingStaffIntent(): boolean {
  try {
    const pending = localStorage.getItem(KEY) === "1";
    if (pending) localStorage.removeItem(KEY);
    return pending;
  } catch {
    return false;
  }
}
