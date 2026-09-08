/** "For You" widget catalogue — content + relevance scoring. */
import type { ReactNode } from "react";
import { ils } from "./mock";
import { relativeTime } from "./news-types";
import { pick, rand, type UserContext } from "./personalise";
import { MONEY_ENABLED } from "./flags";

export type WidgetCta = { label: string; to?: string; href?: string };

export type WidgetRow = {
  icon: string;
  label: string;
  value?: string;
  /** External article/link opened in a new tab from the detail sheet. */
  href?: string;
  /** Thumbnail shown instead of the icon when present. */
  image?: string;
};

export type WidgetContent = {
  headline: string;
  sub?: string;
  /** Hero image for the detail sheet. */
  image?: string;
  /** Makes the sheet headline itself tappable. */
  href?: string;
  rows: WidgetRow[];
  hero?: ReactNode;
  ctas: WidgetCta[];
};

export type WidgetDef = {
  id: string;
  title: string;
  emoji: string;
  gradient: string;
  /** Content-reactive gradient (e.g. sunny = gold, rainy = slate). */
  gradientFor?: (ctx: UserContext) => string;
  relevance: (ctx: UserContext) => number;
  build: (ctx: UserContext) => WidgetContent;
};


const clamp = (n: number) => Math.max(0, Math.min(100, n));

