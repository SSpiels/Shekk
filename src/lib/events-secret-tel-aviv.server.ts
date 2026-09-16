/**
 * Secret Tel Aviv — Shekk's first scraped (non-API) What's On source.
 *
 * There is no partner agreement or feed here: this reads Secret Tel Aviv's own
 * public `/tickets` listing page, which is not disallowed by their robots.txt.
 * Because it's an unofficial read of someone else's page rather than a real
 * data relationship, every listing this produces is meant to land as a
 * `draft` (see `SOURCES.secret_tel_aviv.reviewRequired` in
 * `events-provider.server.ts`) so a human confirms it before a student ever
 * sees it — this adapter does not decide what goes live.
 *
 * The listing table does not currently carry a price for any row (checked
 * directly, not assumed), so price always comes back `null` (unknown) here —
 * never `0`. Zero means free; this source never claims that, since it isn't
 * told it. Booking is always a handoff to Secret Tel Aviv's own event page
 * (`integrationType: "affiliate_link"`) — Shekk never charges for these.
 */

import { parse } from "node-html-parser";
import type { PartnerEvent } from "./events-provider.server";
import { classifyEvent, classifyKind } from "./events-classification";

const LISTING_URL = "https://www.secrettelaviv.com/tickets";
const SOURCE_HOST = "Secret Tel Aviv";
const DEFAULT_CITY = "Tel Aviv";

/** Israel's UTC offset (minutes) at a given instant, DST included — no tz DB dependency needed. */
export function israelOffsetMinutes(utcGuess: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(utcGuess)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - utcGuess.getTime()) / 60_000);
}

/** Build an ISO timestamp from a wall-clock date/time in Asia/Jerusalem. */
export function israelLocalToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMin = israelOffsetMinutes(guessUtc);
  return new Date(guessUtc.getTime() - offsetMin * 60_000).toISOString();
}

/** "6:00 pm" -> { hour: 18, minute: 0 } */
export function parseClock(raw: string): { hour: number; minute: number } | null {
  const m = raw.trim().match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") hour += 12;
  return { hour, minute: Number(m[2]) };
}

/**
 * The date/time cell looks like:
 *   "Wednesday<br> 16/09/2026<br> <i>11:00 am - 11:00 pm</i>"
 * Day/month/year is DD/MM/YYYY (Israel's convention), not US MM/DD/YYYY.
 */
export function parseWhen(cellText: string): { startsAt: string; endsAt: string | null } | null {
  const dateMatch = cellText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!dateMatch) return null;
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);

  const timeMatch = cellText.match(/(\d{1,2}:\d{2}\s*[ap]m)\s*(?:-\s*(\d{1,2}:\d{2}\s*[ap]m))?/i);
  const start = timeMatch ? parseClock(timeMatch[1]) : null;
  if (!start) return null;
  const end = timeMatch?.[2] ? parseClock(timeMatch[2]) : null;

  return {
    startsAt: israelLocalToIso(year, month, day, start.hour, start.minute),
    endsAt: end ? israelLocalToIso(year, month, day, end.hour, end.minute) : null,
  };
}

/** "Outback Garage Bike Fest @ Teder" -> { title: "Outback Garage Bike Fest", venue: "Teder" } */
export function splitTitleVenue(raw: string): { title: string; venue: string | null } {
  const idx = raw.lastIndexOf(" @ ");
  if (idx === -1) return { title: raw.trim(), venue: null };
  return { title: raw.slice(0, idx).trim(), venue: raw.slice(idx + 3).trim() || null };
}

export function slugFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export async function listSecretTelAvivEvents(): Promise<PartnerEvent[]> {
  let html: string;
  try {
    const res = await fetch(LISTING_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ShekkWhatsOnBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error("[events] secret_tel_aviv fetch:", err instanceof Error ? err.message : err);
    return [];
  }

  const root = parse(html);
  const rows = root.querySelectorAll("table tr").filter((r) => r.querySelector("td"));

  const out: PartnerEvent[] = [];
  for (const row of rows) {
    const link = row.querySelector("td a");
    const href = link?.getAttribute("href");
    const rawTitle = link?.textContent?.trim();
    if (!href || !rawTitle) continue;

    const ref = slugFromUrl(href);
    if (!ref) continue;

    const dateCell = row.querySelectorAll("td")[1];
    const when = dateCell ? parseWhen(dateCell.textContent) : null;
    if (!when) continue; // no parseable date — skip rather than guess

    const { title, venue } = splitTitleVenue(rawTitle);

    const descCell = row.querySelectorAll("td")[2];
    const descParagraph = descCell?.querySelector("p");
    const description = descParagraph
      ? descParagraph.textContent.replace(/Read More/i, "").trim() || null
      : null;

    const coverUrl = row.querySelector("td.event-image img")?.getAttribute("src") ?? null;
    const { sourceCategory, subcategory, tags } = classifyEvent({ title, description, host: SOURCE_HOST });

    out.push({
      ref,
      title,
      kind: classifyKind(sourceCategory, title, description),
      description,
      host: SOURCE_HOST,
      venue,
      city: DEFAULT_CITY,
      startsAt: when.startsAt,
      endsAt: when.endsAt,
      price: null, // never stated by this source — never guess "free"
      capacity: 0,
      coverUrl,
      externalProviderId: ref,
      externalBookingUrl: href,
      integrationType: "affiliate_link",
      sourceCategory,
      subcategory,
      tags,
    });
  }

  return out;
}
