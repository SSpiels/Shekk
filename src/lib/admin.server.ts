/**
 * Shekk Console — server-side data layer.
 *
 * Everything here runs with the service role, so every entry point in
 * `admin.functions.ts` must prove the caller holds the `admin` role first.
 */

type AnyClient = {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  auth: { admin: { listUsers: (o?: any) => any } };
};

async function admin(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

const agorot = (n: number | null | undefined) => Number(n ?? 0);

export type MemberRow = {
  userId: string;
  name: string;
  email: string | null;
  country: string | null;
  city: string | null;
  program: string | null;
  cohort: string | null;
  handle: string | null;
  currency: string;
  kycStatus: string;
  accountStatus: string;
  accountApproval: string;
  membership: "free" | "premium";
  balanceAgorot: number;
  heldAgorot: number;
  addedAgorot: number;
  spentAgorot: number;
  cardIssued: boolean;
  joinedISO: string;
  lastActivityISO: string | null;
};

function displayName(p: any): string {
  const parts = [p.legal_first_name, p.legal_last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.email ?? "Unnamed member";
}

/** The whole member book, joined with money, KYC and membership state. */
export async function listMembers(): Promise<MemberRow[]> {
  const db = await admin();

  const [{ data: profiles }, { data: accounts }, { data: subs }, { data: entries }, { data: handles }] =
    await Promise.all([
      db.from("member_profiles").select("*").order("created_at", { ascending: false }),
      db.from("accounts").select("*"),
      db.from("subscriptions").select("user_id, status, current_period_end"),
      db.from("ledger_entries").select("user_id, direction, amount_agorot, created_at"),
      db.from("member_handles").select("user_id, handle"),
    ]);

  const handleBy = new Map<string, string>((handles ?? []).map((h: any) => [h.user_id, h.handle]));

  const accountBy = new Map<string, any>((accounts ?? []).map((a: any) => [a.user_id, a]));
  const premium = new Set<string>(
    (subs ?? [])
      .filter(
        (s: any) =>
          ["active", "trialing", "past_due"].includes(s.status) ||
          (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end) > new Date()),
      )
      .map((s: any) => s.user_id),
  );

  const flow = new Map<string, { added: number; spent: number; last: string | null }>();
  for (const e of entries ?? []) {
    const cur = flow.get(e.user_id) ?? { added: 0, spent: 0, last: null };
    if (e.direction === "credit") cur.added += agorot(e.amount_agorot);
    else cur.spent += agorot(e.amount_agorot);
    if (!cur.last || e.created_at > cur.last) cur.last = e.created_at;
    flow.set(e.user_id, cur);
  }

  return (profiles ?? []).map((p: any) => {
    const acct = accountBy.get(p.user_id);
    const f = flow.get(p.user_id) ?? { added: 0, spent: 0, last: null };
    return {
      userId: p.user_id,
      name: displayName(p),
      email: p.email ?? null,
      country: p.address_country ?? null,
      city: p.city ?? p.address_city ?? null,
      program: p.program ?? null,
      cohort: p.cohort ?? null,
      handle: handleBy.get(p.user_id) ?? null,
      currency: p.preferred_currency ?? "USD",
      kycStatus: p.kyc_status ?? "not_started",
      accountStatus: acct?.status ?? "none",
      accountApproval: p.airwallex_account_status ?? "not_submitted",
      membership: premium.has(p.user_id) ? "premium" : "free",
      balanceAgorot: agorot(acct?.balance_agorot),
      heldAgorot: agorot(acct?.held_agorot),
      addedAgorot: f.added,
      spentAgorot: f.spent,
      cardIssued: Boolean(p.airwallex_cardholder_id),
      joinedISO: p.created_at,
      lastActivityISO: f.last,
    };
  });
}

export type OverviewData = {
  members: number;
  premium: number;
  pendingKyc: number;
  verified: number;
  suspended: number;
  cardsIssued: number;
  floatAgorot: number;
  heldAgorot: number;
  addedAgorot: number;
  spentAgorot: number;
  fundingByCurrency: { code: string; minor: number; shekelsAgorot: number; count: number }[];
  weekly: { label: string; added: number; spent: number }[];
  categories: { label: string; amount: number }[];
  subscriptions: { status: string; count: number }[];
  recent: {
    id: string;
    userId: string;
    name: string;
    direction: string;
    amountAgorot: number;
    merchant: string;
    category: string;
    icon: string;
    createdISO: string;
  }[];
};

function weekBuckets(weeks = 12) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, i) => {
    const from = new Date(start);
    from.setUTCDate(from.getUTCDate() + i * 7);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from, to, label: `${from.getUTCDate()}/${from.getUTCMonth() + 1}`, added: 0, spent: 0 };
  });
}

