/**
 * Server-side master switch for money. Server only.
 *
 * Money is paused. The client flag (VITE_MONEY_ENABLED) only hides screens, so
 * every server function that can move or request money checks this first and
 * refuses while it is off. It defaults to OFF: money only runs when
 * MONEY_ENABLED is set to exactly "true" in the server environment.
 *
 * This is one of three independent switches that must all be on to relaunch
 * money; the others are the client flag and the database flag
 * (app_flags 'money'), which the ledger functions themselves enforce.
 */

export const MONEY_DISABLED_MESSAGE = "Payments aren't available yet";

export function moneyEnabledOnServer(): boolean {
  return process.env.MONEY_ENABLED === "true";
}

export function assertMoneyEnabled(): void {
  if (!moneyEnabledOnServer()) throw new Error(MONEY_DISABLED_MESSAGE);
}
