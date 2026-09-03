import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/onboarding")({
  component: () => (
    <StaffPlaceholderPage
      icon={CheckSquare}
      description="The cohort-level onboarding control centre lands in Phase 4 — completion by checklist item, exactly who's missing what, and a way to remind them."
    />
  ),
});
