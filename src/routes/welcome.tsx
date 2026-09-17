/**
 * The start of the journey.
 *
 * One route, two jobs: the front door for anyone without an account (what Shekk
 * is in a sentence, then straight into the real Supabase auth screen), and a
 * staged journey setup for anyone who has just signed in.
 *
 * Every answer is written to the member's own server-side travel record as soon
 * as they tap Continue, so an interrupted setup resumes on any device. Nothing
 * sensitive is collected here — identity verification stays in the existing KYC
 * flow at /verify, which this screen only explains and links to.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  Compass,
  Loader2,
  MapPin,
  Plane,
  Signal,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import { FocusScreen, PrimaryButton } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Splash } from "@/components/Splash";
import { useApp } from "@/lib/store";
import { useMyHandle } from "@/lib/useSocial";
import { AVATAR_PRESETS, avatarPresetId, avatarUrlFor } from "@/lib/avatars";
import { LOCATION_CITIES } from "@/lib/location";
import { CURRENCIES, type CurrencyCode } from "@/lib/currencies";
import { useProgramme, useTravel } from "@/lib/useProgramme";
import { INTERESTS, type InterestId } from "@/lib/journey-interests";
import { MONEY_ENABLED } from "@/lib/flags";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Israel journey starts here · Shekk" },
      {
        name: "description",
        content:
          "Shekk is one app for your programme life and everything you need before you land in Israel. Set up your journey in a few taps: how you're coming, your dates and your city.",
      },
      { property: "og:title", content: "Your Israel journey starts here" },
      {
        property: "og:description",
        content: "One app for your programme and everything before you land in Israel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://shekel-connect.lovable.app/welcome" },
    ],
    links: [{ rel: "canonical", href: "https://shekel-connect.lovable.app/welcome" }],
  }),
  component: Welcome,
});

const ONE_LINER = "One app for your programme life and everything you need sorted before you land.";

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "South Africa",
  "France",
  "Argentina",
  "Other",
];

const AREAS = [
  "Programme accommodation",
  "Dorms / campus",
  "Rented flat",
  "Family",
  "Not decided yet",
];

/**
 * The journey, in order. Each stage belongs to a chapter, so the header can say
 * where you are instead of counting anonymous form pages. The programme stage is
 * skipped for independents.
 */
