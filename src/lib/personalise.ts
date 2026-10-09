/**
 * Personalisation engine for the Home "For You" rail.
 *
 * Weather (Open-Meteo) and the Jewish calendar (Hebcal) are live, fetched for
 * the student's detected or chosen place. Spending signals come from their own
 * stored activity; only the small nudge copy is still seeded by name.
 */
import { useEffect, useMemo, useState } from "react";
import { type Txn } from "./mock";
import { useApp } from "./store";
import type { LiveJewish, LiveWeather } from "./live-types";
import type { NewsItem } from "./news-types";

/* ---------------------------------------------------------------- seeding */

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Stable pseudo-random in [0,1) for a given seed string. */
export function rand(seed: string): number {
  return (hash(seed) % 100000) / 100000;
}

export function pick<T>(arr: readonly T[], seed: string): T {
  return arr[hash(seed) % arr.length];
}

/* ------------------------------------------------------------- calendar */

export type TimeOfDay = "early" | "morning" | "afternoon" | "evening" | "late";

export type JewishDay = {
  label: string;
  kind: "chag" | "fast" | "minor";
  blurb: string;
};

/* ---------------------------------------------------------------- types */

export type UserContext = {
  ready: boolean;
  now: Date;
  hour: number;
  timeOfDay: TimeOfDay;
  dayOfWeek: number; // 0 = Sunday
  isFriday: boolean;
  isErevShabbat: boolean;
  isShabbat: boolean;
  isMotzash: boolean;
  jewishDay: JewishDay | null;
  sedra: string | null;
  hebrewDate: string;
  city: string;
  /** Where the live data is measured — the student's detected or chosen place. */
  weatherCity: string;
  /** Live Hebcal payload; null while loading or if Hebcal is unreachable. */
  jewish: LiveJewish | null;
  jewishLoading: boolean;
  jewishError: boolean;
  /** Live Open-Meteo payload; null while loading or if the fetch failed. */
  weather: LiveWeather | null;
  weatherLoading: boolean;
  weatherError: boolean;
  /** No GPS fix, pinned city or onboarding city — nothing to fetch for yet. */
  locationNeeded: boolean;
  /** Live Israeli headlines, newest first. */
  news: NewsItem[];
  newsLoading: boolean;
  newsError: boolean;
  signals: {
    topCategory: string;
    favouriteMerchant: string;
    spentThisWeek: number;
    pendingSplits: number;
    lastTransitSpend: number;
    ravKavLow: boolean;
    requests: { from: string; reason: string; amount: number }[];
    requestedTotal: number;
    seed: string;
  };
};


function timeOfDay(hour: number): TimeOfDay {
  if (hour < 6) return "early";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "late";
}

function signalsFrom(txns: Txn[], seed: string) {
  const spends = txns.filter((t) => t.amount < 0);
  const byCategory = new Map<string, number>();
  const byMerchant = new Map<string, number>();
  for (const t of spends) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Math.abs(t.amount));
    byMerchant.set(t.merchant, (byMerchant.get(t.merchant) ?? 0) + Math.abs(t.amount));
  }
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  const fav = [...byMerchant.entries()].sort((a, b) => b[1] - a[1])[0];
  const spentThisWeek = spends.reduce((s, t) => s + Math.abs(t.amount), 0);
  const lastTransitSpend = spends
    .filter((t) => t.category.toLowerCase().includes("transit"))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    topCategory: top?.[0] ?? "Food & drink",
    favouriteMerchant: fav?.[0] ?? "Cafe Rimon",
    spentThisWeek: +spentThisWeek.toFixed(2),
    lastTransitSpend,
    ravKavLow: lastTransitSpend < 60,
    seed,
  };
}

/* ----------------------------------------------------------------- hook */

/** Cities the student can pin the widgets to when GPS is unavailable. */
export { LOCATION_CITIES as WEATHER_CITIES } from "./location";

/** Stable identity so the memo doesn't churn while news is loading. */
const EMPTY_NEWS: NewsItem[] = [];

