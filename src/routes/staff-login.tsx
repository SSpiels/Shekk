/**
 * Programme OS's own front door.
 *
 * Distinct on purpose: an owner, manager or invited staff member arriving
 * here should immediately feel this is a different surface from the student
 * app, the same way desktop `/staff` already looks nothing like the phone
 * shell (see ProgrammeOSShell). No student payment/KYC copy belongs here —
 * Programme OS has nothing to do with a student's own money.
 *
 * Reuses the same Supabase Auth calls and the same invite-acceptance
 * server functions as the student app (useJoinFlow, from useProgrammeHub.ts)
 * — there is no separate staff identity system. Accepting an invite still
 * requires a real, unaccepted invite code from a programme; nobody can just
 * sign up into staff access from this screen.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  KeyRound,
  Loader2,
  MailCheck,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/store";
import { useJoinFlow, useStaffSession, cleanError } from "@/lib/useProgrammeHub";
import { afterStaffAuthPath, safeNext } from "@/lib/auth-redirect";

function safeCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed.length > 24 || !/^[A-Z0-9-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export const Route = createFileRoute("/staff-login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: safeNext(s.next),
    code: safeCode(s.code),
  }),
  head: () => ({
    meta: [
      { title: "Sign in to your workspace · Shekk for Programmes" },
      {
        name: "description",
        content: "Sign in to Shekk Programme OS, or accept a staff invitation from your programme.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StaffLogin,
});

const VALUES = [
  {
    icon: Building2,
    title: "Your whole programme, in one place",
    body: "Roster, schedule, announcements and content — the same data your students see, built for running it.",
  },
  {
    icon: Users,
    title: "Bring your team in properly",
    body: "Invite owners, managers and staff with the right access from day one.",
  },
  {
    icon: ShieldCheck,
    title: "Built on the same account as always",
    body: "One Shekk sign-in. No separate staff password to manage.",
  },
];

function StaffLogin() {
  const navigate = useNavigate();
  const { next, code: initialCode } = Route.useSearch();
  const { signedIn, authChecked } = useApp();
  const { isStaff, loading: staffLoading } = useStaffSession();

  const [tab, setTab] = useState<"signin" | "invite">(initialCode ? "invite" : "signin");

  /* Already an active staff account? Skip the door entirely. */
  useEffect(() => {
    if (!authChecked || staffLoading) return;
    if (signedIn && isStaff) {
      void navigate({ to: afterStaffAuthPath(next), replace: true });
    }
  }, [authChecked, staffLoading, signedIn, isStaff, navigate, next]);

  /* Signed in but not staff — the sign-in tab makes no sense; they're
     either here for an invite, or in the wrong place. */
  useEffect(() => {
    if (authChecked && signedIn && !staffLoading && !isStaff) setTab("invite");
  }, [authChecked, signedIn, staffLoading, isStaff]);

  return (
    <div className="min-h-screen bg-background lg:flex">
      <div className="relative flex flex-col justify-between gap-10 overflow-hidden px-6 py-10 text-ink-foreground sm:px-10 sm:py-14 lg:w-[42%] lg:px-14 lg:py-16 grad-balance">
        <span className="card-sheen pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-lg border border-white/20 bg-white"
            />
            <span className="font-display text-base font-bold leading-none">Shekk</span>
          </Link>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.25em] opacity-70">
            Shekk for Programmes
          </p>
          <h1 className="mt-3 font-display text-[2rem] font-bold leading-[1.1] tracking-tight sm:text-[2.4rem]">
            Sign in to your workspace.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed opacity-80">
            The operations console for programme owners, managers and staff — separate from the
            student app, built on the same programme.
          </p>
        </div>

        <ul className="relative space-y-5">
          {VALUES.map((v) => (
            <li key={v.title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/12">
                <v.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{v.title}</span>
                <span className="block text-[12.5px] leading-snug opacity-75">{v.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="relative text-[11px] opacity-60">
          Not staff?{" "}
          <Link to="/auth" search={{ next: "/" }} className="underline">
            Go to the student app
          </Link>
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:py-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex rounded-2xl border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === "signin" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setTab("invite")}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === "invite" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
              }`}
            >
              I have an invite
            </button>
          </div>

          {tab === "signin" ? (
            <SignInPanel next={next} />
          ) : (
            <InvitePanel initialCode={initialCode ?? ""} next={next} signedIn={signedIn} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Sign in to an existing account ────────────────────────── */

function SignInPanel({ next }: { next: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (forgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) return setError(error.message);
      return setNotice("Check your email for a link to set a new password.");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    void navigate({ to: afterStaffAuthPath(next), replace: true });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          {forgot ? "Reset your password" : "Sign in to Programme OS"}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {forgot
            ? "We'll email you a link to set a new one."
            : "For an existing staff account on a Shekk programme."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Work email"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base"
        />
        {!forgot && (
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base"
          />
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-60"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Please wait…
            </span>
          ) : forgot ? (
            "Email me a reset link"
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setForgot((v) => !v);
          setError(null);
          setNotice(null);
        }}
        className="block text-center text-xs font-semibold text-muted-foreground underline"
      >
        {forgot ? "Back to sign in" : "Forgot your password?"}
      </button>
    </div>
  );
}

/* ────────────────────────────── Accept a staff invitation ─────────────────────────── */

function InvitePanel({
  initialCode,
  next,
  signedIn,
}: {
  initialCode: string;
  next: string;
  signedIn: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { preview, accept } = useJoinFlow();
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Awaited<ReturnType<typeof preview.mutateAsync>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const clean = code.trim().toUpperCase();

  useEffect(() => {
    if (!initialCode) return;
    void check(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  async function check(value = clean) {
    setError(null);
    setResult(null);
    if (value.length < 3) return;
    try {
      const res = await preview.mutateAsync(value);
      if (res.kind === "unknown") {
        setError("We couldn't find that invite. Check the code with your programme.");
        return;
      }
      if (res.kind === "cohort") {
        setError("That's a student join code, not a staff invite — students use shekk.app/join.");
        return;
      }
      setResult(res);
    } catch (e) {
      setError(cleanError(e, "That code could not be checked right now."));
    }
  }

  async function onAccepted() {
    await qc.invalidateQueries({ queryKey: ["staff", "session"] });
    void navigate({ to: afterStaffAuthPath(next), replace: true });
  }

  async function acceptNow() {
    setError(null);
    try {
      await accept.mutateAsync(clean);
      await onAccepted();
    } catch (e) {
      setError(cleanError(e, "We couldn't accept that invite."));
    }
  }

  const invite = result?.kind === "invite" ? result.invite : null;
  const usable = Boolean(invite && !invite.accepted && !invite.expired);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Accept a staff invitation</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Enter the invite code your programme owner sent you.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invite code
          </span>
          <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3.5">
            <KeyRound className="size-4 shrink-0 text-muted-foreground" />
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
              className="w-full min-w-0 bg-transparent text-base font-semibold uppercase tracking-wide outline-none"
            />
          </div>
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {invite ? (
          <div className="rounded-2xl border border-border bg-muted/60 p-3">
            <p className="text-sm font-semibold">{invite.programmeName}</p>
            <p className="text-xs text-muted-foreground">
              Staff invite · {invite.role === "owner" ? "programme owner" : "staff"}
              {invite.cohortName ? ` · ${invite.cohortName}` : ""}
            </p>
            {invite.accepted ? (
              <p className="mt-1 text-xs font-semibold text-destructive">
                This invite has already been used.
              </p>
            ) : invite.expired ? (
              <p className="mt-1 text-xs font-semibold text-destructive">
                This invite has expired.
              </p>
            ) : null}
          </div>
        ) : null}

        {!result ? (
          <button
            type="button"
            onClick={() => void check()}
            disabled={clean.length < 3 || preview.isPending}
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-60"
          >
            {preview.isPending ? "Checking…" : "Check code"}
          </button>
        ) : signedIn && usable ? (
          <button
            type="button"
            onClick={() => void acceptNow()}
            disabled={accept.isPending}
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-60"
          >
            {accept.isPending ? "Joining…" : "Accept invite"}
          </button>
        ) : null}
      </div>

      {!signedIn && usable ? (
        <InviteAuthMiniForm code={clean} next={next} accept={accept} onAccepted={onAccepted} />
      ) : null}
    </div>
  );
}

/** Only reachable once a real, unaccepted invite has been previewed — this is
 *  the one place a brand-new account can be created from this screen, and it
 *  never grants staff access on its own; accepting still requires the code. */
function InviteAuthMiniForm({
  code,
  next,
  accept,
  onAccepted,
}: {
  code: string;
  next: string;
  accept: ReturnType<typeof useJoinFlow>["accept"];
  onAccepted: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function acceptAfterAuth() {
    try {
      await accept.mutateAsync(code);
      await onAccepted();
    } catch (e) {
      setError(cleanError(e, "We couldn't accept that invite."));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message);
      return void acceptAfterAuth();
    }

    if (!accepted) {
      setBusy(false);
      return setError("Please accept the Terms & Conditions to continue.");
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/staff-login?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) return void acceptAfterAuth();
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <MailCheck className="size-4.5 text-success" />
          <p className="text-sm font-semibold">Check your email</p>
        </div>
        <p className="text-xs text-muted-foreground">
          We&rsquo;ve sent a confirmation link to{" "}
          <span className="font-semibold text-foreground">{sentTo}</span>. Confirming it brings you
          straight back here to finish accepting the invite.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex rounded-xl bg-muted p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-lg py-2 ${mode === "signin" ? "bg-card shadow-card" : "text-muted-foreground"}`}
        >
          I have an account
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg py-2 ${mode === "signup" ? "bg-card shadow-card" : "text-muted-foreground"}`}
        >
          I&rsquo;m new here
        </button>
      </div>

      <form onSubmit={submit} className="space-y-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
          className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm"
        />

        {mode === "signup" ? (
          <label className="flex items-start gap-2.5 text-xs">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border"
            />
            <span>
              I accept the{" "}
              <Link to="/terms" className="font-semibold underline">
                Terms &amp; Conditions
              </Link>{" "}
              and privacy notice.
            </span>
          </label>
        ) : null}

        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === "signin" ? (
            <>
              Sign in and accept <ArrowRight className="size-3.5" />
            </>
          ) : (
            <>
              Create account and accept <ArrowRight className="size-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
