import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, AlertTriangle, ChevronRight, Bookmark, Receipt, Settings, FileText, Camera, Crown, CreditCard, Sparkles, ShieldCheck, MessageCircle, LifeBuoy } from "lucide-react";
import { AppShell, Card, ReverifyBanner } from "@/components/AppShell";
import { SectionHead, LoadingBlocks, PreviewBadge } from "@/components/Kit";
import { ils } from "@/lib/mock";
import { refIn } from "@/lib/currencies";
import { useApp } from "@/lib/store";
import { useOnboardedGate } from "@/lib/useOnboardedGate";
import { useProfile } from "@/lib/useProfile";
import { useProgramme, useTravel } from "@/lib/useProgramme";
import { getJourney } from "@/lib/journey-phase";
import { ShekkTagCard } from "@/components/social/ShekkTagCard";
import { useMyHandle, useUnreadChats } from "@/lib/useSocial";
import { AVATAR_PRESETS, avatarPreset, avatarPresetId, avatarUrlFor } from "@/lib/avatars";
import { Sheet } from "@/components/programme/Bits";
import { MONEY_ENABLED } from "@/lib/flags";


export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "You · Shekk" },
      {
        name: "description",
        content:
          "Your Shekk account: your programme, your Shekk tag, saved places, documents, journey details and settings.",
      },
      { property: "og:title", content: "You · Shekk" },
      { property: "og:description", content: "Your Shekk account, programme context and everything you have saved." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Me,
});

