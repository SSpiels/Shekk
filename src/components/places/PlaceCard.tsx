/**
 * The one place card.
 *
 * Google-derived facts (rating, open/closed, address, photo) sit on the top
 * line; Shekk-owned facts (price we checked, contract, partner offer) sit
 * underneath as clearly-labelled badges, so a member always knows which is
 * which. A price is only ever rendered when Shekk actually holds one.
 */

import type { ReactNode } from "react";
import { Bookmark, BookmarkCheck, Star } from "lucide-react";
import { Card } from "@/components/AppShell";
import { contractLabel, emojiFor, hasPrice, kmLabel, openLabel, shekels, type Place } from "@/lib/places";
import { PlacePhoto } from "./PlacePhoto";

export function PlaceCard({
  place,
  active = false,
  saved,
  onSelect,
  onSave,
  photo = true,
  loadPhoto = false,
  footer,
}: {
  place: Place;
  active?: boolean;
  saved?: boolean;
  onSelect?: () => void;
  onSave?: () => void;
  photo?: boolean;
  /**
   * Fetch the place's Google photo for this card. Off by default: every photo is
   * a separate billable request, so list cards show the category emoji and only
   * a single place's detail view loads a real photo.
   */
  loadPhoto?: boolean;
  footer?: ReactNode;
}) {
  const open = openLabel(place.hours.openNow);
  const contract = contractLabel(place.meta);

  return (
    <Card className={`space-y-3 transition ${active ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start gap-3">
        {photo && (
          <PlacePhoto
            {...(loadPhoto && place.photos[0] ? { photo: place.photos[0] } : {})}
            alt={place.name}
            emoji={emojiFor(place.types)}
            className="size-16 shrink-0 rounded-xl"
            maxWidthPx={240}
            variant="thumb"
          />
        )}

        <button
          type="button"
          onClick={onSelect}
          className="tap min-w-0 flex-1 text-left"
          aria-current={active ? "true" : undefined}
        >
          <p className="truncate font-display text-base font-bold">{place.name}</p>
          <p className="truncate text-xs text-muted-foreground">{place.address}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {place.rating !== null && (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Star className="size-3.5 fill-current" />
                {place.rating.toFixed(1)}
                {place.reviews ? (
                  <span className="font-normal text-muted-foreground">({place.reviews})</span>
                ) : null}
              </span>
            )}
            {place.distanceKm !== undefined && <span>{kmLabel(place.distanceKm)} away</span>}
            {open && (
              <span className={place.hours.openNow ? "font-semibold text-success" : ""}>{open}</span>
            )}
          </div>
        </button>

        {onSave && (
          <button
            type="button"
            aria-label={saved ? `Remove ${place.name} from saved` : `Save ${place.name}`}
            onClick={onSave}
            className="tap shrink-0 rounded-full bg-muted p-2 text-foreground"
          >
            {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
          </button>
        )}
      </div>

      {(place.meta.chain || hasPrice(place.meta) || contract || place.meta.partnerOffer) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {place.meta.chain && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {place.meta.chain}
            </span>
          )}
          {place.meta.monthlyIls !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
              ~{shekels(place.meta.monthlyIls)}/mo
            </span>
          )}
          {place.meta.dayPassIls !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
              Day pass {shekels(place.meta.dayPassIls)}
            </span>
          )}
          {contract && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{contract}</span>}
          {place.meta.partnerOffer && (
            <span className="rounded-full bg-notice-soft px-2 py-0.5 text-[11px] font-semibold text-notice-foreground">
              Shekk offer
            </span>
          )}
        </div>
      )}

      {footer}
    </Card>
  );
}
