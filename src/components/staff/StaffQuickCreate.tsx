/**
 * The "+ New" actions — announcement, activity or question — reachable from every Programme
 * OS page, so everyday tasks are one or two taps away on a phone and one click on a desktop.
 * It reuses the same composers the Communications and Calendar pages use; they refresh those
 * pages' data on success.
 *
 * Variants: `button` (header, opens a menu), `fab` (phone's floating button, opens a menu) and
 * `tiles` (a row of big buttons, used on the phone Overview).
 */
import { useState } from "react";
import { BarChart3, CalendarPlus, Megaphone, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StaffAnnouncementComposer } from "@/components/staff/communications/StaffAnnouncementComposer";
import { StaffPollComposer } from "@/components/staff/communications/StaffPollComposer";
import { StaffEventEditor } from "@/components/staff/calendar/StaffEventEditor";
import { useStaffCan, useStaffOS } from "@/components/staff/StaffSessionContext";
import { useStaffAudienceRefs } from "@/lib/useStaffStudents";

type Creating = "announcement" | "poll" | "event" | null;

export function StaffQuickCreate({ variant }: { variant: "button" | "fab" | "tiles" }) {
  const { activeWorkspace } = useStaffOS();
  const can = useStaffCan();
  const cohortId = activeWorkspace?.cohort?.id ?? null;
  const refs = useStaffAudienceRefs(cohortId);
  const [creating, setCreating] = useState<Creating>(null);

  const items = [
    { id: "announcement" as const, label: "Announcement", short: "Announce", hint: "Tell the cohort something", Icon: Megaphone, ok: can("announcements") },
    { id: "event" as const, label: "Activity", short: "Activity", hint: "Add to the schedule", Icon: CalendarPlus, ok: can("events") },
    { id: "poll" as const, label: "Poll or question", short: "Ask", hint: "Ask the cohort", Icon: BarChart3, ok: can("votes") },
  ].filter((i) => i.ok);

  if (!cohortId || items.length === 0) return null;

  return (
    <>
      {variant === "tiles" ? (
        <div className="grid grid-cols-3 gap-2">
          {items.map(({ id, short, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCreating(id)}
              className="tap flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3.5 text-[12.5px] font-semibold shadow-card"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-[18px]" />
              </span>
              {short}
            </button>
          ))}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {variant === "fab" ? (
              <button
                type="button"
                aria-label="Create new"
                className="tap fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus className="size-6" strokeWidth={2.4} />
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus className="size-4" /> New
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={variant === "fab" ? "top" : "bottom"} className="w-64">
            {items.map(({ id, label, hint, Icon }) => (
              <DropdownMenuItem key={id} onSelect={() => setCreating(id)} className="flex items-center gap-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <StaffAnnouncementComposer
        open={creating === "announcement"}
        onClose={() => setCreating(null)}
        cohortId={cohortId}
        groups={refs.groups}
        students={refs.students}
      />
      <StaffPollComposer
        open={creating === "poll"}
        onClose={() => setCreating(null)}
        cohortId={cohortId}
        groups={refs.groups}
        students={refs.students}
      />
      {creating === "event" ? (
        <StaffEventEditor
          open
          onClose={() => setCreating(null)}
          cohortId={cohortId}
          event={null}
          groups={refs.groups}
          students={refs.students}
        />
      ) : null}
    </>
  );
}
