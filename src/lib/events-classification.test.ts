import { describe, expect, it } from "vitest";
import { classifyEvent, classifyKind, classifySourceCategory, classifySubcategory, deriveTags } from "./events-classification";

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

  // Real case, FULL live description (not a paraphrase) — a prior sprint's
  // test for this exact event used a one-line excerpt that happened not to
  // contain "party" at all, so it passed while the real bug (triggered by
  // "celebrating at the nova party", deep in the full text) went uncaught
  // in production. This is the actual text that caused it.
  it('"Faces of October 7th" memorial exhibition is not nightlife, despite mentioning "the nova party"', () => {
    const description = `StandWithUs, in partnership with graffiti artist Benzi Brofman
September 23 – October 8, 2026
10:00am-4:00pm
StandWithUs Katz Education Center
2 George Washington, Jerusalem
You are invited to reflect and remember.
Three years on, you are invited to reflect and remember the atrocities, massacres, and kidnappings of October 7th. This exhibition honors the victims of October 7th and provides a space for memorial, as we look back in sadness and look forward with unity and hope.
A powerful and inspiring exhibition:
The portraits and artwork are created by acclaimed Israeli graffiti artist Benzi Brofman. On October 6, 2023, Benzi was invited to paint live at a music festival in the Re'im parking lot in southern Israel. Contrary to his original plans, Benzi chose to return home that same day rather than stay until Saturday, October 7, 2023, avoiding tragedy by mere hours. Benzi has since devoted his art to commemorating the hostages, those who were murdered, and fallen IDF soldiers.
Today, after all the hostages have been returned to Israel the works take on an additional layer of remembrance, pain, return, and hope.
Often referred to as the Israeli "Banksy", Benzi has produced impactful art installations and murals across Israel, Europe, and beyond. The portraits in this exhibition were created with the support and collaboration of the families.
The exhibition features:
• Powerful portraits that come together to tell the deeply human story of October 7th. The portraits cover a wide range of people: those who were kidnapped to Gaza and returned alive; those who were kidnapped and buried; Civilians who went out to help the fugitives and were murdered; soldiers and commanders; celebrating at the nova party; And families whose lives were changed forever. It is a story of pain, heroism, loss, return and hope — a whole story that we must remember and not forget.
• Powerful video and narration creating a moving environment to honor October 7th victims.
• Interactive touchscreen display outlining the events of the October 7th massacre.
• Opportunity to leave a personal message of remembrance.
• Immersive and unique October 7th VR experience.
This temporary exhibition has limited availability. Reserve your spot soon to experience it in person.
Open to those living in and visiting Israel.`;
    const category = classifySourceCategory({ title: "Faces of October 7th", description, host: "StandWithUs" });
    expect(category).not.toBe("nightlife");
    expect(category).toBe("attractions");
    // Also confirm the new Exhibitions/Culture subcategory picks it up.
    const text = `Faces of October 7th ${description}`.toLowerCase();
    expect(classifySubcategory(category, text)).toBe("exhibition_culture");
  });

  // Real case, found via re-audit: this event genuinely relies on the bare
  // "live at" pattern that was removed to fix the Faces of October 7th false
  // positive above — removing it outright regressed this real concert to
  // "attractions". Fixed by requiring "live at/in" to follow an invitation
  // verb (catch/see/watch/join), which this text has and the October 7th
  // backstory tangent ("invited to paint live at") does not.
  it('"Inbal Wayne" live at Hoodna Bar is a concert, not attractions (regression from the October 7th fix)', () => {
    expect(
      classifySourceCategory({
        title: "Inbal Wayne",
        description: "Catch Inbal Wayne live at Hoodna Bar 🎶",
        host: "Secret Tel Aviv",
      }),
    ).toBe("concerts");
  });

  // Real case, FULL live description — the prior sprint's test used a
  // paraphrase ("Tel Aviv International Salon presents a talk") that never
  // contained the actual trigger, "Amcha Yisrael Party Chairman".
  it('"INVITATION: Brig. General Ofer Winter..." speaker salon is not nightlife, despite "Amcha Yisrael Party Chairman"', () => {
    const description = `"Leading Ideas, Leading Israel"




Tel Aviv International Salon, presents: The Election Series
Ofer Winter
Brigadier General (ret.) & Amcha Yisrael Party Chairman
+ Candidates Yoseph Haddad & Fleur Hassan-Nahoum
In-English Townhall + Q&A
RSVP: Above on Eventbrite
Cost: FREE
Date: Monday Oct 5th, 2026, 7pm
Venue: To Be Announced, Tel Aviv
Who: Event open to all ages
This event will be open to media. Press requests email: Info@TLVSalon.com`;
    expect(
      classifySourceCategory({
        title: "INVITATION: Brig. General Ofer Winter & Amcha Yisrael, Mon Oct 5",
        description,
        host: "Tel Aviv International Salon",
      }),
    ).not.toBe("nightlife");
  });

  it('a genuine political-party mention elsewhere ("party leader") still does not trigger nightlife on its own', () => {
    expect(
      classifySourceCategory({
        title: "Election Night Analysis",
        description: "Join us as the opposition party leader discusses the results.",
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

describe("classifySourceCategory — curated secondary native tags (added from the taxonomy audit)", () => {
  it("NBN's Lectures & Workshops tag maps to workshops", () => {
    expect(classifySourceCategory({ title: "Some Talk", sourceCategoryTags: ["Lectures & Workshops"] })).toBe("workshops");
  });

  it("NBN's Health & Wellness tag maps to wellness", () => {
    expect(classifySourceCategory({ title: "Some Session", sourceCategoryTags: ["Health & Wellness"] })).toBe("wellness");
  });

  it("NBN's Ulpan/Language Exchange tag maps to workshops", () => {
    expect(classifySourceCategory({ title: "Hebrew Practice", sourceCategoryTags: ["Ulpan/Language Exchange"] })).toBe(
      "workshops",
    );
  });

  it("a secondary tag never overrides explicit religious-practice text — real case: 'Sukkot Yom Iyun at Pardes'", () => {
    // Real native tags on this event include "Education in Israel" (deliberately
    // NOT in SECONDARY_SOURCE_TAGS — too vague per the audit). Even if it also
    // carried a curated tag like Lectures & Workshops, explicit Torah-study
    // language must still win.
    expect(
      classifySourceCategory({
        title: "Sukkot Yom Iyun at Pardes",
        description: "A day of learning with the Pardes Beit Midrash community.",
        sourceCategoryTags: ["Lectures & Workshops", "Education in Israel"],
      }),
    ).toBe("jewish");
  });

  it("does not add the vague natives the audit found unreliable (Arts/Creativity, Masorti/Conservative Community)", () => {
    // Real case, full description — "The Next Pour" was deliberately fixed
    // jewish -> food in a prior sprint (Chol HaMoed alone isn't a reliable
    // religious signal). Its real native tags include "Masorti/Conservative
    // Community" — if that were trusted, this fix would silently regress.
    expect(
      classifySourceCategory({
        title: "The Next Pour: An Evening at Jerusalem Brewing Co. for The Next Step",
        description:
          "Join The Next Step for an evening of good beer, good company, and good cause. On Wednesday, September 30th at 7:30pm, we're taking over Jerusalem Brewing for a night of unlimited beer, games, music, and a tour of the brewery. Every ticket and every sponsorship goes directly toward making sure members of our amputee community can join this event.",
        sourceCategoryTags: ["Masorti/Conservative Community", "Chol HaMoed / Holidays", "Networking"],
      }),
    ).toBe("food");
  });
});

describe("classifySourceCategory — party/parties false positives fixed by this audit", () => {
  it('real case: Hawaii photography exhibition is not nightlife, despite mentioning "party"', () => {
    const category = classifySourceCategory({
      title: "Hawaii Tel Aviv - An exhibition of nature and surfing photography from around the world",
      description: "Hawaii-themed photography exhibition and party in Tel Aviv 🎨",
      host: "Secret Tel Aviv",
    });
    expect(category).not.toBe("nightlife");
    expect(category).toBe("attractions");
  });

  it('real case: "Frisson Trio Birthday Party" is a concert (a named musical trio), not nightlife', () => {
    expect(
      classifySourceCategory({
        title: "Frisson Trio Birthday Party",
        description: "Join Frisson Trio for an exclusive birthday celebration 🎉",
        host: "Secret Tel Aviv",
      }),
    ).toBe("concerts");
  });

  it("a genuine club/party event still classifies as nightlife — the fix did not delete party detection", () => {
    expect(
      classifySourceCategory({ title: "Saturday Night Party", description: "The best club night in town, DJ till 4am." }),
    ).toBe("nightlife");
    expect(classifySourceCategory({ title: "Rooftop Party", description: "Rooftop party with drinks and dancing." })).toBe(
      "nightlife",
    );
  });
});

describe("classifySubcategory — Exhibitions / Culture (new, under Activities)", () => {
  it('real case: Hawaii exhibition gets the exhibition_culture subcategory, still under Activities', () => {
    const text = "hawaii tel aviv - an exhibition of nature and surfing photography from around the world hawaii-themed photography exhibition and party in tel aviv";
    expect(classifySubcategory("attractions", text)).toBe("exhibition_culture");
  });

  it("only fires under the attractions fallback, never overriding a more specific category", () => {
    expect(classifySubcategory("nightlife", "a wild exhibition of dance and light")).toBeNull();
    expect(classifySubcategory("jewish", "an exhibition of Jewish art, shabbat included")).toBeNull();
  });

  it("does not fire for generic attractions text with no exhibition/culture signal", () => {
    expect(classifySubcategory("attractions", "trivia and magnet making")).toBeNull();
  });
});

describe("deriveTags — Clubs (new, narrow — never inferred from generic nightlife)", () => {
  it('"club night" and "nightclub" earn the clubs tag', () => {
    expect(deriveTags({ title: "Thursday Club Night", description: "The city's best club night." }, "nightlife", null)).toContain(
      "clubs",
    );
    expect(deriveTags({ title: "Rafi Nightclub", description: "Join us at the nightclub." }, "nightlife", null)).toContain(
      "clubs",
    );
  });

  it("a bare 'club' (e.g. a book club) does not earn the clubs tag", () => {
    expect(deriveTags({ title: "Monthly Book Club", description: "Discuss this month's novel." }, "attractions", null)).not.toContain(
      "clubs",
    );
  });

  it("generic nightlife text with no explicit club wording does not earn the clubs tag", () => {
    expect(deriveTags({ title: "Disco Halal Takeover", description: "Disco takeover this Thursday." }, "nightlife", null)).not.toContain(
      "clubs",
    );
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

  it('a real Holocaust-survivor volunteering event is not nightlife, despite saying "party" three times', () => {
    // Real case (NBN, "Adopt a Safta"): a volunteer escort/care event for
    // isolated Holocaust survivors, described as a "Rosh HaShana Day Party"
    // and "partying with Holocaust Survivors" — bare "party" is genuinely
    // ambiguous (a gathering, not necessarily nightlife), and this is
    // clearly jewish/volunteering, not a night out.
    const input = {
      title: "Volunteer @ Tel Aviv Holocaust Survivor Rosh HaShana Day Party, Sept 17",
      description:
        "Starting the New Year properly by partying with Holocaust Survivors. Tel Aviv Volunteers Needed at our Rosh HaShana Day Party. " +
        "We are currently looking for Tel Aviv area volunteers who are interested in going to the homes of our seniors and escorting them " +
        'to our Rosh party event. "Tzedakah and acts of kindness are the equivalent of all the Mitzvot of the Torah." – Jerusalem Talmud',
      host: "Adopt a safta",
    };
    expect(classifySourceCategory(input)).toBe("jewish");
    const { sourceCategory, tags } = classifyEvent(input);
    expect(tags).not.toContain("nightlife");
    expect(tags).toContain("volunteering");
    expect(sourceCategory).toBe("jewish");
  });

  it('an unambiguous nightlife phrase still wins even alongside "volunteer" text', () => {
    // The guard is scoped to the ambiguous bare "party"/"parties" only —
    // genuine nightlife language (club night, DJ set, rave, ...) still
    // classifies as nightlife regardless of nearby volunteering language.
    expect(
      classifySourceCategory({
        title: "Volunteer Bartenders Wanted",
        description: "Help us run the bar at tonight's club night — DJ set starts at 11pm.",
      }),
    ).toBe("nightlife");
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

describe("classifyEvent — subcategory + tags, using the exact examples from the brief", () => {
  it('"Pub Crawl": nightlife / pub_crawl / [bars, social, group_activity]', () => {
    const result = classifyEvent({
      title: "Pub Crawl",
      description:
        "4 bars/clubs, free VIP entry to every venue, skip the lines, a free shot at every bar. We stop at bars Kuli Alma, Bavel, Mind.",
      host: "D-TLV",
    });
    expect(result.sourceCategory).toBe("nightlife");
    expect(result.subcategory).toBe("pub_crawl");
    expect(result.tags).toEqual(expect.arrayContaining(["bars", "social", "group_activity"]));
  });

  it('"Sukkah Party Under the Stars with Cocktails": jewish primary, with a nightlife-flavour tag despite not being nightlife primary', () => {
    const result = classifyEvent({
      title: "Sukkah Party Under the Stars with Cocktails — Tribe Tel Aviv",
      description:
        "Sukkah Party in Central Tel Aviv with Bartender/cocktails and live music. Young Adults in their 20s & 30s only. Our sukkah at the Ichud Olam synagogue.",
      host: "Tribe Tel Aviv",
    });
    expect(result.sourceCategory).toBe("jewish");
    expect(result.tags).toContain("nightlife"); // flavour tag, distinct from primary
    expect(result.tags).toContain("cocktails");
    expect(result.tags).toContain("young_professionals");
  });

  it('"Shabbat dinner with live music": jewish / friday_night_dinner / [food, community, live_music]', () => {
    const result = classifyEvent({
      title: "Shabbat dinner with live music",
      description: "Join our community for a Friday night dinner with live music and great food.",
      host: "Beit Daniel",
    });
    expect(result.sourceCategory).toBe("jewish");
    expect(result.subcategory).toBe("friday_night_dinner");
    expect(result.tags).toEqual(expect.arrayContaining(["food", "community", "live_music"]));
  });
});

describe("classifySubcategory — conservative, only within a matching category", () => {
  it("never assigns pub_crawl outside the nightlife category, even if the phrase appears", () => {
    expect(classifySubcategory("attractions", "read about our famous pub crawl history")).toBeNull();
  });

  it("distinguishes a genuine Friday night dinner from a generic holiday mention", () => {
    expect(classifySubcategory("jewish", "join us for shabbat dinner this friday")).toBe("friday_night_dinner");
    expect(classifySubcategory("jewish", "sukkot celebration at the community centre")).toBe("holiday_event");
  });

  it("returns null when nothing specific matches", () => {
    expect(classifySubcategory("jewish", "torah class with rabbi eli")).toBeNull();
  });
});

describe("deriveTags — category mirroring and conservative flavour tags", () => {
  it("mirrors sport/outdoors/workshops/wellness/food categories directly as tags", () => {
    expect(deriveTags({ title: "x" }, "sport", null)).toContain("sport");
    expect(deriveTags({ title: "x" }, "outdoors", null)).toContain("outdoors");
    expect(deriveTags({ title: "x" }, "workshops", null)).toContain("workshops");
    expect(deriveTags({ title: "x" }, "wellness", null)).toContain("wellness");
    expect(deriveTags({ title: "x" }, "food", null)).toContain("food");
  });

  it("does not add a redundant nightlife/live_music tag when that's already the primary category", () => {
    const nightlifeTags = deriveTags({ title: "Off Grid", description: "Mid-week techno party" }, "nightlife", null);
    expect(nightlifeTags).not.toContain("nightlife");
    const concertTags = deriveTags({ title: "Live Concert", description: "live music tonight" }, "concerts", null);
    expect(concertTags).not.toContain("live_music");
  });

  it("detects volunteering from text regardless of category", () => {
    expect(deriveTags({ title: "Otef Aza Tour", description: "A volunteer day in the Gaza Envelope" }, "outdoors", null)).toContain(
      "volunteering",
    );
  });

  it("returns no tags for genuinely generic content", () => {
    expect(deriveTags({ title: "Gilmore girls magnets", description: "Trivia and magnet making" }, "attractions", null)).toEqual([]);
  });
});
