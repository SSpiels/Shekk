/**
 * Programme OS Calendar: the operational schedule for a programme managing
 * students in Israel, built entirely on the existing event/audience/RSVP/
 * change engine (see lib/programme-ops.server.ts's staffCalendarOverview/
 * staffEventResponses) — there is no second calendar/event system here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, List, Plus } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlocks } from "@/components/Kit";
import { useStaffOS } from "@/components/staff/StaffSessionContext";
import { StaffCalendarAgenda } from "@/components/staff/calendar/StaffCalendarAgenda";
import { StaffCalendarWeek } from "@/components/staff/calendar/StaffCalendarWeek";
import { StaffCalendarMonth } from "@/components/staff/calendar/StaffCalendarMonth";
import { StaffEventDetail } from "@/components/staff/calendar/StaffEventDetail";
import { StaffEventEditor } from "@/components/staff/calendar/StaffEventEditor";
import { StaffEventResponsesDrilldown } from "@/components/staff/calendar/StaffEventResponsesDrilldown";
import { useStaffCalendarOverview } from "@/lib/useStaffCalendar";
import { useStaffStudentRoster } from "@/lib/useStaffStudents";
import type { StaffCalendarEvent } from "@/lib/programme/logic";

type ViewMode = "agenda" | "week" | "month";
const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export const Route = createFileRoute("/staff/calendar")({
  component: CalendarScreen,
});

function CalendarScreen() {
  const { activeWorkspace } = useStaffOS();
  const cohortId = activeWorkspace?.cohort?.id ?? null;

  const { data, isLoading, error, refetch } = useStaffCalendarOverview(cohortId);
  const roster = useStaffStudentRoster(cohortId);
  const students = useMemo(() => roster.data ?? [], [roster.data]);

  const groups = useMemo(() => {
    const byId = new Map<string, string>();
    for (const st of students) for (const g of st.groups) byId.set(g.id, g.name);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [students]);

  const [view, setView] = useState<ViewMode>("agenda");
  const [showPast, setShowPast] = useState(false);
  /** The event currently selected for detail/edit/responses — kept separate
   *  from which dialog is open, so switching from detail → edit doesn't
   *  lose the reference. */
  const [selected, setSelected] = useState<StaffCalendarEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);

  const studentRefs = useMemo(
    () =>
      students.map((st) => ({ userId: st.userId, displayName: st.displayName, handle: st.handle })),
    [students],
  );

  if (!cohortId) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No cohort yet"
        body="This programme doesn't have a cohort set up."
      />
    );
  }

  if (isLoading) return <LoadingBlocks rows={4} />;
  if (error) {
    return (
      <ErrorState
        body="We couldn't load the calendar. Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return null;

  const openEvent = (e: StaffCalendarEvent) => {
    setSelected(e);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                view === v.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {view === "agenda" ? (
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted"
            >
              <List className="size-3.5" /> {showPast ? "Hide past" : "Show past"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setEditorOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New event
          </button>
        </div>
      </div>

      {data.events.length === 0 && view === "agenda" && !showPast ? (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled yet"
          body="Publish the first event above and it lands in every eligible student's Programme schedule."
        />
      ) : view === "agenda" ? (
        <StaffCalendarAgenda
          events={data.events}
          groups={groups}
          onOpen={openEvent}
          showPast={showPast}
        />
      ) : view === "week" ? (
        <StaffCalendarWeek events={data.events} groups={groups} onOpen={openEvent} />
      ) : (
        <StaffCalendarMonth events={data.events} groups={groups} onOpen={openEvent} />
      )}

      <StaffEventDetail
        // See the note on StaffEventEditor's key below — same reason.
        key={selected?.id ?? "none"}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        cohortId={cohortId}
        event={selected}
        groups={groups}
        onEdit={() => {
          setDetailOpen(false);
          setEditorOpen(true);
        }}
        onOpenResponses={() => {
          setDetailOpen(false);
          setResponsesOpen(true);
        }}
      />

      {editorOpen ? (
        <StaffEventEditor
          // Fresh values on every open, including reopening the same saved event.
          key={selected?.id ?? "new"}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          cohortId={cohortId}
          event={selected}
          groups={groups}
          students={studentRefs}
        />
      ) : null}

      <StaffEventResponsesDrilldown
        open={responsesOpen}
        onClose={() => setResponsesOpen(false)}
        cohortId={cohortId}
        eventId={selected?.id ?? null}
        eventTitle={selected?.title ?? ""}
      />
    </div>
  );
}
