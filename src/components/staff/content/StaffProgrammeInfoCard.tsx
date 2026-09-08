/**
 * The one piece of Content that isn't a checklist/document/contact/place
 * row: the cohort's welcome message, shown verbatim at the top of the
 * student's Programme "Today" tab (routes/programme.index.tsx). Reuses the
 * existing programme_cohorts.welcome_message column — no new table, no new
 * CMS model.
 */
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useStaffUpdateProgrammeInfo } from "@/lib/useStaffContent";

export function StaffProgrammeInfoCard({
  cohortId,
  welcomeMessage,
}: {
  cohortId: string;
  welcomeMessage: string | null;
}) {
  const update = useStaffUpdateProgrammeInfo(cohortId);
  const [value, setValue] = useState(welcomeMessage ?? "");
  const [saved, setSaved] = useState(false);

  // Reset local draft if the underlying data changes from elsewhere (e.g.
  // another tab), but not on every keystroke — only when the saved value moves.
  useEffect(() => setValue(welcomeMessage ?? ""), [welcomeMessage]);

  const dirty = value.trim() !== (welcomeMessage ?? "").trim();

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Info className="size-4.5 text-primary" />
        <div>
          <p className="text-sm font-semibold">Welcome message</p>
          <p className="text-[12px] text-muted-foreground">
            Shown at the top of every student's Programme "Today" tab — the first thing they see.
          </p>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={4}
        maxLength={2000}
        placeholder="Welcome to the programme! Here's what to know before you land…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-muted-foreground">
          {saved ? "Saved." : dirty ? "Unsaved changes." : "Students see this today."}
        </p>
        <div className="flex gap-2">
          {dirty ? (
            <button
              type="button"
              onClick={() => setValue(welcomeMessage ?? "")}
              className="rounded-xl border border-border px-3.5 py-2 text-[13px] font-semibold"
            >
              Revert
            </button>
          ) : null}
          <button
            type="button"
            disabled={!dirty || update.isPending}
            onClick={() => update.mutate(value.trim() || null, { onSuccess: () => setSaved(true) })}
            className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
