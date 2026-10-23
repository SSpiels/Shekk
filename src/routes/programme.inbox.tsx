import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { EmptyState, SectionHead } from "@/components/Kit";
import { useParticipantActions, useProgrammeHub } from "@/lib/useProgrammeHub";
import { AnnouncementCard, VoteCard } from "@/components/programme/Participant";
import { KindChip, fmtDay } from "@/components/programme/Bits";
import { feedItems } from "@/lib/programme/logic";

export const Route = createFileRoute("/programme/inbox")({
  head: () => ({
    meta: [
      { title: "Updates · Your programme · Shekk" },
      {
        name: "description",
        content: "Every programme update, alert and question in one chronological list, newest first.",
      },
      { property: "og:title", content: "Updates · Your programme · Shekk" },
      { property: "og:description", content: "Announcements, alerts and questions from your programme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UpdatesScreen,
});

function UpdatesScreen() {
  const { hub, unread } = useProgrammeHub();
  const { markRead } = useParticipantActions();
  const feed = useMemo(() => feedItems(hub), [hub]);

  // Opening Updates is the read receipt — no separate "mark all read" chore.
  useEffect(() => {
    if (unread.length > 0) markRead.mutate({ ids: unread.map((n) => n.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length]);

  const needsYou = feed.filter((f) => f.needsAction);
  const rest = feed.filter((f) => !f.needsAction);

  if (feed.length === 0) {
    return (
      <div className="px-4 pb-10 pt-4">
        <EmptyState
          icon={Megaphone}
          title="Nothing yet"
          body="When your programme posts an update or asks a question, it lands here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 pb-10 pt-4">
      {needsYou.length > 0 ? (
        <section>
          <SectionHead title="Needs you" hint="Confirm or answer, then it moves down the list." />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
            {needsYou.map((item) => (
              <FeedRow key={item.key} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHead title="Everything else" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
          {rest.map((item) => (
            <FeedRow key={item.key} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FeedRow({ item }: { item: ReturnType<typeof feedItems>[number] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1">
        <KindChip kind={item.kind} />
        <span className="text-[11px] text-muted-foreground">{fmtDay(item.at)}</span>
      </div>
      {item.announcement ? <AnnouncementCard announcement={item.announcement} /> : null}
      {item.vote ? <VoteCard vote={item.vote} /> : null}
    </div>
  );
}
