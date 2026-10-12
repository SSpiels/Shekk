/**
 * Shekk ledger — server-only implementation.
 *
 * Every shekel a member holds lives in the database, never in the browser.
 * Balances are stored as integer agorot (1/100 of a shekel) so no rounding
 * error can ever creep into money. A balance is never written directly: the
 * database routines `ledger_post`, `hold_create`, `hold_settle`,
 * `hold_release` and `funding_settle` are the only writers, they lock the
 * account row, and they are executable by the service role alone.
 *
 * This module is server-only (`.server.ts`) and must never be imported from a
 * component or from module scope of a `.functions.ts` file.
 */

import type { CurrencyCode } from "./currencies";

/* ------------------------------------------------------------- money units --- */

/** Shekels (a display number) → agorot (the stored integer). */
export const toAgorot = (shekels: number): number => Math.round(shekels * 100);

/** Agorot → shekels, for display only. */
export const toShekels = (agorot: number): number => agorot / 100;

/* ---------------------------------------------------------------- shapes --- */

export type LedgerEntry = {
  id: string;
  direction: "credit" | "debit";
  amount_agorot: number;
  balance_after_agorot: number;
  category: string;
  merchant: string;
  icon: string;
  counterparty: string | null;
  external_ref: string | null;
  hold_id: string | null;
  created_at: string;
};

export type HoldRow = {
  id: string;
  amount_agorot: number;
  status: "open" | "settled" | "released";
  merchant: string;
  category: string;
  icon: string;
  external_ref: string | null;
  settled_amount_agorot: number | null;
  created_at: string;
};

export type AccountRow = {
  user_id: string;
  currency: string;
  balance_agorot: number;
  held_agorot: number;
  status: "active" | "frozen" | "closed";
};

/** What the app actually renders: shekels, plus what is reserved. */
export type LedgerSnapshot = {
  balance: number;
  held: number;
  available: number;
  status: AccountRow["status"];
  entries: Array<{
    id: string;
    merchant: string;
    category: string;
    amount: number;
    icon: string;
    date: string;
    createdAt: string;
    externalRef: string | null;
  }>;
  holds: Array<{
    id: string;
    amount: number;
    merchant: string;
    category: string;
    icon: string;
    externalRef: string | null;
    createdAt: string;
  }>;
};

/* -------------------------------------------------------------- admin client --- */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Turn a Postgres money error into something safe to show a member. */
function rethrow(error: { message: string } | null, fallback: string): void {
  if (!error) return;
  const msg = error.message ?? "";
  if (msg.includes("payments are not enabled")) throw new Error("Payments aren't available yet");
  if (msg.includes("insufficient balance")) throw new Error("Not enough money in your account");
  if (msg.includes("account is frozen")) throw new Error("This account is frozen");
  if (msg.includes("account is closed")) throw new Error("This account is closed");
  console.error(`[ledger] ${fallback}:`, msg);
  throw new Error(fallback);
}

/* ------------------------------------------------------------------ reads --- */

