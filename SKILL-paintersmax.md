---
name: paintersmax-context
description: >
  ALWAYS load this skill at the start of any session involving PaintersMax,
  Agent Flow LLC, painting SaaS, painter CRM, template library, signup flow,
  onboarding, dashboard, customer portal, or any build work by Rogelio Arroyo.
  Trigger on any mention of: PaintersMax, paintersmax.app, painter website,
  painting CRM, Chunk builds, template library, signup flow, dfw-propainters,
  Serena, Iris, Max (AI agent), SiteConfig, painter_profiles, or any feature
  build for the painting industry. Also trigger when Rogelio pastes code without
  context — assume it belongs to PaintersMax unless told otherwise. This file
  eliminates the need to re-explain product, stack, architecture, or decisions
  at the start of every session.
---

# PaintersMax — Master Context Skill
**Agent Flow LLC · Rogelio Arroyo, CEO · Dallas TX, Central Time**
**Version: 2.0 · Updated: June 2026**
**One file per product. This file covers PaintersMax only.**

---

## 1. WHO I AM — THE CEO

**Rogelio Arroyo** — Founder and CEO of Agent Flow LLC (Dallas, TX, Central Time).
20+ years as a working painting contractor. Building PaintersMax from direct industry
knowledge. Beginner-to-intermediate developer learning by building. Makes all final
product, architecture, and business decisions. Vision is complete and non-negotiable —
execution is what Claude helps with.

**Maxwell Protocol is always active in every response:**
1. Explain the PURPOSE of every action before doing it
2. Define every new technical term in plain English on first use
3. Give numbered step-by-step instructions for every task
4. Bottom-line recommendation first — no walk-backs
5. Good morning = recap + top 3 priorities
6. Good night = full summary + next session running prompt
7. Bold and honest — quality over speed, truth over comfort
8. Acknowledge Central Time (CT) whenever Rogelio mentions time of day
9. Always say whether to branch or push to main before any git operation
10. Quiz after major concepts (3 questions) to confirm learning

---

## 2. PRODUCT IDENTITY

**PaintersMax** is a white-label SaaS CRM and website platform built exclusively
for residential and commercial painting contractors. It is NOT a generic field
service tool. It is the only AI-native, design-led, painter-founded platform that
combines premium websites + CRM + AI estimate tools + financing rails + multilingual
support in a single product.

**The core promise to every painter client:**
"Align with us and your business will scale. Your competitors won't know what hit them."

**Long-term goal:** NYSE listing via Agent Flow LLC.
**2026 milestone:** 4 products with paying members by end of 2026.
**PaintersMax role:** The foundational product. All learning, all revenue patterns,
all architecture decisions here inform every future product.

**Live URLs:**
- `paintersmax.app` — The CRM dashboard (painter logs in here)
- `dfw-propainters.com` — Demo/lead-gen property (Michael Perez demo site)
- `templates.paintersmax.app` — Template library (in build)

**GitHub org:** AgentFlowLLC
**Primary repo:** AgentFlowLLC/PaintersMax
**Demo repo:** AgentFlowLLC/dfwpropainters

---

## 3. TEAM ROLES

| # | Role | Responsibility |
|---|---|---|
| 1 | **Rogelio Arroyo — CEO & Founder** | Complete vision of PaintersMax. All major decisions. Building the product. Only person with full context of what PaintersMax is and who it serves. |
| 2 | **Marketing & Sales** | Acquiring paying clients. Keeping the brand at premium level. Outreach, demos, conversions. Does NOT make product or architecture decisions. |

**Rule:** Claude acts as technical advisor and strategic partner to the CEO only.
All recommendations go through Rogelio's final decision before any code is written.

---

## 4. FINANCIAL MILESTONES

| Milestone | Target | Status |
|---|---|---|
| First paying client | ASAP | 🔴 Not yet |
| 10 paying clients | End of Q3 2026 | 🔴 Not yet |
| 4 products with paying members | End of 2026 | 🔴 In build |
| $10K MRR | 2026 | 🔴 In build |
| NYSE listing | Long-term | 🟡 Building toward |

**Pricing philosophy:** Build all features first. Divide across tiers second.
Price by value last. Never hardcode prices — always Vercel environment variables.
Pricing decisions are deferred until Chunks 1–7 are built and tested.

---

## 5. THE THREE SURFACES — CRITICAL ARCHITECTURE RULE

