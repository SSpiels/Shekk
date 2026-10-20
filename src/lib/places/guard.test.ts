/**
 * The cost guard in front of Google. Every path must fail CLOSED: when the
 * switch is off, a budget is spent, or the budget check itself breaks, no
 * request may reach Google.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

import { BUDGETS, PLACES_MESSAGES, takeBudget } from "./guard.server";

const env = { ...process.env };

beforeEach(() => {
  rpc.mockReset();
  process.env["GOOGLE_PLACES_ENABLED"] = "true";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("takeBudget", () => {
  it("refuses without touching the database while the master switch is off", async () => {
    delete process.env["GOOGLE_PLACES_ENABLED"];
    await expect(takeBudget("text", "u1")).rejects.toThrow(PLACES_MESSAGES.off);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the bucket's own limits to the database", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await takeBudget("photos", "u1", 1);
    expect(rpc).toHaveBeenCalledWith("api_budget_take", {
      p_bucket: "photos",
      p_user: "u1",
      p_cost: 1,
      p_global_limit: BUDGETS.photos.global,
      p_user_limit: BUDGETS.photos.user,
    });
  });

  it("allows the call when the budget has room", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    await expect(takeBudget("routes", "u1", 3)).resolves.toBeUndefined();
  });

  it("says so plainly when the shared daily limit is spent", async () => {
    rpc.mockResolvedValue({ data: "global", error: null });
    await expect(takeBudget("details", "u1")).rejects.toThrow(PLACES_MESSAGES.global);
  });

  it("says so plainly when this member's daily limit is spent", async () => {
    rpc.mockResolvedValue({ data: "user", error: null });
    await expect(takeBudget("details", "u1")).rejects.toThrow(PLACES_MESSAGES.user);
  });

  it("fails closed when the budget function errors (e.g. migration not applied)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function api_budget_take does not exist" } });
    await expect(takeBudget("text", "u1")).rejects.toThrow(PLACES_MESSAGES.paused);
  });

  it("fails closed when the database call itself throws", async () => {
    rpc.mockRejectedValue(new Error("network down"));
    await expect(takeBudget("text", "u1")).rejects.toThrow(PLACES_MESSAGES.paused);
  });

  it("fails closed on any answer it does not recognise", async () => {
    rpc.mockResolvedValue({ data: "maybe", error: null });
    await expect(takeBudget("text", "u1")).rejects.toThrow(PLACES_MESSAGES.paused);
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(takeBudget("text", "u1")).rejects.toThrow(PLACES_MESSAGES.paused);
  });
});

describe("budget sizes", () => {
  // The console quotas are 30/30/30/25/100/150 a day; ours must sit below them,
  // and a full month of the smallest free SKU (1,000) must stay under it.
  it("stays below the Google console quotas", () => {
    expect(BUDGETS.nearby.global).toBeLessThan(30);
    expect(BUDGETS.text.global).toBeLessThan(30);
    expect(BUDGETS.details.global).toBeLessThan(30);
    expect(BUDGETS.photos.global).toBeLessThan(25);
    expect(BUDGETS.routes.global).toBeLessThan(100);
    expect(BUDGETS.maploads.global).toBeLessThan(150);
  });

  it("keeps a 31-day month under the 1,000 free calls of the Enterprise-tier SKUs", () => {
    for (const b of ["nearby", "text", "details", "photos"] as const) {
      expect(BUDGETS[b].global * 31).toBeLessThan(1000);
    }
  });

  it("never lets one member use the whole shared pool", () => {
    for (const b of Object.values(BUDGETS)) expect(b.user).toBeLessThan(b.global);
  });
});
