/**
 * Shekk Location Platform — the cost guard. Server only.
 *
 * Google Maps Platform is a metered, paid service, so nothing in Shekk may reach
 * it without passing through here first. Three layers, outermost first:
 *
 *  1. Google's own console quotas (set by hand — the hard outer wall).
 *  2. The master switch below: `GOOGLE_PLACES_ENABLED` must be exactly "true".
 *     It is off by default, so a deploy can never switch Google on by accident.
 *  3. Per-day budgets in the database (`api_budget_take`): one pool shared by
 *     every member, and one per member. Each is set below the matching console
 *     quota so this layer trips first.
 *
 * Everything fails CLOSED: if the switch is off, the budget is spent, the budget
 * function is missing, or the database errors, the call is refused and Google is
 * never contacted.
 */

export const PLACES_SWITCH = "GOOGLE_PLACES_ENABLED";

export function placesSwitchOn(): boolean {
  return process.env[PLACES_SWITCH] === "true";
}

/** One bucket per billable Google operation, so a busy one cannot starve another. */
export type Bucket = "nearby" | "text" | "details" | "photos" | "routes" | "maploads";

/**
 * Daily limits. `global` is deliberately below the console quota for the same
 * operation (text/nearby/details 30, photos 25, routes 100, map loads 150) and
 * the monthly total stays under Google's free allowance for the SKU.
 */
export const BUDGETS: Record<Bucket, { global: number; user: number }> = {
  nearby: { global: 25, user: 10 },
  text: { global: 25, user: 10 },
  details: { global: 25, user: 12 },
  photos: { global: 20, user: 8 },
  routes: { global: 90, user: 30 },
  maploads: { global: 120, user: 20 },
};

export const PLACES_MESSAGES = {
  off: "Places isn't switched on yet.",
  global: "Places has reached its limit for today and resets tomorrow.",
  user: "You've reached today's limit for places lookups. It resets tomorrow.",
  paused: "Places is paused right now. Please try again later.",
} as const;

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Take `cost` units from a bucket for this member, or throw. Call it
 * immediately before the paid request — inside any request de-duplication, so
 * identical concurrent requests are charged once.
 */
export async function takeBudget(bucket: Bucket, userId: string, cost = 1): Promise<void> {
  if (!placesSwitchOn()) throw new Error(PLACES_MESSAGES.off);

  const limits = BUDGETS[bucket];
  let result: unknown;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as RpcClient).rpc("api_budget_take", {
      p_bucket: bucket,
      p_user: userId,
      p_cost: cost,
      p_global_limit: limits.global,
      p_user_limit: limits.user,
    });
    if (error) throw new Error(error.message);
    result = data;
  } catch (e) {
    console.error(`[places] budget check failed for "${bucket}" — refusing the call:`, e);
    throw new Error(PLACES_MESSAGES.paused);
  }

  if (result === "ok") return;
  if (result === "global") throw new Error(PLACES_MESSAGES.global);
  if (result === "user") throw new Error(PLACES_MESSAGES.user);
  console.error(`[places] unexpected budget result for "${bucket}":`, result);
  throw new Error(PLACES_MESSAGES.paused);
}
