# Digital Review AI (working name)

By **Banao Digital**

> The product name "Digital Review AI" is a **working name** and is expected to
> change before public launch. It is centralized in
> [`src/lib/config/branding.ts`](./src/lib/config/branding.ts) — update the
> `productName`, `productShortName`, `tagline`, and `parentBrand` fields there
> and the whole app (metadata, header, footer, auth screens) picks it up. The
> name is never hard-coded anywhere else in the codebase.

## Product overview

Digital Review AI helps local businesses collect genuine customer feedback
through a QR code, and helps customers turn their real experience into a
natural Google review draft.

**Product rule (non-negotiable, documented in code as well as here):** the
system must never fabricate a customer's experience, manipulate star
ratings, hide negative feedback, or selectively route only positive
customers to Google. Every rating from 1–5 stars gets the same path to
Google review; a business may additionally receive low-rating feedback
privately, but that is never a substitute for — or a gate in front of — the
public review option. This principle governs every module, and is what
Module 2's QR feedback flow is built around.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **React 19**
- **Tailwind CSS v4** (CSS-first theme, see `src/app/globals.css`)
- **Supabase** — Postgres database, Auth, and Row Level Security
- **@supabase/ssr** for cookie-based session handling across Server
  Components, Route Handlers, and the Next.js proxy (middleware)
