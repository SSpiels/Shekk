#!/usr/bin/env node
/**
 * Seeds the "Aardvark Israel" demo programme: a realistic gap-year cohort with a
 * schedule, announcements, checklist, contacts, places, groups, votes and ~18
 * fictional students, so the whole student AND staff experience can be shown.
 *
 *   node scripts/seed-aardvark-demo.mjs [--demo-date=2026-10-26] [--dry-run]
 *        [--owner-emails=you@example.com,other@example.com]
 *        [--logins=<file>] [--manifest=<file>]
 *   node scripts/seed-aardvark-demo.mjs --teardown --manifest=<file>
 *
 * Safe by construction:
 *  - Everything is scoped to ONE programme (slug `aardvark-israel-demo`) and its
 *    cohort. Re-running wipes and rebuilds that cohort's content only.
 *  - Fictional accounts all use the domain @aardvark-demo.example.test (an address
 *    that cannot receive mail). Real accounts named in --owner-emails are only
 *    ever ADDED as programme owner; nothing else about them is touched.
 *  - Passwords for the three demo logins are written to the --logins file (never
 *    printed). Credentials come from .env / .env.local and are never printed.
 *  - Dates are relative to --demo-date so the demo always has a live week.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/* ------------------------------------------------------------------ setup --- */

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const env = {};
for (const f of [".env", ".env.local"]) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}
const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) {
  console.error("Missing Supabase URL or service key in .env / .env.local");
  process.exit(1);
}
const db = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const has = (n) => args.includes(`--${n}`);
const DEMO_DATE = flag("demo-date") ?? "2026-10-26";
const DRY = has("dry-run");
const LOGINS_FILE = flag("logins");
const MANIFEST = flag("manifest");
const OWNER_EMAILS = (flag("owner-emails") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const SLUG = "aardvark-israel-demo";
const DOMAIN = "aardvark-demo.example.test";

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

/* ------------------------------------------------------------------- time --- */

function tzOffsetMin(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem", hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}
/** ISO instant for `h:m` Israel time, `d` days from the demo date. */
function at(d, h, m = 0) {
  const [Y, M, D] = DEMO_DATE.split("-").map(Number);
  const base = Date.UTC(Y, M - 1, D + d, h, m);
  let t = base - tzOffsetMin(new Date(base)) * 60000;
  t = base - tzOffsetMin(new Date(t)) * 60000;
  return new Date(t).toISOString();
}
const dateOnly = (d) => at(d, 12).slice(0, 10);

// small deterministic random, so a re-run builds the same cohort
let seed = 20261026;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chance = (p) => rnd() < p;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/* ---------------------------------------------------------------- people --- */

const STUDENTS = [
  ["Maya", "Goldberg", "United States", "New York"],
  ["Noah", "Fischer", "United Kingdom", "London"],
  ["Ella", "Rosenthal", "Canada", "Toronto"],
  ["Jonah", "Katz", "Australia", "Melbourne"],
  ["Talia", "Ben-David", "South Africa", "Johannesburg"],
  ["Ethan", "Marcus", "United States", "Chicago"],
  ["Shira", "Levin", "United States", "Los Angeles"],
  ["Daniel", "Cohen", "United Kingdom", "Manchester"],
  ["Abigail", "Stern", "United States", "Philadelphia"],
  ["Lior", "Shapiro", "France", "Paris"],
  ["Hannah", "Weiss", "Canada", "Montreal"],
  ["Gabriel", "Mizrahi", "Brazil", "Sao Paulo"],
  ["Rachel", "Friedman", "United States", "Boston"],
  ["Joshua", "Green", "Australia", "Sydney"],
  ["Naomi", "Berger", "United Kingdom", "Leeds"],
  ["Adam", "Kaplan", "United States", "Miami"],
  ["Yael", "Segal", "Argentina", "Buenos Aires"],
  ["Benji", "Rubin", "United States", "Baltimore"],
];
const AREAS = ["Rehavia dorms", "Bayit Vegan apartments", "Talpiot apartments", "German Colony flats"];
const INTERESTS = ["hiking", "ulpan", "volunteering", "food", "music", "sport", "art", "history"];

const STAFF_DEMO = [
  { key: "director", first: "Daniel", last: "Rosen", role: "owner", permissions: [], login: true },
  { key: "madricha", first: "Noa", last: "Levi", role: "staff", permissions: ["events", "announcements", "participants", "checklists", "acknowledgements"], login: true },
  { key: "madrich", first: "Eitan", last: "Mizrahi", role: "staff", permissions: [], login: false },
];

/* ------------------------------------------------------------------ users --- */

const allUsers = new Map(); // email -> id
async function loadUsers() {
  for (let page = 1; page < 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("list users: " + error.message);
    for (const u of data.users) if (u.email) allUsers.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
}
const pw = () => "Ard!" + randomBytes(9).toString("base64url") + "9z";
const created = []; // { email, password } for newly created accounts we want to hand over

async function ensureUser(email, { keepPassword = false } = {}) {
  email = email.toLowerCase();
  if (allUsers.has(email)) return { id: allUsers.get(email), password: null };
  const password = pw();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: "aardvark" } });
  if (error) throw new Error(`create ${email}: ${error.message}`);
  allUsers.set(email, data.user.id);
  if (keepPassword) created.push({ email, password });
  return { id: data.user.id, password };
}

