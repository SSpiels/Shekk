/**
 * RSVP response drill-down for one event: eligible/going/maybe/not-going/
 * no-response, each by name, linking to the student's Programme OS profile.
 * The denominator is the event's actual eligible audience
 * (staffEventResponses → eventResponseBreakdown → audienceAllows()), never
 * the whole cohort. This is response data, not attendance — a student
 * marked "Going" is not proof they showed up; Attendance is a later module.
 */
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, LoadingBlocks } from "@/components/Kit";
import type { StaffAnnouncementStudentRef } from "@/lib/programme/logic";
import { useStaffEventResponses } from "@/lib/useStaffCalendar";

function StudentList({
  students,
  empty,
}: {
  students: StaffAnnouncementStudentRef[];
  empty: string;
}) {
  if (students.length === 0) {
    return <p className="px-1 text-[12px] text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="rounded-xl border border-border">
      {students.map((st) => (
        <Link
          key={st.userId}
          to="/staff/students/$studentId"
          params={{ studentId: st.userId }}
          className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-[13px] last:border-0 hover:bg-muted/40"
        >
          <span className="min-w-0 truncate font-medium">{st.displayName}</span>
          {st.handle ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">@{st.handle}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function StaffEventResponsesDrilldown({
  open,
  onClose,
  cohortId,
  eventId,
  eventTitle,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string | null;
  eventId: string | null;
  eventTitle: string;
}) {
  const { data, isLoading, error, refetch } = useStaffEventResponses(cohortId, eventId);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{eventTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? <LoadingBlocks rows={2} /> : null}
        {error ? (
          <ErrorState
            body="We couldn't load responses for this event."
            onRetry={() => void refetch()}
          />
        ) : null}

        {data ? (
          data.eligibleCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody in this cohort is eligible for this event.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-[12.5px] text-muted-foreground">
                {data.eligibleCount} eligible{data.capacity ? ` · ${data.capacity} spaces` : ""}
              </p>

              <div className="space-y-1.5">
                <p className="text-[12.5px] font-semibold text-success">
                  Going ({data.going.length})
                </p>
                <StudentList students={data.going} empty="Nobody yet." />
              </div>

              <div className="space-y-1.5">
                <p className="text-[12.5px] font-semibold text-warning-foreground">
                  Maybe ({data.maybe.length})
                </p>
                <StudentList students={data.maybe} empty="Nobody." />
              </div>

              <div className="space-y-1.5">
                <p className="text-[12.5px] font-semibold text-muted-foreground">
                  Not going ({data.notGoing.length})
                </p>
                <StudentList students={data.notGoing} empty="Nobody." />
              </div>

              <div className="space-y-1.5">
                <p className="text-[12.5px] font-semibold text-primary">
                  No response ({data.noResponse.length})
                </p>
                <StudentList students={data.noResponse} empty="Everyone eligible has responded." />
              </div>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
