/**
 * Acknowledgement drill-down for one announcement: eligible/acknowledged/
 * outstanding counts plus the outstanding students by name, each linking to
 * their Programme OS profile. The denominator is the announcement's actual
 * eligible audience (staffAnnouncementAcknowledgements → audienceAllows()),
 * never the whole cohort.
 */
import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, LoadingBlocks, ProgressBar } from "@/components/Kit";
import { useStaffAnnouncementAcknowledgements } from "@/lib/useStaffCommunications";

export function StaffAnnouncementDrilldown({
  open,
  onClose,
  cohortId,
  announcementId,
  announcementTitle,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string | null;
  announcementId: string | null;
  announcementTitle: string;
}) {
  const { data, isLoading, error, refetch } = useStaffAnnouncementAcknowledgements(
    cohortId,
    announcementId,
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">{announcementTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? <LoadingBlocks rows={2} /> : null}

        {error ? (
          <ErrorState
            body="We couldn't load who's acknowledged this."
            onRetry={() => void refetch()}
          />
        ) : null}

        {data ? (
          data.eligibleCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody in this cohort is eligible for this announcement.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold tracking-tight">
                    {data.ackCount}/{data.eligibleCount}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {Math.round((data.ackCount / data.eligibleCount) * 100)}% acknowledged
                  </span>
                </div>
                <ProgressBar value={data.ackCount / data.eligibleCount} tone="success" />
              </div>

              <div className="space-y-1.5">
                <p className="text-[12.5px] font-semibold text-muted-foreground">
                  {data.outstandingCount === 0
                    ? "Everyone eligible has acknowledged"
                    : `Outstanding (${data.outstandingCount})`}
                </p>
                {data.outstandingCount === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success-foreground">
                    <CheckCircle2 className="size-4 shrink-0" /> No exceptions to act on.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                    {data.outstanding.map((st) => (
                      <Link
                        key={st.userId}
                        to="/staff/students/$studentId"
                        params={{ studentId: st.userId }}
                        onClick={onClose}
                        className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-[13px] last:border-0 hover:bg-muted/40"
                      >
                        <span className="min-w-0 truncate font-medium">{st.displayName}</span>
                        {st.handle ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            @{st.handle}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