/* ------------------------------------------------------------- teardown --- */

if (has("teardown")) {
  if (!MANIFEST || !existsSync(MANIFEST)) {
    console.error("--teardown needs --manifest=<file> (written by the seed run)");
    process.exit(1);
  }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (DRY) {
    console.log(`would remove programme ${m.programmeId}, ${m.demoUserIds.length} fictional accounts`);
    process.exit(0);
  }
  // programmes cascade to cohorts, content, staff and memberships
  must(await db.from("programmes").delete().eq("id", m.programmeId).eq("slug", SLUG), "delete programme");
  for (const id of m.demoUserIds) await db.auth.admin.deleteUser(id);
  console.log(`removed the Aardvark programme and ${m.demoUserIds.length} fictional accounts`);
  process.exit(0);
}

/* -------------------------------------------------------------- programme --- */

async function ensureProgramme() {
  const row = {
    name: "Aardvark Israel",
    slug: SLUG,
    organisation: "Aardvark Israel",
    city: "Jerusalem",
    country: "Israel",
    description:
      "Demo programme prepared for a product walkthrough. Every student, event and announcement in it is sample content.",
    programme_type: "gap_year",
    status: "active",
    is_demo: true,
    verified_at: new Date().toISOString(),
  };
  const { data: existing } = await db.from("programmes").select("id").eq("slug", SLUG).maybeSingle();
  if (existing) {
    must(await db.from("programmes").update(row).eq("id", existing.id), "update programme");
    return existing.id;
  }
  return must(await db.from("programmes").insert(row).select("id").single(), "create programme").id;
}

async function ensureCohort(programmeId) {
  const row = {
    programme_id: programmeId,
    name: "Gap Year",
    year: "2026–27",
    join_code: "AARDVARK26",
    status: "open",
    is_demo: true,
    timezone: "Asia/Jerusalem",
    starts_on: "2026-09-01",
    ends_on: "2027-06-30",
    welcome_message:
      "Welcome to your gap year in Israel! This is where your timetable, announcements, contacts and checklist live. If anything is unclear, your madrichim are one message away.",
  };
  const { data: existing } = await db.from("programme_cohorts").select("id").eq("programme_id", programmeId).limit(1).maybeSingle();
  if (existing) {
    must(await db.from("programme_cohorts").update(row).eq("id", existing.id), "update cohort");
    return existing.id;
  }
  return must(await db.from("programme_cohorts").insert(row).select("id").single(), "create cohort").id;
}

async function wipe(cohortId) {
  for (const t of [
    "programme_notifications", "programme_acknowledgements", "programme_audiences", "programme_votes",
    "programme_announcements", "programme_events", "programme_checklist_items", "programme_documents",
    "programme_contacts", "programme_places", "programme_groups", "programme_student_details",
  ]) {
    must(await db.from(t).delete().eq("cohort_id", cohortId), `wipe ${t}`);
  }
}

const fill = (template, rows) => rows.map((r) => ({ ...template, ...r }));

/* ---------------------------------------------------------------- content --- */

