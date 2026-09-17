import { describe, expect, it } from "vitest";
import { conditionalPrice, formatPriceForCard, formatPriceForDetail, parsePriceFromText, type PriceInfo } from "./events-price";

describe("parsePriceFromText — free", () => {
  it('real case: "Cost: FREE" (Ofer Winter invitation)', () => {
    expect(parsePriceFromText("RSVP: Above on Eventbrite\nCost: FREE\nDate: Monday Oct 5th")).toEqual({
      kind: "free",
      amountAgorot: 0,
      maxAmountAgorot: null,
      note: null,
    });
  });

  it('real case: standalone "💙 Free!" (Shabbat Dinner)', () => {
    expect(parsePriceFromText("🥗 Vegetarian potluck — bring a dish to share\n💙 Free!\nRSVP here:")?.kind).toBe("free");
  });

  it('real case: "Classes are free of charge and open to all." (Pardes Yom Iyun)', () => {
    expect(
      parsePriceFromText("Classes are free of charge and open to all. Advance registration required.")?.kind,
    ).toBe("free");
  });

  it('real case: Cost field on the NBN page itself, "Cost: Free" (Judean Football)', () => {
    expect(parsePriceFromText("Cost\nFree")?.kind).toBe("free");
  });

  it('real case: "It\'s free" embedded mid-sentence (Secret Tel Aviv page text, "Mami - Parents Friendly Market")', () => {
    expect(
      parsePriceFromText("It's free, the music is at a reasonable volume, and it's the perfect spot to get down with the crew.")
        ?.kind,
    ).toBe("free");
  });

  it("does not treat \"it's free-range\" as a free declaration", () => {
    expect(parsePriceFromText("Farm-to-table brunch — it's free-range eggs and local produce.")).toBeNull();
  });

  it('real case: Hebrew "כניסה חופשית" (free entrance) on the same Mami page', () => {
    expect(parsePriceFromText("כניסה חופשית בהרשמה מראש")?.kind).toBe("free");
  });
});

describe("parsePriceFromText — false positives that must NOT be treated as free", () => {
  it('"feel free" is not a price signal at all', () => {
    expect(parsePriceFromText("Feel free to reach out with any questions about the event.")).toBeNull();
  });

  it('real case: "a free glass of wine" perk on a paid group-ticket deal is not the event price', () => {
    // Real text: "The Last Five Years" — no admission price stated in this snippet at all.
    const result = parsePriceFromText(
      "Special Group Deal: if you buy 10 tickets you all receive a free glass of wine (or alternate beverage).",
    );
    expect(result?.kind).not.toBe("free");
  });

  it('real case: "Free VIP entry to every venue" / "a free shot at every bar" (Pub Crawl) is marketing copy, not the ticket price', () => {
    const text = "What is Included? 4 bars/clubs, Free VIP entry to every venue, a free shot at every bar.";
    const result = parsePriceFromText(text);
    expect(result?.kind).not.toBe("free");
  });

  it('real case: "Free entry for active soldiers with proof of service" is an exemption, not the general price', () => {
    // Real text: Sukkot Singles Soiree — general public pays $25/85 NIS advance, $30/100 NIS door.
    const result = parsePriceFromText(
      "Tickets: $25 / 85 NIS in advance, $30 / 100 NIS at the door. Free entry for active soldiers with proof of service.",
    );
    expect(result?.kind).toBe("range");
    expect(result?.amountAgorot).toBe(8500);
    expect(result?.maxAmountAgorot).toBe(10000);
  });
});

describe("parsePriceFromText — fixed price", () => {
  it("real case: ₪ symbol (MEET. MINGLE. PARTY page, Cost: NIS69.00 style)", () => {
    expect(parsePriceFromText("Cost\nNIS69.00")?.kind).toBe("exact");
    expect(parsePriceFromText("Cost\nNIS69.00")?.amountAgorot).toBe(6900);
  });

  it("real case: ₪195.00 (StandWithUs gala)", () => {
    const r = parsePriceFromText("Cost\n₪195.00");
    expect(r).toEqual({ kind: "exact", amountAgorot: 19500, maxAmountAgorot: null, note: null });
  });

  it('real case: "Tickets are 45 NIS at the door" (Inbal Wayne, Secret Tel Aviv)', () => {
    const r = parsePriceFromText("Tickets are 45 NIS at the door (cash or Bit)");
    expect(r).toEqual({ kind: "exact", amountAgorot: 4500, maxAmountAgorot: null, note: null });
  });

  it('real case: Hebrew "מחיר 145 שח" (Girafot, Secret Tel Aviv)', () => {
    const r = parsePriceFromText("מחיר 145 שח");
    expect(r?.kind).toBe("exact");
    expect(r?.amountAgorot).toBe(14500);
  });

  it('real case: "Cost: 40 nis" (Hebrew Conversation Group)', () => {
    expect(parsePriceFromText("Cost: 40 nis")?.amountAgorot).toBe(4000);
  });
});