const RAW_WIDGETS: WidgetDef[] = [
  {
    id: "today",
    title: "Today",
    emoji: "🌤",
    gradient: "grad-sky",
    gradientFor: (c) => {
      const w = c.weather;
      const night = w ? !w.isDay : c.timeOfDay === "late" || c.hour >= 20 || c.hour < 5;
      if (night) return "grad-night";
      if (!w) return "grad-sky";
      if ((w.rain ?? 0) > 50 || /rain|drizzle|thunder/i.test(w.condition)) return "grad-rain";
      switch (w.condition) {
        case "Clear":
          return "grad-sun";
        case "Mostly sunny":
          return w.temp >= 30 ? "grad-sun" : "grad-partly";
        case "Partly cloudy":
        case "Overcast":
        case "Cloudy":
          return "grad-cloud";
        case "Hamsin haze":
          return "grad-haze";
        default:
          return "grad-partly";
      }
    },
    relevance: (c) =>
      clamp(52 + (c.timeOfDay === "morning" ? 40 : c.timeOfDay === "early" ? 30 : 6) + ((c.weather?.rain ?? 0) > 50 ? 15 : 0)),
    build: (c) => {
      const w = c.weather;
      if (!w) {
        return {
          headline: c.weatherError ? "Weather unavailable" : "Getting the weather…",
          sub: c.weatherError ? `Couldn't reach the weather service for ${c.weatherCity}` : c.weatherCity,
          rows: [],
          ctas: [],
        };
      }
      // Only show a figure the provider actually gave us.
      const rainRow: WidgetRow[] = w.rain === null ? [] : [{ icon: "☂️", label: "Rain chance", value: `${w.rain}%` }];
      const uvRow: WidgetRow[] = w.uv === null ? [] : [{ icon: "🔆", label: "UV index", value: `${w.uv}` }];
      const rows: WidgetRow[] = c.isFriday
        ? [
            { icon: "🕯", label: "Candle lighting", value: c.jewish?.candle ?? "—" },
            { icon: "🍷", label: "Havdalah", value: c.jewish?.havdalah ?? "—" },
            ...rainRow,
          ]
        : [
            { icon: "🌅", label: "Sunrise", value: c.jewish?.sunrise ?? "—" },
            { icon: "🌇", label: "Sunset", value: c.jewish?.sunset ?? "—" },
            ...uvRow,
            ...rainRow,
          ];
      if (w.aqi !== null) rows.push({ icon: "🫁", label: "Air quality", value: `AQI ${w.aqi}` });
      return {
        headline: `${w.temp}° ${w.condition}`,
        sub: `${c.weatherCity} · feels ${w.feels}° · H ${w.high}° / L ${w.low}°`,
        rows,
        ctas: [],
      };
    },
  },
  {
    id: "jewish",
    title: "Jewish Life",
    emoji: "🕍",
    gradient: "grad-jewish",
    gradientFor: (c) =>
      c.jewishDay?.kind === "fast" ? "grad-fast" : c.jewishDay ? "grad-chag" : c.isErevShabbat || c.isShabbat ? "grad-night" : "grad-jewish",
    relevance: (c) =>
      clamp(
        45 +
          (c.isErevShabbat ? 55 : 0) +
          (c.isFriday ? 25 : 0) +
          (c.jewishDay ? (c.jewishDay.kind === "fast" ? 45 : 35) : 0) +
          (c.isShabbat ? 20 : 0),
      ),
    build: (c) => {
      const j = c.jewish;
      if (!j) {
        return {
          headline: c.jewishError ? "Calendar unavailable" : "Loading the luach…",
          sub: c.jewishError ? "Couldn't reach the Jewish calendar service" : c.weatherCity,
          rows: [],
          ctas: [],
        };
      }
      /** "in 4h 12m" to the next moment that matters, for this location. */
      const countdown = (() => {
        if (!j.next) return null;
        const ms = new Date(j.next.at).getTime() - c.now.getTime();
        if (!Number.isFinite(ms) || ms <= 0) return null;
        const mins = Math.round(ms / 60_000);
        if (mins < 60) return `${j.next.label} in ${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${j.next.label} in ${m ? `${h}h ${m}m` : `${h}h`}`;
      })();
      const place = `Times for ${c.weatherCity}`;
      const sub = [countdown, place].filter(Boolean).join(" · ");

      const base: WidgetRow[] = [];
      base.push({ icon: "🗓", label: j.afterSunset ? "Tonight" : "Today", value: j.hebrewDate });
      if (j.sedra) base.push({ icon: "📜", label: "This week's sedra", value: `Parashat ${j.sedra}` });
      if (j.shabbatSpecial) base.push({ icon: "✡️", label: "This Shabbat", value: j.shabbatSpecial });

      const tail: WidgetRow[] = [
        { icon: "🌇", label: "Shkia (sunset)", value: j.sunset ?? "—" },
        { icon: "✨", label: "Tzeit hakochavim", value: j.tzeit ?? "—" },
        { icon: "📍", label: "Calendar", value: j.schemeNote },
      ];

      if (j.fast) {
        return {
          headline: j.fast.label,
          sub,
          rows: [
            ...base,
            { icon: "🌑", label: "Fast begins", value: j.fast.begins },
            { icon: "✨", label: "Fast ends", value: j.fast.ends },
            { icon: "📍", label: "Calendar", value: j.schemeNote },
          ],
          ctas: [{ label: "Open Siddur", to: "/siddur" }],
        };
      }
      const times: WidgetRow[] = [];
      if (j.candle) {
        times.push({
          icon: "🕯",
          label: j.candleLabel && j.candleLabel !== "Shabbat" ? `Candles · ${j.candleLabel}` : "Candle lighting",
          value: j.candle,
        });
      }
      if (j.havdalah) times.push({ icon: "🍷", label: "Havdalah", value: j.havdalah });

      if (j.holiday) {
        return {
          headline: j.holiday.label,
          sub,
          rows: [...base, ...times, ...tail],
          ctas: [{ label: "Open Siddur", to: "/siddur" }],
        };
      }
      return {
        headline: j.sedra ? `Parashat ${j.sedra}` : j.hebrewDate,
        sub,
        rows: [
          ...base,
          ...times,
          ...(j.upcoming ? [{ icon: "🎉", label: "Coming up", value: j.upcoming.label }] : []),
          ...tail,
        ],
        ctas: [{ label: "Open Siddur", to: "/siddur" }],
      };
    },

  },

  {
    id: "news",
    title: "Israel news",
    emoji: "📰",
    gradient: "grad-news",
    gradientFor: (c) => (c.news.some((n) => n.urgent) ? "grad-alert" : "grad-news"),
    relevance: (c) => {
      if (!c.news.length) return c.newsLoading ? 30 : 10;
      const urgent = c.news.slice(0, 8).some((n) => n.urgent);
      const freshMins = (Date.now() - Date.parse(c.news[0].publishedAt)) / 60_000;
      return clamp(48 + (urgent ? 50 : 0) + (freshMins < 90 ? 10 : 0) + (c.timeOfDay === "morning" ? 8 : 0));
    },
    build: (c) => {
      if (!c.news.length) {
        return {
          headline: c.newsError ? "Headlines unavailable" : "Loading headlines…",
          sub: c.newsError ? "Couldn't reach the news feeds" : "Times of Israel · JPost · Ynet · Arutz Sheva",
          rows: [],
          ctas: [{ label: "Open news", to: "/news" }],
        };
      }
      // Lead with an urgent story when there is one, preferring an urgent story
      // that carries its own art; otherwise the newest story with art. The
      // picture always belongs to the headline shown.
      const urgent = c.news.find((n) => n.urgent && n.image) ?? c.news.find((n) => n.urgent);
      const lead = urgent ?? c.news.find((n) => n.image) ?? c.news[0];

      const rest = c.news.filter((n) => n.id !== lead.id).slice(0, 5);
      return {
        headline: lead.title,
        sub: `${lead.sourceName} · ${relativeTime(lead.publishedAt)}${urgent ? " · developing" : ""}`,
        image: lead.image,
        href: lead.url,
        rows: rest.map((n) => ({
          icon: n.urgent ? "🚨" : "•",
          label: n.title,
          value: relativeTime(n.publishedAt),
          href: n.url,
          image: n.image,
        })),
        ctas: [
          { label: "Read full story", href: lead.url },
          { label: "All headlines", to: "/news" },
        ],
      };
    },
  },

  {
    id: "social",
    title: "Requests",
    emoji: "👥",
    gradient: "grad-social",
    gradientFor: (c) => (c.signals.pendingSplits ? "grad-alert" : "grad-social"),
    relevance: (c) => clamp(40 + (c.signals.pendingSplits ? 38 : 0) + (c.timeOfDay === "evening" ? 12 : 0)),
    build: (c) => ({
      headline: c.signals.pendingSplits ? `${ils(c.signals.requestedTotal)} requested` : "All settled",
      sub: c.signals.pendingSplits
        ? `${c.signals.pendingSplits} friend${c.signals.pendingSplits > 1 ? "s" : ""} waiting to be paid back`
        : "No one is waiting on you",
      rows: [
        ...c.signals.requests.map((r) => ({ icon: "🙋", label: `${r.from} · ${r.reason}`, value: ils(r.amount) })),
      ],
      ctas: [{ label: "Pay back", to: "/social" }],
    }),
  },

];

