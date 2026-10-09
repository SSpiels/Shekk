import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ExternalLink, RotateCw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useUserContext, WEATHER_CITIES } from "@/lib/personalise";
import { LOCATION_CITIES, placeForCity, useLocation } from "@/lib/location";
import { useTravel } from "@/lib/useProgramme";
import { useJewish, useWeather } from "@/lib/live";
import { useNews } from "@/lib/news";
import { arrangeWidgets, type WidgetDef } from "@/lib/widgets";
import { SkyScene, skyKind } from "@/components/SkyScene";
import { JewishScene, jewishSceneKind } from "@/components/JewishScene";



import { useForYouPrefs, haptic } from "@/lib/foryou-prefs";
import { ForYouSettings } from "@/components/ForYouSettings";
import { ils } from "@/lib/mock";
import { useApp } from "@/lib/store";
import { GUIDES } from "@/lib/guides";
import { GuideStrip } from "@/components/GuideStrip";

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 px-5">
      <div className="shimmer col-span-2 h-28 rounded-[1.5rem] bg-muted" />
      <div className="shimmer aspect-square rounded-[1.5rem] bg-muted" />
      <div className="shimmer aspect-square rounded-[1.5rem] bg-muted" />
    </div>
  );
}

type Ctx = ReturnType<typeof useUserContext>;

/* iPhone-style tile: fixed frames, one type scale, one glance value. */
function Tile({
  def,
  ctx,
  balance,
  wide,
  index,
  editing,
  onOpen,
}: {
  def: WidgetDef;
  ctx: Ctx;
  balance: number;
  wide: boolean;
  index: number;
  editing?: boolean;
  onOpen: () => void;
}) {
  const content = def.build(ctx);
  const headline = def.id === "wallet" ? ils(balance) : content.headline;
  const snap = content.rows[0];
  // Weather is location-bound: always name the place it's for, on tiles of any size.
  const footer =
    def.id === "today"
      ? (content.sub ?? ctx.weatherCity)
      : wide
        ? content.sub ?? (snap ? `${snap.label}${snap.value ? ` · ${snap.value}` : ""}` : "")
        : snap
          ? `${snap.label}${snap.value ? ` · ${snap.value}` : ""}`
          : (content.sub ?? "");

  const sky =
    def.id === "today"
      ? skyKind({
          condition: ctx.weather?.condition,
          rain: ctx.weather?.rain,
          isDay: ctx.weather?.isDay,
          night: ctx.weather ? undefined : ctx.hour >= 20 || ctx.hour < 5,
        })
      : null;
  const jl =
    def.id === "jewish"
      ? jewishSceneKind({
          isErevShabbat: ctx.isErevShabbat,
          isShabbat: ctx.isShabbat,
          dayKind: ctx.jewishDay?.kind ?? null,
          tzeitAt: ctx.jewish?.tzeitAt ?? null,
          sunsetAt: ctx.jewish?.sunsetAt ?? null,
          now: ctx.now,
        })
      : null;

  const scene = !!sky || !!jl;
  const paper = def.id === "news" && !content.image;

  return (
    <button
      type="button"
      onClick={() => {
        if (editing) return;
        haptic();
        onOpen();
      }}
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className={`${scene ? "" : (def.gradientFor?.(ctx) ?? def.gradient)} ${paper ? "news-paper" : ""} widget-tile ${
        editing ? "" : "tap-icon"
      } animate-fade-in relative size-full overflow-hidden flex flex-col gap-2 p-3 text-left ${
        wide ? "min-h-[8.5rem]" : ""
      }`}
    >
      {sky ? <SkyScene kind={sky} dense={wide} /> : null}
      {jl ? <JewishScene kind={jl} dense={wide} /> : null}


      {content.image ? (
        <>
          <img
            src={content.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 size-full rounded-[inherit] object-cover opacity-70"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
        </>
      ) : null}



      {/* Header frame */}
      <div className="widget-frame relative z-[1] flex items-center gap-1.5 px-2 py-1.5">
        <span className="text-[13px] leading-none">{def.emoji}</span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em]">{def.title}</span>
      </div>

      {/* Body frame — one type scale across every widget */}
      <div className="widget-frame relative z-[1] flex min-h-0 flex-1 flex-col justify-between px-2.5 py-2">
        <p className="line-clamp-2 text-[15px] font-bold leading-[1.2]">{headline}</p>
        {footer ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-80">{footer}</p>
        ) : null}
      </div>

    </button>
  );
}