function Me() {
  const ready = useOnboardedGate();
  const { state, verification, daysLeft, setAvatar, isPremium } = useApp();
  const { me: myHandle, save: saveHandle } = useMyHandle();
  const [pickerOpen, setPickerOpen] = useState(false);
  const kyc = useProfile();
  const { programme } = useProgramme();
  const { travel } = useTravel();
  const journey = getJourney(travel);
  const unread = useUnreadChats();

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result));
      setPickerOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onPickPreset = (id: string) => {
    setAvatar(null);
    saveHandle.mutate({ avatarUrl: avatarUrlFor(id) });
    setPickerOpen(false);
  };

  if (!ready)
    return (
      <AppShell>
        <LoadingBlocks rows={3} />
      </AppShell>
    );

  const badge =
    verification === "verified"
      ? { label: "Verified", cls: "bg-success-soft text-success", Icon: BadgeCheck }
      : verification === "expiring"
        ? { label: "Expiring soon", cls: "bg-warning-soft text-warning-foreground", Icon: AlertTriangle }
        : { label: "Needs update", cls: "bg-warning-soft text-warning-foreground", Icon: AlertTriangle };

  const contextLine = programme.joined
    ? [programme.programmeName, programme.cohortName].filter(Boolean).join(" · ")
    : journey.chip
      ? journey.chip
      : "Travelling independently";

  return (
    <AppShell>
      <header className="bg-ink px-5 pb-8 pt-7 text-ink-foreground">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Change your avatar"
            className="tap relative shrink-0 cursor-pointer"
          >
            {state.avatar ? (
              <img src={state.avatar} alt="Your profile photo" className="size-16 rounded-2xl object-cover" />
            ) : avatarPreset(myHandle?.avatarUrl) ? (
              <span
                aria-hidden
                className="flex size-16 items-center justify-center overflow-hidden rounded-2xl"
                style={{ backgroundImage: avatarPreset(myHandle?.avatarUrl)!.grad }}
              >
                <img src={avatarPreset(myHandle?.avatarUrl)!.image} alt="" className="size-full object-cover" />
              </span>
            ) : (
              <span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-foreground">
                {(travel.displayName || state.name || "S").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card">
              <Camera className="size-3.5" />
            </span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">
              {travel.displayName || state.name || "Your Shekk"}
            </h1>
            <p className="line-clamp-2 text-[13px] leading-snug opacity-75">{contextLine}</p>
            <button type="button" onClick={() => setPickerOpen(true)} className="mt-1 text-xs underline opacity-70">
              {state.avatar || avatarPreset(myHandle?.avatarUrl) ? "Change avatar" : "Choose an avatar"}
            </button>
          </div>
        </div>

        {!MONEY_ENABLED ? null : kyc.verified ? (
          <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${badge.cls}`}>
            <badge.Icon className="size-4" /> {badge.label}
            {daysLeft !== null && <span>· {daysLeft} days left</span>}
          </div>
        ) : (
          <Link
            to="/verify"
            className="tap mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3 text-accent-foreground"
          >
            <span>
              <span className="block text-sm font-bold">
                {kyc.pending ? "We're checking your ID now" : "Finish setting up your money"}
              </span>
              <span className="block text-xs opacity-80">
                {kyc.pending
                  ? "We'll let you know the moment it clears."
                  : "ID, address and a selfie — about three minutes."}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0" />
          </Link>
        )}
      </header>

      <div className="space-y-5 px-4 py-5">
        {MONEY_ENABLED ? <ReverifyBanner /> : null}

        <ShekkTagCard />

        {MONEY_ENABLED ? (
          <Card>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Your shekels</p>
            <p className="font-display text-3xl font-bold leading-none tracking-tight">{ils(state.balance)}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              ≈ {refIn(state.settings.payCurrency, state.balance)} · updated live
            </p>
          </Card>
        ) : null}

        <div>
          <SectionHead title="Your Shekk" />
          <Card className="p-0">
            <RowLink to="/membership" Icon={Crown} label="Shekk+" hint={isPremium ? "Member" : "See what's included"} />
            {MONEY_ENABLED ? (
              <>
                <RowLink
                  to="/card"
                  Icon={CreditCard}
                  label="Shekk Card"
                  hint={state.card.issued ? `•••• ${state.card.last4}` : ""}
                  badge={state.card.issued ? undefined : <PreviewBadge />}
                />
                <RowLink to="/activity" Icon={Receipt} label="Payment history" hint={`${state.txns.length} records`} />
              </>
            ) : null}
            <RowLink
              to="/social"
              Icon={MessageCircle}
              label="Community"
              hint=""
              badge={
                unread > 0 ? (
                  <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                ) : undefined
              }
            />
            <RowLink to="/explore/shops" Icon={Bookmark} label="Saved places & discounts" hint="" />
            <RowLink to="/explore/documents" Icon={FileText} label="Your documents" hint="Private to you" />
            <RowLink to="/welcome" Icon={Sparkles} label="Journey details" hint="Dates & city" />
            <RowLink to="/settings" Icon={Settings} label="Settings" hint="Currency, theme, alerts" />
            <RowLink to="/help" Icon={LifeBuoy} label="Help & support" hint="" />
            <RowLink to="/terms" Icon={FileText} label="Terms & Conditions" hint="" />
          </Card>
        </div>

        {MONEY_ENABLED ? (
          <div>
            <SectionHead title="How your money works" hint="The short version — full terms are one tap away" />
            <Card className="space-y-2.5">
              <ul className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                <li>
                  • Your shekels sit in a real, regulated ILS payment account held with Airwallex — not app credits or
                  vouchers.
                </li>
                <li>
                  • You add money from a card or bank account in your own name, and you see the rate and the exact
                  shekels you'll get before you confirm.
                </li>
                <li>
                  • Pay a partner inside Shekk and{" "}
                  <span className="font-medium text-foreground">Shekk pays them for you</span> — your card is never
                  charged at the checkout. We take it from your shekel balance.
                </li>
                <li>
                  • To open an account you need to be 16 or over, living outside Israel, and have valid ID. Airwallex
                  runs the identity check and makes the decision.
                </li>
                <li>• We re-check your ID once a year. If you close your account, unspent shekels come back to you.</li>
              </ul>

              <p className="flex items-start gap-2 pt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-[3px] size-3.5 shrink-0" />
                The Shekk Card and partner marketplaces marked "Preview" aren't live yet — we'll tell you the moment
                they are.
              </p>

              <Link to="/terms" className="tap-flat inline-block pt-1 text-[13px] font-semibold text-primary">
                Read the full terms →
              </Link>
            </Card>
          </div>
        ) : null}
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose your avatar">
        <div className="grid grid-cols-4 gap-2.5">
          {AVATAR_PRESETS.map((a) => {
            const selected = !state.avatar && avatarPresetId(myHandle?.avatarUrl) === a.id;
            return (
              <button
                key={a.id}
                type="button"
                aria-label={a.id}
                aria-pressed={selected}
                onClick={() => onPickPreset(a.id)}
                className={`tap flex aspect-square items-center justify-center overflow-hidden rounded-2xl ${
                  selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ backgroundImage: a.grad }}
              >
                <img src={a.image} alt="" className="size-full object-cover" />
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-2">
          <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-semibold">
            <Camera className="size-4" /> Upload your own photo
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
          {state.avatar && (
            <button
              type="button"
              onClick={() => {
                setAvatar(null);
                setPickerOpen(false);
              }}
              className="tap-flat w-full py-2 text-sm text-muted-foreground underline"
            >
              Remove my photo
            </button>
          )}
        </div>
      </Sheet>
    </AppShell>
  );
}

function RowLink({
  to,
  Icon,
  label,
  hint,
  badge,
}: {
  to: string;
  Icon: typeof Receipt;
  label: string;
  hint: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link to={to} className="tap flex items-center gap-3 border-b border-border p-4 last:border-0">
      <Icon className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      {badge ?? (hint ? <span className="shrink-0 text-xs text-muted-foreground">{hint}</span> : null)}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