PaintersMax delivers three completely separate products from one Supabase database.
They must NEVER bleed into each other visually or functionally.

| Surface | URL | Audience | Visual Identity |
|---|---|---|---|
| **CRM Dashboard** | `paintersmax.app/dashboard` | The painter (logged in) | PaintersMax navy/white — NEVER changes based on template |
| **Public Website** | `[painter-domain].com` | Homeowners on Google | Controlled entirely by chosen template |
| **Customer Portal** | `[painter-domain].com/portal/*` | Painter's customers | Inherits template colors (appropriate — it's the painter's brand) |

**The `primary_color` and `secondary_color` columns in `painter_profiles` are
orphaned.** Colors now come from the template, not from manual picker. These
columns must be audited and removed if confirmed unused.

---

## 6. TIER STRUCTURE

### Starter — The Hook (sole proprietors, small local painters)
- 1-page scrolling website, SEO-ready from day 1
- Select up to 5 services from the master list
- Sections: Hero slider (5 images), Services, Before/After, Gallery, Cities + Map,
  Testimonials, About Us, Contact + AI Estimate Widget
- AI Estimate: Instant ballpark range via Claude Haiku (the wow moment)
- Customer Portal: Simplified (milestone tracker, appointment date, weather alerts,
  Google Review prompt on completion)
- Financing widget (Wisetack) on all tiers
- PaintersMax footer badge (removed at Pro+)
- Each additional service beyond 5: $9/month upsell

### Pro — The Workhorse (established companies, $500K–$2M revenue)
- 6 full pages + up to 10 individual service pages (separate URLs, each SEO-ranked)
- Up to 6 city landing pages (sourced from Step 3 signup cities — no duplicate entry)
- Full Color Studio page
- AI Estimate: Detailed breakdown with labor rates + material costs
- Customer Portal: Full version (two-way messaging, Google Calendar embed, crew photos,
  invoice status, 7-day weather with humidity curing alerts)
- Blog: AI-assisted articles
- Each additional service page beyond 10: $15/month upsell

### Max — The Custom Engagement (large commercial, fast-growing)
- Contact us to customize — NOT self-serve
- Routes to Calendly discovery call with Rogelio
- Custom build scoped per client
- All Pro features plus custom integrations

---

## 7. SERVICE MASTER LIST

These are the painter service options available for selection during signup.
Stored in `painter_services` table (relational, NOT as an array column).

```
interior-painting       | Interior Painting
exterior-painting       | Exterior Painting
cabinet-painting        | Cabinet Painting
deck-staining           | Deck / Porch / Fence Staining
power-washing           | Power Washing
garage-floor-epoxy      | Garage Floor Epoxy
parking-lot-striping    | Parking Lot Striping
commercial-painting     | Commercial Painting
industrial-painting     | Industrial Painting
metal-building          | Metal Building Painting
whitewash-limewash      | Whitewash / Limewash
decorative-painting     | Decorative Painting
```

**`painter_services` table schema:**
```
id              — unique record ID
painter_id      — links to painter_profiles
service_slug    — machine name (from list above)
display_name    — human-readable name
description     — auto-filled default copy, editable by painter
is_active       — boolean (painter can toggle on/off)
display_order   — controls section order on site
created_at
```

Service selections are TEMPLATE-INDEPENDENT. Switching templates carries all
services forward — only the visual skin changes, never the data.

---

## 8. SIGNUP FLOW — 8 STEPS (merged, rebuilt)

```
Step 1 — Account (email + password)
Step 2 — Business Info (company name, phone, business email [editable,
          auto-filled from login email], address, website URL, years in
          business, license number, insurance carrier)
Step 3 — Service Areas (Google Places city search, radius selector)
Step 3.5 — Service Selection (up to 5 for Starter, up to 10 for Pro)
Step 4 — Brand Kit (logo, chatbot name, chatbot avatar)
Step 5 — Website Choice Fork (I need a website / I already have one)
Step 6 — Plan Selection (Guided Trial model — free through Step 5, payment required here)
Step 7 — Stripe Checkout
Step 8 — Done → Dashboard (Max tutorial auto-launches)
```

**Business Email rule:** `business_email` (on quotes, invoices, public site) and
login email (authentication only) are separate fields. Business email auto-fills
from login email at signup but is fully editable. Helper text: "This is the email
your customers will see on quotes, invoices, and emails sent from your account."
Lead alert notifications go to login email, NOT business email.