/** One round trip that powers the Overview and Money-flow screens. */
export async function overview(): Promise<OverviewData> {
  const db = await admin();
  const members = await listMembers();

  const [{ data: entries }, { data: funding }, { data: subs }] = await Promise.all([
    db.from("ledger_entries").select("*").order("created_at", { ascending: false }).limit(4000),
    db.from("funding_events").select("pay_currency, pay_amount_minor, shekels_agorot, status"),
    db.from("subscriptions").select("status"),
  ]);

  const nameBy = new Map(members.map((m) => [m.userId, m.name]));

  const buckets = weekBuckets();
  const categories = new Map<string, number>();
  for (const e of entries ?? []) {
    const at = new Date(e.created_at);
    const b = buckets.find((x) => at >= x.from && at < x.to);
    if (b) {
      if (e.direction === "credit") b.added += agorot(e.amount_agorot);
      else b.spent += agorot(e.amount_agorot);
    }
    if (e.direction === "debit") {
      categories.set(e.category ?? "Other", (categories.get(e.category ?? "Other") ?? 0) + agorot(e.amount_agorot));
    }
  }

  const byCurrency = new Map<string, { minor: number; shekelsAgorot: number; count: number }>();
  for (const f of funding ?? []) {
    if (f.status !== "settled") continue;
    const cur = byCurrency.get(f.pay_currency) ?? { minor: 0, shekelsAgorot: 0, count: 0 };
    cur.minor += agorot(f.pay_amount_minor);
    cur.shekelsAgorot += agorot(f.shekels_agorot);
    cur.count += 1;
    byCurrency.set(f.pay_currency, cur);
  }

  const subCounts = new Map<string, number>();
  for (const s of subs ?? []) subCounts.set(s.status, (subCounts.get(s.status) ?? 0) + 1);

  return {
    members: members.length,
    premium: members.filter((m) => m.membership === "premium").length,
    pendingKyc: members.filter((m) => ["submitted", "in_review", "pending"].includes(m.kycStatus)).length,
    verified: members.filter((m) => m.kycStatus === "approved" || m.kycStatus === "verified").length,
    suspended: members.filter((m) => m.accountStatus === "suspended" || m.accountStatus === "frozen").length,
    cardsIssued: members.filter((m) => m.cardIssued).length,
    floatAgorot: members.reduce((n, m) => n + m.balanceAgorot, 0),
    heldAgorot: members.reduce((n, m) => n + m.heldAgorot, 0),
    addedAgorot: members.reduce((n, m) => n + m.addedAgorot, 0),
    spentAgorot: members.reduce((n, m) => n + m.spentAgorot, 0),
    fundingByCurrency: [...byCurrency.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.shekelsAgorot - a.shekelsAgorot),
    weekly: buckets.map((b) => ({ label: b.label, added: b.added, spent: b.spent })),
    categories: [...categories.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    subscriptions: [...subCounts.entries()].map(([status, count]) => ({ status, count })),
    recent: (entries ?? []).slice(0, 25).map((e: any) => ({
      id: e.id,
      userId: e.user_id,
      name: nameBy.get(e.user_id) ?? "Member",
      direction: e.direction,
      amountAgorot: agorot(e.amount_agorot),
      merchant: e.merchant,
      category: e.category,
      icon: e.icon,
      createdISO: e.created_at,
    })),
  };
}

/** Everything the console shows in a single member's drawer. */
export async function memberDetail(userId: string) {
  const db = await admin();
  const [{ data: profile }, { data: account }, { data: entries }, { data: holds }, { data: funding }, { data: subs }, { data: docs }] =
    await Promise.all([
      db.from("member_profiles").select("*").eq("user_id", userId).maybeSingle(),
      db.from("accounts").select("*").eq("user_id", userId).maybeSingle(),
      db.from("ledger_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      db.from("holds").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      db.from("funding_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      db.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      db.from("kyc_documents").select("id, kind, status, created_at").eq("user_id", userId),
    ]);

  const { data: handle } = await db.from("member_handles").select("*").eq("user_id", userId).maybeSingle();

  return {
    profile: profile ?? null,
    handle: handle ?? null,
    account: account ?? null,
    entries: entries ?? [],
    holds: holds ?? [],
    funding: funding ?? [],
    subscriptions: subs ?? [],
    documents: docs ?? [],
  };
}

export async function setKycStatus(userId: string, status: string, reason: string | null) {
  const db = await admin();
  const patch: Record<string, unknown> = {
    kyc_status: status,
    kyc_reviewed_at: new Date().toISOString(),
    kyc_rejection_reason: status === "rejected" ? reason : null,
    updated_at: new Date().toISOString(),
  };
  if (status === "approved") {
    const due = new Date();
    due.setUTCFullYear(due.getUTCFullYear() + 1);
    patch.reverify_due_at = due.toISOString();
    await db.rpc("ensure_account", { _user_id: userId });
  }
  const { error } = await db.from("member_profiles").update(patch).eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setAccountStatus(userId: string, status: string) {
  const db = await admin();
  await db.rpc("ensure_account", { _user_id: userId });
  const { error } = await db
    .from("accounts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Set (or claim) a member's Shekk tag from the console. */
export async function setMemberHandle(userId: string, raw: string) {
  const db = await admin();
  const { normaliseHandle } = await import("./social.server");
  const handle = normaliseHandle(raw);
  if (handle.length < 3) throw new Error("Shekk tags need at least 3 letters or numbers");

  const { data: taken } = await db
    .from("member_handles")
    .select("user_id")
    .ilike("handle", handle)
    .neq("user_id", userId)
    .maybeSingle();
  if (taken) throw new Error("That Shekk tag is already taken");

  const { data: existing } = await db
    .from("member_handles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("member_handles")
      .update({ handle, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { data: profile } = await db
      .from("member_profiles")
      .select("legal_first_name, legal_last_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    const displayName =
      [profile?.legal_first_name, profile?.legal_last_name].filter(Boolean).join(" ") ||
      profile?.email ||
      "Shekk member";
    const { error } = await db.from("member_handles").insert({ user_id: userId, handle, display_name: displayName });
    if (error) throw new Error(error.message);
  }
  return { ok: true, handle };
}

export async function isAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}