export type LiveInput = {
  /** Label for the place the live data was fetched for. */
  cityLabel: string;
  weather: LiveWeather | null;
  weatherLoading: boolean;
  weatherError: boolean;
  locationNeeded?: boolean;
  jewish: LiveJewish | null;
  jewishLoading: boolean;
  jewishError: boolean;
  news?: NewsItem[];
  newsLoading?: boolean;
  newsError?: boolean;
};

/**
 * Reads the clock only after mount so SSR and hydration agree.
 * `refreshKey` forces a re-read; `live` carries the fetched weather/Hebcal data.
 */
export function useUserContext(refreshKey = 0, live?: LiveInput): UserContext {
  const { state } = useApp();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [refreshKey]);

  const jewish = live?.jewish ?? null;
  const weather = live?.weather ?? null;
  const news = live?.news ?? EMPTY_NEWS;

  return useMemo<UserContext>(() => {
    const d = now ?? new Date(2026, 0, 1, 9, 0, 0);
    const hour = d.getHours();
    const dayOfWeek = d.getDay();
    const city = live?.cityLabel ?? "Israel";

    // Prefer real candle-lighting / havdalah instants over clock heuristics.
    // Instant comparisons are timezone-independent, so this stays correct abroad.
    const candleAt = jewish?.candleDate ? new Date(jewish.candleDate) : null;
    const havdalahAt = jewish?.havdalahDate ? new Date(jewish.havdalahDate) : null;
    const withinShabbat =
      candleAt && havdalahAt
        ? d >= candleAt && d < havdalahAt
        : havdalahAt
          ? d < havdalahAt && havdalahAt.getTime() - d.getTime() < 26 * 3600_000
          : (dayOfWeek === 5 && hour >= 17) || (dayOfWeek === 6 && hour < 18);
    const erev = candleAt
      ? d < candleAt && candleAt.getTime() - d.getTime() <= 8 * 3600_000
      : dayOfWeek === 5 && hour >= 11;
    const motzash = havdalahAt
      ? d >= havdalahAt && d.getTime() - havdalahAt.getTime() < 3 * 3600_000
      : dayOfWeek === 6 && hour >= 18;


    const seed = `${state.name}|${city}|${d.toDateString()}|${refreshKey}`;
    const unpaid = state.splits.filter((s) => !s.paid);

    return {
      ready: now !== null,
      now: d,
      hour,
      timeOfDay: timeOfDay(hour),
      dayOfWeek,
      isFriday: dayOfWeek === 5,
      isErevShabbat: erev,
      isShabbat: withinShabbat,
      isMotzash: motzash,
      jewishDay: jewish?.holiday ?? null,
      sedra: jewish?.sedra ?? null,
      hebrewDate: jewish?.hebrewDate ?? "",
      city,
      weatherCity: city,
      jewish,
      jewishLoading: live?.jewishLoading ?? false,
      jewishError: live?.jewishError ?? false,
      weather,
      weatherLoading: live?.weatherLoading ?? false,
      weatherError: live?.weatherError ?? false,
      locationNeeded: live?.locationNeeded ?? false,
      news,
      newsLoading: live?.newsLoading ?? false,
      newsError: live?.newsError ?? false,
      signals: {
        ...signalsFrom(state.txns, seed),
        pendingSplits: unpaid.length,
        requests: unpaid.map((s) => ({ from: s.from, reason: s.reason, amount: s.amount })),
        requestedTotal: +unpaid.reduce((sum, s) => sum + s.amount, 0).toFixed(2),
      },
    };
  }, [
    now,
    refreshKey,
    jewish,
    weather,
    live?.cityLabel,
    live?.weatherLoading,
    live?.weatherError,
    live?.locationNeeded,
    live?.jewishLoading,
    live?.jewishError,
    news,
    live?.newsLoading,
    live?.newsError,
    state.name,
    state.txns,
    state.splits,
  ]);
}
