# PaintersMax Signup Flow Architecture
**Agent Flow LLC · Confidential · Decided in Chat 7, June 2026**
**Status: Fully speced, ready to build. Build begins in Chat 8.**

---

## 1. THE CORE PROBLEM THIS SOLVES

Two disconnected signup systems existed simultaneously:
- `/signup` — 4-step flow (Account → Business → Plan → Done), worked but
  shallow, Subscribe button broken (empty STRIPE_SECRET_KEY)
- `/onboarding` — 6-step flow (Welcome → Business Info → Service Areas →
  Brand Kit → Plan redirect → dead end), richer fields, never connected
  to anything

No real prospect ever completed either flow successfully. This was
invisible until Rogelio walked through his own product as a test client
(tylerpainters@gmail.com) in Chat 7.

**Root lesson:** Before marketing any feature, walk it yourself from zero,
in incognito mode, as a stranger would.

---

## 2. THE FINAL MERGED FLOW — 8 STEPS

```
STEP 1 — Account (email + password)

STEP 2 — Business Info
  Company name, phone, business email, address, website URL (optional),
  years in business, license number, insurance carrier

STEP 3 — Service Areas
  City search (Google Places)
  Heading: "How far will you travel from each city?"
  Radius selector: 10 / 25 / 50 / 100 mi
  Explainer: "We'll create dedicated landing pages for cities within
  this range — helping you rank on Google in each one."
  Persuasion popup on completion: "Nice, [Name] — we'll build you N
  city landing pages for these areas. Each one is a new way homeowners
  find you on Google."

STEP 4 — Brand Kit
  Logo upload + chatbot name + chatbot avatar selection
  REMOVED: color picker / "Live Widget Preview" — colors now derive
  from whichever website template is chosen in Step 5 (eliminates the
  conflict between manually-picked colors and template-defined colors)

STEP 5 — Choose Your Website (fork)
  First question: "Do you already have a website?"

  PATH A — No website:
    → Template gallery (tier-gated: Starter sees limited set, Pro sees
      Family A+B, Agency sees all 16)
    → Live, populated preview rendered with their real business name,
      cities, logo — THIS is the core persuasion moment
    → Popup: "This is YOUR website, built in real time, [Name]. Ready
      to make it live?"

  PATH B — Has a website:
    → Choice: "Redesign my site" or "Keep my current site"

    PATH B1 — Redesign:
      → Same template gallery as Path A, copy changes to "Let's give
        your business an upgrade"
      → Upsell: Site Migration — one-time fee (price TBD, deferred
        until product is finished — see Section 6)

    PATH B2 — Keep current site:
      → Skip template selection entirely
      → Base offer: CRM-only access (Pipeline, Leads, Invoices,
        Schedule, Email Automation, etc.) — no PaintersMax website
      → Clear upsell shown: "Add a PaintersMax website too — capture
        leads two ways instead of one. +$[X]/mo" (two-storefront
        positioning, sold as an add-on, not bundled by default)
      → If they choose annual commitment for this path: dedicated
        disclosure screen required before payment (see Section 4)

STEP 6 — Choose Your Plan
  Mandatory to proceed (this is the "Guided Trial" model — Steps 1-5
  are free and unlock the persuasion moment; payment is required to
  reach the actual dashboard)
  Upsells surfaced here: chatbox upgrade, bid estimator for quotes
  Idle-timeout nudge (30+ sec on this screen): "Most painters book
  their first extra job within the first month — that alone covers a
  year of this." If they leave without paying, their progress + this
  context is saved for the abandoned-signup recovery flow (Section 5)

STEP 7 — Payment (Stripe Checkout)
  Redirects to Stripe hosted checkout
  Webhook on success → updates subscription_tier / subscription_status
  in Supabase → redirects back into PaintersMax

STEP 8 — Done → Dashboard
  Confirmation → straight into dashboard → Max's tutorial auto-launches
  (see Section 7)
```

`/onboarding` is deleted entirely (not merged-and-kept) once this ships,
with a redirect to `/signup` for any stray links. Low risk: confirmed
zero real prospects ever used it.

---

## 3. THE "GUIDED TRIAL" MODEL — WHY STEPS 1-5 ARE FREE

Painting contractors are not developers — they don't intuit software
value from a pricing table. The single most persuasive asset available
is letting them see THEIR OWN business, populated and rendered, before
asking for money. This out-performs any popup or sales copy.

**Demo data engine (Chunk 3) — design rules:**
- All sample data CLEARLY labeled "Sample Data" / "Demo Lead — not
  real" (trust requirement — never let it be mistaken for a real lead)
- Sample leads/invoices auto-generated from their OWN signup answers:
  their service types, their cities, their name used throughout
  ("John's Painting Co. — Interior job, Plano, TX")
  Invoice variety should span: interior painting, exterior painting,
  power washing, deck staining, garage floor epoxy
- One REAL email is sent during signup (a sample quote/invoice) — sent
  to their actual inbox, WITH a clear notice beforehand explaining
  what's about to happen and why ("we're about to send you a real
  sample email so you can see exactly what your future clients will
  receive")
- On conversion to paying customer: sample LEADS are wiped. Sample
  EMAIL TEMPLATES remain as editable starter content (not deleted) —
  this gives them a head start rather than an empty dashboard

---

## 4. ANNUAL CONTRACT STRUCTURE (Path B2 / CRM-only / any annual offer)

