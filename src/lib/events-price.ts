/**
 * Explicit price parsing and display — never a guess. Every value here comes
 * from text a source actually stated; absence of a signal is "unknown", not
 * "free" and not "paid". See the price-coverage audit this sprint is built
 * from for the real examples behind every pattern below.
 *
 * Deliberately small: one text parser, one struct, two format functions. No
 * ticket-pricing engine, no currency conversion (a $ amount can't honestly
 * become a ₪ figure without a live FX rate, so it's tracked as "paid, amount
 * known but not in ₪" rather than converted).
 */

import { ils } from "./mock";

export type PriceKind = "exact" | "free" | "from" | "range" | "tiered" | "conditional" | "paid_unknown" | "unknown";

export type PriceInfo = {
  kind: PriceKind;
  /** Agorot. The single value (exact/from), or the low end (range), or a representative "from" figure for a simple two-tier case. Null otherwise. */
  amountAgorot: number | null;
  /** Agorot. The high end of a range. Null otherwise. */
  maxAmountAgorot: number | null;
  /** Short human-readable context — required for conditional (e.g. "Free before midnight"), optional elsewhere. */
  note: string | null;
};

const UNKNOWN: PriceInfo = { kind: "unknown", amountAgorot: null, maxAmountAgorot: null, note: null };

/* ------------------------------------------------------------- currency --- */

