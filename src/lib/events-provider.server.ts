/**
 * External event source seam.
 *
 * Shekk's events layer is source-agnostic: rows carry a `provider` and a
 * `provider_ref` so listings pulled from outside (a ticketing partner's API,
 * or a scraped public listing page) can live beside the ones created in the
 * Shekk Console, upserted by `provider_ref` so a re-sync updates rather than
 * duplicates.
 *
 * Two kinds of source exist:
 *  - "api": a real partner feed, gated behind credentials. None is wired up
 *    yet — that needs a partner agreement and an API key. When one lands,
 *    implement its case in `listPartnerEvents` against the real response shape.
 *  - "scrape": a public page read directly, with no data relationship behind
 *    it. Because nobody has vetted the content, these always land as `draft`
 *    (see `reviewRequired` below) — an admin has to publish each one by hand
 *    before a student can see it. Nothing here ever invents listings.
 */

import type { EventKind } from "./events.server";
import type { IntegrationType } from "./events.server";
import type { AutoPublishSummary } from "./events-auto-publish.server";
import type { PriceEnrichmentSummary } from "./events-price-enrichment.server";
import type { PriceInfo } from "./events-price";

export type PartnerEvent = {
  ref: string;
  title: string;
  kind: EventKind;
  description: string | null;
  host: string;
  venue: string | null;
  city: string | null;
  startsAt: string;
  endsAt: string | null;
  /**
   * Explicit price parsed from the source's own feed/listing text — see
   * lib/events-price.ts. Omitted (not a `kind: "unknown"` value) when
   * nothing was found, so a later re-sync with no fresh signal never
   * overwrites a richer result the price-enrichment pass may have found by
   * visiting the event's own page separately. Never a guess.
   */
  priceInfo?: PriceInfo;
  capacity: number;
  coverUrl: string | null;
  /** Where a member ends up when they want to book. */
  externalBookingUrl: string | null;
  integrationType: IntegrationType;
  /** Shekk's own category vocabulary (see `lib/activities.ts`), when known. */
  sourceCategory?: string | null;
  /** A finer, optional classification under sourceCategory (see `lib/events-classification.ts`) — most events have none. */
  subcategory?: string | null;
  /** Controlled multi-value tags (see `lib/events-classification.ts`). */
  tags?: string[];
  /**
   * The source's own raw category/tag values, verbatim (e.g. NBN's iCal
   * CATEGORIES) — kept as metadata alongside our derived sourceCategory,
   * never itself shown to members. A source with no native taxonomy (Secret
   * Tel Aviv) just omits this.
   */
  sourceTags?: string[];
  /** The source's own id/slug for this listing — kept distinct from `ref` (the dedupe key) for traceability. */
  externalProviderId?: string | null;
};

export type PartnerId = "eventer" | "tickchak" | "secret_tel_aviv" | "nbn";

const SOURCES: Record<PartnerId, { kind: "api" | "scrape"; reviewRequired: boolean }> = {
  eventer: { kind: "api", reviewRequired: false },
  tickchak: { kind: "api", reviewRequired: false },
  secret_tel_aviv: { kind: "scrape", reviewRequired: true },
  nbn: { kind: "scrape", reviewRequired: true },
};

function credentials(provider: "eventer" | "tickchak"): string | null {
  const key = provider === "eventer" ? process.env.EVENTER_API_KEY : process.env.TICKCHAK_API_KEY;
  return key && key.length > 0 ? key : null;
}

/** Is this source usable at all right now? API sources need credentials; scrapers don't. */
export function partnerConfigured(provider: PartnerId): boolean {
  if (SOURCES[provider].kind === "scrape") return true;
  return credentials(provider as "eventer" | "tickchak") !== null;
}

/**
 * Fetch and normalise a source's listings.
 *
 * An unconfigured API source returns an empty list, so the rest of the app
 * behaves exactly as it does today: the catalogue is whatever the console holds.
 */
export async function listPartnerEvents(provider: PartnerId): Promise<PartnerEvent[]> {
  if (provider === "secret_tel_aviv") {
    const { listSecretTelAvivEvents } = await import("./events-secret-tel-aviv.server");
    return listSecretTelAvivEvents();
  }
  if (provider === "nbn") {
    const { listNbnEvents } = await import("./events-nbn.server");
    return listNbnEvents();
  }
  const key = credentials(provider);
  if (!key) return [];
  // Implement against the partner's documented endpoint once access is granted.
  console.warn(`[events] ${provider} adapter not implemented yet`);
  return [];
}

