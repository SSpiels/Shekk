import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { FocusScreen, PrimaryButton, Card } from "@/components/AppShell";
import { Splash } from "@/components/Splash";
import { useApp } from "@/lib/store";


function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s.next) }),
  head: () => ({
    meta: [
      { title: "Join Shekk · everything for your year in Israel" },
      {
        name: "description",
        content:
          "Create your Shekk account: your programme, arrival essentials and daily life in Israel, all in one app. Sign up with Google or email in under a minute.",
      },
      { property: "og:title", content: "Join Shekk" },
      { property: "og:description", content: "Everything for your year in Israel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

const PROMISES = [
  "Your programme timetable, contacts and checklist",
  "The arrival admin and daily life, in one place",
  "Events, places and the practical stuff sorted",
];

/**
 * Google/Apple sign-in is disabled: it went through a Lovable-hosted OAuth
 * broker (@lovable.dev/cloud-auth-js's default oauthBrokerUrl,
 * "/~oauth/initiate") that only ever existed on Lovable's own hosting -
 * there's no matching route anywhere in this repo, and Vercel has no
 * knowledge of it either. It's been silently failing for every visitor
 * since the move off Lovable, not just since the Supabase project cutover.
 * Restoring this needs real Google/Apple OAuth apps configured directly in
 * Supabase (Authentication -> Providers) - external account setup, not a
 * code fix - then swapping the social()/OAuthHandoff popup flow below for a
 * plain supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
 * redirect, which is what Supabase's own OAuth expects.
 */
const GOOGLE_APPLE_OAUTH_ENABLED = false;

const OAUTH_MESSAGE_TYPE = "authorization_response";
const TRUSTED_OAUTH_ORIGINS = new Set([
  "https://oauth.lovable.app",
  "https://lovable.dev",
  "https://shekk.app",
  "https://www.shekk.app",
  "https://shekel-connect.lovable.app",
]);

type OAuthMessage = {
  type?: unknown;
  response?: {
    access_token?: unknown;
    refresh_token?: unknown;
    error?: unknown;
    error_description?: unknown;
  };
};

/** New sessions land in the staged setup; it resumes or exits instantly if done. */
function afterAuthPath(next: string) {
  return next === "/" ? "/welcome" : next;
}

function isTrustedOAuthOrigin(origin: string) {
  return origin === window.location.origin || TRUSTED_OAUTH_ORIGINS.has(origin);
}

function waitForOAuthMessage() {
  let cleanup = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    const handler = (event: MessageEvent<OAuthMessage>) => {
      if (!isTrustedOAuthOrigin(event.origin)) return;
      if (!event.data || event.data.type !== OAUTH_MESSAGE_TYPE) return;

      const response = event.data.response;
      if (!response) return;

      if (typeof response.error === "string") {
        cleanup();
        reject(new Error(typeof response.error_description === "string" ? response.error_description : response.error));
        return;
      }

      if (typeof response.access_token !== "string" || typeof response.refresh_token !== "string") {
        cleanup();
        reject(new Error("Google sign-in finished, but no session was returned."));
        return;
      }

      cleanup();
      void supabase.auth
        .setSession({ access_token: response.access_token, refresh_token: response.refresh_token })
        .then(({ error }) => {
          if (error) reject(error);
          else resolve();
        });
    };

    cleanup = () => window.removeEventListener("message", handler);
    window.addEventListener("message", handler);
  });

  return { promise, cleanup };
}

/**
 * Hand-off screen for Google/Apple sign-in.
 *
 * The popup can be closed or blocked without the SDK ever resolving, which used
 * to leave people stuck on "Continuing with Google…" forever. So we poll for a
 * session (the popup may have signed them in already) and always offer a way out.
 */
function OAuthHandoff({
  label,
  next,
  onCancel,
}: {
  label: string;
  next: string;
  onCancel: () => void;
}) {
  const [stuck, setStuck] = useState(false);

  async function checkSession() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      window.location.href = afterAuthPath(next);
      return true;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      window.location.href = afterAuthPath(next);
      return true;
    }

    return false;
  }

  useEffect(() => {
    let done = false;
    const check = async () => {
      if (done) return;
      const found = await checkSession();
      if (found) done = true;
    };
    void check();
    const poll = window.setInterval(check, 1000);
    window.addEventListener("focus", check);
    const timer = window.setTimeout(() => setStuck(true), 6000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer);
      window.removeEventListener("focus", check);
    };
  }, [next]);

  return (
    <>
      <Splash message={`Continuing with ${label}…`} />
      {stuck && (
        <div className="fixed inset-x-0 bottom-10 z-[101] flex flex-col items-center gap-2 px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Taking a while? The {label} window may have been blocked or closed.
          </p>
          <button
            type="button"
            onClick={() => void checkSession().then((found) => {
              if (!found) onCancel();
            })}
            className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold shadow-card"
          >
            I finished — continue
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-muted-foreground underline"
          >
            Back to sign in
          </button>
        </div>
      )}
    </>
  );
}

