/**
 * Ask the cohort: a vote, a multiple-choice question or a quick yes/no. Same fields, same
 * server function (staffCreateVote) and same validation as the original mobile composer —
 * a new presentation over identical behaviour. Capacity limits per option, anonymous
 * results and an optional closing time are all supported by the engine.
 */
import { useState } from "react";
import { BarChart3, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fromLocalInput } from "@/components/programme/Bits";
import { everyone, type Audience, type VoteKind } from "@/lib/programme/logic";
import { useStaffPollActions } from "@/lib/useStaffEngagement";
import { StaffAudiencePicker } from "./StaffAudiencePicker";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

const KINDS: { kind: VoteKind; label: string; hint: string }[] = [
  { kind: "poll", label: "Vote", hint: "Pick a winner, then turn it into an activity." },
  { kind: "question", label: "Question", hint: "Students choose from your options." },
  { kind: "yes_no", label: "Yes / no", hint: "One tap to answer." },
];

type Option = { label: string; capacity: string };
const blankOptions = (): Option[] => [
  { label: "", capacity: "" },
  { label: "", capacity: "" },
];

export function StaffPollComposer({
  open,
  onClose,
  cohortId,
  groups,
  students,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  groups: { id: string; name: string }[];
  students: { userId: string; displayName: string; handle: string | null }[];
}) {
  const { create } = useStaffPollActions(cohortId);
  const [kind, setKind] = useState<VoteKind>("poll");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<Option[]>(blankOptions);
  const [closesAt, setClosesAt] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [audience, setAudience] = useState<Audience>(everyone);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKind("poll");
    setQuestion("");
    setDescription("");
    setOptions(blankOptions());
    setClosesAt("");
    setAnonymous(false);
    setAudience(everyone);
    setError(null);
  };

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  const setOption = (i: number, patch: Partial<Option>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const publish = () => {
    setError(null);
    if (!question.trim()) {
      setError("What are you asking?");
      return;
    }
    const chosen =
      kind === "yes_no"
        ? [
            { label: "Yes", detail: null, capacity: null },
            { label: "No", detail: null, capacity: null },
          ]
        : options
            .filter((o) => o.label.trim())
            .map((o) => ({
              label: o.label.trim(),
              detail: null,
              capacity: o.capacity ? Number(o.capacity) : null,
            }));
    if (chosen.length < 2) {
      setError("Give people at least two options.");
      return;
    }
    create.mutate(
      {
        question: question.trim(),
        description: description.trim() || null,
        voteKind: kind,
        options: chosen,
        anonymous,
        allowChange: true,
        resultsVisible: true,
        closesAt: closesAt ? fromLocalInput(closesAt) : null,
        notify: true,
        audience,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setError("We couldn't post that. Try again."),
      },
    );
  };

  const hint = KINDS.find((k) => k.kind === kind)?.hint;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-4.5 text-primary" /> Ask the cohort
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setKind(k.kind)}
                  className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                    kind === k.kind
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            {hint ? <p className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p> : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">Your question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={inputClass}
              placeholder="Which tiyul this Thursday?"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">
              Context (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
              maxLength={1000}
            />
          </div>

          {kind !== "yes_no" ? (
            <div className="space-y-2">
              <p className="text-[12.5px] font-semibold text-muted-foreground">
                Options <span className="font-normal">· optional cap per option</span>
              </p>
              {options.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_2rem] items-center gap-2">
                  <input
                    value={o.label}
                    onChange={(e) => setOption(i, { label: e.target.value })}
                    className={inputClass}
                    placeholder={`Option ${i + 1}`}
                    maxLength={120}
                  />
                  <input
                    value={o.capacity}
                    onChange={(e) => setOption(i, { capacity: e.target.value.replace(/\D/g, "") })}
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="Cap"
                    aria-label={`Capacity for option ${i + 1}`}
                  />
                  {options.length > 2 ? (
                    <button
                      type="button"
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              {options.length < 12 ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, { label: "", capacity: "" }])}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                >
                  <Plus className="size-3.5" /> Add option
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Closes (optional)
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] font-medium">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="size-3.5"
              />
              Anonymous — totals, not names
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">Who sees this</label>
            <StaffAudiencePicker
              value={audience}
              onChange={setAudience}
              groups={groups}
              students={students}
            />
          </div>

          {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={create.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {create.isPending ? "Posting…" : "Ask the cohort"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