function DetailSheet({
  def,
  ctx,
  balance,
  weatherCity,
  setWeatherCity,
  onUseLocation,
  locating,
  locationError,
  onClose,
}: {
  def: WidgetDef;
  ctx: Ctx;
  balance: number;
  weatherCity: string;
  setWeatherCity: (c: string) => void;
  onUseLocation: () => void;
  locating: boolean;
  locationError: string | null;
  onClose: () => void;
}) {
  const content = def.build(ctx);
  const headline = def.id === "wallet" ? ils(balance) : content.headline;
  const sky =
    def.id === "today"
      ? skyKind({
          condition: ctx.weather?.condition,
          rain: ctx.weather?.rain,
          isDay: ctx.weather?.isDay,
          night: ctx.weather ? undefined : ctx.hour >= 20 || ctx.hour < 5,
        })
      : null;
  const jl =
    def.id === "jewish"
      ? jewishSceneKind({
          isErevShabbat: ctx.isErevShabbat,
          isShabbat: ctx.isShabbat,
          dayKind: ctx.jewishDay?.kind ?? null,
          tzeitAt: ctx.jewish?.tzeitAt ?? null,
          sunsetAt: ctx.jewish?.sunsetAt ?? null,
          now: ctx.now,
        })
      : null;

  const scene = !!sky || !!jl;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-foreground/40" aria-label="Close" onClick={onClose} />
      <div className="animate-fade-in relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] border border-border bg-card p-6 pb-8 shadow-card sm:rounded-[2rem]">
        <header className="flex items-start gap-3">
          <span className={`${scene ? "" : (def.gradientFor?.(ctx) ?? def.gradient)} widget-tile relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl`}>
            {sky ? <SkyScene kind={sky} /> : null}
            {jl ? <JewishScene kind={jl} /> : null}
            <span className="relative z-[1]">{def.emoji}</span>
          </span>


          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{def.title}</p>
            {content.href ? (
              <a
                href={content.href}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-flat block text-[17px] font-bold leading-tight underline-offset-2 hover:underline"
              >
                {headline}
              </a>
            ) : (
              <p className="text-[17px] font-bold leading-tight">{headline}</p>
            )}
            {content.sub ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{content.sub}</p> : null}
          </div>
          <button onClick={onClose} className="tap rounded-full bg-muted p-2" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>

        {content.image ? (
          <a
            href={content.href ?? undefined}
            target={content.href ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="mt-4 block overflow-hidden rounded-2xl bg-muted"
          >
            <img
              src={content.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-40 w-full object-cover"
              onError={(e) => {
                (e.currentTarget.parentElement as HTMLElement).style.display = "none";
              }}
            />
          </a>
        ) : null}

        <ul className="mt-5 space-y-2">
          {content.rows.map((r, i) => {
            const inner = (
              <>
                {r.image ? (
                  <img
                    src={r.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-11 shrink-0 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="w-5 shrink-0 text-center">{r.icon}</span>
                )}
                <span className="min-w-0 flex-1">{r.label}</span>
                {r.value ? (
                  <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">{r.value}</span>
                ) : null}
              </>
            );
            const cls = "flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-[13px] leading-snug";
            return (
              <li key={`${r.label}-${i}`}>
                {r.href ? (
                  <a href={r.href} target="_blank" rel="noopener noreferrer" className={`tap-flat ${cls}`}>
                    {inner}
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>


        {def.id === "today" || def.id === "jewish" ? (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Location</p>
              <button
                onClick={() => {
                  haptic();
                  onUseLocation();
                }}
                className="tap rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary"
              >
                {locating ? "Locating…" : "Use my location"}
              </button>
            </div>
            {locationError ? <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{locationError}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {WEATHER_CITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    haptic();
                    setWeatherCity(c);
                  }}
                  className={`tap rounded-full px-3.5 py-2 text-xs font-semibold ${
                    c === weatherCity ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {content.ctas.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {content.ctas.map((cta, i) => {
              const cls = `tap rounded-full px-4 py-2.5 text-xs font-semibold ${
                i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`;
              return cta.href ? (
                <a
                  key={cta.label}
                  href={cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => haptic()}
                  className={cls}
                >
                  {cta.label}
                </a>
              ) : (
                <Link
                  key={cta.label}
                  to={cta.to!}
                  onClick={() => {
                    haptic();
                    onClose();
                  }}
                  className={cls}
                >
                  {cta.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ForYou() {
  const { state } = useApp();
  // Live: re-derive context on a timer and whenever the tab regains focus.
  const [tick, setTick] = useState(0);
  const { prefs, togglePin, toggleHide, move, setOrder, setSize, setWeatherCity, reset } = useForYouPrefs();
  const loc = useLocation();

  const { travel } = useTravel();
  const setupCity = travel.israelCity && LOCATION_CITIES.includes(travel.israelCity) ? travel.israelCity : null;

  // A manual city pin wins, then the live GPS fix, then the city chosen in
  // onboarding — so declining the location prompt doesn't leave these empty.
  const place = useMemo(
    () => (prefs.weatherCity ? placeForCity(prefs.weatherCity) : (loc.place ?? (setupCity ? placeForCity(setupCity) : null))),
    [prefs.weatherCity, loc.place, setupCity],
  );

  // First visit: ask for location once so the widgets have something real.
  useEffect(() => {
    if (!prefs.weatherCity && loc.status === "idle") loc.detect();
  }, [prefs.weatherCity, loc.status]);

  const weather = useWeather(place);
  const jewish = useJewish(place);
  const news = useNews();

  const ctx = useUserContext(tick, {
    cityLabel: place ? (place.area ? `${place.area}, ${place.city}` : place.city) : "Israel",
    weather: weather.data ?? null,
    weatherLoading: weather.isPending && !!place,
    weatherError: weather.isError,
    locationNeeded: !place && loc.status !== "asking",
    jewish: jewish.data ?? null,
    jewishLoading: jewish.isPending && !!place,
    jewishError: jewish.isError,
    news: news.data?.items,
    newsLoading: news.isPending,
    newsError: news.isError,
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const id = window.setInterval(bump, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", bump);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", bump);
    };
  }, []);

  // Tiles are stuck where the member left them — no relevance reshuffling.
  // Tiles never move for a failed feed — the card shows its own error + Retry.
  const widgets = useMemo(
    () => arrangeWidgets(prefs.order.length ? prefs.order : prefs.pinned, prefs.hidden),
    [prefs.order, prefs.pinned, prefs.hidden],
  );
  const openDef = widgets.find((w) => w.id === openId) ?? null;

  /* ---- Manual refresh: re-pull every live feed behind the tiles ---- */
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = async () => {
    if (refreshing) return;
    haptic();
    setRefreshing(true);
    try {
      await Promise.allSettled([weather.refetch(), jewish.refetch(), news.refetch()]);
    } finally {
      setTick((t) => t + 1);
      setRefreshing(false);
    }
  };

  /* ---- iPhone-style edit mode: long-press to pick up, drag to reorder ---- */
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [lift, setLift] = useState({ x: 0, y: 0 });
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const pressRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const ids = widgets.map((w) => w.id);

  const cancelPress = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pressRef.current = null;
  };
  useEffect(() => cancelPress, []);

  const dragTo = (x: number, y: number) => {
    if (!dragId) return;
    const origin = originRef.current;
    if (origin) setLift({ x: x - origin.x, y: y - origin.y });

    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(
      "[data-wid]",
    ) as HTMLElement | null;
    const over = el?.dataset.wid;
    if (!over || over === dragId) return;
    const next = ids.slice();
    const from = next.indexOf(dragId);
    const to = next.indexOf(over);
    if (from < 0 || to < 0) return;
    next.splice(to, 0, next.splice(from, 1)[0]);
    haptic(6);
    setOrder(next);
    // The tile just moved into a new slot under the finger — re-anchor there.
    originRef.current = { x, y };
    setLift({ x: 0, y: 0 });
  };

  const pickUp = (id: string, x: number, y: number, target: HTMLElement, pointerId: number) => {
    setDragId(id);
    originRef.current = { x, y };
    setLift({ x: 0, y: 0 });
    try {
      target.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  };

  const onTilePointerDown = (e: React.PointerEvent, id: string) => {
    if (editing) {
      haptic(10);
      pickUp(id, e.clientX, e.clientY, e.currentTarget as HTMLElement, e.pointerId);
      return;
    }
    pressRef.current = { id, x: e.clientX, y: e.clientY };
    const target = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    const { clientX, clientY } = e;
    timerRef.current = window.setTimeout(() => {
      haptic(18);
      setEditing(true);
      // Keep the finger on the tile: the same press becomes the drag.
      pickUp(id, clientX, clientY, target, pointerId);
      pressRef.current = null;
    }, 480);
  };

  const onTilePointerMove = (e: React.PointerEvent) => {
    if (!editing) {
      const p = pressRef.current;
      if (p && (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8)) cancelPress();
      return;
    }
    dragTo(e.clientX, e.clientY);
  };

  // The drag itself is tracked on the window so the pointer can leave the tile.
  useEffect(() => {
    if (!dragId) return;
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      dragTo(ev.clientX, ev.clientY);
    };
    const up = () => onTilePointerUp();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);

    };
  });

  const onTilePointerUp = () => {
    cancelPress();
    // Drop: the tile settles back into its slot.
    originRef.current = null;
    setLift({ x: 0, y: 0 });
    setDragId(null);
  };


  /**
   * Layout engine — mosaic of widget tiles and boxless guide tiles that share
   * the exact same shapes (square or wide). A column cursor keeps every row
   * complete, so wide items only start a fresh row and nothing ever orphans.
   */
  const items = useMemo(() => {
    const seed = 7; // fixed: the mosaic never rearranges itself
    let s = (seed * 9301 + 49297) % 233280;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const pool = [...GUIDES].sort(() => rnd() - 0.5);
    const compact = prefs.size === "compact";

    type Item =
      | { kind: "widget"; key: string; def: WidgetDef; wide: boolean }
      | { kind: "guide"; key: string; guide: (typeof GUIDES)[number]; wide: boolean };

    const out: Item[] = [];
    let col = 0; // 0 = row start, 1 = row filled halfway
    let sinceGuide = 0;
    let gi = 0;
    // Randomised run length between guides: 2 widgets, then 1, then 2 …
    let run = 2 + Math.round(rnd());

    const place = (make: (wide: boolean) => Item, canBeWide: boolean) => {
      const wide = !compact && canBeWide && col === 0;
      out.push(make(wide));
      col = wide ? 0 : (col + 1) % 2;
    };

    widgets.forEach((w, i) => {
      // Hero tile first, then an occasional wide widget to break the rhythm.
      place((wide) => ({ kind: "widget", key: w.id, def: w, wide }), i === 0 || (i > 2 && i % 5 === 0));
      sinceGuide += 1;

      if (sinceGuide >= run && gi < pool.length && i < widgets.length - 1) {
        const guide = pool[gi];
        // A guide fills the slot next to a widget, or spans the row when it
        // lands on a fresh row — same shapes as the tiles, just boxless.
        place(
          (wide) => ({ kind: "guide", key: `guide-${guide.id}`, guide, wide }),
          gi % 2 === 1,
        );
        gi += 1;
        sinceGuide = 0;
        run = 1 + Math.round(rnd()); // 1 or 2 widgets before the next guide
      }
    });

    // Never leave a half-empty last row: pad with one more guide if we can.
    if (col === 1 && gi < pool.length) {
      const guide = pool[gi];
      out.push({ kind: "guide", key: `guide-${guide.id}`, guide, wide: false });
    }

    return out;
  }, [widgets, prefs.size]);

  return (
    <section className="pt-7">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-display text-xl font-bold leading-tight tracking-tight">
            <Sparkles className="size-4 text-primary" /> For You
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Your widgets — hold one to rearrange, or customise the set.
          </p>
        </div>

        {editing ? (
          <button
            onClick={() => {
              haptic();
              setEditing(false);
            }}
            className="tap flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Check className="size-3.5" /> Done
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="tap rounded-full bg-muted p-2 disabled:opacity-70"
              aria-label="Refresh widgets"
            >
              <RotateCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                haptic();
                setSettingsOpen(true);
              }}
              className="tap rounded-full bg-muted p-2"
              aria-label="Customise For You"
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        )}

      </div>


      {!ctx.ready ? (
        <div className="pt-3">
          <Skeleton />
        </div>
      ) : (
        <div className="mt-3 grid auto-rows-min grid-cols-2 gap-3 px-5" style={{ touchAction: editing ? "none" : undefined }}>
          {(editing ? items.filter((it) => it.kind === "widget") : items).map((item, i) =>
            item.kind === "guide" ? (
              <GuideStrip key={item.key} guide={item.guide} wide={item.wide} index={i} />
            ) : (
              <div
                key={item.key}
                data-wid={item.def.id}
                onPointerDown={(e) => onTilePointerDown(e, item.def.id)}
                onPointerMove={onTilePointerMove}
                onPointerUp={onTilePointerUp}
                onContextMenu={(e) => editing && e.preventDefault()}
                style={
                  dragId === item.def.id
                    ? {
                        transform: `translate3d(${lift.x}px, ${lift.y}px, 0) scale(1.08) rotate(1.5deg)`,
                        touchAction: "none",
                      }
                    : editing
                      ? { animationDelay: `${(i % 4) * 90}ms` }
                      : undefined
                }
                className={`relative ${item.wide ? "col-span-2 min-h-[8.5rem]" : "aspect-square"} ${
                  editing ? "wiggle select-none" : ""
                } ${dragId && dragId !== item.def.id ? "wiggle-settle" : ""} ${
                  dragId === item.def.id ? "wiggle-lift" : ""
                }`}
              >
                <Tile
                  def={item.def}
                  ctx={ctx}
                  balance={state.balance}
                  wide={item.wide}
                  index={i}
                  editing={editing}
                  onOpen={() => setOpenId(item.def.id)}
                />
                {/* Live feed genuinely failed — retry in place, tile stays put. */}
                {!editing && item.def.id === "today" && weather.isError ? (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic();
                      void weather.refetch();
                    }}
                    disabled={weather.isFetching}
                    className="tap absolute bottom-2 right-2 z-[2] flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-card disabled:opacity-70"
                  >
                    <RotateCw className={`size-3 ${weather.isFetching ? "animate-spin" : ""}`} /> Retry
                  </button>
                ) : null}
                {editing ? (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      haptic();
                      toggleHide(item.def.id);
                    }}
                    aria-label={`Remove ${item.def.title}`}
                    className="absolute -left-1.5 -top-1.5 z-10 grid size-6 place-items-center rounded-full bg-foreground text-background shadow-card"
                  >
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
            ),
          )}
        </div>
      )}


      {editing ? (
        <p className="mt-3 px-5 text-center text-[11px] text-muted-foreground">
          Drag tiles to rearrange · tap ✕ to remove · Done when you're happy
        </p>
      ) : null}

      {openDef && !editing ? (
        <DetailSheet
          def={openDef}
          ctx={ctx}
          balance={state.balance}
          weatherCity={prefs.weatherCity ?? place?.city ?? ""}
          setWeatherCity={setWeatherCity}
          onUseLocation={() => {
            setWeatherCity(null);
            loc.detect();
          }}
          locating={loc.loading}
          locationError={
            prefs.weatherCity ? `Pinned to ${prefs.weatherCity}` : (loc.error ?? null)
          }
          onClose={() => setOpenId(null)}
        />
      ) : null}

      <ForYouSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        togglePin={togglePin}
        toggleHide={toggleHide}
        move={move}
        setSize={setSize}
        reset={reset}
      />
    </section>
  );
}