function Auth() {

  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { signedIn, authChecked } = useApp();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);

  /**
   * Already signed in? Don't ask again.
   *
   * If anything ever bounces a member here while their session is fine, they
   * should land back where they were going instead of typing a password again.
   */
  useEffect(() => {
    if (!authChecked || !signedIn) return;
    void navigate({ to: afterAuthPath(next), replace: true });
  }, [authChecked, signedIn, navigate, next]);


  async function social(provider: "google" | "apple") {
    const label = provider === "google" ? "Google" : "Apple";
    setBusy(true);
    setHandoff(label);
    setError(null);
    const messageFallback = waitForOAuthMessage();
    let finished = false;
    try {
      const result = await Promise.race([
        lovable.auth.signInWithOAuth(provider, {
          redirect_uri: window.location.origin,
          ...(provider === "google" ? { extraParams: { prompt: "select_account" } } : {}),
        }),
        messageFallback.promise.then(() => ({ error: null, redirected: false as const })),
      ]);
      finished = true;
      if (result.error) {
        setBusy(false);
        setHandoff(null);
        return setError(result.error.message ?? `${label} sign-in failed. Try email instead.`);
      }
      if (result.redirected) return;
    } catch (e) {
      finished = true;
      setBusy(false);
      setHandoff(null);
      return setError(
        e instanceof Error ? e.message : `${label} sign-in failed. Try email instead.`,
      );
    } finally {
      if (finished) messageFallback.cleanup();
    }
    setBusy(false);
    window.location.href = afterAuthPath(next);
  }



  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) return setError(error.message);
      return setNotice("Check your email for a link to set a new password.");
    }

    if (mode === "signup") {
      if (!accepted) {
        setBusy(false);
        return setError("Please accept the Terms & Conditions to continue.");
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/verify` },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (data.session) {
        void navigate({ to: afterAuthPath(next), replace: true });
        return;
      }
      setSentTo(email);
      return;
    }


    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    void navigate({ to: afterAuthPath(next), replace: true });

  }

  if (handoff) {
    return (
      <OAuthHandoff
        label={handoff}
        next={next}
        onCancel={() => {
          setHandoff(null);
          setBusy(false);
          setError(
            `${handoff} sign-in didn't finish. Try again, or use your email and password below.`,
          );
        }}
      />
    );
  }


  if (sentTo) {
    return (
      <FocusScreen nav={false}>
        <div className="flex min-h-screen flex-col justify-center gap-5 px-6 py-14 sm:min-h-[860px]">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-success/10">
            <MailCheck className="size-7 text-success" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
              Check your email
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              We&rsquo;ve sent a confirmation link to{" "}
              <span className="font-semibold text-foreground">{sentTo}</span>. Tap
              &ldquo;Verify now&rdquo; in that email to activate your Shekk account.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing yet? Give it a minute and check your spam folder.
            </p>
          </div>

          {notice && <p className="text-sm text-success">{notice}</p>}
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <PrimaryButton
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              setNotice(null);
              const { error } = await supabase.auth.resend({
                type: "signup",
                email: sentTo,
                options: { emailRedirectTo: `${window.location.origin}/verify` },
              });
              setBusy(false);
              if (error) return setError(error.message);
              setNotice("Sent again — check your inbox.");
            }}
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Sending…
              </span>
            ) : (
              "Resend the email"
            )}
          </PrimaryButton>

          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setNotice(null);
              setError(null);
              setMode("signin");
            }}
            className="text-center text-sm text-muted-foreground underline"
          >
            Already confirmed? Sign in
          </button>
        </div>
      </FocusScreen>
    );
  }

  return (

    <FocusScreen nav={false}>
      <div className="flex min-h-screen flex-col justify-center gap-6 px-6 py-14 sm:min-h-[860px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Shekk</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
            {mode === "signup"
              ? "Create your Shekk account."
              : mode === "signin"
                ? "Welcome back."
                : "Reset your password."}
          </h1>
          {mode === "signup" && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Finance, programme and Israel in one app — then a few quick questions so it fits your
              trip.
            </p>
          )}
          {mode === "signup" && (
            <ul className="mt-4 space-y-1.5">
              {PROMISES.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        {GOOGLE_APPLE_OAUTH_ENABLED && mode !== "forgot" && (
          <>
            <button
              type="button"
              onClick={() => social("google")}
              disabled={busy}
              className="tap flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-base font-semibold shadow-card disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
                />
              </svg>
              {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
            </button>
            <button
              type="button"
              onClick={() => social("apple")}
              disabled={busy}
              className="tap -mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-base font-semibold shadow-card disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="size-5 fill-foreground" aria-hidden="true">
                <path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.8-1.7 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.5 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.7 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.4-3.6ZM14.1 5.1c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z" />
              </svg>
              {mode === "signup" ? "Sign up with Apple" : "Continue with Apple"}
            </button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
            </div>
          </>

        )}

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base"
          />
          {mode !== "forgot" && (
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (8+ characters)"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base"
            />
          )}

          {mode === "signup" && (
            <Card className="space-y-3">
              <div className="max-h-28 overflow-y-auto rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">The short version</p>
                <p className="mt-1">
                  Shekk is a shekel spending account. You add money from your own card or bank in
                  your home currency; it is converted to shekels at the rate shown before you
                  confirm, with the conversion cost always displayed. Money is held with our
                  regulated payment partner, Airwallex, not by Shekk.
                </p>
                <p className="mt-1">
                  You must be 16 or over, verify your identity before spending, and use the account
                  yourself — never for someone else. We check your identity again every 12 months.
                  Unspent shekels can be returned to you on closure to a source in your own name.
                </p>
                <p className="mt-1">
                  Accounts are for people coming to Israel from abroad: you must live in a country
                  Airwallex supports for onboarding, and you cannot open an account if you are
                  resident in Israel.
                </p>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 size-5 rounded border-border"
                />
                <span>
                  I accept the{" "}
                  <Link to="/terms" className="font-semibold underline">
                    Terms &amp; Conditions
                  </Link>{" "}
                  and privacy notice. I confirm I am 16 or over, resident outside Israel, and opening this account for myself, and I consent to electronic records and to identity checks run by Airwallex.
                </span>
              </label>
            </Card>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

          <PrimaryButton type="submit" disabled={busy}>
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Please wait…
              </span>
            ) : mode === "signup" ? (
              "Create my account"
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Email me a reset link"
            )}
          </PrimaryButton>
        </form>

        <div className="space-y-2 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setMode(mode === "signup" ? "signin" : "signup");
            }}
            className="text-muted-foreground underline"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
          {mode !== "forgot" && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode("forgot");
                }}
                className="text-xs text-muted-foreground underline"
              >
                Forgot your password?
              </button>
            </div>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> Identity checks are run by our regulated payment
          partner.
        </p>
        <Link to="/staff" className="text-center text-xs text-muted-foreground underline">
          Programme staff?
        </Link>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="text-center text-sm text-muted-foreground"
        >
          Back to Shekk
        </button>
      </div>
    </FocusScreen>
  );
}