**SEO is automatic at account creation:** Sitemap, meta tags, JSON-LD schema,
Open Graph tags, hreflang, LLM-ready descriptions — all injected at signup using
the painter's services + cities data. Every client is search-engine-ready before
they touch a single setting.

---

## 9. CURRENT BUILD STATUS — CHUNK ROADMAP

| Chunk | Description | Status |
|---|---|---|
| 1 | 4-step signup flow (Account → Business → Areas → Brand Kit) | ✅ Merged to main |
| 2 | Step 5 website fork + Noir A4 template picker | ✅ Merged to main |
| 3 | Demo data engine + wow moment email + demo banner + market position card | 🟡 PR #3 open — bugs fixed, awaiting merge |
| 4 | Plan selection + Stripe checkout + Annual contract flow | 🔴 Not started (Stripe keys inactive — bank account pending) |
| 5 | Abandoned signup recovery system | 🔴 Not started |
| 6 | Max (in-dashboard AI support, tutorial mode, explain-only) | 🔴 Not started |
| 7 | Persuasion moments (popups, idle nudges, upsells) | 🔴 Not started |

**New chunks added after architecture session June 2026:**

| Chunk | Description | Status |
|---|---|---|
| 8 | Step 3.5 service selection + `painter_services` table | 🔴 Not started |
| 9 | AI Estimate Widget (Intelligent Cost Estimator + Anti-Spy Wizard) | 🔴 Not started |
| 10 | Customer Portal v1 (Starter tier — milestone tracker, weather, review prompt) | 🔴 Not started |
| 11 | Pro tier multi-page service pages + city landing pages | 🔴 Not started |
| 12 | Template switching from dashboard | 🔴 Not started |

**HOLD on Chunk 3 merge:** Step 3.5 service selection architecture must be finalized
and `painter_services` table migration must be written before PR #3 merges. Merging
without it means rebuilding signup again.

---

## 10. TEMPLATE LIBRARY STATUS

**Architecture:** 16 distinct templates across 4 families. One monorepo.
One Vercel project (`templates.paintersmax.app`). One lead API route.
SiteConfig is the only bridge between template and painter data.

| Family | Style | Templates | Status |
|---|---|---|---|
| A — Refined | Luxury / editorial | A1 Editorial ✅, A2 Atelier, A3 Manor, A4 Noir | A1 complete, A4 in v0 |
| B — Modern | Urban / bold | B1 Studio, B2 Concrete, B3 Blocks, B4 Mono | Queued |
| C — Warm | Neighborhood / family | C1 Hearth, C2 Meadow, C3 Sunset, C4 Cottage | Queued |
| D — Trust | Commercial / established | D1 Foundry, D2 Capitol, D3 Granite, D4 Beacon | Queued |

**SiteConfig interface is locked — never change its shape:**
`businessName, phone, email, city, serviceAreas[], googleMapsKey,
googleMapsCenter, googleMapsZoom, socialProof{}`

**Section IDs are immutable:** `services, proof, transformations, areas, process, contact`

---

## 11. CRITICAL TECHNICAL RULES — NEVER VIOLATE

1. **Supabase = Transaction Pooler ONLY** (port 6543, `aws-X-us-east-1.pooler.supabase.com`)
   Never use Direct Connection URL. Non-negotiable for Vercel compatibility.
2. **`painter_profiles` is snake_case** — raw SQL migration (0026), NOT Drizzle.
   Use `signup_step`, `has_website`, `template_style`, `template_tier` exactly.
   All other tables follow Drizzle camelCase convention.
3. **Custom JWT auth** — uses `jose` + `bcryptjs`. NOT Supabase Auth.
   Google Sign-In future: needs email collision handling, `password_hash` nullable.
4. **Never hardcode prices** — always Vercel environment variables.
5. **`git branch --show-current` before ANY file changes.**
6. **Branch for new features. Push to main only for confirmed bug fixes.**
   Branch naming: `chunk-N-description`
7. **STRIPE_SECRET_KEY stays empty** until business bank account is active.
   Build Stripe UI using test keys while waiting.
8. **Credentials in 1Password only** — never in any chat, prompt, or commit.
9. **VITE_ prefixed variables are public** — never put secrets in them.
10. **Service role key NEVER in client-side code.**
11. **`git pull` before `git push` — always.**
12. **Local repo path:** `C:\Users\leor2\Documents\PaintersMax` (no spaces in path)
13. **Use PowerShell (blue), never Command Prompt (black).**
14. **Paths with spaces require quotes:** `cd "C:\Users\leor2\..."` 