async function seedContent(cohortId, ownerId, groups) {
  /* Events: a live week around the demo date plus two weeks either side. */
  const E = (d, h, m, durMin, title, extra = {}) => ({
    title, starts_at: at(d, h, m), ends_at: at(d, h, m + durMin), ...extra,
  });
  const ULPAN = "Ulpan Centre, Rehavia";
  const MERKAZ = "The Merkaz, Emek Refaim";
  const events = [
    // last week (history)
    E(-6, 8, 30, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true, status: "completed" }),
    E(-4, 9, 0, 300, "Jerusalem: Old City walking tour", { location_label: "Jaffa Gate", meeting_point: "Outside Jaffa Gate, by the taxi rank", event_type: "trip", status: "completed" }),
    // demo week
    E(0, 8, 30, 120, "Ulpan: Aleph & Bet", { description: "Your morning Hebrew class. Bring your notebook and homework.", location_label: ULPAN, event_type: "class", mandatory: true }),
    E(0, 12, 30, 60, "Lunch & learn: Israeli society 101", { description: "A relaxed talk and Q&A with a guest speaker, with lunch provided.", location_label: MERKAZ, event_type: "class" }),
    E(0, 16, 0, 180, "Volunteering: food bank packing", { description: "Closed shoes please. Counts towards your volunteering hours.", location_label: "Pantry warehouse, Talpiot", meeting_point: "Merkaz entrance, 15:30 — minibus leaves on time", event_type: "activity", rsvp_enabled: true, capacity: 12 }),
    E(0, 19, 30, 90, "Community dinner at the Merkaz", { description: "Cohort dinner. Dietary needs are on file with the kitchen.", location_label: MERKAZ, event_type: "meal" }),
    E(1, 8, 30, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true }),
    E(1, 13, 0, 120, "Internship placement meetings", { description: "One-to-one slots with the placements team. Check your time in your messages.", location_label: MERKAZ, event_type: "meeting", mandatory: true }),
    E(1, 18, 30, 75, "Krav Maga taster", { description: "No experience needed. Bring water and wear trainers.", location_label: "Sports hall, Gonenim", event_type: "activity", rsvp_enabled: true, capacity: 15 }),
    E(2, 8, 30, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true }),
    E(2, 10, 30, 240, "Yad Vashem guided visit", { description: "A guided visit followed by time to reflect together. Please read the visit guidelines first.", location_label: "Yad Vashem, Har Hazikaron", meeting_point: "Bus A and Bus B leave the Merkaz at 10:00", event_type: "trip", mandatory: true, requires_ack: true }),
    E(2, 18, 0, 45, "Madrich check-in", { location_label: MERKAZ, event_type: "meeting" }),
    E(3, 8, 30, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true }),
    E(3, 14, 0, 210, "Machane Yehuda market and cooking workshop", { description: "Shop for ingredients with a local chef, then cook together. Limited spaces.", location_label: "Machane Yehuda Market", meeting_point: "Agrippas entrance by the fountain", event_type: "activity", rsvp_enabled: true, capacity: 18, status: "delayed", status_note: "Moved back 30 minutes — the chef's train is delayed.", original: [3, 13, 30] }),
    E(3, 20, 30, 120, "Open mic night", { description: "Perform or just cheer. Sign up with Noa.", location_label: "Cafe Rimon, Ben Yehuda", event_type: "activity" }),
    E(4, 9, 0, 120, "Bus to Tzfat for Shabbaton", { description: "Bags on the bus 15 minutes before we leave. Check the packing list.", location_label: MERKAZ, meeting_point: "Merkaz car park", event_type: "travel", mandatory: true, requires_ack: true }),
    E(4, 18, 0, 75, "Kabbalat Shabbat in Tzfat", { location_label: "Ascent of Tzfat synagogue", event_type: "shabbat" }),
    E(4, 19, 30, 90, "Shabbat dinner with host families", { description: "You will eat with a local family. Details of your host were sent to you.", location_label: "Tzfat Old City", event_type: "meal" }),
    E(5, 10, 0, 90, "Shabbat shiur and free time", { location_label: "Tzfat", event_type: "shabbat" }),
    E(5, 19, 30, 60, "Havdalah and bus home", { location_label: "Tzfat", event_type: "shabbat" }),
    E(6, 9, 0, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true }),
    E(6, 11, 30, 90, "Seminar: Israel 1948 to 1967", { description: "History seminar with discussion.", location_label: MERKAZ, event_type: "class" }),
    // next week
    E(7, 8, 30, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true }),
    E(8, 7, 30, 600, "Masada sunrise and Dead Sea", { description: "Early start. Two litres of water minimum, a hat and sunscreen. Swimmers welcome.", location_label: "Masada", meeting_point: "Merkaz car park, 04:15 sharp", event_type: "trip", rsvp_enabled: true, capacity: 30, requires_ack: true }),
    E(9, 18, 0, 60, "Cohort meeting", { description: "Weekly catch-up: what is coming up and your feedback.", location_label: MERKAZ, event_type: "meeting" }),
    E(10, 17, 0, 90, "Hebrew conversation workshop", { location_label: ULPAN, event_type: "class", rsvp_enabled: true, capacity: 20 }),
    E(11, 10, 0, 480, "Tel Aviv free day", { description: "Free day in Tel Aviv. Meet back at the bus at 18:00 sharp.", location_label: "Tel Aviv", meeting_point: "Central Bus Station, platform 4", event_type: "trip", status: "tentative", requires_ack: true }),
    E(12, 17, 30, 90, "Beach volleyball", { location_label: "Gordon Beach, Tel Aviv", event_type: "activity", status: "cancelled", status_note: "Cancelled — forecast storms. We will reschedule." }),
    E(13, 19, 0, 120, "Parents' video call evening", { description: "Optional: a live call so families can hear how the programme is going.", location_label: MERKAZ, event_type: "meeting" }),
    E(14, 8, 30, 120, "Ulpan: Aleph & Bet", { location_label: ULPAN, event_type: "class", mandatory: true }),
    E(16, 9, 0, 1200, "Negev desert weekend (departure)", { description: "Three days in the Negev. Full kit list on your checklist.", location_label: MERKAZ, meeting_point: "Merkaz car park", event_type: "travel", mandatory: true, requires_ack: true }),
  ];

  const template = {
    cohort_id: cohortId, created_by: ownerId, timezone: "Asia/Jerusalem", title: "", description: null,
    starts_at: "", ends_at: null, original_starts_at: null, location_label: null, meeting_point: null,
    online_url: null, event_type: "activity", mandatory: false, status: "scheduled", status_note: null,
    audience_kind: "everyone", rsvp_enabled: false, capacity: null, requires_ack: false, urgent: false,
  };
  const rows = fill(template, events.map(({ original, ...e }) => (original ? { ...e, original_starts_at: at(...original) } : e)));
  const inserted = must(await db.from("programme_events").insert(rows).select("id, title, status, starts_at, rsvp_enabled, capacity, requires_ack"), "events");
  const byKey = new Map(inserted.map((e) => [`${e.title}|${e.starts_at}`, e]));

  // history for the delayed and cancelled events, the way a real change would leave it
  const delayed = inserted.find((e) => e.status === "delayed");
  const cancelled = inserted.find((e) => e.status === "cancelled");
  const changes = [];
  if (delayed) changes.push({ cohort_id: cohortId, event_id: delayed.id, field: "starts_at", before_value: at(3, 13, 30), after_value: at(3, 14, 0), note: "Moved back 30 minutes — the chef's train is delayed.", notify_level: "notify", changed_by: ownerId });
  if (cancelled) changes.push({ cohort_id: cohortId, event_id: cancelled.id, field: "status", before_value: "scheduled", after_value: "cancelled", note: "Cancelled — forecast storms. We will reschedule.", notify_level: "notify", changed_by: ownerId });
  if (changes.length) must(await db.from("programme_event_changes").insert(changes), "event changes");

  // the Masada trip is aimed at Bus A only
  const masada = inserted.find((e) => e.title.startsWith("Masada"));
  if (masada) must(await db.from("programme_events").update({ audience_kind: "groups" }).eq("id", masada.id), "masada audience"), must(await db.from("programme_audiences").insert({ cohort_id: cohortId, subject_type: "event", subject_id: masada.id, group_id: groups["Bus A"] }), "masada group");

  /* Announcements */
  const aTemplate = { cohort_id: cohortId, created_by: ownerId, title: "", body: null, priority: "normal", pinned: false, requires_ack: false, audience_kind: "everyone", event_id: null, link_url: null };
  const shabbaton = inserted.find((e) => e.title.startsWith("Bus to Tzfat"));
  const announcements = must(
    await db.from("programme_announcements").insert(
      fill(aTemplate, [
        { title: "Welcome to the Aardvark gap year", body: "We're so glad you're here. Your timetable, contacts and checklist all live in this app — start with the checklist, and say hi to your madrichim.", priority: "important", pinned: true },
        { title: "Shabbaton to Tzfat — be at the Merkaz by 09:00 on Friday", body: "Bags on the bus 15 minutes before we leave. Please confirm you have seen this so we know everyone is accounted for.", priority: "urgent", requires_ack: true, event_id: shabbaton?.id ?? null },
        { title: "Curfew reminder", body: "Back in your apartments by 23:00 on weeknights. If you're going to be late, message your madrich before 22:00.", priority: "important", requires_ack: true },
        { title: "Krav Maga taster — spaces left", body: "A few places remain for Tuesday evening. RSVP on the schedule.", priority: "normal" },
        { title: "Laundry pickup moves to Thursday", body: "Bags outside your door by 08:00.", priority: "normal" },
        { title: "Mid-programme feedback", body: "We'd love your feedback on the first two months. It takes five minutes and is anonymous.", priority: "normal", link_url: "https://example.com/aardvark-demo-feedback" },
      ]),
    ).select("id, title, requires_ack"),
    "announcements",
  );

  /* Votes */
  const vTemplate = { cohort_id: cohortId, question: "", description: null, status: "open", anonymous: true, allow_change: true, results_visible: true, closes_at: null, created_by: ownerId, vote_kind: "poll", audience_kind: "everyone" };
  const votes = must(
    await db.from("programme_votes").insert([
      { ...vTemplate, question: "Where should next Friday night's dinner be?", description: "Pick one. Some options have limited places.", closes_at: at(2, 20, 0) },
      { ...vTemplate, question: "Cohort hoodie colour", description: "Voting is closed. Thanks everyone!", status: "closed", closes_at: at(-3, 20, 0) },
    ]).select("id, question, status"),
    "votes",
  );
  const openVote = votes.find((v) => v.status === "open");
  const closedVote = votes.find((v) => v.status === "closed");
  const optionRows = [
    { vote_id: openVote.id, label: "Host family dinners in Nachlaot", detail: "Small tables, home cooking", capacity: null, sort_order: 0 },
    { vote_id: openVote.id, label: "Merkaz BBQ on the roof", detail: "Everyone together", capacity: null, sort_order: 1 },
    { vote_id: openVote.id, label: "Shabbat in Tel Aviv", detail: "Limited to 12", capacity: 12, sort_order: 2 },
    { vote_id: closedVote.id, label: "Navy", detail: null, capacity: null, sort_order: 0 },
    { vote_id: closedVote.id, label: "Forest green", detail: null, capacity: null, sort_order: 1 },
    { vote_id: closedVote.id, label: "Burgundy", detail: null, capacity: null, sort_order: 2 },
  ];
  const options = must(await db.from("programme_vote_options").insert(optionRows).select("id, vote_id, sort_order"), "vote options");

  /* Checklist: the standard before-you-fly items plus programme-specific ones */
  const base = [
    ["passport", "Check your passport is valid", "Most programmes need at least six months of validity beyond your return date.", null, null, true],
    ["visa", "Sort your visa or entry paperwork", "Check what your nationality and programme length require.", "visa", "/explore/visa", true],
    ["insurance", "Arrange travel and health insurance", "Bring the policy number and hotline with you, not just the email.", "insurance", "/services/insurance", true],
    ["esim", "Get an eSIM or SIM for Israel", "Have data working the moment you land, before you look for wifi.", "esim", "/services/esim", true],
    ["emergency_contact", "Give us an emergency contact", "One person at home your programme can reach.", null, null, true],
    ["flight_info", "Send your flight details", "Flight number, landing time and terminal so pickups can be planned.", null, null, true],
    ["medication", "Documentation for any medication", "A letter or prescription copy for anything you fly with.", null, null, false],
    ["packing", "Pack for the season", "Check the weather for your dates and what your programme asks you to bring.", null, null, false],
    ["programme_forms", "Return your programme forms", "Whatever your programme office still needs signed.", null, null, true],
    ["code_of_conduct", "Sign the programme code of conduct", "Read it with your madrich, then sign. It takes ten minutes.", null, null, true],
    ["whatsapp", "Join the cohort WhatsApp group", "Ask Noa for the link. This is where quick day-to-day updates go.", null, null, false],
    ["shabbat_host", "Tell us your Shabbat dietary needs", "So host families and the kitchen can cater for you.", null, null, true],
  ];
  const checklist = must(
    await db.from("programme_checklist_items").insert(
      base.map(([item_key, title, details, feature_key, action_url, required], i) => ({ cohort_id: cohortId, item_key, title, details, required, action_url, feature_key, sort_order: i })),
    ).select("id, item_key, required"),
    "checklist",
  );

  /* Contacts, documents, places */
  const cTemplate = { cohort_id: cohortId, name: "", role: null, category: "other", phone: null, whatsapp: null, email: null, notes: null, availability: null, is_emergency: false, audience_kind: "everyone", sort_order: 0 };
  must(await db.from("programme_contacts").insert(fill(cTemplate, [
    { name: "Noa Levi", role: "Madricha, Bus A", category: "madrich", phone: "+972 50 000 0101", whatsapp: "+972 50 000 0101", availability: "07:00–23:00", sort_order: 0 },
    { name: "Eitan Mizrahi", role: "Madrich, Bus B", category: "madrich", phone: "+972 50 000 0102", whatsapp: "+972 50 000 0102", availability: "07:00–23:00", sort_order: 1 },
    { name: "Daniel Rosen", role: "Programme director", category: "office", phone: "+972 50 000 0103", email: "director@aardvark-demo.example.test", availability: "Sun–Thu 09:00–17:00", sort_order: 2 },
    { name: "Programme office", role: "Office", category: "office", phone: "+972 2 000 0000", email: "office@aardvark-demo.example.test", availability: "Sun–Thu 09:00–17:00", sort_order: 3 },
    { name: "Medical support (nurse on call)", role: "Health", category: "other", phone: "+972 50 000 0104", availability: "24/7", notes: "For anything health-related, day or night.", sort_order: 4 },
    { name: "24/7 emergency line", role: "Emergency", category: "emergency", phone: "+972 50 000 0105", is_emergency: true, notes: "Sample number for the demo.", sort_order: 5 },
  ])), "contacts");

  must(await db.from("programme_documents").insert([
    { cohort_id: cohortId, label: "Programme handbook", description: "Rules, curfew, what the programme covers and who to call.", link_url: "https://example.com/aardvark-demo-handbook", category: "handbook", sort_order: 0, created_by: ownerId },
    { cohort_id: cohortId, label: "Shabbaton packing list", description: "What to bring to Tzfat.", link_url: "https://example.com/aardvark-demo-packing", category: "other", sort_order: 1, created_by: ownerId },
    { cohort_id: cohortId, label: "Yad Vashem visit guidelines", description: "Please read before Wednesday.", link_url: "https://example.com/aardvark-demo-yad-vashem", category: "other", sort_order: 2, created_by: ownerId },
    { cohort_id: cohortId, label: "Volunteering placement guide", description: "How your weekly volunteering is organised.", link_url: "https://example.com/aardvark-demo-volunteering", category: "other", sort_order: 3, created_by: ownerId },
  ]), "documents");

  const pTemplate = { cohort_id: cohortId, created_by: ownerId, label: "", category: "other", notes: null, meeting_instructions: null, google_place_id: null, address: null, latitude: null, longitude: null, audience_kind: "everyone", sort_order: 0 };
  must(await db.from("programme_places").insert(fill(pTemplate, [
    { label: "The Merkaz: home base", category: "campus", notes: "Dinner, cohort meetings and the madrichim office.", address: "Emek Refaim, Jerusalem", latitude: 31.7621, longitude: 35.2168, sort_order: 0 },
    { label: "Ulpan Centre", category: "other", notes: "Hebrew classes, second floor.", address: "Rehavia, Jerusalem", latitude: 31.7740, longitude: 35.2150, sort_order: 1 },
    { label: "Jaffa Gate: tour meeting point", category: "meeting_point", meeting_instructions: "Outside the gate by the taxi rank. Be there ten minutes early.", address: "Jaffa Gate, Old City, Jerusalem", latitude: 31.7767, longitude: 35.2277, sort_order: 2 },
    { label: "Machane Yehuda market", category: "other", meeting_instructions: "Agrippas entrance, by the fountain.", address: "Agrippas St, Jerusalem", latitude: 31.7850, longitude: 35.2124, sort_order: 3 },
    { label: "Central Bus Station", category: "meeting_point", meeting_instructions: "Platform 4 for Tel Aviv day trips.", address: "Jaffa Rd, Jerusalem", latitude: 31.7889, longitude: 35.2034, sort_order: 4 },
    { label: "Pantry warehouse (volunteering)", category: "other", address: "Talpiot, Jerusalem", latitude: 31.7480, longitude: 35.2250, sort_order: 5 },
  ])), "places");

  return { inserted, announcements, votes, options, checklist, byKey };
}