- **`qrcode`** — client-side QR code image generation for the dashboard
- Anthropic API (optional, Module 2) — only used server-side, only if
  `AI_PROVIDER_API_KEY` is set, to lightly polish (never author) a review
  draft; see [AI Review Assistant](#ai-review-assistant-module-2) below

## Current functionality

### Module 1 — Foundation

- **Landing page** — hero, "how it works" (3 steps), feature placeholders,
  "why" section, trust/policy section, final CTA, footer. Fully responsive.
- **Authentication** — sign up, log in, log out, forgot password, reset
  password, session persistence, and protected routes, all via Supabase
  Auth. Email confirmation and password-recovery links are handled by
  `src/app/auth/callback/route.ts`.
- **Business account foundation** — a `businesses` table and a Business
  Profile page where the signed-in owner can create/edit their business
  name, category, phone, email, address, city, website, and Google review
  URL, with loading/success/error/validation states.
- **Dashboard shell** — header (business name, user menu, logout) and
  sidebar (Overview, Business Profile, QR Feedback — all functional;
  Analytics and Settings still visibly disabled and marked "Coming soon").
- **Admin foundation** — `/admin` route, protected server-side by checking
  `profiles.role === 'admin'` against the database (not just hiding a nav
  link), with a placeholder system-overview shell.
- **Configuration** — `.env.example` documents every variable, including
  placeholders for the future AI provider and payment provider keys.

### Module 2 — QR Feedback System

**Business side** (`/dashboard/qr-feedback`):
- Generates a unique feedback link + QR code per business, on demand
  (`getOrCreateFeedbackLink` server action). The link uses a random
  `public_code` (business-name slug + random suffix) — never the internal
  `businesses.id` or `feedback_links.id`.
- QR code is rendered client-side (`qrcode` package) from the full public
  URL and can be downloaded as a PNG.
- The link can be copied, and paused/resumed (`is_active` toggle) without
  losing its code or history.
- A status panel shows whether the AI Review Assistant is configured.

**Customer side** (`/feedback/[code]`, public, no login):
1. Business identity (name, category, city, logo) — resolved only through
   the `public.feedback_pages` view (see RLS section).
2. Star rating, 1–5.
3. Optional experience tags (`Service`, `Staff`, `Quality`, `Cleanliness`,
   `Value`, `Ambience`, `Speed` by default — stored per-business on
   `feedback_links.tags` so a future module can customize them).
4. Optional free-text feedback.
5. Optional AI-assisted draft — see below. The customer can edit it, or
   skip drafting entirely and submit their raw words instead.
6. Every submission is saved to `feedback_submissions` (private to the
   business) **and then** the customer sees the same "Post my review on
   Google" call-to-action *regardless of their star rating*. There is no
   code path that changes, hides, disables, or re-labels that button based
   on the rating value — the only thing that changes is whether it's
   shown at all, which depends solely on whether the business has
   configured a Google review URL.

#### AI Review Assistant (Module 2)

`src/lib/ai/reviewDraft.ts` is the single integration boundary:

- **No `AI_PROVIDER_API_KEY` set (default in this environment):** every
  draft is produced by a deterministic template that only concatenates the
  customer's own rating, selected tags, and message. No model call is
  made. This always works, out of the box.
- **`AI_PROVIDER_API_KEY` set to an Anthropic API key:** the same template
  draft is sent to the Anthropic Messages API with a system prompt that
  strictly forbids adding any fact, claim, experience, or detail not
  already present, and forbids changing the rating's sentiment — it may
  only improve grammar and flow. If the call fails for any reason, it
  silently falls back to the template so the customer flow never breaks.
- This key is **not set** in this environment, so only the template path
  has actually run here. The Anthropic call path is implemented and
  code-reviewed, but not live-tested end-to-end — see Known limitations.

#### Google review flow

No Google API integration exists, and none is claimed. "Google-safe" here
means: the business supplies their own Google review URL in their profile
(Module 1), and the public feedback page links straight to it as a plain
`<a href>` — the same link, the same button, shown identically for every
star rating. There is no rating-based branching anywhere in
`src/components/feedback/FeedbackFlow.tsx` or
`src/app/feedback/[code]/actions.ts` that would hide, delay, or alter that
link based on the customer's rating.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev
```

The app runs at http://localhost:3000.

## Environment variables

See [`.env.example`](./.env.example) for the full list with comments. In
short:

| Variable | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Module 1 | Safe to expose to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Module 1 | Safe to expose to the browser; RLS does the real enforcement |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used yet | Documented for future use; **never** import into client-reachable code |
| `AI_PROVIDER_API_KEY` | Optional, Module 2 | Anthropic API key; unset = deterministic template drafts only |
| `PAYMENT_PROVIDER_PUBLIC_KEY` / `PAYMENT_PROVIDER_SECRET_KEY` | Not used yet | Placeholder for Module 6 |

Never commit `.env`, `.env.local`, or any file with real secrets — `.gitignore`
already excludes `.env*` (with `.env.example` explicitly allowed).

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run, **in order**:
   [`0001_init.sql`](./supabase/migrations/0001_init.sql) →
   [`0002_qr_feedback.sql`](./supabase/migrations/0002_qr_feedback.sql) →
   [`0003_module2_hardening.sql`](./supabase/migrations/0003_module2_hardening.sql) →
   [`0004_module6_customer_intelligence.sql`](./supabase/migrations/0004_module6_customer_intelligence.sql).
   These create the schema, indexes, triggers, views, and RLS policies
   described below. If you use the Supabase CLI instead, `supabase db push`
   will apply all four, in filename order, from the `supabase/migrations` folder.
3. Copy your project URL and anon key from **Project Settings → API** into
   `.env.local`.
4. In **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` (and your production equivalent) as
   a redirect URL, so email confirmation and password-reset links work.
5. Email confirmation can be toggled in **Authentication → Providers →
   Email**. The signup flow handles both cases (confirmation on: shows a
   "check your inbox" message; confirmation off: signs the user straight
   in).
6. (Optional, Module 2) Set `AI_PROVIDER_API_KEY` to an Anthropic API key
   to enable AI-polished drafts. Leave it unset to use the always-available
   template drafts.

## Database schema

### Module 1

**`profiles`** — one row per authenticated user, created automatically by a
trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, unique, FK → `auth.users.id` | |
| `full_name` | text | |
| `email` | text | |
| `phone` | text | |
| `role` | enum `business_owner` \| `admin` | default `business_owner` |
| `created_at` / `updated_at` | timestamptz | `updated_at` auto-maintained by trigger |


**`businesses`** — one or more rows per owner (`owner_id`), the anchor for
QR codes, feedback, reviews, analytics, and subscriptions.

| Column | Type |
|---|---|
| `id` | uuid, PK |
| `owner_id` | uuid, FK → `auth.users.id` |
| `business_name` | text, required |
| `category`, `phone`, `email`, `address`, `city`, `website`, `google_review_url`, `logo_url` | text, optional |
| `created_at` / `updated_at` | timestamptz |

### Module 2

**`feedback_links`** — one row per business (unique on `business_id`);
holds the public identifier and per-business config for the QR/link.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | never exposed to customers |
| `business_id` | uuid, FK → `businesses.id`, unique | |
| `public_code` | text, unique | the only identifier customers/QR ever see; format-checked (`^[a-z0-9-]{6,64}$`) |
| `tags` | text[] | defaults to the 7-tag example set; per-business, ready for future customization |
| `is_active` | boolean | owner can pause/resume the public page |
| `created_at` / `updated_at` | timestamptz | |

**`feedback_submissions`** — every customer submission; this table *is* the
private feedback channel.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `business_id` | uuid, FK → `businesses.id` | |
| `feedback_link_id` | uuid, FK → `feedback_links.id`, nullable | |
| `rating` | smallint | CHECK 1–5 |
| `tags` | text[] | customer's selected tags |
| `message` | text, nullable | customer's free-text feedback |
| `ai_draft` | text, nullable | the generated draft before any customer edits |
| `final_draft` | text, nullable | what the customer actually submitted (their edit, or raw message if they skipped drafting) |
| `proceeded_to_google` | boolean | reserved for future self-reporting; not currently set by the client, and never used to gate anything |
| `created_at` | timestamptz | |

**`public.feedback_pages`** (view, not a table) — the only thing an
anonymous visitor can read business-wise: `public_code`, `tags`,
`is_active`, `business_name`, `category`, `city`, `logo_url`,
`google_review_url`. Deliberately excludes `business_id`, `owner_id`,
`phone`, `email`, `address`, `website`.

## Authentication

Supabase Auth (email + password) via `@supabase/ssr`:

- `src/lib/supabase/client.ts` — browser client (Client Components)
- `src/lib/supabase/server.ts` — server client (Server Components, Route
  Handlers), cookie-based
- `src/lib/supabase/middleware.ts` + `src/proxy.ts` — refreshes the session
  on every request and redirects unauthenticated requests away from
  `/dashboard` and `/admin`, and authenticated requests away from
  `/login`, `/signup`, `/forgot-password` (deliberately **not**
  `/reset-password`, since a password-recovery link signs the user in on
  the way to that page)

Every protected Server Component (`dashboard/layout.tsx`, `admin/layout.tsx`)
also re-checks `supabase.auth.getUser()` independently — defense in depth,
not just reliance on the proxy/middleware.

The public `/feedback/[code]` flow needs no authentication at all — that's
intentional; the customer never creates an account.

## RLS / security

**Module 1**
- RLS is enabled on both `profiles` and `businesses`.
- `profiles`: a user may `select`/`update` only the row where
  `user_id = auth.uid()`. No public insert policy exists — rows are only
  ever created by the `handle_new_user` trigger (`security definer`). No
  delete policy — user deletion goes through Supabase auth admin, not
  direct table access.
- `businesses`: an owner may `select`/`insert`/`update`/`delete` only rows
  where `owner_id = auth.uid()`. No policy grants access to anonymous or
  other authenticated users.

**Module 2**
- RLS is enabled on both `feedback_links` and `feedback_submissions`.
- `feedback_links`: owners fully manage (`select`/`insert`/`update`) only
  links belonging to a business they own. A second, narrow policy also
  lets `anon`/`authenticated` `select` rows where `is_active = true` —
  needed so a public_code can be resolved to a `business_id` server-side
  without ever trusting a client-supplied id. This only exposes link
  metadata (id, business_id, tags, is_active, timestamps), never business
  contact information.
- `feedback_submissions`: only the owning business can `select`. There is
  **no update or delete policy at all** — not even for the owner — so a
  submission can't be edited or removed after the fact by anyone through
  the API. `anon`/`authenticated` may `insert`, but only with a `WITH
  CHECK` that the row's `business_id`/`feedback_link_id` pair matches an
  **active** feedback link — enforced at the database layer, not just in
  the server action.
- `public.feedback_pages`: a view (not `security_invoker`) that exposes
  only `public_code`, `tags`, `is_active`, `business_name`, `category`,
  `city`, `logo_url`, `google_review_url` to `anon`/`authenticated`. It
  runs with the view owner's privileges against the RLS-protected
  `businesses`/`feedback_links` tables — the standard Supabase pattern for
  giving anon a safe, narrow read without any direct grant on the base
  tables. `businesses.phone`, `.email`, `.address`, `.website`, and
  `.owner_id` are unreachable through any public code path.

**Both modules**
- Admin read policies check the caller's **own** `profiles.role`, which
  cannot be spoofed from the client since it's read server-side from a
  row scoped by RLS to the caller.
- The Supabase **service role key is never used** anywhere in this
  codebase, client or server. It's documented in `.env.example` only so the
  pattern (and the warning not to expose it) is established ahead of time.
- `/admin` access is enforced server-side by querying `profiles.role`, not
  by hiding a nav item.
- Every server action that touches business-owned data
  (`src/app/dashboard/qr-feedback/actions.ts`) resolves the caller's
  business from their authenticated session server-side — it never trusts
  a business id passed in from the client. Every server action that
  touches public feedback (`src/app/feedback/[code]/actions.ts`) resolves
  the business purely from the `public_code`, again server-side.

## Testing performed

Ran and passing, from a fresh install, against this exact codebase:

| Check | Result |
|---|---|
| `npx tsc --noEmit` (type-check) | ✅ Pass, no errors |
| `npm run lint` (ESLint) | ✅ Pass, no warnings (including `react-hooks` rules) |
| `npm run build` (production build, Turbopack) | ✅ Pass — all 15 routes compiled, including `/feedback/[code]` |

Verified by code review against the spec (structure, RLS policy logic,
route/server-action authorization logic, form states):
- Module 1 flows as previously documented.
- Module 2: `getOrCreateFeedbackLink`/`setFeedbackLinkActive` resolve the
  business from the session, never from client input; `submitFeedback`/
  `generateDraft` resolve the business from `public_code` only, validate
  rating range and input sizes server-side, and always return
  `googleReviewUrl` independent of the rating value; the RLS policies above
  were traced by hand against "business A must not be able to read
  business B's `feedback_submissions`" and "anon must not be able to read
  any `feedback_submissions`" and both hold under the policies as written.

## Known limitations / what could not be tested

- **No live Supabase project has been used at any point in this project.**
  Every RLS/schema/query-pattern claim across all 6 modules has been
  verified against a local Postgres 16 instance built to mirror Supabase's
  role/grant/RLS conventions as closely as possible — not against actual
  Supabase infrastructure. Unverified: real Auth flows (signup → email
  confirmation → login, password reset round-trip), Realtime, Storage,
  and any project-level configuration behavior.
- **No browser/screenshot tool has been available at any point** — no
  visual, click-through, or true cross-device responsiveness testing for
  any page in the app, including all of Module 6's new dashboard and
  public pages.
- **AI paths have never run against a real key.** The Anthropic polish
  path in `reviewDraft.ts` (Module 2/3), the Google Places lookup in
  `placesLookup.ts` (Module 4), and the AI Business Advisor narrative in
  `customerVoiceEnhancer.ts` (Module 6) have only ever executed their
  "not configured" fail-closed branches — `AI_PROVIDER_API_KEY` and
  `GOOGLE_PLACES_API_KEY` are both unset in this environment.
- **Customer Intelligence (Module 6) is deterministic-only in practice.**
  The architecture supports AI enhancement (see
  `src/lib/ai/customerVoiceEnhancer.ts`), but only the rule-based engines
  have actually run. Free-text topic clustering for demand signals beyond
  the fixed reason enum (`classifyDemandTopics`) is an intentionally
  unimplemented stub, not a shortcut — implementing it without real NLP
  would risk exactly the fabrication the product rules forbid.
- **Customer Pulse duplicate-vote prevention is best-effort only**
  (client-side `localStorage`, per spec's "where practical") — a different
  browser, device, or cleared cache can vote again. This is documented in
  the UI code, not hidden.
- **Analytics/Intelligence scans are capped**, not true database
  aggregates (2,000–3,000 most-recent rows depending on the page) — fine
  at current scale, would need a materialized view or scheduled rollup for
  a high-volume business.
- **`feedback_links.tags`** can now be edited from `/dashboard/qr-feedback`
  (added during Module 2 hardening) — this is no longer a limitation, but
  is called out here since an earlier version of this README said
  otherwise.
- Once you have Supabase credentials, the fastest way to close the biggest
  gap is: `npm install && npm run dev`, run all four migrations in order,
  then walk through signup → business profile → QR Feedback → generate
  link → submit feedback at a few different ratings (including the
  optional unmet-demand question) → check `/dashboard/intelligence` and
  `/dashboard/feedback` reflect it → create a Customer Pulse poll and vote
  on it from `/pulse/[code]` in another browser/incognito tab.

## Module roadmap

- **Module 1** — Foundation + Authentication + Business Profile ✅ complete
- **Module 2** — QR Feedback System ✅ complete
- **Module 3** — Customer Feedback Inbox + AI Review Assistant tone options ✅ complete
- **Module 4** — Google review URL validation, test-link, and Places lookup
  integration boundary (gracefully degrades when unconfigured) ✅ complete
- **Module 5** — Business Dashboard + Analytics (rating distribution, weekly
  trend, per-tag breakdown) ✅ complete
- **Module 6** — Customer Intelligence + Customer Pulse ✅ complete *(this module)*
- **Module 7+** — not yet planned

## MODULE 6 STATUS: COMPLETE

Modules 1–5 are preserved and still build/lint/type-check cleanly, with all
regressions re-verified against a local Postgres instance after this
module's changes.

Module 6 adds a deterministic (zero-AI-required) Customer Intelligence
engine — `src/lib/insights/*` — that turns real `feedback_submissions` and
a new `unmet_demand_reports` table into evidence-grounded insights
(love/attention/frustration/request/stock/repeat-intent), a transparent
Customer Experience Score, and a rule-based Business Advisor that produces
prioritized, traceable recommendations. Every insight and recommendation
carries a real, computed `evidence.count` — never a number an AI model
supplied. A clearly-separated, optional AI layer
(`src/lib/ai/customerVoiceEnhancer.ts`) can add narrative polish on top of
the same evidence when `AI_PROVIDER_API_KEY` is configured; it has no way
to fabricate a count because it never receives write access to the
evidence pipeline, only already-computed data to summarize.

Also new: **Customer Pulse** (`customer_pulse_polls` /
`customer_pulse_responses`), a fully independent one-question-poll feature
with its own public voting flow at `/pulse/[code]`, and an optional "was
there anything you wanted today but couldn't find?" question added to the
existing public feedback flow, feeding `unmet_demand_reports`.

**Testing performed:** all 5 insight modules were executed directly via
Node (not simulated) against 71 crafted test assertions covering normal,
edge, empty, and low-signal cases — 1 genuine bug was found this way (an
Experience Score weighting error that capped the maximum score at 70
instead of 100) and fixed, then re-verified. The full pipeline was also run
end-to-end against real rows read from a live local Postgres instance,
confirming the engine correctly shows nothing rather than fabricating a
pattern from single-occurrence data. 17 RLS/constraint tests covering all
4 new tables plus the new view were run live against local Postgres 16.
None of this has been exercised against a live Supabase project or a real
browser — see Known limitations below.
