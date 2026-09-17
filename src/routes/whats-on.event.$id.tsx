import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ExternalLink,
  Info,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Share2,
  Ticket,
} from "lucide-react";
import { AppShell, Card, PrimaryButton, ScreenHeader } from "@/components/AppShell";
import { EVENT_KIND_LABEL, eventWhen, useBuyTicket, useEvent, useOutboundBooking } from "@/lib/useEvents";
import { useProgramme } from "@/lib/useProgramme";
import { ils } from "@/lib/mock";
import { useApp } from "@/lib/store";
import { bookingCta, bookingMode, providerLabel } from "@/lib/activities";
import { formatPriceForDetail } from "@/lib/events-price";
import { MONEY_ENABLED } from "@/lib/flags";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/whats-on/event/$id")({
  head: () => ({
    meta: [
      { title: "Activity · What's On · Shekk" },
      { name: "description", content: "When it is, where it is, what it costs and how to book it." },
      { property: "og:title", content: "Activity · What's On · Shekk" },
      { property: "og:description", content: "When it is, where it is, what it costs and how to book it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityDetail,
});

function ActivityDetail() {
  const { id } = useParams({ from: "/whats-on/event/$id" });
  const navigate = useNavigate();
  const { data, isLoading, error } = useEvent(id);
  const { available } = useApp();
  const { programme: myProgramme } = useProgramme();
  const buy = useBuyTicket();
  const outbound = useOutboundBooking();
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState<{ code: string; quantity: number; amount: number } | null>(null);

  const activity = data?.event ?? null;
  const mine = data?.mine ?? 0;

  useEffect(() => {
    if (activity) track("activity_viewed", { id: activity.id, provider: activity.provider });
  }, [activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <AppShell>
        <ScreenHeader title="Activity" back="/whats-on" />
        <div className="space-y-3 px-4 py-4">
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  if (error || !activity) {
    return (
      <AppShell>
        <ScreenHeader title="Activity" back="/whats-on" />
        <div className="px-4 py-4">
          <Card className="space-y-2 text-center">
            <p className="text-3xl">🎟️</p>
            <p className="text-sm font-semibold">This activity isn&apos;t available</p>
            <p className="text-xs text-muted-foreground">
              It may have been taken down. Have a look at what else is on.
            </p>
            <Link to="/whats-on" className="tap inline-block text-sm font-semibold text-primary">
              Back to What&apos;s On
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const mode = bookingMode(activity);
  const programme = activity.programmeStatus !== "independent";
  const leftForMe = Math.max(0, activity.perPersonLimit - mine);
  const maxQty = Math.max(1, Math.min(leftForMe, activity.remaining ?? activity.perPersonLimit));
  const total = activity.price === null ? 0 : +(activity.price * qty).toFixed(2);
  const shortBy = +(total - available).toFixed(2);

  /* A real clash, computed from the member's own programme schedule — never a guess. */
  const clash = findClash(myProgramme.schedule, activity.startsAt, activity.endsAt);

  const directions = [activity.venue, activity.city].filter(Boolean).join(", ");

  const share = async () => {
    track("activity_shared", { id: activity.id });
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: activity.title, text: `${activity.title} · ${eventWhen(activity.startsAt)}`, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* the member cancelled the share sheet */
    }
  };

  const goToProvider = () => {
    track("outbound_booking_clicked", { id: activity.id, provider: activity.provider });
    outbound.mutate(
      { eventId: activity.id },
      {
        onSuccess: (res) => {
          const url = res.url ?? activity.externalBookingUrl;
          if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
        },
      },
    );
  };

  if (done) {
    return (
      <AppShell>
        <ScreenHeader title="You're in" back="/whats-on" />
        <div className="space-y-4 px-4 py-6 text-center">
          <p className="text-5xl">{activity.emoji}</p>
          <div>
            <h2 className="text-xl font-bold">{activity.title}</h2>
            <p className="text-sm text-muted-foreground">
              {done.quantity} {done.quantity === 1 ? "spot" : "spots"} ·{" "}
              {done.amount === 0 ? "Free" : ils(done.amount)}
            </p>
          </div>
          <Card className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Ticket code</p>
            <p className="font-mono text-lg font-bold tracking-widest">{done.code}</p>
          </Card>
          <PrimaryButton onClick={() => navigate({ to: "/tickets" })}>Show my ticket</PrimaryButton>
          <button
            onClick={() => navigate({ to: "/whats-on" })}
            className="tap w-full text-sm font-semibold text-muted-foreground"
          >
            Back to What&apos;s On
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader title={activity.title} subtitle={activity.host} back="/whats-on" />

      <div className="space-y-4 px-4 py-4">
        {activity.coverUrl ? (
          <img
            src={activity.coverUrl}
            alt={activity.title}
            loading="lazy"
            className="h-44 w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-44 w-full items-center justify-center rounded-2xl bg-muted text-6xl">
            {activity.emoji}
          </div>
        )}

        <Card className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {EVENT_KIND_LABEL[activity.kind] ?? "Activity"}
              </p>
              <h2 className="text-lg font-bold leading-snug">{activity.title}</h2>
            </div>
            <button
              onClick={() => void share()}
              aria-label="Share this activity"
              className="tap shrink-0 rounded-full bg-muted p-2"
            >
              <Share2 className="size-4" />
            </button>
          </div>

          {programme ? (
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">
              {activity.programmeStatus === "programme_included"
                ? "Included in your programme"
                : "Official programme activity"}
            </p>
          ) : null}

          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              {eventWhen(activity.startsAt)}
            </p>
            {activity.venue || activity.city ? (
              <p className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                {[activity.venue, activity.city].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <p className="flex items-center gap-2">
              <Ticket className="size-4 shrink-0 text-muted-foreground" />
              {formatPriceForDetail(
                {
                  kind: activity.priceKind,
                  amountAgorot: activity.price === null ? null : Math.round(activity.price * 100),
                  maxAmountAgorot: activity.priceMax === null ? null : Math.round(activity.priceMax * 100),
                  note: activity.priceNote,
                },
                providerLabel(activity.provider),
              )}
              {activity.remaining !== null ? ` · ${activity.remaining} of ${activity.capacity} left` : ""}
            </p>
            {activity.ageMin ? (
              <p className="flex items-center gap-2">
                <Info className="size-4 shrink-0 text-muted-foreground" />
                {activity.ageMin}+ only — bring ID
              </p>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {programme ? "Run by " : "Hosted by "}
            <span className="font-semibold text-foreground">{activity.host}</span>
            {!programme && providerLabel(activity.provider) !== "the provider"
              ? ` · listed via ${providerLabel(activity.provider)}`
              : ""}
          </p>

          {activity.description ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{activity.description}</p>
          ) : null}

          {activity.includes ? (
            <div className="rounded-xl bg-muted p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                What&apos;s included
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{activity.includes}</p>
            </div>
          ) : null}
        </Card>

        {directions ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directions)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tap flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <Navigation className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Directions</span>
              <span className="block truncate text-xs text-muted-foreground">{directions}</span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
          </a>
        ) : null}

        {clash ? (
          <Card className="flex items-start gap-2 border-notice-border bg-notice-soft text-xs text-notice-foreground">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              This clashes with <span className="font-semibold">{clash.title}</span> on your programme schedule (
              {eventWhen(clash.startsAt)}).
            </span>
          </Card>
        ) : null}

        {mine > 0 ? (
          <Link to="/tickets" className="tap block">
            <Card className="flex items-center gap-3 border-primary/30">
              <Ticket className="size-5 shrink-0 text-primary" />
              <p className="flex-1 text-sm font-semibold">
                You already have {mine} {mine === 1 ? "spot" : "spots"} — view ticket
              </p>
            </Card>
          </Link>
        ) : null}

        {mode === "sold_out" ? (
          <Card className="text-center text-sm font-semibold text-muted-foreground">Sold out</Card>
        ) : mode === "external" ? (
          <div className="space-y-2">
            <PrimaryButton disabled={outbound.isPending} onClick={goToProvider}>
              {outbound.isPending ? "Opening…" : bookingCta("external", activity.provider)}
            </PrimaryButton>
            <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
              You&apos;ll finish booking and pay on {providerLabel(activity.provider)}&apos;s own site. Your booking,
              tickets and any refund are handled by them.
              {activity.refundSummary ? ` ${activity.refundSummary}` : ""}
            </p>
            {activity.termsUrl ? (
              <a
                href={activity.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-flat block px-1 text-[11.5px] font-semibold text-primary"
              >
                {providerLabel(activity.provider)}&apos;s terms and refund policy →
              </a>
            ) : null}
          </div>
        ) : mode === "unavailable" ? (
          <Card className="space-y-1.5 text-center">
            <p className="text-sm font-semibold">Booking isn&apos;t open in Shekk yet</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {MONEY_ENABLED
                ? "The host hasn't opened booking for this one. Ask them directly for a spot."
                : "This one needs paid booking, which is coming to Shekk soon. Ask the host directly for a spot in the meantime."}
            </p>
          </Card>
        ) : leftForMe === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            You&apos;ve reached the limit of {activity.perPersonLimit} per person for this one.
          </Card>
        ) : (
          <>
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">How many spots?</p>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="One fewer"
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                    disabled={qty <= 1}
                    className="tap rounded-full bg-muted p-2 disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-6 text-center text-lg font-bold">{qty}</span>
                  <button
                    aria-label="One more"
                    onClick={() => setQty((n) => Math.min(maxQty, n + 1))}
                    disabled={qty >= maxQty}
                    className="tap rounded-full bg-muted p-2 disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-bold">{total === 0 ? "Free" : ils(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {total === 0
                  ? "Free — your spot and QR ticket land in My plans."
                  : `Paid from your Shekk balance (${ils(available)} available).`}{" "}
                {activity.refundSummary ?? "Tickets aren't refundable or transferable."}
              </p>
            </Card>

            {buy.error ? (
              <Card className="flex items-start gap-2 border-destructive/30 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{(buy.error as Error).message}</span>
              </Card>
            ) : null}

            {total === 0 || shortBy <= 0 ? (
              <PrimaryButton
                disabled={buy.isPending}
                onClick={() =>
                  buy.mutate({ eventId: activity.id, quantity: qty }, { onSuccess: (res) => setDone(res) })
                }
              >
                {buy.isPending ? "Getting your spot…" : total === 0 ? "Get my spot" : `Pay ${ils(total)}`}
              </PrimaryButton>
            ) : (
              <div className="space-y-2">
                <Card className="text-center text-sm text-muted-foreground">
                  You&apos;re {ils(shortBy)} short — top up and come back.
                </Card>
                <PrimaryButton onClick={() => navigate({ to: "/topup" })}>Top up</PrimaryButton>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

/** A clash only when the member's own programme schedule really overlaps. */
function findClash(
  events: { title: string; startsAt: string; endsAt: string | null }[],
  startsAt: string,
  endsAt: string | null,
): { title: string; startsAt: string } | null {
  if (events.length === 0) return null;
  const from = new Date(startsAt).getTime();
  const to = endsAt ? new Date(endsAt).getTime() : from + 2 * 3600_000;
  for (const e of events) {
    const eFrom = new Date(e.startsAt).getTime();
    const eTo = e.endsAt ? new Date(e.endsAt).getTime() : eFrom + 2 * 3600_000;
    if (from < eTo && eFrom < to) return { title: e.title, startsAt: e.startsAt };
  }
  return null;
}
