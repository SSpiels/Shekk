import { fmtDateOnly } from "@/lib/programme/logic";
/**
 * Joining a programme — one code box that understands both kinds of code:
 * a cohort join code (participants) and an invite code (a director claiming
 * their programme, or a staff invite). The server decides which it is.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Card, Notice, PrimaryButton } from "@/components/AppShell";
import { track } from "@/lib/analytics";
import { cleanError, useJoinFlow } from "@/lib/useProgrammeHub";
import { ErrorText } from "@/components/programme/Bits";

export function JoinPanel({ initialCode = "" }: { initialCode?: string }) {
  const navigate = useNavigate();
  const { preview, join, accept } = useJoinFlow();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof preview.mutateAsync>> | null>(null);
  const clean = code.trim().toUpperCase();

  /* A code arriving in the URL should already be checked when the screen opens. */
  useEffect(() => {
    if (!initialCode) return;
    void check(initialCode.trim().toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  async function check(value = clean) {
    setError(null);
    setResult(null);
    try {
      const res = await preview.mutateAsync(value);
      if (res.kind === "unknown") {
        setError("We couldn't find that code. Check it with your programme office.");
        return;
      }
      setResult(res);
    } catch (e) {
      setError(cleanError(e, "That code could not be checked right now."));
    }
  }

  async function confirm() {
    setError(null);
    try {
      if (result?.kind === "invite") {
        await accept.mutateAsync(clean);
        navigate({ to: "/programme/staff" });
      } else {
        await join.mutateAsync(clean);
        track("programme_joined");
        navigate({ to: "/programme" });
      }
    } catch (e) {
      setError(cleanError(e, "We couldn't add you to that programme."));
    }
  }

  const busy = join.isPending || accept.isPending;

  return (
    <div className="space-y-4 px-4">
      <Card className="space-y-3">
        <p className="text-sm font-semibold">Enter your programme code</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your programme gives you a short code. It unlocks your live timetable, announcements, the people to
          call and your checklist. Nothing about a programme is visible until you join.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Programme code
          </span>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setResult(null);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="ABC123"
            className="w-full rounded-2xl bg-muted px-4 py-3.5 text-base font-semibold uppercase tracking-wide outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <ErrorText>{error}</ErrorText>

        {result?.kind === "cohort" && result.cohort ? (
          <div className="rounded-2xl border border-border bg-muted/60 p-3">
            <p className="text-sm font-semibold">{result.cohort.programmeName}</p>
            <p className="text-xs text-muted-foreground">{result.cohort.cohortName}</p>
            {result.cohort.organisation ? (
              <p className="text-xs text-muted-foreground">{result.cohort.organisation}</p>
            ) : null}
            {result.cohort.startsOn ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtDateOnly(result.cohort.startsOn)}
                {result.cohort.endsOn ? ` – ${fmtDateOnly(result.cohort.endsOn)}` : ""}
                {result.cohort.city ? ` · ${result.cohort.city}` : ""}
              </p>
            ) : null}
            {result.cohort.verified ? (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-success">
                <ShieldCheck className="size-3.5" /> Verified programme
              </p>
            ) : null}
          </div>
        ) : null}

        {result?.kind === "invite" && result.invite ? (
          <div className="rounded-2xl border border-border bg-muted/60 p-3">
            <p className="text-sm font-semibold">{result.invite.programmeName}</p>
            <p className="text-xs text-muted-foreground">
              Staff invite · {result.invite.role === "owner" ? "programme owner" : "staff"}
              {result.invite.cohortName ? ` · ${result.invite.cohortName}` : ""}
            </p>
            {result.invite.accepted ? (
              <p className="mt-1 text-xs font-semibold text-destructive">This invite has already been used.</p>
            ) : null}
            {result.invite.expired ? (
              <p className="mt-1 text-xs font-semibold text-destructive">This invite has expired.</p>
            ) : null}
          </div>
        ) : null}

        {result && result.kind !== "unknown" ? (
          <PrimaryButton
            onClick={confirm}
            disabled={
              busy || (result.kind === "invite" && Boolean(result.invite?.accepted || result.invite?.expired))
            }
          >
            {busy
              ? "Joining…"
              : result.kind === "invite"
                ? "Accept staff invite"
                : `Join ${result.cohort?.cohortName ?? "programme"}`}
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => void check()} disabled={clean.length < 3 || preview.isPending}>
            {preview.isPending ? "Checking…" : "Check code"}
          </PrimaryButton>
        )}
      </Card>

      <Notice title="Travelling independently?">
        That's fine — Shekk works without a programme. You still get every Israel guide, the arrival checklist
        and the setup essentials.{" "}
        <Link to="/before-you-fly" className="font-semibold underline">
          Open Before you fly
        </Link>
        .
      </Notice>
    </div>
  );
}
