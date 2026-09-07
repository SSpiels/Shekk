import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Radio, Signal, Sparkles } from "lucide-react";
import { Card } from "@/components/AppShell";
import { EmptyState, Milestone, ProgressBar, SectionHead } from "@/components/Kit";
import { track } from "@/lib/analytics";
import { useParticipantActions, useProgrammeHub } from "@/lib/useProgrammeHub";
import { AnnouncementCard, EventRow, EventSheet, VoteCard } from "@/components/programme/Participant";
import { Freshness, StatusChip, TapRow } from "@/components/programme/Bits";
import {
  changeLine,
  fmtIsraelDayLong,
  fmtIsraelTime,
  pendingActions,
  type ProgrammeEvent,
} from "@/lib/programme/logic";

export const Route = createFileRoute("/programme/")({
  head: () => ({
    meta: [
      { title: "Today · Your programme · Shekk" },
      {
        name: "description",
        content: "What's happening now and next on your programme, plus anything that changed today.",
      },
      { property: "og:title", content: "Today · Your programme · Shekk" },
      { property: "og:description", content: "Now, next and what changed — your programme day at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodayScreen,
});

function TodayScreen() {
  const { hub, now, next, today, changes, checklist } = useProgrammeHub();
  const { tick } = useParticipantActions();
  const [open, setOpen] = useState<ProgrammeEvent | null>(null);
  const [allTodo, setAllTodo] = useState(false);

  useEffect(() => {
    track("programme_hub_viewed");
  }, []);

  const todo = useMemo(() => pendingActions(hub), [hub]);
  const pinned = hub.announcements.filter((a) => a.pinned || a.priority === "urgent").slice(0, 2);
  const focus = now ?? next;

  return (
    <div className="space-y-8 px-4 pb-10 pt-4">
      {hub.welcomeMessage ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-card">
          {hub.welcomeMessage}
        </p>
      ) : null}

      {/* NOW / NEXT — the one thing a participant opens the app for. */}
      <section>
        <SectionHead title={now ? "Happening now" : "Next up"} />
        {focus ? (
          <button type="button" onClick={() => setOpen(focus)} className="tap block w-full text-left">
            <Card className="border-primary/40">
              <div className="flex items-center gap-2">
                {now ? <Radio className="size-4 shrink-0 animate-pulse text-primary" /> : null}
                <StatusChip status={focus.status} />
                <Freshness event={focus} />
              </div>
              <p className="mt-2 font-display text-lg font-bold leading-tight">{focus.title}</p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {fmtIsraelTime(focus.startsAt)}
                {focus.endsAt ? ` – ${fmtIsraelTime(focus.endsAt)}` : ""}
              </p>
              {focus.locationLabel ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{focus.locationLabel}</p>
              ) : null}
              {focus.meetingPoint ? (
                <p className="mt-0.5 text-xs text-muted-foreground">Meet at {focus.meetingPoint}</p>
              ) : null}
              {focus.statusNote ? (
                <p className="mt-2 text-[12.5px] font-medium text-warning-foreground">{focus.statusNote}</p>
              ) : null}
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-primary">Open details →</p>
            </Card>
          </button>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Nothing scheduled right now"
            body="When your programme adds something, it shows up here first."
          />
        )}
      </section>

      {/* One honest to-do list: only things this participant can clear. */}
      {todo.length > 0 ? (
        <section>
          <SectionHead title="You need to" hint="Short list. It empties as you go." />
          <div className="space-y-2">
            {(allTodo ? todo : todo.slice(0, 3)).map((a) => {
              const event = a.eventId ? hub.events.find((e) => e.id === a.eventId) : null;
              return (
                <TapRow
                  key={a.key}
                  title={a.title}
                  detail={a.detail}
                  tone={a.urgent ? "urgent" : "plain"}
                  onClick={() => {
                    if (event) {
                      setOpen(event);
                      return;
                    }
                    if (a.kind === "checklist" && a.itemId) {
                      tick.mutate({ itemId: a.itemId, done: true });
                      return;
                    }
                    window.location.assign("/programme/inbox");
                  }}
                />
              );
            })}
            {todo.length > 3 ? (
              <button
                type="button"
                onClick={() => setAllTodo((v) => !v)}
                className="tap-flat w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-[12.5px] font-bold text-primary"
              >
                {allTodo ? "Show less" : `Show ${todo.length - 3} more`}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {changes.length > 0 ? (
        <section>
          <SectionHead title="What changed" />
          <div className="space-y-2">
            {changes.slice(0, 4).map((c) => (
              <Card key={c.id} className="border-notice-border bg-notice-soft">
                <p className="text-[13px] font-semibold text-notice-foreground">{c.eventTitle}</p>
                <p className="mt-0.5 text-[12px] text-notice-foreground/90">{changeLine(c)}</p>
                {c.note ? <p className="mt-0.5 text-[12px] text-notice-foreground/90">{c.note}</p> : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {pinned.length > 0 ? (
        <section>
          <SectionHead
            title="Pinned"
            action={
              <Link to="/programme/inbox" className="text-[12px] font-bold text-primary">
                All updates →
              </Link>
            }
          />
          <div className="space-y-2">
            {pinned.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHead
          title={`Today · ${fmtIsraelDayLong(new Date().toISOString())}`}
          action={
            <Link to="/programme/schedule" className="text-[12px] font-bold text-primary">
              All days →
            </Link>
          }
        />
        {today.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing on today" body="Check the full schedule for the days ahead." />
        ) : (
          <div className="space-y-2">
            {today.map((e) => (
              <EventRow key={e.id} event={e} onOpen={() => setOpen(e)} />
            ))}
          </div>
        )}
      </section>

      {hub.votes.filter((v) => v.status === "open").length > 0 ? (
        <section>
          <SectionHead title="Your programme is asking" />
          <div className="space-y-2">
            {hub.votes
              .filter((v) => v.status === "open")
              .map((v) => (
                <VoteCard key={v.id} vote={v} />
              ))}
          </div>
        </section>
      ) : null}

      {checklist.total > 0 ? (
        checklist.done === checklist.total ? (
          <Milestone
            title="Programme checklist complete"
            body="Everything your programme asked for is done. Nothing left to chase."
            actionLabel="See what's next"
            actionTo="/israel"
          />
        ) : (
          <section>
            <SectionHead
              title="Before you fly"
              action={
                <Link to="/programme/info" className="text-[12px] font-bold text-primary">
                  Open →
                </Link>
              }
            />
            <Card>
              <p className="text-sm font-semibold">
                {checklist.done} of {checklist.total} done
              </p>
              <div className="mt-2">
                <ProgressBar value={checklist.total ? checklist.done / checklist.total : 0} />
              </div>
              {checklist.requiredTotal > checklist.requiredDone ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {checklist.requiredTotal - checklist.requiredDone} required{" "}
                  {checklist.requiredTotal - checklist.requiredDone === 1 ? "item" : "items"} still to do.
                </p>
              ) : null}
            </Card>
          </section>
        )
      ) : null}

      {/* Cross-integration: the programme sends people to the rest of Shekk. */}
      <section>
        <SectionHead title="Get set up" />
        <div className="grid grid-cols-2 gap-2">
          <Link to="/services/esim" className="tap">
            <Card className="h-full">
              <Signal className="size-5 text-primary" />
              <p className="mt-2 text-[13px] font-semibold">Israeli SIM</p>
              <p className="text-[11px] text-muted-foreground">Stay reachable on arrival.</p>
            </Card>
          </Link>
          <Link to="/before-you-fly" className="tap">
            <Card className="h-full">
              <Sparkles className="size-5 text-primary" />
              <p className="mt-2 text-[13px] font-semibold">Before you fly</p>
              <p className="text-[11px] text-muted-foreground">Everything to sort at home.</p>
            </Card>
          </Link>
        </div>
      </section>

      <EventSheet event={open} hub={hub} onClose={() => setOpen(null)} />
    </div>
  );
}
