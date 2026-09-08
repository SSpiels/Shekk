import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { QRCode } from "@/components/QRCode";
import { eventWhen, useMyTickets } from "@/lib/useEvents";
import { MONEY_ENABLED } from "@/lib/flags";

type LiveItem = {
  id: string;
  emoji: string;
  label: string;
  title: string;
  sub: string;
  meta?: string;
  gradient: string;
  cta: string;
  to?: string;
  qr?: string;
};

export function ActiveNow() {
  const { state, hydrated } = useApp();
  const [qr, setQr] = useState<LiveItem | null>(null);

  const pendingSplit = state.splits.find((s) => !s.paid);
  const { data: tickets } = useMyTickets();

  /** The next thing you're actually going to, with its door QR ready. */
  const nextTicket = useMemo(() => {
    const now = Date.now();
    return (tickets ?? [])
      .filter(
        (t) =>
          !t.event.cancelled &&
          t.status === "valid" &&
          new Date(t.event.startsAt).getTime() > now - 6 * 3600_000,
      )
      .sort((a, b) => +new Date(a.event.startsAt) - +new Date(b.event.startsAt))[0];
  }, [tickets]);

  const items = useMemo<LiveItem[]>(() => {
    const list: LiveItem[] = [];

    if (nextTicket) {
      list.push({
        id: `ticket-${nextTicket.id}`,
        emoji: nextTicket.event.emoji || "\ud83c\udf9f\ufe0f",
        label: "Your ticket",
        title: nextTicket.event.title,
        sub: eventWhen(nextTicket.event.startsAt),
        meta: [nextTicket.event.venue, nextTicket.event.city].filter(Boolean).join(" · ") || nextTicket.event.host,
        gradient: "from-[oklch(0.45_0.16_265)] to-[oklch(0.32_0.13_265)]",
        cta: "Show QR",
        qr: `shekk:ticket:${nextTicket.code}`,
      });
    }

    if (MONEY_ENABLED && pendingSplit) {
      list.unshift({
        id: `split-${pendingSplit.id}`,
        emoji: "💸",
        label: "Pending split",
        title: `${pendingSplit.from.split(" ")[0]} requested ₪${pendingSplit.amount.toFixed(2)}`,
        sub: pendingSplit.reason,
        meta: "Waiting on you",
        gradient: "from-[oklch(0.5_0.19_25)] to-[oklch(0.36_0.16_20)]",
        cta: "Pay now",
        to: "/social",
      });
    }

    return list;
  }, [pendingSplit, nextTicket]);

  if (!hydrated || items.length === 0) return null;

  return (
    <section className="pt-6">
      <div className="flex items-baseline justify-between px-5">
        <h2 className="font-display text-base font-bold tracking-tight">Active now</h2>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          Live
        </span>
      </div>

      <div className="no-scrollbar mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1">
        {items.map((item) => {
          const inner = (
            <>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-white/15 text-sm backdrop-blur">
                  {item.emoji}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">{item.label}</span>
              </div>
              <div className="mt-3 rounded-2xl bg-white/12 p-3 backdrop-blur">
                <p className="line-clamp-1 text-[15px] font-bold leading-tight text-white">{item.title}</p>
                <p className="mt-1 line-clamp-1 text-[12px] font-medium text-white/85">{item.sub}</p>
                {item.meta ? <p className="mt-0.5 line-clamp-1 text-[11px] text-white/65">{item.meta}</p> : null}
              </div>
              <span className="mt-3 inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-neutral-900">
                {item.cta}
              </span>
            </>
          );

          const className = `tap widget-tile flex min-h-[168px] w-[15.5rem] shrink-0 snap-start flex-col rounded-[1.5rem] bg-gradient-to-br ${item.gradient} p-3.5 text-left`;

          return item.to ? (
            <Link key={item.id} to={item.to} className={className}>
              {inner}
            </Link>
          ) : (
            <button key={item.id} type="button" onClick={() => setQr(item)} className={className}>
              {inner}
            </button>
          );
        })}
      </div>

      {qr ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/45 p-4 animate-fade-in"
          onClick={() => setQr(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{qr.label}</p>
                <p className="mt-1 text-sm font-bold">{qr.title}</p>
                <p className="text-xs text-muted-foreground">{qr.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => setQr(null)}
                className="tap-icon rounded-full bg-muted p-1.5"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center rounded-2xl bg-muted p-4">
              <QRCode value={qr.qr || qr.id} className="h-44 w-44" />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Show this at the door — staff scan it to check you in.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
