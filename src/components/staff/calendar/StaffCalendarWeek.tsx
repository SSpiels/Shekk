/**
 * Week view: seven Israel-local day columns. Navigation moves by day-keys
 * (plain calendar-day arithmetic on the "YYYY-MM-DD" string, not on UTC
 * instants), so it can never drift across a DST change the way adding
 * 7 * 86_400_000 milliseconds to a Date would.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  fmtIsraelTime,
  israelDateKey,
  STATUS_LABEL,
  statusTone,
  type StaffCalendarEvent,
} from "@/lib/programme/logic";

const TONE_BG: Record<ReturnType<typeof statusTone>, string> = {
  live: "bg-success-soft text-success",
  pending: "bg-primary-soft text-primary",
  attention: "bg-warning-soft text-warning-foreground",
  quiet: "bg-muted text-muted-foreground",
};

/** A narrow week column needs a denser card than Agenda/Month's — full
 *  location/audience text just truncates into illegibility at that width. */
function CompactEventCard({ event, onOpen }: { event: StaffCalendarEvent; onOpen: () => void }) {
  const cancelled = event.status === "cancelled";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[11.5px] shadow-card hover:border-primary/40 ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <p className={`truncate font-semibold ${cancelled ? "line-through" : ""}`}>{event.title}</p>
      <p className="mt-0.5 flex items-center justify-between gap-1 text-muted-foreground">
        <span>{fmtIsraelTime(event.startsAt)}</span>
        {event.status !== "scheduled" ? (
          <span
            className={`rounded px-1 py-px text-[9.5px] font-bold uppercase ${TONE_BG[statusTone(event.status)]}`}
          >
            {STATUS_LABEL[event.status]}
          </span>
        ) : null}
      </p>
      {event.locationLabel ? (
        <p className="truncate text-muted-foreground">{event.locationLabel}</p>
      ) : null}
    </button>
  );
}

/** Monday of the week containing `key` ("YYYY-MM-DD"), as a day-key. */
function mondayOf(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDayKey(key: string): { weekday: string; day: string } {
  const d = new Date(`${key}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
    day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

export function StaffCalendarWeek({
  events,
  onOpen,
}: {
  events: StaffCalendarEvent[];
  /** Accepted for interface parity with Agenda/Month; the compact week card
   *  doesn't show audience text (too narrow), so it isn't used here. */
  groups: { id: string; name: string }[];
  onOpen: (event: StaffCalendarEvent) => void;
}) {
  const todayKey = israelDateKey(new Date().toISOString());
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayKey));

  const byDay = useMemo(() => {
    const map = new Map<string, StaffCalendarEvent[]>();
    for (const e of events) {
      const key = israelDateKey(e.startsAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((k) => addDays(k, -7))}
            aria-label="Previous week"
            className="rounded-lg border border-border p-1.5 hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((k) => addDays(k, 7))}
            aria-label="Next week"
            className="rounded-lg border border-border p-1.5 hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setWeekStart(mondayOf(todayKey))}
          className="text-[12.5px] font-semibold text-primary"
        >
          This week
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7">
        {days.map((key) => {
          const { weekday, day } = fmtDayKey(key);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} className="min-w-0 space-y-2">
              <div
                className={`rounded-xl px-2 py-1.5 text-center ${isToday ? "bg-primary-soft" : "bg-muted"}`}
              >
                <p
                  className={`text-[11px] font-bold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}
                >
                  {weekday}
                </p>
                <p className={`text-[12.5px] font-semibold ${isToday ? "text-primary" : ""}`}>
                  {day}
                </p>
              </div>
              <div className="space-y-1.5">
                {dayEvents.length === 0 ? (
                  <p className="px-1 text-[11.5px] text-muted-foreground">—</p>
                ) : (
                  dayEvents.map((e) => (
                    <CompactEventCard key={e.id} event={e} onOpen={() => onOpen(e)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
