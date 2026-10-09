import { createFileRoute, Link } from "@tanstack/react-router";
import { FocusScreen } from "@/components/AppShell";
import { SITE_URL } from "@/lib/site";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions · Shekk" },
      {
        name: "description",
        content: "How your Shekk shekel account works, who provides it, eligibility criteria and how identity checks are handled.",
      },
      { property: "og:title", content: "Terms & Conditions · Shekk" },
      { property: "og:description", content: "Your Shekk account, who provides it, eligibility and identity checks." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `${SITE_URL}/terms` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
  component: Terms,
});

const SHORT = [
  "Shekk is a shekel spending account. You add money from your own card or bank in your home currency; it is converted to shekels at the rate shown before you confirm, with the conversion cost always displayed. Money is held with our regulated payment partner, Airwallex, not by Shekk.",
  "You must be 16 or over, verify your identity before spending, and use the account yourself — never for someone else. We check your identity again every 12 months. Unspent shekels can be returned to you on closure to a source in your own name.",
];

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. Who runs your account",
    p: [
      "Shekk is the app you use. The money side of Shekk is provided by Airwallex, a regulated payments institution that holds and moves the funds under its own licences and its own customer terms.",
      "Your shekel account is a real, regulated ILS payment account held with Airwallex — not app credits, tokens or a voucher. Opening it means entering an agreement with Airwallex as well as with Shekk, and you accept both when you open the account.",
      "Shekk does not hold your money, decide who is approved, or make regulatory decisions about your account. Airwallex does. Where these terms and the Airwallex customer terms differ on the money side, the Airwallex terms apply.",
    ],
  },
  {
    h: "2. Eligibility",
    p: [
      "You can only hold a Shekk account if you meet Airwallex's onboarding criteria as well as ours. At a minimum you must: be at least 16 years old; be a natural person opening the account for yourself; be resident in a country Airwallex supports for onboarding; hold valid government-issued identity documents; and not appear on any applicable sanctions list.",
      "Shekk accounts are for people coming to Israel from abroad. You cannot open an account if you are resident in Israel, and you cannot open one if you are resident in, or operating from, any country or territory Airwallex or applicable law restricts. Where you are aged 16 or 17, additional checks and lower limits apply and, where Airwallex or local law requires it, parental or guardian consent.",
      "Meeting these criteria does not guarantee an account. Airwallex can decline, delay, limit or close an account at its discretion or where the law requires it, and neither we nor Airwallex are obliged to give a reason.",
      "You must not use the account for any activity on Airwallex's prohibited-use list, including business use, gambling where restricted, virtual-asset trading, or handling money for anyone other than yourself.",
    ],
  },
  {
    h: "3. Identity checks are run by Airwallex",
    p: [
      "Shekk collects your details and documents and passes them to Airwallex. Airwallex performs the customer due diligence, sanctions and fraud screening, and makes the decision to approve, refuse or review your account.",
      "You must complete identity verification before you can spend. Until Airwallex approves your ILS account you may be able to sign in and browse Shekk, but you cannot add money, spend or be issued a card.",
      "Shekk cannot verify you itself, override a refusal, or promise a timescale. Where Airwallex asks for more information we will pass the request on to you; if you do not provide it, the account cannot be opened or kept open.",
      "We re-check your identity every 12 months. You will get an email and an in-app countdown with a clear deadline. Airwallex may also re-run checks at any time, or when a document expires. Until an outstanding request is resolved, the account may be limited.",
    ],
  },
  {
    h: "4. Adding money and currency conversion",
    p: [
      "You add money from a card or bank account in your own name, in a supported currency — GBP, USD, EUR, CAD, AUD or ZAR — and it is converted into new Israeli shekels and credited to your ILS account. Shekk holds one currency account for you: shekels.",
      "Before you confirm, the app shows the amount you pay, the reference rate, Shekk's conversion cost and the exact shekel amount you will receive. The rate shown at confirmation is the rate applied.",
      "Funds are received and held by Airwallex and safeguarded in line with the rules Airwallex is subject to. A payment account is not a savings product: it earns no interest and is not a deposit-insured bank deposit.",
      "We do not accept money from a card or account in someone else's name, and we do not accept cash.",
    ],
  },
  {
    h: "5. Spending, cards and transfers",
    p: [
      "You can spend your shekel balance in the app, with partner services inside Shekk, and — where issued to you — with a Shekk card. Card payments are authorised against your available balance.",
      "Payments are made from your own account. Where an amount is not final at the time of payment, such as a ride fare, the amount is held against your balance and settled at the final figure once confirmed; any difference is released back to you.",
      "Every movement appears in Activity with the merchant, category, amount and date.",
    ],
  },
  {
    h: "6. Limits, holds and account status",
    p: [
      "Balance, payment and transfer limits apply and may change; they are set by us and by Airwallex and can be adjusted for regulatory or risk reasons. Lower limits apply to accounts held by 16 and 17 year olds.",
      "Your account may be limited, frozen or closed where Airwallex requires it, where checks are outstanding, or where we suspect fraud, sanctions exposure or use by someone other than the account holder. While an account is limited you may be unable to add money or spend.",
    ],
  },
  {
    h: "7. Closing your account and getting unspent shekels back",
    p: [
      "You can ask us to close your account at any time, and we or Airwallex may close it in line with these terms.",
      "On closure, any unspent shekels are returned to you — to a bank account or card in your own name, after the checks the law requires. Funds are never sent to a third party. Where a return currency other than shekels is used, it is converted at the rate applying on the day and the conversion cost is shown.",
      "Shekels are not withdrawable to cash on demand while the account is open; the account is for spending in Israel.",
    ],
  },
  {
    h: "8. Your responsibilities",
    p: [
      "Keep your details accurate and tell us promptly if your name, address, residency status or identity documents change. Keep your sign-in and card details secure and report loss, theft or unrecognised activity to us immediately.",
      "The account is yours alone. Do not let anyone else use it, do not receive money for third parties through it, and do not use it for business or any prohibited activity.",
    ],
  },
  {
    h: "9. Support and disputes",
    p: [
      "Raise anything about a payment, a partner order or your balance with Shekk first. We will work with Airwallex and the merchant, and where a refund is due, the funds return to your shekel account.",
      "Report an error in a payment or a top-up as soon as you notice it. Where the Airwallex customer terms or applicable law give you additional rights over disputed or unauthorised payments, those rights apply and nothing here limits them.",
    ],
  },
];

function Terms() {
  return (
    <FocusScreen>
      <div className="min-h-screen sm:min-h-[860px]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <Link to="/me" className="tap rounded-full bg-muted p-2">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-semibold">Terms & Conditions</h1>
        </header>
        <div className="space-y-6 px-6 py-6 text-sm leading-relaxed">
          <p className="rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
            Maintained by Shekk to explain how the account works. The money side of Shekk is provided by Airwallex and the Airwallex customer terms apply alongside these. This is not legal advice and is not a substitute for either full agreement.
          </p>
          <section className="rounded-2xl border border-border p-4">
            <h2 className="mb-2 text-base font-semibold">The short version</h2>
            {SHORT.map((p, i) => (
              <p key={i} className="mb-2 text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="mb-2 text-base font-semibold">{s.h}</h2>
              {s.p.map((p, i) => (
                <p key={i} className="mb-2 text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <Link to="/me" className="tap block rounded-2xl bg-primary py-4 text-center font-semibold text-primary-foreground">
            Back to Me
          </Link>
        </div>
      </div>
    </FocusScreen>
  );
}
