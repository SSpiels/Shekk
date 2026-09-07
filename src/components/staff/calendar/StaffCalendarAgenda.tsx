/**
 * Default Calendar view: a chronological, day-grouped list of what's coming
 * up — the most operationally useful view for a programme manager, versus
 * opening on a sparse month grid. Grouping uses israelDateKey so a day
 * boundary is always Israel-local, not the viewer's own timezone.
 */
import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/Kit";
import { fmtIsraelDayLong, israelDateKey, type StaffCalendarEvent } from "@/lib/programme/logic";
import { StaffEventCard } from "./StaffEventCard";

export function StaffCalendarAgenda({
  events,
  groups,
  onOpen,
  showPast,
}: {
  events: StaffCalendarEvent[];
  groups: { id: string; name: string }[];
  onOpen: (event: StaffCalendarEvent) => void;
  showPast: boolean;
}) {
  const days = useMemo(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    const rows = showPast ? events : events.filter((e) => new Date(e.startsAt).getTime() >= cutoff);
    const byDay = new Map<string, StaffCalendarEvent[]>();
    for (const e of [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const key = israelDateKey(e.startsAt);
      byDay.set(key, [...(byDay.get(key) ?? []), e]);
    }
    return [...byDay.entries()];
  }, [events, showPast]);

  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing scheduled"
        body={
          showPast
            ? "No events found."
            : "No upcoming events. New ones appear here the moment they're published."
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {days.map(([day, dayEvents]) => (
        <section key={day} className="space-y-2">
          <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">
            {fmtIsraelDayLong(dayEvents[0]!.startsAt)}
          </h3>
          <div className="space-y-2">
            {dayEvents.map((e) => (
              <StaffEventCard key={e.id} event={e} groups={groups} onOpen={() => onOpen(e)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
