import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bike, Dumbbell, Star, TreePine, Trophy, Waves } from "lucide-react";
import { AppShell, ScreenHeader } from "@/components/AppShell";
import type { ActivityType } from "@/lib/fitness";
import { haptic } from "@/lib/foryou-prefs";

export const Route = createFileRoute("/explore/fitness/")({
  head: () => ({
    meta: [
      { title: "Fitness · Shekk" },
      {
        name: "description",
        content:
          "Gyms, classes, pools, studios, courts and outdoor fitness near you in Israel — pick what you're after.",
      },
      { property: "og:title", content: "Fitness · Shekk" },
      {
        property: "og:description",
        content:
          "What are you looking for? Gyms, classes, swimming, running, martial arts and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FitnessLanding,
});

/**
 * Each tile either sets an existing activity filter (reusing the real
 * category/Google-Places taxonomy in `lib/fitness.ts`), pre-fills a real
 * search term (Running has no matching category, so it searches instead of
 * fabricating a new one), or opens the Saved tab. All land on the existing,
 * untouched Discover screen — nothing here talks to Google Places directly.
 */
const CATEGORY_TILES: {
  label: string;
  emoji: string;
  icon: typeof Dumbbell;
  category?: ActivityType;
  q?: string;
  tab?: "saved";
}[] = [
  { label: "Gyms", emoji: "🏋️", icon: Dumbbell, category: "gym" },
  { label: "Classes", emoji: "🧘", icon: Bike, category: "classes" },
  { label: "Swimming", emoji: "🏊", icon: Waves, category: "pool" },
  { label: "Running", emoji: "🏃", icon: Trophy, q: "running" },
  { label: "Martial Arts", emoji: "🥊", icon: Trophy, category: "martial" },
  { label: "Sports & Courts", emoji: "🎾", icon: Trophy, category: "courts" },
  { label: "Outdoor Fitness", emoji: "🌳", icon: TreePine, category: "outdoor" },
  { label: "Saved", emoji: "⭐", icon: Star, tab: "saved" },
];

function FitnessLanding() {
  return (
    <AppShell>
      <ScreenHeader title="Fitness" subtitle="What are you looking for?" />

      <div className="space-y-5 px-4 py-4">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">Fitness</h1>
          <p className="text-sm text-muted-foreground">What are you looking for?</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_TILES.map((tile) => (
            <Link
              key={tile.label}
              to="/explore/fitness/discover"
              search={{
                ...(tile.category ? { category: tile.category } : {}),
                ...(tile.q ? { q: tile.q } : {}),
                ...(tile.tab ? { tab: tile.tab } : {}),
              }}
              onClick={() => haptic()}
              className="tap flex min-h-[132px] flex-col items-start justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-card"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-2xl">
                {tile.emoji}
              </span>
              <span className="text-base font-bold leading-tight">{tile.label}</span>
            </Link>
          ))}
        </div>

        <Link
          to="/explore/fitness/discover"
          onClick={() => haptic()}
          className="tap-flat flex items-center justify-center gap-2 rounded-2xl bg-muted px-4 py-3.5 text-sm font-semibold text-foreground"
        >
          Search all fitness <ArrowRight className="size-4" />
        </Link>
      </div>
    </AppShell>
  );
}
