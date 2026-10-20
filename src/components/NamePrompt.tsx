import { useState } from "react";

/**
 * Shown under the greeting when the signed-in account has no name yet (an
 * account made without going through onboarding, for instance). The name is
 * saved to the account, so it follows the member to every device.
 */
export function NamePrompt({
  onSave,
  saving,
  error,
}: {
  onSave: (name: string) => Promise<boolean>;
  saving: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-flat mt-2 text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
      >
        What should we call you?
      </button>
    );
  }

  return (
    <form
      className="mt-2 flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSave(draft)) setOpen(false);
      }}
    >
      <label className="sr-only" htmlFor="member-name">
        Your first name
      </label>
      <input
        id="member-name"
        autoFocus
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your first name"
        autoComplete="given-name"
        className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={saving || draft.trim().length < 1}
        className="tap shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {error ? <span className="sr-only">{error}</span> : null}
    </form>
  );
}