/** Upsert a source's listings into the catalogue, keyed on provider_ref. */
export async function syncPartnerEvents(
  provider: PartnerId,
): Promise<{ synced: number; autoPublish?: AutoPublishSummary; priceEnrichment?: PriceEnrichmentSummary }> {
  const listings = await listPartnerEvents(provider);
  if (listings.length === 0) return { synced: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { reviewRequired } = SOURCES[provider];
  const baseRow = (e: PartnerEvent) => ({
    provider,
    provider_ref: e.ref,
    title: e.title,
    kind: e.kind,
    description: e.description,
    host: e.host,
    venue: e.venue,
    city: e.city,
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    capacity: e.capacity,
    cover_url: e.coverUrl,
    external_booking_url: e.externalBookingUrl,
    external_provider_id: e.externalProviderId ?? e.ref,
    integration_type: e.integrationType,
    source_category: e.sourceCategory ?? null,
    subcategory: e.subcategory ?? null,
    tags: e.tags ?? [],
    source_tags: e.sourceTags ?? [],
    last_verified_at: new Date().toISOString(),
    availability_confidence: "recent" as const,
    // Trusted API partners publish immediately, matching today's behaviour.
    // A reviewRequired source (e.g. a scrape) never sets `status` at all: a
    // new row keeps the `draft` column default, and a re-sync never touches
    // `status` on an existing row, so it can't silently undo an admin's
    // publish/cancel decision on a listing that's already been reviewed.
    ...(reviewRequired ? {} : { status: "published" as const }),
  });

  // PostgREST derives one bulk upsert's column list from the UNION of keys
  // across every row in the call — a column simply missing from one row's
  // object still gets written as NULL for that row if ANY other row in the
  // same call includes it. So rows with a fresh price signal and rows
  // without one can't share a single upsert call: they're split into two,
  // each internally uniform, exactly like the `status` field above already
  // relies on every row in one call sharing the same reviewRequired value.
  const withPrice = listings.filter((e) => e.priceInfo);
  const withoutPrice = listings.filter((e) => !e.priceInfo);

  if (withoutPrice.length > 0) {
    const { error } = await supabaseAdmin
      .from("events")
      .upsert(withoutPrice.map(baseRow), { onConflict: "provider,provider_ref" });
    if (error) {
      console.error(`[events] ${provider} sync:`, error.message);
      throw new Error("Could not sync partner events");
    }
  }

  if (withPrice.length > 0) {
    const { error } = await supabaseAdmin
      .from("events")
      .upsert(
        withPrice.map((e) => ({
          ...baseRow(e),
          price_agorot: e.priceInfo!.amountAgorot,
          price_kind: e.priceInfo!.kind,
          price_max_agorot: e.priceInfo!.maxAmountAgorot,
          price_note: e.priceInfo!.note,
        })),
        { onConflict: "provider,provider_ref" },
      );
    if (error) {
      console.error(`[events] ${provider} sync:`, error.message);
      throw new Error("Could not sync partner events");
    }
  }

  // Conservative cross-source duplicate detection — see events-dedupe.ts.
  // Never blocks or fails the sync itself; a dedupe hiccup shouldn't lose a
  // successful import.
  try {
    const { detectCrossSourceDuplicates } = await import("./events-dedupe.server");
    await detectCrossSourceDuplicates(provider);
  } catch (err) {
    console.error(`[events] ${provider} dedupe pass:`, err instanceof Error ? err.message : err);
  }

  // Shadow-evaluates (and, only when explicitly enabled, applies) the
  // auto-publish decision for this provider's draft backlog — see
  // events-auto-publish.server.ts. Never blocks or fails the sync itself.
  let autoPublish: AutoPublishSummary | undefined;
  if (reviewRequired) {
    try {
      const { evaluateAutoPublish } = await import("./events-auto-publish.server");
      autoPublish = await evaluateAutoPublish(provider);
    } catch (err) {
      console.error(`[events] ${provider} auto-publish pass:`, err instanceof Error ? err.message : err);
    }
  }

  // For events still unknown after feed/listing text, visits each one's own
  // already-linked page and tries again — see events-price-enrichment.server.ts.
  // Bounded per run, isolated per event, never blocks or fails the sync itself.
  let priceEnrichment: PriceEnrichmentSummary | undefined;
  try {
    const { enrichUnknownPrices } = await import("./events-price-enrichment.server");
    priceEnrichment = await enrichUnknownPrices(provider);
  } catch (err) {
    console.error(`[events] ${provider} price enrichment pass:`, err instanceof Error ? err.message : err);
  }

  return { synced: listings.length, autoPublish, priceEnrichment };
}
