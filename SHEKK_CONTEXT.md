# Shekk — product context

This is the durable "what Shekk is and why" document. Implementation status
belongs in [`CURRENT_STATE.md`](./CURRENT_STATE.md); settled product/UX
decisions belong in [`PRODUCT_DECISIONS.md`](./PRODUCT_DECISIONS.md).

## Product identity

Shekk is a student companion and platform for young people spending a year in
Israel, initially focused on international gap-year and programme students.

The core concept: **one place for your programme, your plans and everything
you need in Israel.**

The broader aspiration is for Shekk to become something like the operating
system for a student's year in Israel — the app they open before arrival and
keep using throughout the year. Treat that as a useful way to describe the
ambition, not as a locked marketing tagline.

Shekk is **not** currently a banking app, payment wallet, QR-payment product,
or an Alipay/Cash App clone. That was an earlier stage of the project (see
"Product strategy" below).

## Audience

Initially:

- International gap-year and programme students in Israel
- Especially English-speaking students, from markets like the UK and US
- Yeshiva, seminary, gap-year and other year-programme contexts are important
  initial markets

This is a starting point, not a permanent ceiling — the product itself isn't
built to be specific to one religious demographic, and the long-term audience
can broaden as it grows.

## Product strategy: how this evolved

The original Shekk concept was payment-first: closed-loop shekel credits,
top-ups, QR payments, merchant acceptance, KYC, banking-style features. A
meaningful amount of that work exists in the codebase and is not necessarily
throwaway.

The strategic change: **banking and financial services are now a later major
product/revenue layer, not the launch wedge.** The priority is establishing
student utility, programme adoption, trust and daily usage first. The
financial work is preserved, not deleted, and can be switched back on
deliberately later — see `PRODUCT_DECISIONS.md`.

## Main product pillars

- **Programme experience** — a student's connection to their specific
  programme (schedule, announcements, checklist, staff contacts)
- **Home / "For You"** — a personalised entry point into the rest of the app
- **Getting Around** — transit, maps, navigating Israel
- **What's On** — discovering events and activities
- **Explore / mini-app ecosystem** — the broader library of utilities and
  services
- **Arrival/setup essentials** — the practical things to sort before and
  after landing (eSIM, insurance, visa, documents)
- **Health** — insurance card, clinics, emergency info
- **Useful local services** — housing, shops, community/shul finder, and
  similar
- **Passport / discovery** — a gamified way to explore Israel
- **Financial services** — later, once the above is established

## Company

Shekk operates as **Shekk Ltd**, incorporated in the UK. Beyond that basic
fact, don't assume or state company details (registration numbers,
ownership/cap table, funding, signed partnerships, or revenue figures) —
none of that is established in this document, and it shouldn't be invented
or inferred elsewhere either.

## Business model

Shekk is intended to be free or highly accessible to students initially, with
revenue developing through partner services and, later, financial products.
These are **product/business directions being pursued, not necessarily
already-live revenue or signed contracts** — check `CURRENT_STATE.md` before
assuming any specific integration is earning revenue today.

Potential early revenue streams:

- eSIM / mobile connectivity commissions
- Ticketing and activities commissions
- Selected travel/service referrals
- Insurance referrals, where appropriate and properly licensed
- Other relevant partner services

Longer term, financial services and banking-related products may become a
major revenue layer.

## Programme relationship principle

This matters a lot: **Shekk should complement programmes, not disintermediate
them.**

Programmes often already provide or arrange services for their students — for
example, insurance is frequently included or arranged by the programme, and a
programme may derive some of its own funding from that arrangement. Shekk
should not simply redirect a programme's students to a competing service
without regard for what the programme already provides.

The intended direction:

- Understand what a given programme already provides
- Respect programme-provided cover/services rather than routing around them
- Support programme-approved service configurations
- Refer students to appropriate, properly licensed providers where relevant
- Potentially share partner economics with programmes, where commercially and
  legally appropriate

Any insurance or financial referral/commission arrangement needs proper
legal and regulatory consideration before implementation — do not assume one
is already agreed or signed.