const STEPS = [
  { id: "profile", chapter: "Your journey" },
  { id: "style", chapter: "Your journey" },
  { id: "code", chapter: "Your journey" },
  { id: "dates", chapter: "Planning your stay" },
  { id: "place", chapter: "Planning your stay" },
  { id: "focus", chapter: "Making it yours" },
  { id: "esim", chapter: "Making it yours" },
  { id: "money", chapter: "Getting set up" },
  { id: "verify", chapter: "Getting set up" },
  { id: "done", chapter: "Ready" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function Welcome() {
  const { signedIn, authChecked } = useApp();

  if (!authChecked) return <Splash message="Opening Shekk…" />;
  if (!signedIn) return <Landing />;
  return <Setup />;
}

/* ─────────────────────────────── Landing ─────────────────────────────── */

function Landing() {
  return (
    <FocusScreen nav={false}>
      <div className="flex min-h-screen flex-col justify-between gap-8 px-6 py-14 sm:min-h-[860px]">
        <div className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Shekk</p>
          <h1 className="font-display text-[2.2rem] font-extrabold leading-[1.08] tracking-tight">
            Your Israel journey starts here.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">{ONE_LINER}</p>

          <ol className="space-y-3 pt-2">
            {[
              {
                icon: Plane,
                step: "Before you fly",
                title: "Land ready, not guessing",
                body: "The arrival admin in the order it actually happens.",
              },
              MONEY_ENABLED
                ? {
                    icon: Wallet,
                    step: "From day one",
                    title: "Spend in shekels",
                    body: "Add money in your home currency, see the rate before you confirm.",
                  }
                : {
                    icon: Compass,
                    step: "Every day",
                    title: "Israel, sorted",
                    body: "Guides, places and the practical stuff, right where you need them.",
                  },
              {
                icon: Building2,
                step: "All the way through",
                title: "Your programme and your city",
                body: "Timetable, contacts and what's around you, in one place.",
              },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {f.step}
                  </span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{f.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3">
          <Link
            to="/auth"
            search={{ next: "/welcome" }}
            className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-semibold text-primary-foreground shadow-card"
          >
            Start my journey <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/auth"
            search={{ next: "/" }}
            className="tap block w-full rounded-2xl border border-border bg-card px-5 py-4 text-center text-base font-semibold shadow-card"
          >
            I already have an account
          </Link>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            {MONEY_ENABLED
              ? "Shekk is a shekel spending account for people coming to Israel from abroad. A one-time identity check is required before you can spend."
              : "Free to get started — no payment account required."}
          </p>
        </div>
      </div>
    </FocusScreen>
  );
}

/* ──────────────────────────────── Setup ─────────────────────────────── */

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function daysBetween(a: string, b: string) {
  const from = new Date(`${a}T00:00:00`).getTime();
  const to = new Date(`${b}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

function daysFromToday(iso: string) {
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(then)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((then - today.getTime()) / 86_400_000);
}

function Setup() {
  const navigate = useNavigate();
  const { state, completeOnboarding } = useApp();
  const { travel, loading, fetched, failed, refetch, save } = useTravel();
  const { join, joined, programme } = useProgramme();
  const { me: myHandle, save: saveHandle } = useMyHandle();

  const [step, setStep] = useState<StepId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [style, setStyle] = useState<"programme" | "independent">("programme");
  const [code, setCode] = useState("");
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [homeCountry, setHomeCountry] = useState("");
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>(state.settings.payCurrency);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [interests, setInterests] = useState<InterestId[]>([]);

  /* Adopt whatever the server already knows, once. */
  useEffect(() => {
    if (!fetched || step !== null) return;
    if (myHandle?.displayName && myHandle.displayName !== "Shekk member") setDisplayName(myHandle.displayName);
    if (myHandle?.avatarUrl) setAvatarId(avatarPresetId(myHandle.avatarUrl));
    if (travel.travelStyle !== "unknown") setStyle(travel.travelStyle);
    if (travel.arrivalDate) setArrival(travel.arrivalDate);
    if (travel.departureDate) setDeparture(travel.departureDate);
    if (travel.homeCountry) setHomeCountry(travel.homeCountry);
    if (travel.fundingCurrency) setPayCurrency(travel.fundingCurrency as CurrencyCode);
    if (travel.israelCity) setCity(travel.israelCity);
    if (travel.accommodationArea) setArea(travel.accommodationArea);
    if (travel.interests.length) setInterests(travel.interests as InterestId[]);
    const resumed = STEPS.find((s) => s.id === travel.onboardingStep)?.id;
    setStep(travel.onboardingCompletedAt ? "done" : (resumed ?? "profile"));
  }, [fetched, step, travel, myHandle]);

  /** Independents never see the programme stage; nobody sees the money/KYC
   *  stages while MONEY_ENABLED is off — flipping that flag back on brings
   *  them back with no other change needed here. */
  const flow = useMemo(
    () =>
      STEPS.filter((s) => s.id !== "code" || style === "programme").filter(
        (s) => MONEY_ENABLED || (s.id !== "money" && s.id !== "verify"),
      ),
    [style],
  );
  const index = Math.max(0, flow.findIndex((s) => s.id === step));
  const chapter = flow[index]?.chapter ?? "";

  // A permanently failed load must never leave someone staring at a spinner
  // forever — give them a way to retry or carry on into the app instead.
  if (failed && step === null) {
    return <SetupLoadError onRetry={() => void refetch()} onSkip={() => void navigate({ to: "/" })} />;
  }

  if (loading || step === null) return <Splash message="Picking up where you left off…" />;

  const stay = arrival && departure ? daysBetween(arrival, departure) : null;
  const untilFlight = arrival ? daysFromToday(arrival) : null;

  async function persist(patch: Parameters<typeof save.mutateAsync>[0]) {
    try {
      await save.mutateAsync(patch);
      return true;
    } catch {
      setError("We couldn't save that just now. Check your connection and try again.");
      return false;
    }
  }

  function goto(id: StepId) {
    setError(null);
    setStep(id);
  }

  async function forward() {
    setError(null);
    const nextStep = flow[Math.min(index + 1, flow.length - 1)].id;

    if (step === "profile") {
      setBusy(true);
      try {
        await saveHandle.mutateAsync({
          displayName: displayName.trim() || undefined,
          avatarUrl: avatarId ? avatarUrlFor(avatarId) : undefined,
        });
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message.replace(/^Error:\s*/, "") : "We couldn't save that just now.");
        return;
      }
      const ok = await persist({
        displayName: displayName.trim() || undefined,
        onboardingStep: nextStep,
      });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "style") {
      setBusy(true);
      const ok = await persist({ travelStyle: style, onboardingStep: nextStep });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "code") {
      const clean = code.trim().toUpperCase();
      setBusy(true);
      if (clean.length >= 3 && !joined) {
        try {
          await join.mutateAsync(clean);
        } catch (e) {
          setBusy(false);
          setError(
            e instanceof Error
              ? e.message.replace(/^Error:\s*/, "")
              : "We couldn't find that code — check it with your programme, or skip for now.",
          );
          return;
        }
      }
      const ok = await persist({ onboardingStep: nextStep });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "dates") {
      if (arrival && departure && departure < arrival) {
        setError("Your departure date is before your arrival date.");
        return;
      }
      setBusy(true);
      const ok = await persist({
        arrivalDate: arrival || null,
        departureDate: departure || null,
        onboardingStep: nextStep,
      });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "place") {
      setBusy(true);
      const ok = await persist({
        israelCity: city || null,
        accommodationArea: area || null,
        onboardingStep: nextStep,
      });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "focus") {
      setBusy(true);
      const ok = await persist({ interests, onboardingStep: nextStep });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "esim") {
      setBusy(true);
      const ok = await persist({ onboardingStep: nextStep });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "money") {
      setBusy(true);
      const ok = await persist({
        homeCountry: homeCountry || null,
        fundingCurrency: payCurrency,
        onboardingStep: nextStep,
      });
      setBusy(false);
      if (ok) goto(nextStep);
      return;
    }

    if (step === "verify") {
      setBusy(true);
      const ok = await persist({ onboardingStep: "done", onboardingComplete: true });
      setBusy(false);
      if (!ok) return;
      completeOnboarding({
        name: displayName || state.name,
        programId: state.programId,
        cohort: state.cohort,
        homeCountry,
        arrivalDateISO: arrival || null,
        city,
        appLanguage: state.settings.appLanguage,
        payCurrency,
      });
      goto("done");
      return;
    }

    void navigate({ to: "/" });
  }

  function back() {
    setError(null);
    if (index <= 0) {
      void navigate({ to: "/" });
      return;
    }
    setStep(flow[index - 1].id);
  }

  const canContinue =
    step === "money" ? Boolean(homeCountry) : step === "place" ? Boolean(city) : true;

  return (
    <FocusScreen nav={false}>
      <header className="sticky top-0 z-10 bg-background/90 px-5 pb-3 pt-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Go back"
            onClick={back}
            className="tap shrink-0 rounded-full bg-muted p-2"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div
            className="flex flex-1 gap-1.5"
            role="progressbar"
            aria-label={`Journey setup: ${chapter}`}
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={flow.length}
          >
            {flow.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= index ? "bg-primary" : "bg-border"
                }`}
                aria-hidden
              />
            ))}
          </div>
        </div>
        <p className="mt-2 pl-11 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {chapter}
          <span className="sr-only">
            {" "}
            — step {index + 1} of {flow.length}
          </span>
        </p>
      </header>

      <div key={step} className="animate-in fade-in slide-in-from-right-3 px-5 pt-5 duration-300">
        {step === "profile" ? (
          <Stage
            icon={UserRound}
            title="What should we call you?"
            blurb="Your name and avatar show up on your home screen and to your programme — nothing else about you is shared."
          >
            <div className="flex justify-center">
              <Avatar
                name={displayName || "S"}
                src={avatarId ? avatarUrlFor(avatarId) : null}
                className="size-20"
                textClassName="text-3xl"
              />
            </div>
            <Field label="Your name">
              <input
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Sam"
                maxLength={60}
                className="w-full rounded-2xl bg-muted px-4 py-3.5 text-base outline-none"
              />
            </Field>
            <Field label="Pick an avatar">
              <div className="grid grid-cols-4 gap-2.5">
                {AVATAR_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-label={a.id}
                    aria-pressed={avatarId === a.id}
                    onClick={() => setAvatarId((v) => (v === a.id ? null : a.id))}
                    className={`tap flex aspect-square items-center justify-center rounded-2xl text-2xl ${
                      avatarId === a.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                    }`}
                    style={{ backgroundImage: a.grad }}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </Field>
          </Stage>
        ) : null}

        {step === "style" ? (
          <Stage
            icon={Sparkles}
            title="How are you coming to Israel?"
            blurb="This shapes your home screen, your checklist and what Shekk puts in front of you first."
          >
            <div className="space-y-2">
              {(
                [
                  {
                    id: "programme",
                    label: "With a programme",
                    hint: "Gap year, seminary, yeshiva, MASA, study abroad",
                  },
                  {
                    id: "independent",
                    label: "Independently",
                    hint: "Working, volunteering, studying, visiting family or travelling",
                  },
                ] as const
              ).map((o) => (
                <Option
                  key={o.id}
                  selected={style === o.id}
                  onClick={() => setStyle(o.id)}
                  label={o.label}
                  hint={o.hint}
                />
              ))}
            </div>
          </Stage>
        ) : null}

        {step === "code" ? (
          <Stage
            icon={Building2}
            title="Unlock your programme"
            blurb="If your programme is on Shekk, the code they gave you brings your timetable, your contacts and your checklist straight into the app."
          >
            {joined ? (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
                <p className="text-sm font-semibold">
                  {programme.programmeName ?? "Your programme"} is in
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {programme.cohortName ?? "Your timetable and contacts are now in Shekk."}
                </p>
              </div>
            ) : (
              <Field label="Programme code">
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) void forward();
                  }}
                  placeholder="e.g. SHEKKDEMO"
                  className="w-full rounded-2xl bg-muted px-4 py-3.5 text-base font-semibold uppercase tracking-wide outline-none"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  No code yet? Carry on without it — nothing else changes, and you can add it from
                  the Programme tab whenever it arrives.
                </p>
              </Field>
            )}
          </Stage>
        ) : null}

        {step === "dates" ? (
          <Stage
            icon={CalendarDays}
            title="When does your journey begin?"
            blurb="We'll count down to your landing and line the arrival admin up around it. Rough dates are fine — you can change them later."
          >
            <Field label="Arrival date">
              <input
                type="date"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                className="w-full rounded-2xl bg-muted px-4 py-3.5 text-base outline-none"
              />
            </Field>
            <Field label="Departure date (optional)">
              <input
                type="date"
                value={departure}
                min={arrival || undefined}
                onChange={(e) => setDeparture(e.target.value)}
                className="w-full rounded-2xl bg-muted px-4 py-3.5 text-base outline-none"
              />
            </Field>

            {arrival && stay !== null && stay >= 0 ? (
              <div className="animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-4 shadow-card duration-300">
                <p className="font-display text-2xl font-bold leading-none tracking-tight">
                  {stay} {stay === 1 ? "day" : "days"} in Israel
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {untilFlight !== null && untilFlight > 0
                    ? `${untilFlight} ${untilFlight === 1 ? "day" : "days"} until you fly · lands ${fmtDate(arrival)}`
                    : `From ${fmtDate(arrival)}`}
                </p>
              </div>
            ) : arrival && untilFlight !== null && untilFlight > 0 ? (
              <p className="animate-in fade-in text-sm font-semibold text-primary duration-300">
                {untilFlight} {untilFlight === 1 ? "day" : "days"} until you fly.
              </p>
            ) : null}
          </Stage>
        ) : null}

        {step === "place" ? (
          <Stage
            icon={MapPin}
            title="Where will you call home?"
            blurb="Your base sets your weather, your Shabbat times, your transport options and what Shekk recommends nearby."
          >
            <Field label="City or area">
              <Choices options={LOCATION_CITIES} value={city} onChange={setCity} />
            </Field>
            <Field label="Where are you staying? (optional)">
              <Choices options={AREAS} value={area} onChange={setArea} />
            </Field>
          </Stage>
        ) : null}

        {step === "focus" ? (
          <Stage
            icon={Compass}
            title="What should Shekk help you with?"
            blurb="Pick as many as you like. We'll put these at the top of your home screen — you can change them any time."
          >
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = interests.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setInterests((prev) =>
                        prev.includes(i.id) ? prev.filter((x) => x !== i.id) : [...prev, i.id],
                      )
                    }
                    className={`tap flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      on ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <i.icon className="size-4" />
                    {i.label}
                  </button>
                );
              })}
            </div>
          </Stage>
        ) : null}

        {step === "esim" ? (
          <Stage
            icon={Signal}
            title="Get connected before you land"
            blurb="An eSIM installs before you fly and switches on the moment you land, so you can message home and order a taxi straight from arrivals."
          >
            <ul className="space-y-2.5">
              {[
                "Install it at home on Wi-Fi, before you fly",
                "Switches on the moment you land — no hunting for wifi",
                "Answer three questions and Shekk finds the plan that fits your stay",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-semibold">Takes about two minutes</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                We'll ask how long you're staying, whether you need an Israeli number and how much data you use,
                then point you at the right plan.
              </p>
              <Link
                to="/services/esim"
                className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Find my SIM <ArrowRight className="size-4" />
              </Link>
            </div>
          </Stage>
        ) : null}

        {step === "money" ? (
          <Stage
            icon={Wallet}
            title="Set up your spending"
            blurb="Your Shekk balance is held in shekels. You add money in your home currency and always see the rate and the cost before you confirm."
          >
            <Field label="Home country">
              <Choices options={COUNTRIES} value={homeCountry} onChange={setHomeCountry} />
            </Field>
            <Field label="Currency you'll add money in">
              <div className="grid grid-cols-3 gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setPayCurrency(c.code)}
                    className={`tap rounded-2xl px-3 py-3 text-sm font-semibold ${
                      payCurrency === c.code ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {c.flag} {c.code}
                  </button>
                ))}
              </div>
            </Field>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Shekk is for people coming to Israel from abroad — you can't open an account as an
              Israeli resident.
            </p>
          </Stage>
        ) : null}

        {step === "verify" ? (
          <Stage
            icon={ShieldCheck}
            title="Prepare your Shekk Wallet"
            blurb="Because your wallet holds real money, there's one identity check to complete before you can spend. It happens once, and nothing else in Shekk is waiting on it."
          >
            <ul className="space-y-2.5">
              {[
                "Your legal name, date of birth and home address",
                "A photo of your passport or ID, and a quick selfie check",
                "Roughly how much you expect to spend each month",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-sm font-semibold">About five minutes, whenever suits you</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Checks are run by our regulated payment partner and reviewed before your wallet can
                spend, so it isn't instant. Your documents are stored privately and used only for
                this check.
              </p>
              <Link
                to="/verify"
                className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Start the check <ArrowRight className="size-4" />
              </Link>
            </div>
          </Stage>
        ) : null}

        {step === "done" ? <Done city={city} /> : null}
      </div>

      {step === "done" ? (
        <Ready
          style={style}
          programmeName={joined ? (programme.programmeName ?? "Your programme") : null}
          arrival={arrival}
          untilFlight={untilFlight}
          city={city}
          currency={payCurrency}
          interests={interests}
        />
      ) : null}

      <div className="px-5 pb-12 pt-8">
        {error ? (
          <p role="alert" className="mb-3 text-sm font-semibold text-destructive">
            {error}
          </p>
        ) : null}

        <PrimaryButton disabled={!canContinue || busy} onClick={() => void forward()}>
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Saving…
            </span>
          ) : step === "done" ? (
            "Take me into Shekk"
          ) : step === "verify" ? (
            "I'll do this later — finish setting up"
          ) : step === "focus" && interests.length === 0 ? (
            "Skip for now"
          ) : step === "profile" && !displayName.trim() ? (
            "Skip for now"
          ) : step === "code" && !joined && code.trim().length < 3 ? (
            "I don't have a code yet"
          ) : (
            "Continue"
          )}
        </PrimaryButton>

        {step !== "done" ? (
          <button
            type="button"
            onClick={() => void navigate({ to: "/" })}
            className="tap mt-3 block w-full text-center text-xs font-semibold text-muted-foreground underline"
          >
            Carry on with this later
          </button>
        ) : null}
      </div>
    </FocusScreen>
  );
}

