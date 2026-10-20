import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Mail, Upload, ShieldCheck } from "lucide-react";
import { FocusScreen, PrimaryButton, Card } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useMemberName } from "@/lib/useMemberName";

export const Route = createFileRoute("/reverify")({
  head: () => ({
    meta: [
      { title: "Annual re-verification · Shekk" },
      {
        name: "description",
        content: "Re-confirm your ID within 30 days to keep your Shekk account active and your shekels spendable.",
      },
      { property: "og:title", content: "Annual re-verification · Shekk" },
      { property: "og:description", content: "One-tap annual ID re-verification for Shekk accounts." },
    ],
  }),
  component: Reverify,
});

function Reverify() {
  const { state, daysLeft, completeReverify, triggerReverify } = useApp();
  const member = useMemberName();
  const [step, setStep] = useState<"email" | "upload" | "done">("email");
  const [uploaded, setUploaded] = useState(false);
  const navigate = useNavigate();

  const deadline = state.reverifyDueISO
    ? new Date(state.reverifyDueISO).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  return (
    <FocusScreen>
      <div className="min-h-screen px-5 pb-10 pt-7 sm:min-h-[860px]">
        <Link to="/" className="text-sm font-semibold text-muted-foreground">
          ← Back to Pay
        </Link>

        {step === "email" && (
          <div className="mt-4 space-y-4">
            <h1 className="text-2xl font-bold">Your re-verification email</h1>
            <p className="text-sm text-muted-foreground">
              This is the notice we send at the 12-month mark. Mockup for the prototype.
            </p>

            <Card className="p-0">
              <div className="flex items-center gap-3 border-b border-border p-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Mail className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">Shekk &lt;no-reply@shekk.app&gt;</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Action needed: re-verify your ID by {deadline}
                  </p>
                </div>
              </div>
              <div className="space-y-3 p-5 text-sm leading-relaxed">
                <p className="font-semibold">Hey {member.first || "there"} —</p>
                <p>
                  It's been a year since we verified your ID. To keep your Shekk account active, we need one fresh
                  photo of your passport page and a quick selfie.
                </p>
                <p>
                  <strong>Deadline: {deadline}</strong> ({daysLeft ?? 30} days from today). Takes about 60 seconds.
                </p>
                <p className="text-muted-foreground">
                  If the deadline passes, your account moves to limited status — no new top ups or spends until you
                  re-verify. Your existing balance stays on your account.
                </p>
                <button
                  onClick={() => {
                    if (!state.reverifyDueISO) triggerReverify();
                    setStep("upload");
                  }}
                  className="tap w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
                >
                  Re-verify now
                </button>
                <p className="text-xs text-muted-foreground">
                  Questions about how your account works?{" "}
                  <Link to="/terms" className="font-semibold text-primary underline">
                    Terms & Conditions
                  </Link>
                  .
                </p>
              </div>
            </Card>

            {daysLeft === null && (
              <Card className="text-xs text-muted-foreground">
                You're currently verified. Tap “Re-verify now” above (or the demo control in Me) to run the annual cycle
                and see the countdown banner appear on Pay and Me.
              </Card>
            )}
          </div>
        )}

        {step === "upload" && (
          <div className="mt-4 flex min-h-[70vh] flex-col justify-between">
            <div>
              <h1 className="text-3xl font-bold">Re-verify your ID</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Same flow as signup. Deadline {deadline}.
              </p>
              <button
                onClick={() => setUploaded(true)}
                className={`tap mt-6 flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed p-10 ${
                  uploaded ? "border-success bg-success-soft" : "border-border bg-card"
                }`}
              >
                {uploaded ? <ShieldCheck className="size-10 text-success" /> : <Upload className="size-10 text-primary" />}
                <span className="text-sm font-semibold">
                  {uploaded ? "passport_2026.jpg + selfie uploaded" : "Upload passport page + selfie"}
                </span>
                <span className="text-xs text-muted-foreground">Mock upload — nothing leaves this prototype</span>
              </button>
            </div>
            <PrimaryButton
              disabled={!uploaded}
              onClick={() => {
                completeReverify();
                setStep("done");
              }}
            >
              Submit for review
            </PrimaryButton>
          </div>
        )}

        {step === "done" && (
          <div className="mt-4 flex min-h-[70vh] flex-col justify-between">
            <div className="pt-16 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success-soft">
                <Check className="size-10 text-success" />
              </div>
              <h1 className="mt-6 text-3xl font-bold">You're verified</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Badge is back to Verified and the countdown banner is gone. Next check in 12 months — we'll email you
                30 days ahead.
              </p>
            </div>
            <div className="space-y-2">
              <PrimaryButton onClick={() => navigate({ to: "/" })}>Back to my wallet</PrimaryButton>
              <Link to="/me" className="tap block rounded-2xl bg-muted py-4 text-center text-sm font-semibold">
                View my status
              </Link>
            </div>
          </div>
        )}
      </div>
    </FocusScreen>
  );
}
