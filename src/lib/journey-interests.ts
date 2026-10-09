/**
 * What Shekk should help with.
 *
 * Chosen during the journey setup and stored on the member's own travel record
 * (member_travel.interests), so the choice follows them across devices. Home
 * uses it straight away: the "Picked for you" rail is built from these ids, in
 * the order they were chosen.
 */

import {
  Bus,
  CalendarHeart,
  Compass,
  Dumbbell,
  Landmark,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { MONEY_ENABLED } from "@/lib/flags";

export type InterestId =
  | "spending"
  | "transport"
  | "programme"
  | "events"
  | "jewish"
  | "fitness"
  | "food"
  | "exploring";

export type Interest = {
  id: InterestId;
  /** Short label on the choice chip. */
  label: string;
  /** Home rail wording — an action, not a category. */
  action: string;
  hint: string;
  to: string;
  icon: typeof Wallet;
};

const ALL_INTERESTS: Interest[] = [
  {
    id: "spending",
    label: "Spending & exchange",
    action: "Add money",
    hint: "Home currency into shekels",
    to: "/topup",
    icon: Wallet,
  },
  {
    id: "transport",
    label: "Getting around",
    action: "Transport",
    hint: "Rav-Kav, trains, rides",
    to: "/explore/transit",
    icon: Bus,
  },
  {
    id: "programme",
    label: "Programme life",
    action: "Your programme",
    hint: "Timetable and contacts",
    to: "/programme",
    icon: Users,
  },
  {
    id: "events",
    label: "Events & nights out",
    action: "What's on",
    hint: "Events and tickets",
    to: "/whats-on",
    icon: CalendarHeart,
  },
  {
    id: "jewish",
    label: "Jewish life",
    action: "Jewish life",
    hint: "Times, brachot, tefillot",
    to: "/siddur",
    icon: Landmark,
  },
  {
    id: "fitness",
    label: "Fitness",
    action: "Find a gym",
    hint: "Gyms, classes, courts",
    to: "/explore/fitness",
    icon: Dumbbell,
  },
  {
    id: "food",
    label: "Food",
    action: "Eat well",
    hint: "Delivery, shuk, kosher",
    to: "/explore/food",
    icon: UtensilsCrossed,
  },
  {
    id: "exploring",
    label: "Exploring Israel",
    action: "Explore Israel",
    hint: "Places worth the trip",
    to: "/israel",
    icon: Compass,
  },
];

/** "Spending & exchange" points at the paused money product, so it is only
 *  offered (and only resolved on Home) while MONEY_ENABLED is on. */
export const INTERESTS: Interest[] = ALL_INTERESTS.filter((i) => MONEY_ENABLED || i.id !== "spending");

const BY_ID = new Map(INTERESTS.map((i) => [i.id, i]));

/** Only the interests we still recognise, in the member's own order. */
export function resolveInterests(ids: readonly string[]): Interest[] {
  const seen = new Set<string>();
  const out: Interest[] = [];
  for (const id of ids) {
    const match = BY_ID.get(id as InterestId);
    if (match && !seen.has(id)) {
      seen.add(id);
      out.push(match);
    }
  }
  return out;
}