Approved structure — a dedicated, explicit confirmation screen, separate
from general Terms of Service, BEFORE payment:

```
"You're signing up for an Annual Plan"

- You'll be billed [$X/month or $X upfront] for 12 months
- This plan cannot be cancelled or refunded early
- You can upgrade anytime, but cannot downgrade or cancel until your
  12-month term ends
- Your renewal date will be [auto-calculated date]

[ ] I understand and agree to the 12-month commitment

[Continue to Payment →]
```

Rationale: DFW's painting contractor community is word-of-mouth driven
(confirmed in Operation Brushfire War Report). Total transparency on a
non-cancelable term converts a legal protection into a trust signal
rather than a hidden trap — critical for a brand-new platform with zero
market reputation yet.

---

## 5. ABANDONED SIGNUP RECOVERY (Chunk 5 — new feature, built from scratch)

- New Supabase table tracks incomplete signups: what step they reached,
  what data they entered, timestamp of last activity
- Multi-touch sequence: email day 1, email day 3, SMS day 7
- On return: "Welcome back, [Name]" — restores their saved progress
  rather than making them start over
- Captures prospects who stall for financial/timing reasons so they can
  be followed up with later, including flexible plan messaging (down
  payment matching their tier + setup + upsells)

---

## 6. PRICING — DELIBERATELY DEFERRED

Per Rogelio's explicit decision: no price tags are being attached to
migration fees, upsells, annual plans, or new tier structures until
the FIRST VERSION of the full signup system is built and tested. Adding
prices to an immature, still-changing product creates rework and
undervalues features that will gain significance as they're built out.
**Revisit pricing only after Chunk 1-7 are built and tested.**

---

## 7. MAX — IN-DASHBOARD SUPPORT AI (Chunk 6)

| Decision | Locked value |
|---|---|
| Name | Max |
| Personality | Warm-efficient, action-oriented, never cutesy |
| Avatar | Icon-based (stylized "M" or tool icon) — not a character/mascot |
| Location | Bottom-right floating button, dashboard-themed (dark navy) |
| Trigger | Auto-opens tutorial on first dashboard visit; on-demand after |
| Knowledge scope (Starter/Pro) | Explain-only — walks through steps, never takes actions |
| Action-taking | Future paid upgrade (Tier 2/3), priced as a standalone add-on line item, not bundled into a whole tier |

**Tutorial opener (first dashboard visit):**
```
👋 Hey, I'm Max — your PaintersMax guide.

I'll show you around your dashboard in about 2 minutes, then I'll be
right here in the corner anytime you need help — billing questions,
how-to's, anything.

[Let's go →]   [Skip for now]
```

---

## 8. THE 7-CHUNK BUILD ROADMAP

```
CHUNK 1 — Merged Signup Flow (Steps 1-4) + delete /onboarding
CHUNK 2 — Website Choice Fork + Template Picker (Noir A4 first)
CHUNK 3 — Demo Data Engine (personalized leads/invoices/calendar/crew)
CHUNK 4 — Plan Selection + Stripe Checkout + Annual Contract Flow
CHUNK 5 — Abandoned Signup Recovery System
CHUNK 6 — Max (tutorial mode + on-demand support, explain-only scope)
CHUNK 7 — Persuasion Moments (personalized popups, idle nudges, upsells)
```

**Tool assignment per chunk — Claude Code is primary for all 7.** Manus
remains available only for narrow, repetitive, low-risk sub-tasks
(e.g., mechanically configuring already-proven template patterns into
SiteConfig, or drafting follow-up email copy) — never for anything
touching auth, payment, or real Supabase data.

| Chunk | Primary tool | Manus allowed for |
|---|---|---|
| 1 | Claude Code | — |
| 2 | Claude Code | Repetitive template→SiteConfig configuration, once pattern proven |
| 3 | Claude Code | — |
| 4 | Claude Code | — (zero exceptions, this is payment) |
| 5 | Claude Code | Email/SMS copywriting only |
| 6 | Claude Code | — |
| 7 | Claude Code | Low-stakes practice chunk if desired |

---

## 9. KEY TECHNICAL RULES DISCOVERED IN CHAT 7 (apply going forward)

1. Windows folder names are case-insensitive — `PaintersMax-Templates`
   and `paintersmax-templates` are the SAME folder to Windows.
2. `.gitignore` can silently block entire folders even when `git push`
   reports success — always verify on GitHub.com after pushing.
3. Moving files in File Explorer, inside a git-tracked folder, registers
   as a DELETE to git. Use GitHub Desktop or `git mv` instead.
4. Always use PowerShell (blue icon), never Command Prompt (black) —
   different syntax causes silent failures.
5. Always verify a Vercel domain is connected to the CORRECT project —
   similarly-named projects in one team make this an easy mistake.

---

## 10. OPEN ITEMS NOT YET RESOLVED

- Noir A4 template exists but is sitting inside the ptemplate-demo1 v0
  project at `/noir` — needs extraction/export and configuration into
  the shared SiteConfig contract before real deployment
- `paintingpro.dev` domain purchased, in Vercel, not yet connected to
  any project
- STRIPE_SECRET_KEY empty — deferred until business bank account active
- Two stale Vercel feature branches (`feature/brand-kit-save`,
  `feature/template-pdf`) need a merge-or-delete decision

---

*Agent Flow LLC · Confidential · Reference document for Chat 8 build phase*
