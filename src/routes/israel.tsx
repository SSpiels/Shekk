import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { LoadingBlocks } from "@/components/Kit";
import { MiniAppIcon } from "@/components/MiniAppIcon";
import { miniApps, searchMiniApps, type MiniApp } from "@/lib/mini-apps";
import { useOnboardedGate } from "@/lib/useOnboardedGate";

export const Route = createFileRoute("/israel")({
  head: () => ({
    meta: [
      { title: "Explore · Shekk apps" },
      {
        name: "description",
        content:
          "The Shekk app library: every mini app we build in-house, from maps, transit and Hebrew to visas, documents, health and your siddur.",
      },
      { property: "og:title", content: "Explore · Shekk apps" },
      {
        property: "og:description",
        content: "All your Shekk apps in one place, grouped the way you'll actually use them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExploreHub,
});

/** One Shekk mini app tile, with a Soon badge when it isn't integrated yet. */
function MiniTile({ app }: { app: MiniApp }) {
  return (
    <Link to={app.path} className="tap-icon flex flex-col items-center gap-2">
      <span className="relative">
        <MiniAppIcon app={app} size={60} />
        {app.status === "planned" ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ink-foreground">
            soon
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight">{app.name}</span>
    </Link>
  );
}

/** Shekk mini apps, in plain groups — no near-duplicate sections. */
const MINI_GROUPS: { title: string; hint: string; ids: string[] }[] = [
  { title: "Getting around", hint: "Buses, trains, taxis and maps", ids: ["transit", "rides", "maps", "passport"] },
  {
    title: "Everyday life",
    hint: "Food, shopping, health, Hebrew and where you live",
    ids: ["food", "shops", "health", "housing", "fitness", "reserve", "ulpan"],
  },
  { title: "Jewish life and news", hint: "Tefillah, times and what's happening", ids: ["siddur", "news"] },
  {
    title: "Plan and paperwork",
    hint: "Guides, visas, documents and budgeting",
    ids: ["guides", "visa", "documents", "money-planner"],
  },
  {
    title: "Staying longer",
    hint: "University, the IDF and lone soldier life",
    ids: ["uni", "army", "lone-soldier"],
  },
];

function ExploreHub() {
  const ready = useOnboardedGate();
  const [query, setQuery] = useState("");
  const apps = miniApps();

  /** Grouped mini apps, with anything ungrouped appended so nothing disappears. */
  const miniGroups = useMemo(() => {
    const byId = new Map(apps.map((a) => [a.id, a]));
    const groups = MINI_GROUPS.map((g) => ({
      title: g.title,
      hint: g.hint,
      apps: g.ids.map((id) => byId.get(id)).filter((a): a is MiniApp => Boolean(a)),
    })).filter((g) => g.apps.length > 0);
    const placed = new Set(MINI_GROUPS.flatMap((g) => g.ids));
    const rest = apps.filter((a) => !placed.has(a.id));
    if (rest.length) groups.push({ title: "More from Shekk", hint: "Everything else we build in-house", apps: rest });
    return groups;
  }, [apps]);

  const results = useMemo(() => (query.trim() ? searchMiniApps(apps, query) : null), [query, apps]);

  if (!ready)
    return (
      <AppShell>
        <LoadingBlocks rows={3} />
      </AppShell>
    );

  return (
    <AppShell layout="grid">
      <header className="px-5 pt-7">
        <h1 className="font-display text-4xl font-bold tracking-tight">Explore</h1>
        <p className="mt-1 text-sm text-muted-foreground">All your Shekk apps, in one place.</p>
      </header>

      {/* search sticks to the top so it's always a thumb away */}
      <div className="sticky top-0 z-30 -mt-1 bg-background/85 px-5 pb-3 pt-4 backdrop-blur-xl lg:max-w-2xl">
        <label className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-base shadow-card sm:text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Shekk apps — maps, visa, siddur, Hebrew…"
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button onClick={() => setQuery("")} className="tap-flat shrink-0 text-muted-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
      </div>

      {results ? (
        <section className="px-4 py-6 lg:px-5">
          <p className="mb-4 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {results.length} app{results.length === 1 ? "" : "s"}
          </p>
          {results.length === 0 ? (
            <Card className="text-sm text-muted-foreground">No Shekk app matches that search.</Card>
          ) : (
            <div className="grid grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-8">
              {results.map((app) => (
                <MiniTile key={app.id} app={app} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-9 px-4 pb-4 pt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0 lg:px-5 lg:pt-4">
          {miniGroups.map((g) => (
            <section
              key={g.title}
              className="lg:rounded-3xl lg:border lg:border-border lg:bg-card lg:p-6 lg:shadow-card"
            >
              <div className="mb-3 px-1 lg:px-0">
                <h2 className="font-display text-base font-bold leading-tight tracking-tight">{g.title}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{g.hint}</p>
              </div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-5 lg:gap-y-6">
                {g.apps.map((app) => (
                  <MiniTile key={app.id} app={app} />
                ))}
              </div>
            </section>
          ))}
          <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground lg:col-span-2">
            Apps marked “soon” open an honest explainer until the integration is live.
          </p>
        </section>
      )}
    </AppShell>
  );
}