describe("parsePriceFromText — fixed price, non-ILS currency", () => {
  it('real case: "$80.00" (Feldenkrais lessons Cost field) — a real price, but not in ₪, so paid_unknown not exact', () => {
    const r = parsePriceFromText("Cost\n$80.00");
    expect(r?.kind).toBe("paid_unknown");
    expect(r?.amountAgorot).toBeNull();
    expect(r?.note).toContain("80");
  });

  it("prefers the ILS figure when both ILS and USD amounts are stated together", () => {
    // Real case: "Witnessing October 7" — "Cost: 150 Shekels (55 USD)".
    const r = parsePriceFromText("Cost: 150 Shekels (55 USD)");
    expect(r?.kind).toBe("exact");
    expect(r?.amountAgorot).toBe(15000);
  });
});

describe("parsePriceFromText — from price", () => {
  it('"From ₪80"', () => {
    const r = parsePriceFromText("Tickets from ₪80, limited early bird spots available.");
    expect(r).toEqual({ kind: "from", amountAgorot: 8000, maxAmountAgorot: null, note: null });
  });

  it('does not treat "Starting at 7pm" as a from-price — real near-miss in the audit', () => {
    // Real case: "CONVERSATIONAL HEBREW WORKSHOPS" — "Starting at 7" referred to start time, not price,
    // and had no currency amount nearby at all.
    const r = parsePriceFromText("Join our weekly series. Starting at 7pm every Tuesday.");
    expect(r).toBeNull();
  });
});

describe("parsePriceFromText — range price", () => {
  it('real case: "80 NIS advance / 100NIS at the door" (Pub Crawl)', () => {
    const text = "Cost NIS80.00. If you wait until the day of, it is 100NIS at the door so buy those tickets today!";
    const r = parsePriceFromText(text);
    expect(r).toEqual({ kind: "range", amountAgorot: 8000, maxAmountAgorot: 10000, note: null });
  });

  it('real case: Hebrew advance/door pricing, "105 ש״ח במוקדמת" / "125 ש״ח בדלת" (Tzukush X Hen Porati)', () => {
    const r = parsePriceFromText('105 ש״ח במוקדמת" "125 ש״ח בדלת');
    expect(r?.kind).toBe("range");
    expect(r?.amountAgorot).toBe(10500);
    expect(r?.maxAmountAgorot).toBe(12500);
  });
});

describe("parsePriceFromText — tiered", () => {
  it('real case: "ESRA Members: Complimentary | Non-Members: ₪45"', () => {
    const r = parsePriceFromText("ESRA Members: Complimentary | Non-Members: ₪45");
    expect(r?.kind).toBe("tiered");
    expect(r?.amountAgorot).toBe(4500);
  });

  it("real case: complex multi-dimensional tiering (3-Day Galilee Culinary Escape) has no single safe number", () => {
    const text =
      "ESRA Members (Double Room): NIS 2,040. Non-Members (Double Room): NIS 2,600. " +
      "ESRA Members (Single Room): NIS 3,440. Non-Members (Single Room): NIS 3,840.";
    const r = parsePriceFromText(text);
    expect(r?.kind).toBe("tiered");
    expect(r?.amountAgorot).toBeNull();
    expect(r?.note).toBeTruthy();
  });
});

describe("parsePriceFromText — definitely paid, amount unknown", () => {
  it('real case: "Grab your tickets via the link in the bio" with no visible amount', () => {
    const r = parsePriceFromText("Grab your tickets via the link in the bio for this one.");
    expect(r?.kind).toBe("paid_unknown");
    expect(r?.amountAgorot).toBeNull();
  });
});

describe("parsePriceFromText — fully unknown", () => {
  it("returns null for genuinely uninformative text", () => {
    expect(parsePriceFromText("Join us for a great night out. RSVP required.")).toBeNull();
  });

  it('real case: no price info at all (Outback Garage Bike Fest page)', () => {
    expect(parsePriceFromText("A day of bikes, music and community at Teder.")).toBeNull();
  });
});

describe("conditionalPrice", () => {
  it('real case: "entry is free before midnight" (Thursday Party / Disco Halal Takeover)', () => {
    const p = conditionalPrice("Free before midnight");
    expect(p).toEqual({ kind: "conditional", amountAgorot: null, maxAmountAgorot: null, note: "Free before midnight" });
  });

  it('real case: "First class free!" (Memoir Workshop, recurring)', () => {
    const p = conditionalPrice("First class free");
    expect(p.kind).toBe("conditional");
  });
});

