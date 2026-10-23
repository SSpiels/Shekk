/**
 * The original phone-only "Run the day" tools. Programme OS (/staff) is now the one staff
 * surface on every device, with everything this screen did — delay/move/cancel an activity,
 * post an update, ask the cohort a question, groups, the join code, checklist and contacts.
 *
 * This screen was built on the member's own *student* hub, so for someone who is a student in
 * one programme and staff in another it showed the wrong programme. Programme OS works from
 * the staff workspace the account has chosen, so that cannot happen there. Old bookmarks and
 * links land in Programme OS.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/programme/staff")({
  beforeLoad: () => {
    throw redirect({ to: "/staff/overview", replace: true });
  },
});
