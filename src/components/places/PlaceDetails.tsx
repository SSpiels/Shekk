/**
 * Shared place detail blocks.
 *
 * These are the panels every location mini app needs: the Google facts header,
 * contact/directions actions, opening hours, getting-there times, and the
 * Shekk-owned price panel with its verification age.
 */

import { Bus, Car, Clock, ExternalLink, Footprints, MapPin, Phone, Star } from "lucide-react";
import { Card } from "@/components/AppShell";
import {
  contractLabel,
  directionsUrl,
  hasPrice,
  kmLabel,
  openLabel,
  priceLabel,
  shekels,
  verifiedLabel,
  type Place,
  type TravelSet,
} from "@/lib/places";
import { GoogleAttribution } from "./GoogleAttribution";

export function PlaceFacts({ place }: { place: Place }) {
  const open = openLabel(place.hours.openNow);
  const price = priceLabel(place.priceLevel);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {place.rating !== null && (
        <span className="inline-flex items-center gap-1 font-semibold">
          <Star className="size-4 fill-current" />
          {place.rating.toFixed(1)}
          {place.reviews ? <span className="font-normal text-muted-foreground">· {place.reviews} reviews</span> : null}
        </span>
      )}
      {open && (
        <span className={place.hours.openNow ? "font-semibold text-success" : "text-muted-foreground"}>
          {place.hours.openNow ? "Open now" : "Closed right now"}
        </span>
      )}
      {place.distanceKm !== undefined && (
        <span className="text-muted-foreground">{kmLabel(place.distanceKm)} away</span>
      )}
      {price && <span className="text-muted-foreground">{price}</span>}
    </div>
  );
}

export function PlaceActions({ place }: { place: Place }) {
  return (
    <div className="flex flex-wrap gap-2">
      {place.phone && (
        <a
          href={`tel:${place.phone.replace(/\s/g, "")}`}
          className="tap inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-semibold"
        >
          <Phone className="size-3.5" /> Call
        </a>
      )}
      <a
        href={directionsUrl(place)}
        target="_blank"
        rel="noreferrer"
        className="tap inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
      >
        <MapPin className="size-3.5" /> Directions
      </a>
      {place.website && (
        <a
          href={place.website}
          target="_blank"
          rel="noreferrer"
          className="tap inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-semibold"
        >
          <ExternalLink className="size-3.5" /> Website
        </a>
      )}
    </div>
  );
}

export function PlaceHours({ place }: { place: Place }) {
  const weekdays = place.hours.weekdays;
  if (!weekdays?.length) return null;
  return (
    <Card className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock className="size-3.5" /> Opening hours
      </p>
      <ul className="space-y-1 text-sm">
        {weekdays.map((line) => (
          <li key={line} className="text-muted-foreground">
            {line}
          </li>
        ))}
      </ul>
      <GoogleAttribution what="Opening hours" />
    </Card>
  );
}

export function GettingThere({ travel }: { travel: TravelSet | null }) {
  if (!travel || (!travel.walk && !travel.transit && !travel.drive)) return null;
  const transfers = travel.transit?.transit?.transfers;
  const steps = travel.transit?.transit?.steps;
  return (
    <Card className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Getting there</p>
      <div className="flex flex-wrap gap-4 text-sm">
        {travel.walk && (
          <span className="inline-flex items-center gap-1.5">
            <Footprints className="size-4 text-muted-foreground" /> {travel.walk.minutes} min walk
          </span>
        )}
        {travel.transit && (
          <span className="inline-flex items-center gap-1.5">
            <Bus className="size-4 text-muted-foreground" /> {travel.transit.minutes} min by bus
            {transfers !== undefined ? ` · ${transfers === 0 ? "direct" : `${transfers} transfer${transfers > 1 ? "s" : ""}`}` : ""}
          </span>
        )}
        {travel.drive && (
          <span className="inline-flex items-center gap-1.5">
            <Car className="size-4 text-muted-foreground" /> {travel.drive.minutes} min drive
          </span>
        )}
      </div>
      {steps?.length ? (
        <ul className="space-y-1.5 border-t border-border pt-2">
          {steps.map((s, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{s.line ?? "Transit"}</span>
              {s.departureStop && s.arrivalStop ? ` · ${s.departureStop} → ${s.arrivalStop}` : null}
              {s.departureTime ? ` · ${transitTimeLabel(s.departureTime)}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function transitTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Shekk's own numbers, always stamped with when a human last checked them. If
 * Shekk holds no price, this renders nothing rather than guessing one.
 */
export function ShekkPricePanel({ place, title = "What Shekk knows" }: { place: Place; title?: string }) {
  const { meta } = place;
  const contract = contractLabel(meta);
  if (!hasPrice(meta) && !contract && !meta.notes && !meta.partnerOffer) return null;

  return (
    <Card className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>

      {meta.partnerOffer && (
        <p className="rounded-xl bg-notice-soft px-3 py-2 text-sm font-semibold text-notice-foreground">
          {meta.partnerOffer}
        </p>
      )}

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Monthly</dt>
          <dd className="font-semibold">
            {meta.monthlyIls !== undefined ? `~${shekels(meta.monthlyIls)}` : "Ask at the desk"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Day pass</dt>
          <dd className="font-semibold">
            {meta.dayPassIls !== undefined ? shekels(meta.dayPassIls) : "Ask at the desk"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Shortest contract</dt>
          <dd className="font-semibold">{contract ?? "Ask at the desk"}</dd>
        </div>
      </dl>

      {meta.notes && <p className="text-xs text-muted-foreground">{meta.notes}</p>}
      <p className="text-[11px] font-semibold text-muted-foreground">{verifiedLabel(meta)}</p>
    </Card>
  );
}
