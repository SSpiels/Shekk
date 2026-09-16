import { describe, expect, it } from "vitest";
import { classifyKind, classifySourceCategory } from "./events-classification";

/**
 * Every case below is a real event from the live published dataset, found
 * misclassified during an audit of all 104 published events (2026-09-16) —
 * not invented examples. Each `it` names the actual title.
 */

describe("classifySourceCategory — real misclassifications found in the audit", () => {
  it('"Pub Crawl" (was attractions) — the example that started this audit', () => {
    expect(
      classifySourceCategory({
        title: "Pub Crawl",
        description:
          "The best night of your life. Every Thursday and Friday night at 10PM. 4 bars/clubs, free VIP entry, a free shot at every bar. We stop at bars Kuli Alma, Bavel, Mind, Jimmy Who, Radio EPGB.",
        host: "D-TLV",
      }),
    ).toBe("nightlife");
  });

  it('"Sarit Hadad" birthday show (was attractions, no "live music"/"concert" literal match)', () => {
    expect(
      classifySourceCategory({
        title: "Sarit Hadad",
        description: "Sarit Hadad brings her massive birthday show live",
        host: "Secret Tel Aviv",
      }),
    ).toBe("concerts");
  });

  it('"Rod Stewart - Tribute show" (was attractions, no "live" at all)', () => {
    expect(
      classifySourceCategory({
        title: "Rod Stewart - Tribute show",
        description: "Experience an unforgettable tribute to Rod Stewart",
        host: "Secret Tel Aviv",
      }),
    ).toBe("concerts");
  });

  it('"Girafot" album performance (was attractions)', () => {
    expect(
      classifySourceCategory({
        title: "Girafot",
        description: "Girafot perform their iconic Gag album live",
        host: "Secret Tel Aviv",
      }),
    ).toBe("concerts");
  });

  it('"Yuval Menashe" piano songs (was attractions)', () => {
    expect(
      classifySourceCategory({
        title: "Yuval Menashe",
        description: "Yuval Menashe brings intimate piano songs to Levontin",
        host: "Secret Tel Aviv",
      }),
    ).toBe("concerts");
  });

  it('"Zanavi - Vinyl Set" (was attractions — a DJ set is nightlife, not a "concert")', () => {
    expect(
      classifySourceCategory({
        title: "Zanavi - Vinyl Set",
        description: "Eclectic vinyl sounds with Paris-born DJ Zanavi",
        host: "Secret Tel Aviv",
      }),
    ).toBe("nightlife");
  });

  it('"Disco Halal Takeover" (was attractions)', () => {
    expect(
      classifySourceCategory({
        title: "Disco Halal Takeover",
        description: "Disco Halal Takeover at Rafi this Thursday",
        host: "Secret Tel Aviv",
      }),
    ).toBe("nightlife");
  });

  it('"Faces of October 7th" memorial exhibition (was nightlife — clearly wrong)', () => {
    expect(
      classifySourceCategory({
        title: "Faces of October 7th",
        description: "StandWithUs, in partnership with graffiti artist Benzi Brofman",
        host: "StandWithUs",
      }),
    ).not.toBe("nightlife");
  });

  it('"INVITATION: Brig. General Ofer Winter..." speaker salon (was nightlife — clearly wrong)', () => {
    expect(
      classifySourceCategory({
        title: "INVITATION: Brig. General Ofer Winter & Amcha Yisrael",
        description: "Leading Ideas, Leading Israel. Tel Aviv International Salon presents a talk.",
        host: "Tel Aviv International Salon",
      }),
    ).not.toBe("nightlife");
  });

  it('"Operation Rising Lion Virtual Beit Midrash" shiurim (was attractions)', () => {
    expect(
      classifySourceCategory({
        title: "Operation Rising Lion Virtual Beit Midrash",
        description: "Join us for inspiring online shiurim, featuring exciting guest speakers.",
        host: "Young Israel in Israel",
      }),
    ).toBe("jewish");
  });

  it('"High Tea & Torah in the Garden" (was attractions)', () => {
    expect(
      classifySourceCategory({
        title: "High Tea & Torah in the Garden",
        description: "Ladies, come start your day with inspiration and connection!",
        host: "Chabad on the Coast",
      }),
    ).toBe("jewish");
  });

  it('"Night Seder Program!" yeshiva terminology (was attractions)', () => {
    expect(
      classifySourceCategory({
        title: "Night Seder Program!",
        description: "Starting tonight: new night seder program! Bring your chavrusa and come learn.",
        host: "Emek Learning Center",
      }),
    ).toBe("jewish");
  });

  it('"The Last Five Years - Musical Performance" (was jewish — a secular musical, not Jewish content)', () => {
    expect(
      classifySourceCategory({
        title: "The Last Five Years - Musical Performance",
        description: "Join us this Fall for the musical The Last Five Years!",
        host: "Living Room Productions",
      }),
    ).not.toBe("jewish");
  });

  it('"The Next Pour...for The Next Step" (was jewish, inconsistently — an amputee-charity beer tasting, not Jewish content)', () => {
    const result = classifySourceCategory({
      title: "The Next Pour: An Evening at Jerusalem Brewing Co. for The Next Step",
      description: "Join The Next Step for an evening of good beer, good company, and good cause.",
      host: "The Next Step",
    });
    expect(result).not.toBe("jewish");
  });

  it('"Comedy Show Chol Hamoed In Efrat" (was jewish — a comedy show is not religious content just because of when it happens)', () => {
    expect(
      classifySourceCategory({
        title: "Comedy Show Chol Hamoed In Efrat",
        description: "COMEDY NIGHT IN EFRAT, SUKKOT! Mikey Greenblatt of JSKETCH is coming.",
        host: "Nefesh B'Nefesh",
      }),
    ).not.toBe("jewish");
  });

  it("same event, two occurrences with different source tags, now classifies consistently", () => {
    // Reproduces the real inconsistency: NBN tagged one occurrence of this
    // recurring event "Chol HaMoed / Holidays" and another one didn't.
    const base = {
      title: "StandWithUs Jerusalem Gala Evening",
      description: "You are invited for an inspirational evening in support of StandWithUs.",
      host: "Stand With Us",
    };
    const withHolidayTag = classifySourceCategory({ ...base, sourceCategoryTags: ["Chol HaMoed / Holidays"] });
    const withoutTag = classifySourceCategory({ ...base, sourceCategoryTags: [] });
    expect(withHolidayTag).toBe(withoutTag);
  });

  it("NBN's own explicit Tiyulim/Tours and Sport/Excercise tags map directly (preserved from the pre-refactor adapter)", () => {
    expect(classifySourceCategory({ title: "Some Trip", sourceCategoryTags: ["Tiyulim/Tours"] })).toBe("outdoors");
    expect(classifySourceCategory({ title: "Some Session", sourceCategoryTags: ["Sport/Excercise"] })).toBe("sport");
  });

  it("NBN's own explicit Shabbat Meals & Activities tag still wins outright", () => {
    expect(
      classifySourceCategory({
        title: "Some Friday Gathering",
        description: "Come join us",
        host: "A Host",
        sourceCategoryTags: ["Shabbat Meals & Activities"],
      }),
    ).toBe("jewish");
  });
});