export async function readSnapshot(userId: string, limit = 60): Promise<LedgerSnapshot> {
  const db = await admin();

  const { error: acctError } = await db.rpc("ensure_account", { _user_id: userId });
  rethrow(acctError, "Could not open your account");

  const [{ data: account }, { data: entries }, { data: holds }] = await Promise.all([
    db.from("accounts").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("ledger_entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    db.from("holds").select("*").eq("user_id", userId).eq("status", "open"),
  ]);

  const acct = (account ?? {
    balance_agorot: 0,
    held_agorot: 0,
    status: "active",
  }) as AccountRow;

  return {
    balance: toShekels(acct.balance_agorot),
    held: toShekels(acct.held_agorot),
    available: toShekels(acct.balance_agorot - acct.held_agorot),
    status: acct.status,
    entries: ((entries ?? []) as LedgerEntry[]).map((e) => ({
      id: e.id,
      merchant: e.merchant,
      category: e.category,
      amount: (e.direction === "credit" ? 1 : -1) * toShekels(e.amount_agorot),
      icon: e.icon,
      date: relative(e.created_at),
      createdAt: e.created_at,
      externalRef: e.external_ref,
    })),
    holds: ((holds ?? []) as HoldRow[]).map((h) => ({
      id: h.id,
      amount: toShekels(h.amount_agorot),
      merchant: h.merchant,
      category: h.category,
      icon: h.icon,
      externalRef: h.external_ref,
      createdAt: h.created_at,
    })),
  };
}

/* ----------------------------------------------------------------- writes --- */

export type PostInput = {
  /** Debit only: credits are created solely by funding_settle and transfer_post. */
  direction: "debit";
  shekels: number;
  merchant: string;
  category?: string;
  icon?: string;
  counterparty?: string | null;
  externalRef?: string | null;
  idempotencyKey?: string | null;
};

export async function post(userId: string, input: PostInput) {
  const db = await admin();
  const { error } = await db.rpc("ledger_post", {
    _user_id: userId,
    _direction: input.direction,
    _amount_agorot: toAgorot(input.shekels),
    _merchant: input.merchant,
    _category: input.category ?? "Other",
    _icon: input.icon ?? "💳",
    _counterparty: input.counterparty ?? undefined,
    _external_ref: input.externalRef ?? undefined,
    _idempotency_key: input.idempotencyKey ?? undefined,
    _hold_id: undefined,
  });
  rethrow(error, "That payment could not be completed");
  return readSnapshot(userId);
}

export type HoldInput = {
  shekels: number;
  merchant: string;
  category?: string;
  icon?: string;
  externalRef?: string | null;
  idempotencyKey?: string | null;
};

/** Reserve money for something whose final price is not known yet. */
export async function createHold(userId: string, input: HoldInput) {
  const db = await admin();
  const { data, error } = await db.rpc("hold_create", {
    _user_id: userId,
    _amount_agorot: toAgorot(input.shekels),
    _merchant: input.merchant,
    _category: input.category ?? "Other",
    _icon: input.icon ?? "💳",
    _external_ref: input.externalRef ?? undefined,
    _idempotency_key: input.idempotencyKey ?? undefined,
  });
  rethrow(error, "Could not reserve that amount");
  const hold = data as unknown as HoldRow;
  return { holdId: hold.id, snapshot: await readSnapshot(userId) };
}

/** Charge a reservation at its true final amount. */
export async function settleHold(userId: string, holdId: string, finalShekels?: number) {
  const db = await admin();
  const { error } = await db.rpc("hold_settle", {
    _user_id: userId,
    _hold_id: holdId,
    _final_amount_agorot: finalShekels == null ? undefined : toAgorot(finalShekels),
  });
  rethrow(error, "Could not complete that payment");
  return readSnapshot(userId);
}

/** Give a reservation back without charging anything. */
export async function releaseHold(userId: string, holdId: string) {
  const db = await admin();
  const { error } = await db.rpc("hold_release", { _user_id: userId, _hold_id: holdId });
  rethrow(error, "Could not release that reservation");
  return readSnapshot(userId);
}

export type FundingInput = {
  payCurrency: CurrencyCode;
  payAmount: number;
  interbankRate: number;
  quotedRate: number;
  fee: number;
  shekels: number;
  method?: string;
  provider?: string;
  providerRef?: string | null;
  idempotencyKey?: string | null;
};

/**
 * Record a completed top up and credit the shekels it bought.
 *
 * Today the caller is the in-app simulator. Once Airwallex is live this is
 * called only from the verified payment webhook — never from the client.
 */
export async function settleFunding(userId: string, input: FundingInput) {
  const db = await admin();
  const { error } = await db.rpc("funding_settle", {
    _user_id: userId,
    _pay_currency: input.payCurrency,
    _pay_amount_minor: Math.round(input.payAmount * 100),
    _interbank_rate: input.interbankRate,
    _quoted_rate: input.quotedRate,
    _fee_minor: Math.round(input.fee * 100),
    _shekels_agorot: toAgorot(input.shekels),
    _method: input.method ?? "apple-pay",
    _provider: input.provider ?? "simulator",
    _provider_ref: input.providerRef ?? undefined,
    _idempotency_key: input.idempotencyKey ?? undefined,
  });
  rethrow(error, "That top up could not be completed");
  return readSnapshot(userId);
}

/* ------------------------------------------------------------------- util --- */

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