describe("parsePriceFromText — automatically recognises known conditional shapes", () => {
  // Real bug found during backfill: conditionalPrice() was only ever a
  // manual constructor — nothing in the real parsing path called it, so
  // these genuinely conditional cases fell through to null (unknown) in
  // production instead of "conditional".
  it('real case: "entry is free before midnight" (Thursday Party, Disco Halal Takeover)', () => {
    const r = parsePriceFromText("Swing by early—entry is free before midnight, paid after.");
    expect(r?.kind).toBe("conditional");
    expect(r?.note).toBe("Free before midnight");
  });

  it('real case: "free entry from the Teder yard before midnight—after that... the paid party" (Disco Halal Takeover, exact page text) — a real near-miss where the fixed 3-word phrase alone did not match', () => {
    const r = parsePriceFromText(
      "Swing by early for free entry from the Teder yard before midnight—after that, head to the garden entrance for the paid party.",
    );
    expect(r?.kind).toBe("conditional");
    expect(r?.note).toBe("Free before midnight");
  });

  it('real case: "Cost: First class free!" (Memoir Workshop)', () => {
    const r = parsePriceFromText("Facilitator: Carol Ungar\nCost: First class free!\nFor more information...");
    expect(r?.kind).toBe("conditional");
  });
});

describe("formatPriceForCard", () => {
  it("shows the exact figure for a fixed price", () => {
    expect(formatPriceForCard({ kind: "exact", amountAgorot: 8000, maxAmountAgorot: null })).toBe("₪80.00");
  });

  it("shows Free", () => {
    expect(formatPriceForCard({ kind: "free", amountAgorot: 0, maxAmountAgorot: null })).toBe("Free");
  });

  it("shows From ₪X", () => {
    expect(formatPriceForCard({ kind: "from", amountAgorot: 8000, maxAmountAgorot: null })).toBe("From ₪80.00");
  });

  it("shows a range honestly", () => {
    expect(formatPriceForCard({ kind: "range", amountAgorot: 8000, maxAmountAgorot: 10000 })).toBe("₪80.00–₪100.00");
  });

  it("shows See price for definitely-paid-unknown-amount", () => {
    expect(formatPriceForCard({ kind: "paid_unknown", amountAgorot: null, maxAmountAgorot: null })).toBe("See price");
  });

  it("shows See price for conditional pricing (never flattens to Free)", () => {
    expect(formatPriceForCard({ kind: "conditional", amountAgorot: null, maxAmountAgorot: null })).toBe("See price");
  });

  it("shows nothing at all for genuinely unknown", () => {
    expect(formatPriceForCard({ kind: "unknown", amountAgorot: null, maxAmountAgorot: null })).toBeNull();
  });

  it("a simple two-tier price reads like From ₪X on the compact card", () => {
    expect(formatPriceForCard({ kind: "tiered", amountAgorot: 4500, maxAmountAgorot: null })).toBe("From ₪45.00");
  });

  it("a complex multi-tier price (no safe number) reads as See price", () => {
    expect(formatPriceForCard({ kind: "tiered", amountAgorot: null, maxAmountAgorot: null })).toBe("See price");
  });
});

describe("formatPriceForDetail", () => {
  const source = "Nefesh B'Nefesh";

  it("names the source for a definitely-paid-unknown-amount event", () => {
    expect(formatPriceForDetail({ kind: "paid_unknown", amountAgorot: null, maxAmountAgorot: null, note: null }, source)).toBe(
      "See price on Nefesh B'Nefesh",
    );
  });

  it("uses a neutral, non-presumptive handoff for genuinely unknown pricing — never implies it's paid", () => {
    const text = formatPriceForDetail({ kind: "unknown", amountAgorot: null, maxAmountAgorot: null, note: null }, source);
    expect(text).toBe("Check details on Nefesh B'Nefesh");
    expect(text.toLowerCase()).not.toContain("see price");
  });

  it("weaves the condition into the sentence rather than flattening it away", () => {
    const p = conditionalPrice("Free before midnight");
    expect(formatPriceForDetail(p, "Secret Tel Aviv")).toBe("Free before midnight — see Secret Tel Aviv for full pricing");
  });

  it("shows the exact figure per person", () => {
    expect(formatPriceForDetail({ kind: "exact", amountAgorot: 8000, maxAmountAgorot: null, note: null }, source)).toBe(
      "₪80.00 per person",
    );
  });
});
