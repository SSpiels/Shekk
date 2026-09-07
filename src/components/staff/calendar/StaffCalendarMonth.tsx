/**
 * Month grid: a full-picture overview. Each cell shows up to a few event
 * titles plus an overflow count; clicking a day selects it, listing that
 * day's events in full below the grid. Day-keys throughout are
 * Israel-local (israelDateKey), so a day boundary never depends on the
 * viewer's own timezone.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/Kit";
import { CalendarClock } from "lucide-react";
import { israelDateKey, statusTone, type StaffCalendarEvent } from "@/lib/programme/logic";
import { StaffEventCard } from "./StaffEventCard";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthKey(key: string): string {
  return key.slice(0, 7); // "YYYY-MM"
}

function firstOfMonth(monthKeyStr: string): string {
  return `${monthKeyStr}-01`;
}

function addMonths(monthKeyStr: string, n: number): string {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The 6x7 grid of day-keys covering `monthKeyStr`, Monday-first. */
function monthGrid(monthKeyStr: string): string[] {
  const first = firstOfMonth(monthKeyStr);
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay();
  const back = dow === 0 ? 6 : dow - 1;
  const start = addDays(first, -back);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function fmtMonthLabel(monthKeyStr: string): string {
  const d = new Date(`${monthKeyStr}-01T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function StaffCalendarMonth({
  events,
  groups,
  onOpen,
}: {
  events: StaffCalendarEvent[];
  groups: { id: string; name: string }[];
  onOpen: (event: StaffCalendarEvent) => void;
}) {
  const todayKey = israelDateKey(new Date().toISOString());
  const [month, setMonth] = useState(() => monthKey(todayKey));
  const [selected, setSelected] = useState(todayKey);

  const byDay = useMemo(() => {
    const map = new Map<string, StaffCalendarEvent[]>();
    for (const e of events) {
      const key = israelDateKey(e.startsAt);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const selectedEvents = byDay.get(selected) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-bold tracking-tight">{fmtMonthLabel(month)}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
            className="rounded-lg border border-border p-1.5 hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMonth(monthKey(todayKey));
              setSelected(todayKey);
            }}
            className="px-2 text-[12.5px] font-semibold text-primary"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="rounded-lg border border-border p-1.5 hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {grid.map((key) => {
          const inMonth = monthKey(key) === month;
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selected;
          const dayNum = Number(key.slice(8, 10));
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`min-h-[84px] rounded-xl border p-1.5 text-left align-top ${
                isSelected
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-card hover:bg-muted/40"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`inline-flex size-5 items-center justify-center rounded-full text-[11.5px] font-bold ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {dayNum}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <p
                    key={e.id}
                    className={`truncate text-[10.5px] font-semibold ${
                      e.status === "cancelled"
                        ? "text-muted-foreground line-through"
                        : statusTone(e.status) === "attention"
                          ? "text-warning-foreground"
                          : "text-foreground"
                    }`}
                  >
                    {e.title}
                  </p>
                ))}
                {dayEvents.length > 3 ? (
                  <p className="text-[10.5px] font-semibold text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">
          {new Date(`${selected}T12:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        </h3>
        {selectedEvents.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing that day" body="No events scheduled." />
        ) : (
          <div className="space-y-2">
            {selectedEvents.map((e) => (
              <StaffEventCard key={e.id} event={e} groups={groups} onOpen={() => onOpen(e)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
