import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, Search, X } from "lucide-react";
import { AppShell, ScreenHeader } from "@/components/AppShell";
import {
  GUIDES,
  GUIDE_CATEGORIES,
  categoryLabel,
  featuredGuide,
  getGuide,
  searchGuides,
  type Guide,
  type GuideCategoryId,
} from "@/lib/guides";
import { useGuidePrefs } from "@/lib/guide-prefs";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title: "Guides · Living in Israel, explained · Shekk" },
      {
        name: "description",
        content:
          "Practical gap-year guides: Rav-Kav and student fares, Shabbat timing, renting a room, visa extensions, seeing a doctor, tiyulim and money.",
      },
      { property: "og:title", content: "Guides · Living in Israel, explained" },
      { property: "og:description", content: "Practical how-tos for your year in Israel, written for students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidesIndex,
});

function Row({ guide, note }: { guide: Guide; note?: string | null }) {
  return (
    <Link to="/guides/$id" params={{ id: guide.id }} className="tap-flat flex items-start gap-3 py-4">
      <span className="mt-0.5 text-xl leading-none">{guide.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {categoryLabel(guide.category)} · {guide.readMins} min
        </p>
        <h3 className="mt-0.5 text-[15px] font-bold leading-tight">{guide.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{note ?? guide.blurb}</p>
      </div>
      <ArrowRight className="mt-5 size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function GuidesIndex() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<GuideCategoryId | "all">("all");
  const { prefs } = useGuidePrefs();

  const hits = useMemo(() => searchGuides(query), [query]);
  const featured = featuredGuide();
  const saved = prefs.saved.map(getGuide).filter((g): g is Guide => g !== null);
  const reading = Object.entries(prefs.progress)
    .filter(([, v]) => v > 0.1 && v < 0.95)
    .map(([id]) => getGuide(id))
    .filter((g): g is Guide => g !== null);

  const groups = GUIDE_CATEGORIES.map((c) => ({
    ...c,
    guides: GUIDES.filter((g) => g.category === c.id),
  })).filter((c) => c.guides.length && (cat === "all" || cat === c.id));

  return (
    <AppShell>
      <ScreenHeader title="Guides" />

      <header className="px-5 pt-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Guides</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Living here, explained — the things nobody tells you before you land.
        </p>
        <label className="mt-4 flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rav-Kav, arnona, last bus, doctor…"
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button onClick={() => setQuery("")} className="tap-flat shrink-0 text-muted-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
      </header>

      {query ? (
        <section className="px-5 pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {hits.length} result{hits.length === 1 ? "" : "s"}
          </p>
          {hits.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nothing yet on that. Try a plainer word — “bus”, “rent”, “doctor”, “visa”.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {hits.map((h) => (
                <Row
                  key={h.guide.id}
                  guide={h.guide}
                  note={h.section ? `In this guide: ${h.section}` : undefined}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8 pt-6">
          {/* Featured */}
          <section className="px-5">
            <Link to="/guides/$id" params={{ id: featured.id }} className="tap block">
              <div className="grad-premium relative overflow-hidden rounded-3xl p-5 text-ink-foreground shadow-lift">
                <span className="card-sheen pointer-events-none absolute inset-0" aria-hidden />
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                  Start here
                </p>
                <p className="relative mt-1.5 font-display text-2xl font-bold leading-tight">{featured.title}</p>
                <p className="relative mt-1.5 text-[12.5px] leading-snug opacity-85">{featured.blurb}</p>
                <p className="relative mt-3 inline-flex items-center gap-1 text-[12px] font-semibold">
                  Read it <ArrowRight className="size-3.5" />
                </p>
              </div>
            </Link>
          </section>

          {reading.length ? (
            <section className="px-5">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Continue reading
              </h2>
              <div className="divide-y divide-border">
                {reading.map((g) => (
                  <Row key={g.id} guide={g} note={`${Math.round((prefs.progress[g.id] ?? 0) * 100)}% read`} />
                ))}
              </div>
            </section>
          ) : null}

          {saved.length ? (
            <section className="px-5">
              <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Bookmark className="size-3" /> Saved
              </h2>
              <div className="divide-y divide-border">
                {saved.map((g) => (
                  <Row key={g.id} guide={g} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {[{ id: "all" as const, label: "All", emoji: "✳️" }, ...GUIDE_CATEGORIES].map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id as GuideCategoryId | "all")}
                className={`tap-flat shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
                  cat === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          {groups.map((c) => (
            <section key={c.id} className="px-5">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {c.label} · {c.guides.length}
              </h2>
              <div className="divide-y divide-border">
                {c.guides.map((g) => (
                  <Row key={g.id} guide={g} />
                ))}
              </div>
            </section>
          ))}

          <p className="px-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            Written for gap-year students and checked against the Israeli calendar. Prices and phone numbers are
            correct as of the date on each guide.
          </p>
        </div>
      )}

      <div className="pb-10" />
    </AppShell>
  );
}
