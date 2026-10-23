import {
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { StaffNavId } from "@/lib/staff-nav";

/* Icons live here, not in the pure lib/staff-nav.ts — same split as
   lib/nav.ts (pure) vs AppShell.tsx's TABS array (React + icons). */
export const STAFF_ICONS: Record<StaffNavId, LucideIcon> = {
  overview: LayoutDashboard,
  students: Users,
  onboarding: CheckSquare,
  communications: Megaphone,
  calendar: CalendarDays,
  content: FileText,
  team: UserCog,
  settings: Settings,
};