/** Shown when the saved-progress load fails and retries are exhausted — the
 *  screen this replaces used to just spin forever with no way out. */
function SetupLoadError({ onRetry, onSkip }: { onRetry: () => void; onSkip: () => void }) {
  return (
    <FocusScreen nav={false}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground/60">
          <Compass className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">We couldn't load your setup</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Check your connection and try again. Your answers so far are saved, so nothing is lost.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
          <button
            type="button"
            onClick={onSkip}
            className="tap block w-full text-center text-xs font-semibold text-muted-foreground underline"
          >
            Carry on with this later
          </button>
        </div>
      </div>
    </FocusScreen>
  );
}

/* ─────────────────────────────── Pieces ─────────────────────────────── */

/** The celebratory head of the completion screen. */
function Done({ city }: { city: string }) {
  return (
    <div className="animate-in fade-in zoom-in-95 space-y-4 duration-500">
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Plane className="size-6" />
        <span
          aria-hidden
          className="animate-in zoom-in absolute -inset-2 rounded-[1.4rem] border border-primary/30 duration-700"
        />
      </div>
      <div>
        <h1 className="font-display text-[1.8rem] font-bold leading-tight tracking-tight">
          Your Israel journey is taking shape.
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {city
            ? `Shekk is now set up around ${city} and your dates.`
            : "Shekk is now set up around your dates and how you're coming."}
        </p>
      </div>
    </div>
  );
}

