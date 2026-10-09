/**
 * The Israel setup checklist — the spine of the launch product.
 *
 * Each task is something the member can actually DO, in Shekk or through a
 * partner. Some tasks Shekk can see are done (documents uploaded, programme
 * joined); the rest the member ticks themselves and we store that per member.
 */

import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  BusFront,
  FileText,
  GraduationCap,
  HeartPulse,
  PhoneCall,
  Plane,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";

export type SetupPhase = "before" | "arrival" | "first-week";

export type SetupTask = {
  key: string;
  title: string;
  blurb: string;
  phase: SetupPhase;
  href: string;
  cta: string;
  Icon: LucideIcon;
  /** True when the task is informational about the frozen money product. */
  money?: boolean;
};

export const SETUP_TASKS: SetupTask[] = [
  {
    key: "sim",
    title: "Sort your Israeli SIM",
    blurb: "Answer three questions and we'll recommend the right eSIM or local plan for your stay.",
    phase: "before",
    href: "/services/esim",
    cta: "Find my SIM",
    Icon: Smartphone,
  },
  {
    key: "insurance",
    title: "Get travel and medical cover",
    blurb: "Most programmes require it. Compare the cover that fits your dates and activities.",
    phase: "before",
    href: "/services/insurance",
    cta: "Compare cover",
    Icon: ShieldCheck,
  },
  {
    key: "programme",
    title: "Link your programme",
    blurb: "Enter your join code to get your timetable, announcements, documents and on-call contacts.",
    phase: "before",
    href: "/programme",
    cta: "Enter code",
    Icon: GraduationCap,
  },
  {
    key: "documents",
    title: "Save your key documents",
    blurb: "Passport, visa, acceptance letter and insurance policy — private to you, ready offline.",
    phase: "before",
    href: "/explore/documents",
    cta: "Open documents",
    Icon: FileText,
  },
  {
    key: "airport",
    title: "Plan your airport transport",
    blurb: "Train, sherut or a fixed-price transfer from Ben Gurion — decide before you land.",
    phase: "before",
    href: "/explore/transit",
    cta: "See options",
    Icon: Plane,
  },
  {
    key: "emergency",
    title: "Save emergency numbers",
    blurb: "101 ambulance, 100 police, 102 fire, plus your programme's on-call contact.",
    phase: "before",
    href: "/programme",
    cta: "Review contacts",
    Icon: PhoneCall,
  },
  {
    key: "activate-sim",
    title: "Activate your SIM",
    blurb: "Switch your eSIM on at the airport and check you have data before you leave the terminal.",
    phase: "arrival",
    href: "/services/esim",
    cta: "How to activate",
    Icon: Smartphone,
  },
  {
    key: "rav-kav",
    title: "Get a Rav-Kav",
    blurb: "The card every bus and train runs on. Where to get one and how to load it.",
    phase: "arrival",
    href: "/explore/transit",
    cta: "Open transport",
    Icon: BusFront,
  },
  {
    key: "health",
    title: "Store your health cover",
    blurb: "Add your kupah or insurance card so a clinic can read your member number in seconds.",
    phase: "first-week",
    href: "/explore/health",
    cta: "Add my card",
    Icon: HeartPulse,
  },
  {
    key: "local-apps",
    title: "Install the local apps",
    blurb: "Moovit, Wolt, Gett and the rest — the apps everyone in Israel actually uses.",
    phase: "first-week",
    href: "/israel",
    cta: "See the apps",
    Icon: Smartphone,
  },
  {
    key: "where-you-live",
    title: "Find your feet where you live",
    blurb: "Nearest makolet, pharmacy, laundry and the bus stop you'll use every day.",
    phase: "first-week",
    href: "/explore/maps",
    cta: "Open maps",
    Icon: BedDouble,
  },
  {
    key: "money",
    title: "Sort money for Israel",
    blurb: "How students usually pay here, what cards cost and what Shekk Money will change.",
    phase: "first-week",
    href: "/money",
    cta: "Read the plan",
    Icon: Wallet,
    money: true,
  },
];

export const PHASE_LABEL: Record<SetupPhase, string> = {
  before: "Before you fly",
  arrival: "Landing day",
  "first-week": "Your first week",
};

export function tasksForPhase(phase: SetupPhase) {
  return SETUP_TASKS.filter((t) => t.phase === phase);
}
