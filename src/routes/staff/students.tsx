import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/students")({
  component: () => (
    <StaffPlaceholderPage
      icon={Users}
      description="The student roster and individual profiles land in Phase 4 — search, filter by group or status, and a complete operational picture per student."
    />
  ),
});