describe("classifySourceCategory — new subcategories (still fold into the Activities discovery tab)", () => {
  it('"How To Find Work The Israeli Way" is a workshop, not a bare attraction', () => {
    expect(
      classifySourceCategory({
        title: 'How To Find Work The "Israeli Way"',
        description: "Stop Guessing. Start Getting Interviews. A career workshop.",
        host: "ESRA",
      }),
    ).toBe("workshops");
  });

  it('"Move. Feel. Connect." Feldenkrais lessons is wellness, not generic sport', () => {
    expect(
      classifySourceCategory({
        title: "Move. Feel. Connect. Online Feldenkrais Lessons with Dr. Hillel",
        description: "Feldenkrais helps you improve your physical, mental & spiritual well-being.",
        host: "Somatic Well",
      }),
    ).toBe("wellness");
  });
});

describe("classifySourceCategory — word-boundary matching (caught during this audit, before shipping)", () => {
  it('does not match "disco" inside "discover"/"discovery"', () => {
    // Real cases: a career webinar ("...uncover important details...you'll
    // discover...") and a history tour ("discover thousands of years of
    // history") both got misclassified nightlife before this was fixed.
    expect(
      classifySourceCategory({
        title: "Memoir Workshop with Carol Ungar",
        description: "Come discover the power of your story and connect with others through the art of memoir writing.",
        host: "Nefesh B'Nefesh",
      }),
    ).not.toBe("nightlife");
  });

  it('does not match "rave" inside "travel"/"traveling"', () => {
    expect(
      classifySourceCategory({
        title: "3-Day Galilee Culinary Escape",
        description: "Come on your own, with a partner or with friends. Traveling solo? We'll help arrange room-sharing.",
        host: "ESRA",
      }),
    ).not.toBe("nightlife");
  });

  it('a real memorial dedication ("a tribute to [name]") is not a music tribute act', () => {
    // Real case: a gala evening description mentioning "a special tribute
    // to Sgt. Natan Rosenfeld z\"l" got misclassified as a concert.
    expect(
      classifySourceCategory({
        title: "StandWithUs Jerusalem Gala Evening",
        description: "Plus, a special tribute to Sgt. Natan Rosenfeld z\"l, and hear from young leaders.",
        host: "Stand With Us",
      }),
    ).not.toBe("concerts");
  });
});

