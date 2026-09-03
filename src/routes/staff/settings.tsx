import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/settings")({
  component: () => (
    <StaffPlaceholderPage
      icon={Settings}
      description="Programme name, logo and basic cohort settings land in Phase 4."
    />
  ),
});