/** Money is paused for launch (see flags.ts) — the "Requests"/split-repayment
 *  tile has nothing to show without it, so it's excluded here rather than at
 *  every place WIDGETS is read, the same single-flag approach flags.ts
 *  documents for the rest of Money's surfaces. */
export const WIDGETS: WidgetDef[] = RAW_WIDGETS.filter((w) => MONEY_ENABLED || w.id !== "social");

export const WIDGET_BY_ID = Object.fromEntries(WIDGETS.map((w) => [w.id, w])) as Record<string, WidgetDef>;

/** Extra flavour so identical contexts still differ per student. */
export function jitter(ctx: UserContext, id: string) {
  return rand(`${ctx.signals.seed}|${id}`) * 8;
}

/**
 * Fixed arrangement — tiles stay exactly where the member left them. Saved
 * order first, then any widget that didn't exist yet, in registry order.
 */
export function arrangeWidgets(order: string[], hidden: string[]): WidgetDef[] {
  const seen = new Set<string>();
  const out: WidgetDef[] = [];
  for (const id of order) {
    const w = WIDGET_BY_ID[id];
    if (w && !seen.has(id) && !hidden.includes(id)) {
      out.push(w);
      seen.add(id);
    }
  }
  for (const w of WIDGETS) if (!seen.has(w.id) && !hidden.includes(w.id)) out.push(w);
  return out;
}


export function orderWidgets(ctx: UserContext, pinned: string[], hidden: string[]): WidgetDef[] {
  const pinnedDefs = pinned.map((id) => WIDGET_BY_ID[id]).filter(Boolean).filter((w) => !hidden.includes(w.id));
  const rest = WIDGETS.filter((w) => !pinned.includes(w.id) && !hidden.includes(w.id)).sort(
    (a, b) => b.relevance(ctx) + jitter(ctx, b.id) - (a.relevance(ctx) + jitter(ctx, a.id)),
  );
  return [...pinnedDefs, ...rest];
}

export const sampleTip = (ctx: UserContext) =>
  pick(["Updated just now", "Personalised for you", "Based on your week", "Live for your area"], ctx.signals.seed);
