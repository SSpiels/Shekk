import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/overview")({
  component: () => (
    <StaffPlaceholderPage
      icon={LayoutDashboard}
      description="The command centre lands in Phase 4 — active students, onboarding completion, open items needing attention, today's programme and recent activity, all in one place."
    />
  ),
});