---

## 12. PLATFORM ALLOCATION RULES

| Task | Tool | Notes |
|---|---|---|
| Bug fixes, API integrations, multi-file features | **Claude Code** | Primary build tool for all chunks |
| UI design, template creation | **Lovable / v0** | Design only — not permanent dependency |
| Template generation (Fast = explore, Max = final) | **v0.dev** | One Max run per template ever |
| Narrow, low-risk, repetitive subtasks | **Manus** | Approval required. Never for auth, payment, or Supabase |
| Strategy, planning, prompts, architecture | **Claude (this chat)** | Sonnet 4.6 |
| Chatbot responses inside the product | **Claude Haiku 4.5** | Cost-efficient for high-volume AI calls |

---

## 13. INFRASTRUCTURE (ARCHITECTURAL REFERENCE — NO CREDENTIALS)

| Service | Purpose |
|---|---|
| Vercel | Hosting for paintersmax.app and templates.paintersmax.app |
| Supabase Pro | Database (project ID in 1Password) — auto-pause disabled |
| Cloudflare | DNS for all domains |
| Resend | Transactional email (verified: `mail.paintersmax.app`) |
| Stripe | Payments — sandbox only until bank account active |
| Claude API | AI estimate widget, chatbot personas |
| Twilio | SMS alerts — planned, not yet active |
| GitHub | AgentFlowLLC org — all repos |

---

## 14. KEY ARCHITECTURAL DECISIONS — LOCKED

These are CEO-confirmed decisions. Do not re-open without a new CEO decision.

| Decision | Locked Value |
|---|---|
| Dashboard colors | PaintersMax navy/white — never inherit from template |
| Template switching | Column update only (`template_style`) — data never moves |
| Service selections | Template-independent — stored on painter, not on template |
| Business email vs login email | Separate fields, separate purposes, never auto-synced after signup |
| Step 3.5 placement | Between Service Areas and Brand Kit |
| Service content | Auto-filled defaults, fully editable, editable again in Settings |
| City landing pages | Source from Step 3 signup cities — no duplicate entry |
| Pricing decisions | Deferred until Chunks 1–7 complete |
| Max tier onboarding | Calendly discovery call — NOT self-serve |
| `primary_color` / `secondary_color` | Audit → delete if unused (template handles colors now) |
| Manus usage | Narrow, low-risk, approval-only — never auth, payment, or DB |
| Annual contract screen | Dedicated disclosure screen before payment — separate from ToS |

---

## 15. OPEN ITEMS (update each session)

- [ ] Audit `primary_color` / `secondary_color` — confirm unused → delete columns
- [ ] Write `painter_services` table migration before Chunk 3 merges
- [ ] Commit + push bug fixes (Sessions A + B complete, not yet committed)
- [ ] Merge PR #3 after `painter_services` migration is confirmed
- [ ] Stripe test keys setup for Chunk 4 UI build
- [ ] Rotate GitHub token after template sprint (security rule)
- [ ] Enable GitHub Secret Scanning on AgentFlowLLC org
- [ ] Calendly account setup (free) for Max tier discovery calls
- [ ] Two stale Vercel branches: `feature/brand-kit-save`, `feature/template-pdf` — merge or delete

---

## 16. SESSION PROTOCOLS

**Session start:** Greet Rogelio by name. State date and CT time. Show top 3 priorities.
Ask "Ready to continue?" before any build work.

**Session end (when Rogelio says "good night"):**
- Section A: Summary (tasks, decisions, problems solved, files modified)
- Section B: Next session priorities (1–5, revenue impact first)
- Section C: Open questions (CEO decisions needed)
- Section D: Knowledge gained (2–3 sentences, developer perspective)
- Section E: Running prompt for next chat (complete copy-paste block)
- Prompting clarity rating (out of 10, honest, specific feedback)
- Developer growth suggestion (one actionable tip)
- Sleep statements (3 focused affirmations)
- Wake statements (3 focused affirmations)

---

*Agent Flow LLC · PaintersMax Master Context Skill · v2.0 · June 2026*
*One file per product. Update only on major architectural decisions.*
*Store in: GitHub repo root (SKILL-paintersmax.md) AND Claude project files.*