/** ₪50, 50 NIS, 50NIS, NIS50.00, ILS 50, 50 shekel(s), 50 ש"ח / ש״ח / שח — all ILS-denominated. */
const ILS_AMOUNT_RE =
  /(?:₪|ILS|NIS)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:₪|ILS|NIS|shekels?|ש["״]?ח)/gi;

/** $50, USD 50 — a real stated price, just not in Shekk's display currency. */
const USD_AMOUNT_RE = /\$\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?USD/gi;

function toAgorot(raw: string): number {
  return Math.round(parseFloat(raw.replace(/,/g, "")) * 100);
}

type AmountMatch = { agorot: number; index: number };

/** Every distinct ILS amount mentioned, in agorot with its position in the text, in the order first seen. */
function extractIlsAmounts(text: string): AmountMatch[] {
  const seen = new Set<number>();
  const out: AmountMatch[] = [];
  for (const m of text.matchAll(ILS_AMOUNT_RE)) {
    const raw = m[1] ?? m[2];
    if (!raw) continue;
    const agorot = toAgorot(raw);
    if (agorot > 0 && !seen.has(agorot)) {
      seen.add(agorot);
      out.push({ agorot, index: m.index ?? 0 });
    }
  }
  return out;
}

/* ---------------------------------------------------------------- free --- */

/**
 * Deliberately an allowlist of specific declaration shapes, not a bare
 * `/free/` match — a first pass on real data caught real false positives:
 * "a free glass of wine" (perk on a paid ticket), "free VIP entry" / "a free
 * shot" (marketing copy for a paid pub crawl), "Free entry for active
 * soldiers" (an exemption for one group, not the general price), "feel free
 * to..." (not about price at all). None of those reduce to a standalone
 * "Free" declaration, so none of them match here.
 */
function hasExplicitFreeDeclaration(text: string): boolean {
  if (/\bfree of charge and open to all\b/i.test(text)) return true;
  // "It's free" — real case: a Secret Tel Aviv page's own text ("It's free,
  // the music is at a reasonable volume..."), distinct from "feel free" and
  // guarded against "it's free-range"/"it's free-flowing" style compounds.
  if (/\bit'?s free\b(?!-)/i.test(text)) return true;
  // Hebrew: "כניסה חופשית" (free entrance) / "חינם" (free) — real case: the
  // same Secret Tel Aviv page states both, and price text on that source is
  // sometimes Hebrew-only. Plain substring, not \b-anchored — JS regex's
  // \b is ASCII-word-aware, not Unicode-aware, so it doesn't behave
  // sensibly around Hebrew letters.
  if (text.includes("כניסה חופשית") || text.includes("חינם")) return true;
  // A line that, once emoji/punctuation are stripped, is just "Free", "Free!",
  // "Cost: Free", "Admission: Free" or "Entrance: Free" — e.g. "💙 Free!" or
  // "Cost: FREE".
  return text.split(/\n/).some((line) => {
    const cleaned = line
      .replace(/[^\p{L}\p{N}\s!:]/gu, "")
      .trim()
      .toLowerCase();
    return /^(cost|admission|entrance)?:?\s*free!?$/.test(cleaned) && cleaned.length > 0;
  });
}

/**
 * Known conditional-pricing shapes, recognised directly rather than left for
 * a caller to build — both are real, evidenced cases from the audit, not a
 * general "is this conditional" guess. Checked before the free/paid_unknown
 * fallbacks so "free before midnight" (genuinely conditional) isn't read as
 * an unconditional free declaration.
 */
const CONDITIONAL_PATTERNS: { re: RegExp; note: string }[] = [
  // Real phrasing varies more than a fixed 3-word phrase — "entry is free
  // before midnight", "free entry from the yard before midnight—after that,
  // the paid party" both need to match, so this allows other words between
  // "free" and "before midnight" but stays within one sentence (no '.').
  { re: /\bfree\b[^.!?]{0,60}\bbefore midnight\b/i, note: "Free before midnight" },
  { re: /\bfirst class (is |for the )?free\b/i, note: "First class free" },
];

function detectConditional(text: string): PriceInfo | null {
  for (const { re, note } of CONDITIONAL_PATTERNS) {
    if (re.test(text)) return conditionalPrice(note);
  }
  return null;
}

/* -------------------------------------------------------------- tiered --- */

const MEMBER_TIER_RE = /\bnon-?members?\b|\bmembers?\b.{0,30}\b(complimentary|free)\b/i;

/* ---------------------------------------------------------- from/range --- */

const FROM_PHRASE_RE = /\b(from|starting at|starting from)\b/i;

/** A stated ticket/purchase channel exists, but no parseable amount was found — paid, not free, exact figure unknown. */
const PAID_SIGNAL_RE = /\b(buy tickets?|get tickets?|grab (your |a )?tickets?|tickets? are|ticket price|book now|register.{0,15}\$)/i;

/* ------------------------------------------------------------------ API --- */

/**
 * Parses one block of text (title + description, or an event/source page's
 * visible text) for an explicit price. Returns `null` when nothing in this
 * particular text says anything about price — the caller decides what that
 * means (try another source, or leave it unknown).
 */
export function parsePriceFromText(text: string): PriceInfo | null {
  const conditional = detectConditional(text);
  if (conditional) return conditional;

  const ilsAmounts = extractIlsAmounts(text);
  const isTiered = MEMBER_TIER_RE.test(text);

  if (ilsAmounts.length >= 3) {
    // Too many distinct figures to safely collapse into one "from"/"range" —
    // e.g. member/non-member × room type. Never guess which two matter.
    return { kind: "tiered", amountAgorot: null, maxAmountAgorot: null, note: "Multiple pricing tiers — see source for details" };
  }

  if (ilsAmounts.length === 2) {
    const [a, b] = ilsAmounts;
    const [lo, hi] = a.agorot <= b.agorot ? [a, b] : [b, a];
    if (isTiered) {
      return { kind: "tiered", amountAgorot: lo.agorot, maxAmountAgorot: null, note: null };
    }
    return { kind: "range", amountAgorot: lo.agorot, maxAmountAgorot: hi.agorot, note: null };
  }

  if (ilsAmounts.length === 1) {
    const amount = ilsAmounts[0];
    if (isTiered) {
      return { kind: "tiered", amountAgorot: amount.agorot, maxAmountAgorot: null, note: null };
    }
    // Only counts as "from" when the phrase sits right before this specific
    // number — a bare whole-text search would also fire on unrelated text
    // like "Starting at 7pm" (a real case in the audit — that's a time, not
    // a price).
    const precedingWindow = text.slice(Math.max(0, amount.index - 25), amount.index);
    if (FROM_PHRASE_RE.test(precedingWindow)) {
      return { kind: "from", amountAgorot: amount.agorot, maxAmountAgorot: null, note: null };
    }
    return { kind: "exact", amountAgorot: amount.agorot, maxAmountAgorot: null, note: null };
  }

  // No ILS figure. A stated (but non-ILS, e.g. $80) amount is still real evidence of a paid event.
  const usdMatch = text.match(USD_AMOUNT_RE);
  if (usdMatch) {
    return { kind: "paid_unknown", amountAgorot: null, maxAmountAgorot: null, note: usdMatch[0].trim() };
  }

  if (hasExplicitFreeDeclaration(text)) {
    return { kind: "free", amountAgorot: 0, maxAmountAgorot: null, note: null };
  }

  if (PAID_SIGNAL_RE.test(text)) {
    return { kind: "paid_unknown", amountAgorot: null, maxAmountAgorot: null, note: null };
  }

  return null;
}

/**
 * Conditional pricing (e.g. "free before midnight", "first class free") is
 * never produced by `parsePriceFromText` alone — the free/paid split it
 * depends on ("before midnight", "first class") is source-specific enough
 * that it needs to be recognised explicitly, not guessed at from generic
 * patterns. Call sites that find one of these known shapes build the
 * `PriceInfo` directly with `kind: "conditional"` and a `note` describing
 * the condition in the source's own words.
 */
export function conditionalPrice(note: string): PriceInfo {
  return { kind: "conditional", amountAgorot: null, maxAmountAgorot: null, note };
}

export { UNKNOWN as UNKNOWN_PRICE };

/* ------------------------------------------------------------- display --- */

function ilsFromAgorot(agorot: number): string {
  return ils(agorot / 100);
}

/** Event card — compact, one line. `null` means show nothing in the price area at all. */
export function formatPriceForCard(p: Pick<PriceInfo, "kind" | "amountAgorot" | "maxAmountAgorot">): string | null {
  switch (p.kind) {
    case "free":
      return "Free";
    case "exact":
      return p.amountAgorot !== null ? ilsFromAgorot(p.amountAgorot) : "See price";
    case "from":
      return p.amountAgorot !== null ? `From ${ilsFromAgorot(p.amountAgorot)}` : "See price";
    case "range":
      return p.amountAgorot !== null && p.maxAmountAgorot !== null
        ? `${ilsFromAgorot(p.amountAgorot)}–${ilsFromAgorot(p.maxAmountAgorot)}`
        : "See price";
    case "tiered":
      // A simple two-tier case (one clear public price) reads like "from"; a
      // complex multi-tier case has no single number worth showing.
      return p.amountAgorot !== null ? `From ${ilsFromAgorot(p.amountAgorot)}` : "See price";
    case "paid_unknown":
    case "conditional":
      return "See price";
    case "unknown":
    default:
      return null;
  }
}

/** Event detail page — one sentence, may reference the source. */
export function formatPriceForDetail(p: Pick<PriceInfo, "kind" | "amountAgorot" | "maxAmountAgorot" | "note">, sourceLabel: string): string {
  switch (p.kind) {
    case "free":
      return "Free";
    case "exact":
      return p.amountAgorot !== null ? `${ilsFromAgorot(p.amountAgorot)} per person` : `See price on ${sourceLabel}`;
    case "from":
      return p.amountAgorot !== null ? `From ${ilsFromAgorot(p.amountAgorot)}` : `See price on ${sourceLabel}`;
    case "range":
      return p.amountAgorot !== null && p.maxAmountAgorot !== null
        ? `${ilsFromAgorot(p.amountAgorot)}–${ilsFromAgorot(p.maxAmountAgorot)}`
        : `See price on ${sourceLabel}`;
    case "tiered":
      return p.amountAgorot !== null ? `From ${ilsFromAgorot(p.amountAgorot)} — see ${sourceLabel} for full pricing` : `See price on ${sourceLabel}`;
    case "conditional":
      return p.note ? `${p.note} — see ${sourceLabel} for full pricing` : `See price on ${sourceLabel}`;
    case "paid_unknown":
      return `See price on ${sourceLabel}`;
    case "unknown":
    default:
      return `Check details on ${sourceLabel}`;
  }
}