describe("classifySourceCategory — unrelated categories are unaffected (no regressions)", () => {
  it("a real farmers market stays food", () => {
    expect(
      classifySourceCategory({ title: "Ze Mipo Farmers Market", description: "Weekly farmers market vibes", host: "Secret Tel Aviv" }),
    ).toBe("food");
  });

  it("a real Gaza envelope tour stays outdoors", () => {
    expect(
      classifySourceCategory({
        title: "Otef Aza Tour for Young Professionals",
        description: "A full day tour of the Gaza Envelope",
        host: "Zionist Education Initiative",
      }),
    ).toBe("outdoors");
  });

  it("a real football open practice stays sport", () => {
    expect(
      classifySourceCategory({ title: "Judean Football, Open Practices!", description: "Open practices/tryouts", host: "Jason Hess" }),
    ).toBe("sport");
  });

  it("genuinely unclassifiable content still falls back to attractions", () => {
    expect(classifySourceCategory({ title: "Gilmore girls magnets", description: "Trivia and magnet making", host: "Secret Tel Aviv" })).toBe(
      "attractions",
    );
  });

  it("does not guess concerts from a bare, ambiguous 'festival'", () => {
    expect(classifySourceCategory({ title: "Freedom to Create Festival - 70 Together", host: "Secret Tel Aviv" })).toBe("attractions");
    expect(classifySourceCategory({ title: "Live Music Festival", host: "Secret Tel Aviv" })).toBe("concerts");
  });

  it("does not guess food from a bare, ambiguous 'market'", () => {
    expect(classifySourceCategory({ title: "Jaffa Flea Market", host: "Secret Tel Aviv" })).toBe("attractions");
    expect(classifySourceCategory({ title: "Ze Mipo Farmers Market", host: "Secret Tel Aviv" })).toBe("food");
  });
});

describe("classifyKind", () => {
  it("labels an explicit Shabbat dinner a shabbaton", () => {
    expect(classifyKind("jewish", "Friday Night Shabbat Dinner")).toBe("shabbaton");
  });
  it("labels nightlife club and outdoors tiyul", () => {
    expect(classifyKind("nightlife", "Pub Crawl")).toBe("club");
    expect(classifyKind("outdoors", "Hiking trip")).toBe("tiyul");
  });
});
