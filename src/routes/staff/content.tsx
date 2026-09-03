import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { StaffPlaceholderPage } from "@/components/staff/StaffPlaceholderPage";

export const Route = createFileRoute("/staff/content")({
  component: () => (
    <StaffPlaceholderPage
      icon={FileText}
      description="Checklist, documents, contacts and places lands in Phase 4 — the same content that already flows into the student app's Programme tab."
    />
  ),
});
