/**
 * Mini apps are the little apps that live inside Shekk. Each one gets its own
 * launch screen and runs full-bleed — no Shekk tab bar, no Shekk top banner,
 * just a small back button.
 *
 * Every mini app also owns a real app icon: a squircle in its own gradient with
 * a single line glyph, so the icons read as a family instead of a row of emoji.
 */
import type { LucideIcon } from "lucide-react";
import { MONEY_ENABLED } from "./flags";

import {
  ArrowLeftRight,
  BookOpenText,
  Calculator,
  Languages,
  Radar,
  School,
  BusFront,
  CalendarCheck,
  CarFront,
  Compass,
  Dumbbell,
  FolderLock,
  House,

  MapPin,
  Map as MapIcon,
  Newspaper,
  PartyPopper,
  HeartHandshake,
  ShoppingBag,
  Stamp,
  BookMarked,
  Stethoscope,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";

export type MiniApp = {
  /** Route prefix that belongs to this mini app. */
  path: string;
  id: string;
  name: string;
  /** One line under the name on the launch screen. */
  tagline: string;
  emoji: string;
  /** Line glyph at the centre of the app icon. */
  Icon: LucideIcon;
  /** Optical size of the glyph as a fraction of the icon. Default 0.44. */
  iconScale?: number;
  /** Glyph stroke width. Default 1.8. */
  iconStroke?: number;
  /** Icon gradient, from the design tokens in styles.css. */
  grad: string;
  /** Launch-screen surface, from the design tokens. */
  surface: string;
  /** Text colour that sits on that surface. */
  onSurface: string;
  /** "planned" means designed but not integrated yet — the route explains how it will work. */
  status?: "live" | "planned";
};


export const MINI_APPS: MiniApp[] = [
  {
    path: "/explore/maps",
    id: "maps",
    name: "Maps",
    tagline: "Everything around you, on one map",
    emoji: "📍",
    Icon: MapPin,
    iconScale: 0.44,
    grad: "var(--grad-travel)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/map",
    id: "been-there",
    name: "Been There",
    tagline: "Your map of Israel",
    emoji: "🗺️",
    Icon: MapIcon,
    iconScale: 0.46,
    grad: "var(--grad-discover)",
    surface: "bg-primary",
    onSurface: "text-primary-foreground",
  },
  {
    path: "/explore/fitness",
    id: "fitness",
    name: "Fitness",
    tagline: "Gyms, classes and courts near you",
    emoji: "🏋️",
    Icon: Dumbbell,
    iconScale: 0.48,
    grad: "var(--grad-alert)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/health",
    id: "health",
    name: "Health",
    tagline: "Your insurance card, ready at the clinic",
    emoji: "🩺",
    Icon: Stethoscope,
    iconScale: 0.44,
    grad: "var(--grad-social)",
    surface: "bg-primary",
    onSurface: "text-primary-foreground",
  },
  {
    path: "/explore/food",
    id: "food",
    status: "planned",
    name: "Food",
    tagline: "Eat well, pay with Shekk",
    emoji: "🥙",
    Icon: UtensilsCrossed,
    iconScale: 0.42,
    grad: "var(--grad-deals)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/rides",
    id: "rides",
    status: "planned",
    name: "Rides",
    tagline: "Get across town",
    emoji: "🚕",
    Icon: CarFront,
    iconScale: 0.46,
    grad: "var(--grad-sun)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/transit",
    id: "transit",
    name: "Getting Around",
    tagline: "Plan a journey, anywhere in Israel",
    emoji: "🚌",
    Icon: BusFront,
    iconScale: 0.44,
    grad: "var(--grad-partly)",
    surface: "bg-primary",
    onSurface: "text-primary-foreground",
  },
  {
    path: "/explore/housing",
    id: "housing",
    status: "planned",
    name: "Housing",
    tagline: "Rooms, dira hunting and deposits",
    emoji: "🏠",
    Icon: House,
    iconScale: 0.44,
    grad: "var(--grad-haze)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/shops",
    id: "shops",
    status: "planned",
    name: "Shops",
    tagline: "Where your shekels go furthest",
    emoji: "🛍️",
    Icon: ShoppingBag,
    iconScale: 0.43,
    grad: "var(--grad-chag)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/reserve",
    id: "reserve",
    status: "planned",
    name: "Reserve",
    tagline: "Book a table, a court or a slot",
    emoji: "📅",
    Icon: CalendarCheck,
    iconScale: 0.44,
    grad: "var(--grad-wallet)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/siddur",
    id: "siddur",
    name: "Siddur",
    tagline: "Tefillah, brachot and Havdalah",
    emoji: "📖",
    Icon: BookOpenText,
    iconScale: 0.45,
    grad: "var(--grad-jewish)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/visa",
    id: "visa",
    name: "Visa",
    tagline: "Your status, sorted",
    emoji: "🛂",
    Icon: Stamp,
    iconScale: 0.44,
    grad: "var(--grad-haze)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/army",
    id: "army",
    name: "Explore the IDF",
    tagline: "Branches, units and pathways",
    emoji: "🎖️",
    Icon: Radar,
    iconScale: 0.45,
    grad: "var(--grad-alert)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },

  {
    path: "/explore/lone-soldier",
    id: "lone-soldier",
    name: "Lone Soldier",
    tagline: "Chayal boded rights and help",
    emoji: "🪖",
    Icon: HeartHandshake,
    iconScale: 0.46,
    grad: "var(--grad-deals)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/uni",
    id: "uni",
    name: "Universities",
    tagline: "Find your university in Israel",
    emoji: "🎓",
    Icon: School,
    iconScale: 0.46,
    grad: "var(--grad-discover)",
    surface: "bg-primary",
    onSurface: "text-primary-foreground",
  },

  {
    path: "/explore/documents",
    id: "documents",
    name: "Documents",
    tagline: "Your papers, private and ready",
    emoji: "🗂️",
    Icon: FolderLock,
    iconScale: 0.44,
    grad: "var(--grad-wallet)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/explore/ulpan",
    id: "ulpan",
    name: "Ulpan",
    tagline: "Hebrew you'll actually use",
    emoji: "🗣️",
    Icon: Languages,
    iconScale: 0.45,
    grad: "var(--grad-sky)",
    surface: "bg-primary",
    onSurface: "text-primary-foreground",
  },
  {
    path: "/explore/money-planner",
    id: "money-planner",
    name: "Money Planner",
    tagline: "The month, the landing, the buffer",
    emoji: "🧮",
    Icon: Calculator,
    iconScale: 0.44,
    grad: "var(--grad-wallet)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },



  {
    path: "/passport",
    id: "passport",
    name: "Passport",
    tagline: "Your year in Israel, stamped",
    emoji: "🛂",
    Icon: BookMarked,
    iconScale: 0.44,
    grad: "var(--grad-chag)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/guides",
    id: "guides",
    name: "Guides",
    tagline: "Living here, explained",
    emoji: "🧭",
    Icon: Compass,
    iconScale: 0.45,
    grad: "var(--grad-discover)",
    surface: "bg-primary",
    onSurface: "text-primary-foreground",
  },
  {
    path: "/news",
    id: "news",
    name: "News",
    tagline: "Israel, right now",
    emoji: "📰",
    Icon: Newspaper,
    iconScale: 0.44,
    grad: "var(--grad-news)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
  {
    path: "/exchange",
    id: "exchange",
    name: "Exchange",
    tagline: "Dollars in, shekels out",
    emoji: "💱",
    Icon: ArrowLeftRight,
    iconScale: 0.42,
    grad: "var(--grad-wallet)",
    surface: "bg-ink",
    onSurface: "text-ink-foreground",
  },
];

/**
 * Mini apps that belong to the paused regulated money product. They stay in
 * MINI_APPS (and keep their routes) but are hidden from the app library until
 * MONEY_ENABLED is true. Money Planner is not here: it is an informational
 * budgeting tool, not the wallet.
 */
export const MONEY_MINI_APP_IDS = new Set(["exchange"]);

/**
 * Mini apps that are archived: kept in MINI_APPS (routes and data stay live
 * for anyone with a direct link) but pulled out of the app library, search
 * and every other discovery surface.
 */
export const ARCHIVED_MINI_APP_IDS = new Set(["been-there"]);

/** Pure: the library a member should see for a given money-flag state. */
export function visibleMiniApps(moneyEnabled: boolean, apps: MiniApp[] = MINI_APPS): MiniApp[] {
  return moneyEnabled ? apps : apps.filter((a) => !MONEY_MINI_APP_IDS.has(a.id));
}

/** Pure: mini-app search over name and tagline only. */
export function searchMiniApps(apps: MiniApp[], query: string): MiniApp[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return apps.filter((a) => `${a.name} ${a.tagline}`.toLowerCase().includes(q));
}

/** Every mini app a member can open right now, in launch order. */
export function miniApps(): MiniApp[] {
  return visibleMiniApps(MONEY_ENABLED).filter((a) => !ARCHIVED_MINI_APP_IDS.has(a.id));
}


/** Which mini app, if any, owns this route. */
export function miniAppFor(pathname: string): MiniApp | null {

  const clean = pathname.replace(/\/$/, "") || "/";
  let best: MiniApp | null = null;
  for (const app of MINI_APPS) {
    if (clean === app.path || clean.startsWith(`${app.path}/`)) {
      if (!best || app.path.length > best.path.length) best = app;
    }
  }
  return best;
}
