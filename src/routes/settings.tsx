import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  CreditCard,
  Palette,
  Bell,
  ShieldCheck,
  Globe2,
  FileText,
  LogOut,
  RotateCcw,
  Moon,
  Sun,
  MonitorSmartphone,
} from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { LoadingBlocks } from "@/components/Kit";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES, currency, money, refIn, shekkRate } from "@/lib/currencies";
import { useApp } from "@/lib/store";
import type { Settings as SettingsShape, ThemePref } from "@/lib/store";
import { ils } from "@/lib/mock";
import { useOnboardedGate } from "@/lib/useOnboardedGate";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Shekk" },
      {
        name: "description",
        content:
          "Choose the currency you pay from, switch light or dark mode, and control notifications, privacy and security in Shekk.",
      },
      { property: "og:title", content: "Settings · Shekk" },
      { property: "og:description", content: "Pay currency, appearance, notifications, privacy and security." },
    ],
  }),
  component: SettingsPage,
});

const CITIES = ["Jerusalem", "Tel Aviv", "Beit Shemesh", "Efrat", "Tzfat", "Haifa", "Beer Sheva"];

function SettingsPage() {
  const ready = useOnboardedGate();
  const { state, setSetting, resetSettings, setFeedOptIn } = useApp();
  const navigate = useNavigate();
  const s = state.settings;

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { next: "/" } });
  }

  if (!ready)
    return (
      <AppShell>
        <LoadingBlocks rows={3} />
      </AppShell>
    );

  const cur = currency(s.payCurrency);

  return (
    <AppShell>
      <header className="bg-ink px-5 pb-7 pt-8 text-ink-foreground">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm opacity-70">
          How Shekk behaves. Your account is always held in shekels — {ils(state.balance)} right now.
        </p>
      </header>

      <div className="space-y-5 px-4 py-5">
        {/* Payments */}
        <Section Icon={CreditCard} title="Payments" note="Your balance stays in shekels. This is what you pay from.">
          <div className="p-4">
            <p className="text-sm font-semibold">Default pay currency</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {cur.flag} {cur.label} · {money(s.payCurrency, 1)} = ₪{shekkRate(s.payCurrency).toFixed(3)} at the Shekk
              rate
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setSetting("payCurrency", c.code)}
                  className={`tap rounded-xl px-2 py-2.5 text-sm font-semibold ${
                    s.payCurrency === c.code ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <span className="mr-1">{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Balance reference: {refIn(s.payCurrency, state.balance)} — shown for reference; your balance stays in
              shekels.
            </p>
          </div>

          <Divider />
          <Toggle
            label="Auto top up"
            hint={`Add money automatically when your balance drops below ${ils(s.autoTopUpFloor)}`}
            checked={s.autoTopUp}
            onChange={(v) => setSetting("autoTopUp", v)}
          />
          {s.autoTopUp ? (
            <div className="border-t border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top up when below</p>
              <div className="mt-2 flex gap-2">
                {[50, 100, 200].map((f) => (
                  <button
                    key={f}
                    onClick={() => setSetting("autoTopUpFloor", f)}
                    className={`tap flex-1 rounded-xl py-2 text-sm font-semibold ${
                      s.autoTopUpFloor === f ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    {ils(f)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Divider />
          <Toggle
            label="Hide balance on home"
            hint="Blur your balance until you tap it"
            checked={s.hideBalance}
            onChange={(v) => setSetting("hideBalance", v)}
          />
          <Divider />
          <RowLink to="/topup" label="Payment methods" hint="•••• 4417 · Visa" />
        </Section>

        {/* Appearance */}
        <Section Icon={Palette} title="Appearance">
          <div className="p-4">
            <p className="text-sm font-semibold">Theme</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  { id: "light", label: "Light", Icon: Sun },
                  { id: "dark", label: "Dark", Icon: Moon },
                  { id: "system", label: "System", Icon: MonitorSmartphone },
                ] as { id: ThemePref; label: string; Icon: typeof Sun }[]
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSetting("theme", id)}
                  className={`tap flex flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold ${
                    s.theme === id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <Toggle
            label="Reduce motion"
            hint="Turn off tile animations and card bounce"
            checked={s.reduceMotion}
            onChange={(v) => setSetting("reduceMotion", v)}
          />
          <Divider />
          <Toggle
            label="Haptic feedback"
            hint="A tap on every confirm and tile press"
            checked={s.hapticFeedback}
            onChange={(v) => setSetting("hapticFeedback", v)}
          />
        </Section>

        {/* Notifications */}
        <Section Icon={Bell} title="Notifications">
          <Toggle
            label="Split requests"
            hint="When a friend asks you to split a bill"
            checked={s.notifSplits}
            onChange={(v) => setSetting("notifSplits", v)}
          />
          <Divider />
          <Toggle
            label="Spend receipts"
            hint="A line every time money leaves your balance"
            checked={s.notifReceipts}
            onChange={(v) => setSetting("notifReceipts", v)}
          />
          <Divider />
          <Toggle
            label="Deals near me"
            hint="Student discounts at partner places in your city"
            checked={s.notifDeals}
            onChange={(v) => setSetting("notifDeals", v)}
          />
          <Divider />
          <Toggle
            label="Re-verification reminders"
            hint="Annual ID check — email plus in-app countdown"
            checked={s.notifReverify}
            onChange={(v) => setSetting("notifReverify", v)}
          />
          <Divider />
          <Toggle
            label="Shabbat & chagim quiet mode"
            hint="Nothing buzzes from candle-lighting until havdalah"
            checked={s.shabbatQuiet}
            onChange={(v) => setSetting("shabbatQuiet", v)}
          />
        </Section>

        {/* Security */}
        <Section Icon={ShieldCheck} title="Security">
          <Toggle
            label="Face ID to pay"
            hint="Confirm every payment with Face ID"
            checked={s.faceIdOnPay}
            onChange={(v) => setSetting("faceIdOnPay", v)}
          />
          <Divider />
          <div className="p-4">
            <p className="text-sm font-semibold">Extra confirmation above</p>
            <div className="mt-2 flex gap-2">
              {[null, 100, 200, 500].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setSetting("confirmOver", v)}
                  className={`tap flex-1 rounded-xl py-2 text-sm font-semibold ${
                    s.confirmOver === v ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {v === null ? "Off" : ils(v)}
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <Toggle
            label="Discoverable by friend code"
            hint="Let group friends find you to send Shekk"
            checked={s.discoverable}
            onChange={(v) => setSetting("discoverable", v)}
          />
          <Divider />
          <Toggle
            label="Show my photo to merchants"
            hint="Helps staff match your QR at the counter"
            checked={s.showPhotoToMerchants}
            onChange={(v) => setSetting("showPhotoToMerchants", v)}
          />
          <Divider />
          <Toggle
            label="Activity feed"
            hint="Opt in to the lightweight friends feed"
            checked={state.feedOptIn}
            onChange={setFeedOptIn}
          />
        </Section>

        {/* Region */}
        <Section Icon={Globe2} title="Region & language">
          <div className="p-4">
            <p className="text-sm font-semibold">Home city</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Sets weather, transit and Shabbat times.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSetting("homeCity", c)}
                  className={`tap rounded-full px-3 py-1.5 text-xs font-semibold ${
                    s.homeCity === c ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <div className="p-4">
            <p className="text-sm font-semibold">App language</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Default language for every screen. Hebrew switches the app to right-to-left.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { id: "en", label: "English", note: "" },
                  { id: "he", label: "עברית", note: "Hebrew" },
                  { id: "es", label: "Español", note: "Spanish" },
                  { id: "fr", label: "Français", note: "French" },
                  { id: "ru", label: "Русский", note: "Russian" },
                ] as { id: SettingsShape["appLanguage"]; label: string; note: string }[]
              ).map(({ id, label, note }) => (
                <button
                  key={id}
                  onClick={() => setSetting("appLanguage", id)}
                  className={`tap rounded-full px-3 py-1.5 text-xs font-semibold ${
                    s.appLanguage === id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                  title={note}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <div className="p-4">
            <p className="text-sm font-semibold">Hebrew slang in English copy</p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  { id: "en", label: "Plain English" },
                  { id: "en-heb", label: "English + Hebrew terms" },
                ] as { id: SettingsShape["language"]; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSetting("language", id)}
                  className={`tap flex-1 rounded-xl py-2 text-xs font-semibold ${
                    s.language === id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Divider />
          <Toggle
            label="Show Hebrew dates"
            hint="Sedra and Hebrew date on your For You tiles"
            checked={s.hebrewDates}
            onChange={(v) => setSetting("hebrewDates", v)}
          />
        </Section>

        {/* Legal & account */}
        <Section Icon={FileText} title="Legal & account">
          <RowLink to="/terms" label="Terms & Conditions" hint="Credit terms" />
          <RowLink to="/me" label="Account & verification" hint="Your info" />
          <RowLink to="/help" label="Help & support" hint="24/7 chat" />
          <button
            onClick={resetSettings}
            className="tap-flat flex w-full items-center gap-3 border-t border-border p-4 text-left"
          >
            <RotateCcw className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-semibold">Reset settings to default</span>
          </button>
          <button
            onClick={() => void signOut()}
            className="tap-flat flex w-full items-center gap-3 border-t border-border p-4 text-left"
          >
            <LogOut className="size-5 text-destructive" />
            <span className="flex-1 text-sm font-semibold text-destructive">Sign out</span>
          </button>
        </Section>

        <p className="px-1 pb-2 text-center text-[11px] text-muted-foreground">
          Shekk balances are held in shekels. See the Terms & Conditions for the full credit terms.
        </p>
      </div>
    </AppShell>
  );
}

function Section({
  Icon,
  title,
  note,
  children,
}: {
  Icon: typeof Bell;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className="size-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      {note ? <p className="mb-2 px-1 text-xs text-muted-foreground">{note}</p> : null}
      <Card className="p-0">{children}</Card>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border" />;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="tap-flat flex w-full items-center gap-3 p-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-card shadow-card transition-all ${
            checked ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function RowLink({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link to={to} className="tap-flat flex items-center gap-3 border-b border-border p-4 last:border-0">
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
