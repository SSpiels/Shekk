/**
 * The guards in front of the server functions anyone can call: a cache that is
 * shared and bounded, a daily budget per caller and overall, and an anonymous id
 * for the caller that never contains their address.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const headers: Record<string, string | undefined> = {};
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: (name: string) => headers[name.toLowerCase()] }));

import {
  OPEN_BUDGETS,
  OPEN_MESSAGES,
  TtlCache,
  assertOpenBudget,
  cachedGuarded,
  clientScope,
  roundTo,
  takeOpenBudget,
} from "./open-endpoints.server";

beforeEach(() => {
  rpc.mockReset();
  for (const k of Object.keys(headers)) delete headers[k];
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("clientScope", () => {
  it("identifies a caller without containing their address", async () => {
    headers["x-real-ip"] = "203.0.113.42";
    const scope = await clientScope();
    expect(scope).toMatch(/^ip:[0-9a-f]{20}$/);
    expect(scope).not.toContain("203");
  });

  it("gives the same caller the same id, and different callers different ids", async () => {
    headers["x-real-ip"] = "203.0.113.42";
    const a = await clientScope();
    expect(await clientScope()).toBe(a);
    headers["x-real-ip"] = "198.51.100.7";
    expect(await clientScope()).not.toBe(a);
  });

  it("uses the first address of a forwarded list, and copes with none at all", async () => {
    headers["x-forwarded-for"] = "203.0.113.42, 10.0.0.1";
    const viaList = await clientScope();
    headers["x-forwarded-for"] = undefined;
    headers["x-real-ip"] = "203.0.113.42";
    expect(await clientScope()).toBe(viaList);
    delete headers["x-real-ip"];
    expect(await clientScope()).toBe("ip:unknown");
  });
});

describe("takeOpenBudget", () => {
  it("passes the bucket's limits and the caller's anonymous id to the database", async () => {
    headers["x-real-ip"] = "203.0.113.42";
    rpc.mockResolvedValue({ data: "ok", error: null });
    expect(await takeOpenBudget("codepreview")).toBe("ok");
    const args = rpc.mock.calls[0]![1] as Record<string, unknown>;
    expect(rpc.mock.calls[0]![0]).toBe("api_budget_take");
    expect(args["p_bucket"]).toBe("open:codepreview");
    expect(args["p_user"]).toMatch(/^ip:/);
    expect(args["p_global_limit"]).toBe(OPEN_BUDGETS.codepreview.global);
    expect(args["p_user_limit"]).toBe(OPEN_BUDGETS.codepreview.perClient);
  });

  it("reports which limit was hit", async () => {
    rpc.mockResolvedValue({ data: "user", error: null });
    expect(await takeOpenBudget("weather")).toBe("client");
    rpc.mockResolvedValue({ data: "global", error: null });
    expect(await takeOpenBudget("weather")).toBe("global");
  });

  it("never throws: a database error or an odd answer is reported as an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await takeOpenBudget("weather")).toBe("error");
    rpc.mockRejectedValue(new Error("network"));
    expect(await takeOpenBudget("weather")).toBe("error");
    rpc.mockResolvedValue({ data: "maybe", error: null });
    expect(await takeOpenBudget("weather")).toBe("error");
  });
});

describe("assertOpenBudget (used for anything guessable)", () => {
  it("lets the call through only on an explicit yes", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await expect(assertOpenBudget("codepreview")).resolves.toBeUndefined();
  });

  it("refuses with a plain message when a limit is hit", async () => {
    rpc.mockResolvedValue({ data: "user", error: null });
    await expect(assertOpenBudget("codepreview")).rejects.toThrow(OPEN_MESSAGES.client);
    rpc.mockResolvedValue({ data: "global", error: null });
    await expect(assertOpenBudget("codepreview")).rejects.toThrow(OPEN_MESSAGES.global);
  });

  it("fails CLOSED when the budget cannot be checked", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });
    await expect(assertOpenBudget("codepreview")).rejects.toThrow(OPEN_MESSAGES.error);
  });
});

describe("TtlCache", () => {
  it("remembers a value until it expires", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000);
    cache.set("a", "one");
    expect(cache.get("a")).toBe("one");
    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
    vi.useRealTimers();
  });

  it("never grows past its ceiling, dropping the oldest first", () => {
    const cache = new TtlCache<number>(60_000, 3);
    for (let i = 0; i < 6; i++) cache.set(`k${i}`, i);
    expect(cache.size).toBe(3);
    expect(cache.get("k0")).toBeUndefined();
    expect(cache.get("k5")).toBe(5);
  });

  it("shares one call between concurrent identical requests and forgets a failure", async () => {
    const cache = new TtlCache<number>(60_000);
    const load = vi.fn(async () => 7);
    const [a, b] = await Promise.all([cache.share("k", load), cache.share("k", load)]);
    expect([a, b, load.mock.calls.length]).toEqual([7, 7, 1]);

    const failing = vi.fn(async () => {
      throw new Error("upstream down");
    });
    await expect(cache.share("f", failing)).rejects.toThrow();
    await expect(cache.share("f", failing)).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(2); // a failure is not remembered
  });
});

describe("cachedGuarded", () => {
  const run = (cache: TtlCache<string | null>, load: () => Promise<string | null>, worth = true) =>
    cachedGuarded({
      cache,
      key: "k",
      bucket: "geocode",
      load,
      worthCaching: (v) => (worth ? v !== null : false),
      onRefused: () => null,
    });

  it("costs one budget unit and one upstream call, however many people ask", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    const cache = new TtlCache<string | null>(60_000);
    const load = vi.fn(async () => "Katamon");
    const answers = await Promise.all([run(cache, load), run(cache, load), run(cache, load)]);
    expect(answers).toEqual(["Katamon", "Katamon", "Katamon"]);
    expect(await run(cache, load)).toBe("Katamon"); // later: straight from the cache
    expect(load).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not call upstream when the budget is spent", async () => {
    rpc.mockResolvedValue({ data: "global", error: null });
    const load = vi.fn(async () => "x");
    expect(await run(new TtlCache<string | null>(60_000), load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("does not call upstream when the budget cannot be checked", async () => {
    rpc.mockRejectedValue(new Error("db down"));
    const load = vi.fn(async () => "x");
    expect(await run(new TtlCache<string | null>(60_000), load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("does not remember an empty answer", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    const cache = new TtlCache<string | null>(60_000);
    const load = vi.fn(async () => null);
    await run(cache, load);
    await run(cache, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("budget sizes", () => {
  it("keeps weather lookups under Open-Meteo's free allowance (~3 upstream calls each, 10,000/day)", () => {
    expect(OPEN_BUDGETS.weather.global * 3).toBeLessThan(10_000);
  });

  it("stays generous per caller: a cohort on one wifi must not be locked out", () => {
    expect(OPEN_BUDGETS.codepreview.perClient).toBeGreaterThanOrEqual(100);
    expect(OPEN_BUDGETS.geocode.perClient).toBeGreaterThanOrEqual(100);
  });

  it("is still far too slow for a code guesser", () => {
    // 300 guesses a day from one address, against codes with millions of combinations.
    expect(OPEN_BUDGETS.codepreview.perClient).toBeLessThanOrEqual(500);
  });
});

describe("roundTo", () => {
  it("lets people a few hundred metres apart share one answer", () => {
    expect(roundTo(31.76831, 3)).toBe(roundTo(31.76834, 3));
    expect(roundTo(31.7683, 2)).toBe(31.77);
  });
});
