import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare, FileText, MapPin, Phone } from "lucide-react";
import { EmptyState, ProgressBar, SectionHead } from "@/components/Kit";
import { Card } from "@/components/AppShell";
import { useParticipantActions, useProgrammeHub } from "@/lib/useProgrammeHub";
import { ChecklistRow, ContactRow, DocRow, PlaceRow } from "@/components/programme/Participant";
import { ActionButton } from "@/components/programme/Bits";

export const Route = createFileRoute("/programme/info")({
  head: () => ({
    meta: [
      { title: "Info · Your programme · Shekk" },
      {
        name: "description",
        content:
          "Your programme checklist, documents, staff and emergency contacts, and the places you'll need to find.",
      },
      { property: "og:title", content: "Info · Your programme · Shekk" },
      {
        property: "og:description",
        content: "Checklist, documents, contacts and programme places — everything you might need offline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InfoScreen,
});

const TABS = ["Checklist", "Contacts", "Documents", "Places"] as const;

function InfoScreen() {
  const { hub, checklist } = useProgrammeHub();
  const { leave } = useParticipantActions();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Checklist");
  const emergency = hub.contacts.filter((c) => c.isEmergency);
  const others = hub.contacts.filter((c) => !c.isEmergency);

  return (
    <div className="space-y-6 px-4 pb-10 pt-4">
      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`tap-flat shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold ${
              tab === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Checklist" ? (
        hub.checklist.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No checklist yet"
            body="When your programme publishes what to sort before you fly, it lands here."
          />
        ) : (
          <section className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
            <Card className="lg:col-span-2">
              <p className="text-sm font-semibold">
                {checklist.done} of {checklist.total} done
              </p>
              <div className="mt-2">
                <ProgressBar value={checklist.total ? checklist.done / checklist.total : 0} />
              </div>
            </Card>
            {hub.checklist.map((i) => (
              <ChecklistRow key={i.id} item={i} />
            ))}
          </section>
        )
      ) : null}

      {tab === "Contacts" ? (
        hub.contacts.length === 0 ? (
          <EmptyState icon={Phone} title="No contacts yet" body="Your programme hasn't shared its contacts." />
        ) : (
          <div className="space-y-6">
            {emergency.length > 0 ? (
              <section>
                <SectionHead title="If something goes wrong" />
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
                  {emergency.map((c) => (
                    <ContactRow key={c.id} contact={c} />
                  ))}
                </div>
              </section>
            ) : null}
            {others.length > 0 ? (
              <section>
                <SectionHead title="Programme team" />
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
                  {others.map((c) => (
                    <ContactRow key={c.id} contact={c} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )
      ) : null}

      {tab === "Documents" ? (
        hub.documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" body="Forms and letters your programme shares appear here." />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
            {hub.documents.map((d) => (
              <DocRow key={d.id} doc={d} />
            ))}
          </div>
        )
      ) : null}

      {tab === "Places" ? (
        hub.places.length === 0 ? (
          <EmptyState icon={MapPin} title="No places yet" body="Your campus, dorm and meeting points show up here." />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:items-start">
            {hub.places.map((p) => (
              <PlaceRow key={p.id} place={p} />
            ))}
          </div>
        )
      ) : null}

      <div className="border-t border-border pt-4">
        <ActionButton
          tone="danger"
          disabled={leave.isPending}
          onClick={() => {
            if (window.confirm("Leave this programme? You'll lose access to its timetable and contacts.")) {
              leave.mutate(undefined);
            }
          }}
        >
          {leave.isPending ? "Leaving…" : "Leave this programme"}
        </ActionButton>
      </div>
    </div>
  );
}
