/**
 * Guards for the server functions that anyone can call without signing in.
 * Server only.
 *
 * Every server function is a public HTTP endpoint, and a few are deliberately
 * open (weather, place names, the join-code preview, the eSIM finder). Left
 * unguarded they let one script
 *  - exhaust the free upstream services behind them (a public geocoder bans apps
 *    that ask too often, which would break the location bar for everyone),
 *  - guess join and invite codes by trying thousands of them,
 *  - fill the database with junk rows.
 *
 * Three tools, used together:
 *  - `TtlCache`        — remember a recent answer, so many people share one upstream call.
 *  - `takeOpenBudget`  — a daily budget per caller and one shared by everyone, kept
 *                         in the database (`api_budget_take`), counted only when real
 *                         work happens (a cache hit is free).
 *  - `clientScope`     — who the caller is: a one-way hash of their network address.
 *                         The address itself is never stored or logged.
 *
 * The per-caller limits are generous on purpose. Students on a programme's wifi
 * share ONE address, so a limit sized for one person would lock out a whole
 * cohort. They exist to stop scripts, not to ration people.
 */

import { createHash } from "node:crypto";

export type OpenBucket = "geocode" | "weather" | "jewish" | "codepreview" | "simanswers" | "simhandoff";

/** Daily limits. `perClient` is per network address (so per shared wifi), not per person. */
export const OPEN_BUDGETS: Record<OpenBucket, { global: number; perClient: number }> = {
  // Upstream calls only — an answer served from the cache costs nothing.
  geocode: { global: 6_000, perClient: 500 },
  // Open-Meteo's free tier allows 10,000 calls a day and each lookup makes ~3.
  weather: { global: 2_500, perClient: 300 },
  jewish: { global: 4_000, perClient: 300 },
  // Guessing codes: 300 tries a day from one address is useless to a guesser and
  // plenty for a room of students typing the same code.
  codepreview: { global: 5_000, perClient: 300 },
  simanswers: { global: 3_000, perClient: 200 },
  simhandoff: { global: 3_000, perClient: 200 },
};

export const OPEN_MESSAGES = {
  client: "Too many attempts from this connection. Please try again later.",
  global: "This is busy right now. Please try again in a little while.",
  error: "Please try again in a moment.",
} as const;

export type OpenBudgetResult = "ok" | "client" | "global" | "error";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** A stable, anonymous id for the caller: a hash of their network address. */
export async function clientScope(): Promise<string> {
  let ip = "";
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    ip = (getRequestHeader("x-real-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]!.trim();
  } catch {
    /* no request context */
  }
  if (!ip) return "ip:unknown";
  return `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 20)}`;
}

/**
 * Take one unit from a bucket for this caller. Never throws — the caller decides
 * what a refusal means (fail soft for harmless lookups, fail closed for anything
 * guessable).
 */
export async function takeOpenBudget(bucket: OpenBucket, cost = 1): Promise<OpenBudgetResult> {
  const limits = OPEN_BUDGETS[bucket];
  try {
    const scope = await clientScope();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as RpcClient).rpc("api_budget_take", {
      p_bucket: `open:${bucket}`,
      p_user: scope,
      p_cost: cost,
      p_global_limit: limits.global,
      p_user_limit: limits.perClient,
    });
    if (error) throw new Error(error.message);
    if (data === "ok") return "ok";
    if (data === "user") return "client";
    if (data === "global") return "global";
    throw new Error(`unexpected budget answer: ${String(data)}`);
  } catch (e) {
    console.error(`[open-endpoints] budget check failed for "${bucket}":`, e);
    return "error";
  }
}

/** Take one unit or throw the member-facing refusal. Fails CLOSED: for anything guessable. */
export async function assertOpenBudget(bucket: OpenBucket): Promise<void> {
  const result = await takeOpenBudget(bucket);
  if (result !== "ok") throw new Error(refusalMessage(result));
}

/** Turn a refusal into the sentence a member sees. */
export function refusalMessage(result: Exclude<OpenBudgetResult, "ok">): string {
  return OPEN_MESSAGES[result];
}

/* ------------------------------------------------------------------ cache --- */

type Entry<T> = { value: T; expires: number };

/** A small in-memory cache with a lifetime and a size ceiling. */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly max = 500,
  ) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (hit.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T) {
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.entries.size > this.max) {
      // Oldest first; a Map keeps insertion order.
      const excess = this.entries.size - this.max;
      let i = 0;
      for (const k of this.entries.keys()) {
        if (i++ >= excess) break;
        this.entries.delete(k);
      }
    }
  }

  /** Identical concurrent requests share one call. A failure is never remembered. */
  async share(key: string, load: () => Promise<T>): Promise<T> {
    const running = this.inflight.get(key);
    if (running) return running;
    const promise = load().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  get size() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
    this.inflight.clear();
  }
}

/**
 * Cache first, then budget, then the real call. A cache hit never touches the
 * budget or the upstream; concurrent identical requests share one of each. If the
 * budget refuses, `onRefused` decides the outcome (a fallback value, or a throw).
 */
export async function cachedGuarded<T>(opts: {
  cache: TtlCache<T>;
  key: string;
  bucket: OpenBucket;
  load: () => Promise<T>;
  /** Cache the result? Return false for empty / failed answers. */
  worthCaching?: (value: T) => boolean;
  onRefused: (result: Exclude<OpenBudgetResult, "ok">) => T;
}): Promise<T> {
  const hit = opts.cache.get(opts.key);
  if (hit !== undefined) return hit;
  return opts.cache.share(opts.key, async () => {
    const budget = await takeOpenBudget(opts.bucket);
    if (budget !== "ok") return opts.onRefused(budget);
    const value = await opts.load();
    if (!opts.worthCaching || opts.worthCaching(value)) opts.cache.set(opts.key, value);
    return value;
  });
}

/** Round a coordinate so people a few metres apart share one cached answer. */
export const roundTo = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