/* ----------------------------------------------------------- run the seed --- */

async function main() {
  console.log(`Aardvark demo seed, anchored on ${DEMO_DATE}${DRY ? " (dry run: nothing written)" : ""}`);
  await loadUsers();
  if (DRY) {
    console.log(`would create/refresh: 1 programme, 1 cohort, ${STAFF_DEMO.length} demo staff, ${STUDENTS.length} students, owners ${OWNER_EMAILS.join(", ") || "(none)"}`);
    return;
  }

  const programmeId = await ensureProgramme();
  const cohortId = await ensureCohort(programmeId);
  await wipe(cohortId);

  /* Staff accounts */
  const staffIds = {};
  for (const s of STAFF_DEMO) {
    const email = `${s.first}.${s.last}@${DOMAIN}`.toLowerCase();
    const { id } = await ensureUser(email, { keepPassword: s.login });
    staffIds[s.key] = id;
    await db.from("member_handles").upsert({ user_id: id, handle: `ard_${s.first}_${s.last}`.toLowerCase().replace(/[^a-z0-9_]/g, ""), display_name: `${s.first} ${s.last}`, discoverable: false }, { onConflict: "user_id" });
    await db.from("member_travel").upsert({ user_id: id, travel_style: "programme", display_name: `${s.first} ${s.last}`, israel_city: "Jerusalem", home_country: "Israel", onboarding_step: "done", onboarding_completed_at: new Date().toISOString() }, { onConflict: "user_id" });
    must(await db.from("programme_staff").upsert({ programme_id: programmeId, user_id: id, role: s.role, permissions: s.permissions }, { onConflict: "programme_id,user_id" }), "staff row");
  }
  // real accounts named by the operator become owners (added only; nothing else about them is touched)
  const ownerAdded = [];
  for (const email of OWNER_EMAILS) {
    const id = allUsers.get(email);
    if (!id) { console.log(`  (no account found for ${email}; skipped)`); continue; }
    const { data: existing } = await db.from("programme_staff").select("id").eq("programme_id", programmeId).eq("user_id", id).maybeSingle();
    if (!existing) must(await db.from("programme_staff").insert({ programme_id: programmeId, user_id: id, role: "owner", permissions: [] }), "owner row");
    ownerAdded.push(email);
  }

  /* Groups first (events and members refer to them) */
  const groupRows = must(await db.from("programme_groups").insert([
    { cohort_id: cohortId, name: "Bus A", description: "North bus", colour: "#2563eb", sort_order: 0 },
    { cohort_id: cohortId, name: "Bus B", description: "South bus", colour: "#0f766e", sort_order: 1 },
    { cohort_id: cohortId, name: "Ulpan Aleph", description: "Beginners Hebrew", colour: "#b45309", sort_order: 2 },
    { cohort_id: cohortId, name: "Ulpan Bet", description: "Intermediate Hebrew", colour: "#7c3aed", sort_order: 3 },
    { cohort_id: cohortId, name: "Volunteering team", description: "Pantry and community projects", colour: "#be123c", sort_order: 4 },
  ]).select("id, name"), "groups");
  const groups = Object.fromEntries(groupRows.map((g) => [g.name, g.id]));

  const content = await seedContent(cohortId, staffIds.director, groups);

  /* Students */
  const studentIds = [];
  const reqChecklist = content.checklist.filter((c) => c.required);
  const goingByEvent = new Map();
  for (let i = 0; i < STUDENTS.length; i++) {
    const [first, last, country, city] = STUDENTS[i];
    const email = `${first}.${last}@${DOMAIN}`.toLowerCase().replace(/[^a-z0-9.@-]/g, "");
    const isLogin = i === 0; // Maya is the demo student login
    const { id } = await ensureUser(email, { keepPassword: isLogin });
    studentIds.push(id);

    const status = i >= STUDENTS.length - 2 ? "pre_arrival" : i === 5 ? "temporarily_away" : "active";
    const arrived = status !== "pre_arrival";
    const complete = status === "active" ? 0.85 : status === "temporarily_away" ? 0.7 : 0.35;

    await db.from("member_handles").upsert({ user_id: id, handle: `${first}_${last[0]}_${26}`.toLowerCase().replace(/[^a-z0-9_]/g, ""), display_name: `${first} ${last}`, discoverable: true }, { onConflict: "user_id" });
    await db.from("member_travel").upsert({
      user_id: id, travel_style: "programme", display_name: `${first} ${last}`, home_country: country,
      israel_city: "Jerusalem", accommodation_area: pick(AREAS),
      arrival_date: dateOnly(arrived ? -55 + Math.floor(rnd() * 6) : 9 + Math.floor(rnd() * 4)),
      funding_currency: country === "United Kingdom" ? "GBP" : country === "Australia" ? "AUD" : country === "Canada" ? "CAD" : country === "South Africa" ? "ZAR" : "USD",
      interests: [pick(INTERESTS), pick(INTERESTS)].filter((v, k, a) => a.indexOf(v) === k),
      onboarding_step: "done", onboarding_completed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // one active membership per account: this one
    await db.from("programme_memberships").update({ status: "left" }).eq("user_id", id).eq("status", "active").neq("cohort_id", cohortId);
    const { data: mem } = await db.from("programme_memberships").select("id").eq("user_id", id).eq("cohort_id", cohortId).maybeSingle();
    if (mem) must(await db.from("programme_memberships").update({ status: "active" }).eq("id", mem.id), "membership");
    else must(await db.from("programme_memberships").insert({ user_id: id, cohort_id: cohortId, status: "active" }), "membership");

    must(await db.from("programme_student_details").insert({
      user_id: id, cohort_id: cohortId, status,
      emergency_contact_name: `${pick(["Sarah", "David", "Rebecca", "Michael", "Leah", "Jonathan"])} ${last}`,
      emergency_contact_relationship: pick(["Parent", "Parent", "Guardian", "Sibling"]),
      emergency_contact_phone: "+1 555 0100",
      flight_number: pick(["LY002", "LY008", "BA165", "AC088", "EL AL 332"]),
      flight_arrival_at: at(arrived ? -55 : 10, 6, 30),
    }), "student details");

    // groups: a bus, an ulpan class, some volunteering
    const members = [i % 2 === 0 ? "Bus A" : "Bus B", i % 3 === 0 ? "Ulpan Bet" : "Ulpan Aleph", ...(chance(0.4) ? ["Volunteering team"] : [])];
    must(await db.from("programme_group_members").insert(members.map((n) => ({ group_id: groups[n], user_id: id }))), "group members");

    // checklist progress
    const done = content.checklist.filter((c) => chance(c.required ? complete : complete * 0.5));
    if (done.length) must(await db.from("programme_checklist_progress").insert(done.map((c) => ({ user_id: id, item_id: c.id, done: true, done_at: at(-30 + Math.floor(rnd() * 28), 12) }))), "checklist progress");

    // RSVPs on events that take them
    if (arrived) {
      for (const e of content.inserted.filter((x) => x.rsvp_enabled)) {
        const r = rnd();
        const response = r < 0.55 ? "going" : r < 0.7 ? "maybe" : r < 0.8 ? "not_going" : null;
        if (!response) continue;
        const going = goingByEvent.get(e.id) ?? 0;
        if (response === "going" && e.capacity && going >= Math.min(e.capacity, 14)) continue;
        if (response === "going") goingByEvent.set(e.id, going + 1);
        await db.from("programme_event_rsvps").insert({ event_id: e.id, user_id: id, response });
      }
      // acknowledgements of the things that ask for one
      const acks = [
        ...content.announcements.filter((a) => a.requires_ack).map((a) => ({ type: "announcement", id: a.id })),
        ...content.inserted.filter((e) => e.requires_ack).map((e) => ({ type: "event", id: e.id })),
      ];
      for (const a of acks) {
        if (chance(0.72)) await db.from("programme_acknowledgements").insert({ cohort_id: cohortId, subject_type: a.type, subject_id: a.id, user_id: id, acknowledged_at: at(-1, 10) });
      }
      // vote responses
      for (const vote of content.votes) {
        if (!chance(vote.status === "closed" ? 0.9 : 0.6)) continue;
        const opts = content.options.filter((o) => o.vote_id === vote.id);
        await db.from("programme_vote_responses").insert({ vote_id: vote.id, option_id: pick(opts).id, user_id: id });
      }
    }
  }

  /* Hand over the demo logins */
  if (LOGINS_FILE && created.length) {
    const lines = [
      "Aardvark Israel demo: logins (keep private; sample accounts only)",
      `Created ${new Date().toISOString()}`,
      "",
      ...created.map((c) => `${c.email}  /  ${c.password}`),
      "",
      "director = programme owner (staff workspace), Noa = madricha with limited permissions, Maya = a student.",
    ];
    writeFileSync(LOGINS_FILE, lines.join("\n"));
  }
  if (MANIFEST) {
    const demoUserIds = [...Object.values(staffIds), ...studentIds];
    writeFileSync(MANIFEST, JSON.stringify({ programmeId, cohortId, demoUserIds, createdAt: new Date().toISOString() }, null, 1));
  }

  console.log(`done: programme ${programmeId}, cohort ${cohortId} (join code AARDVARK26)`);
  console.log(`  staff accounts: ${Object.keys(staffIds).length}, students: ${studentIds.length}, owners added: ${ownerAdded.join(", ") || "none"}`);
  console.log(`  events: ${content.inserted.length}, announcements: ${content.announcements.length}, votes: ${content.votes.length}, checklist items: ${content.checklist.length}`);
  console.log(`  new logins written to: ${LOGINS_FILE && created.length ? LOGINS_FILE : "(none created this run)"}`);
}

main().catch((e) => {
  console.error("seed failed:", e.message);
  process.exit(1);
});
