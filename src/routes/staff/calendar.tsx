import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/calendar")({
  component: () => (
    <StaffPlaceholderPage
      icon={CalendarDays}
      description="A desktop month/week/agenda view over the existing programme events engine lands in Phase 4 — the same events already flow into the student app today."
    />
  ),
});
