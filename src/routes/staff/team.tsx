import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/team")({
  component: () => (
    <StaffPlaceholderPage
      icon={UserCog}
      description="Staff list and role/permission presets, owner-managed, land in Phase 4 — built on the existing owner | staff + permissions model."
    />
  ),
});
