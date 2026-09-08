import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FocusScreen, PrimaryButton } from "@/components/AppShell";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password · Shekk" },
      {
        name: "description",
        content: "Choose a new password for your Shekk account and get straight back in.",
      },
      { property: "og:title", content: "Set a new password · Shekk" },
      { property: "og:description", content: "Choose a new Shekk password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Those passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
  }

  return (
    <FocusScreen nav={false}>
      <div className="flex min-h-screen flex-col justify-center gap-6 px-6 py-14 sm:min-h-[860px]">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {done ? "Password updated" : "Set a new password"}
        </h1>
        {done ? (
          <>
            <p className="text-sm text-muted-foreground">
              You're signed in with your new password.
            </p>
            <PrimaryButton onClick={() => (window.location.href = "/")}>
              Continue to Shekk
            </PrimaryButton>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (8+ characters)"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base"
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base"
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save new password"}
            </PrimaryButton>
          </form>
        )}
      </div>
    </FocusScreen>
  );
}