/** Real saved state, one recommended next action, then the quieter links. */
function Ready({
  style,
  programmeName,
  arrival,
  untilFlight,
  city,
  currency,
  interests,
}: {
  style: "programme" | "independent";
  programmeName: string | null;
  arrival: string;
  untilFlight: number | null;
  city: string;
  currency: CurrencyCode;
  interests: InterestId[];
}) {
  const rows = [
    {
      label: "Coming",
      value: programmeName ?? (style === "programme" ? "With a programme" : "Independently"),
    },
    {
      label: arrival && untilFlight !== null && untilFlight > 0 ? "You fly in" : "Arriving",
      value: arrival
        ? untilFlight !== null && untilFlight > 0
          ? `${untilFlight} ${untilFlight === 1 ? "day" : "days"}`
          : fmtDate(arrival)
        : "Dates to confirm",
    },
    { label: "Based in", value: city || "To be decided" },
    ...(MONEY_ENABLED ? [{ label: "Adding money in", value: currency }] : []),
  ];

  const focus = INTERESTS.filter((i) => interests.includes(i.id)).slice(0, 3);

  const primary =
    style === "programme" && !programmeName
      ? { to: "/programme" as const, label: "Add your programme code", hint: "Brings your timetable and contacts in" }
      : untilFlight !== null && untilFlight > 0
        ? { to: "/before-you-fly" as const, label: "Start before you fly", hint: "The arrival admin, in order" }
        : MONEY_ENABLED
          ? { to: "/topup" as const, label: "Add your first money", hint: "Fund in your home currency" }
          : { to: "/israel" as const, label: "Explore Israel", hint: "Guides, maps and what's around you" };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 px-5 pt-6 duration-500">
      <dl className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-2xl border border-border bg-card p-3 shadow-card">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {r.label}
            </dt>
            <dd className="mt-1 truncate text-sm font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>

      {focus.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Your home screen leads with {focus.map((f) => f.label.toLowerCase()).join(", ")}.
        </p>
      ) : null}

      <Link
        to={primary.to}
        className="tap flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lift"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">
            Recommended next
          </span>
          <span className="mt-0.5 block text-sm font-semibold">{primary.label}</span>
          <span className="block text-xs opacity-80">{primary.hint}</span>
        </span>
        <ArrowRight className="size-4 shrink-0" />
      </Link>

      <div className="flex flex-wrap gap-2">
        <Link to="/programme" className="tap rounded-full bg-muted px-3.5 py-2 text-xs font-semibold">
          Your programme
        </Link>
        <Link to="/israel" className="tap rounded-full bg-muted px-3.5 py-2 text-xs font-semibold">
          Explore Israel
        </Link>
        {MONEY_ENABLED ? (
          <Link to="/verify" className="tap rounded-full bg-muted px-3.5 py-2 text-xs font-semibold">
            Identity check
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Stage({
  icon: Icon,
  title,
  blurb,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-[1.75rem] font-bold leading-tight tracking-tight">
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </div>
  );
}

function Option({
  selected,
  onClick,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`tap flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left ${
        selected ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs opacity-70">{hint}</span>
      </span>
      {selected ? <Check className="size-4 shrink-0" /> : null}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`tap rounded-full px-3.5 py-2 text-sm font-semibold ${
            value === o ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
