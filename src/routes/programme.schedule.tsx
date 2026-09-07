import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { EmptyState, SectionHead } from "@/components/Kit";
import { useProgrammeHub } from "@/lib/useProgrammeHub";
import { EventRow, EventSheet } from "@/components/programme/Participant";
import { fmtIsraelDayLong, israelDateKey, type ProgrammeEvent } from "@/lib/programme/logic";

export const Route = createFileRoute("/programme/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule · Your programme · Shekk" },
      {
        name: "description",
        content: "Your full programme timetable, day by day, with live status, delays and location changes.",
      },
      { property: "og:title", content: "Schedule · Your programme · Shekk" },
      { property: "og:description", content: "Every session, tiyul and Shabbaton on your programme timetable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScheduleScreen,
});

function ScheduleScreen() {
  const { hub } = useProgrammeHub();
  const [open, setOpen] = useState<ProgrammeEvent | null>(null);
  const [past, setPast] = useState(false);

  const days = useMemo(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    const rows = hub.events.filter((e) => (past ? true : new Date(e.startsAt).getTime() >= cutoff));
    const map = new Map<string, ProgrammeEvent[]>();
    for (const e of [...rows].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      // Israel-local day, not the viewer's own — a 23:45 Israel event and a
      // 00:15-the-next-day Israel event must land in different day sections
      // even for a viewer whose own browser day hasn't rolled over yet.
      const key = israelDateKey(e.startsAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [hub.events, past]);

  return (
    <div className="space-y-6 px-4 pb-10 pt-4">
      <button
        type="button"
        onClick={() => setPast((v) => !v)}
        className="tap-flat text-[12px] font-bold text-primary"
      >
        {past ? "Hide past days" : "Show past days"}
      </button>

      {days.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing scheduled yet"
          body="Your programme hasn't published a timetable. It appears here the moment they do."
        />
      ) : (
        days.map(([day, events]) => (
          <section key={day}>
            <SectionHead title={fmtIsraelDayLong(events[0]!.startsAt)} />
            <div className="space-y-2">
              {events.map((e) => (
                <EventRow key={e.id} event={e} onOpen={() => setOpen(e)} />
              ))}
            </div>
          </section>
        ))
      )}

      <EventSheet event={open} hub={hub} onClose={() => setOpen(null)} />
    </div>
  );
}
