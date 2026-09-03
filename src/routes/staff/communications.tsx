import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/communications")({
  component: () => (
    <StaffPlaceholderPage
      icon={Megaphone}
      description="A desktop view of the existing announcement engine lands in Phase 4 — audience targeting, and exactly who has (and hasn't) acknowledged."
    />
  ),
});
