# BD Clarity — Change Log

## Rename Note

The product's working name changed from "BD Voice" to "BD Clarity" — the actual name that existed in code before this was "Digital Review AI" (the Module 1 working name); "BD Voice" was only ever used in our conversation, never written into the codebase. This rename touched exactly one file, `src/lib/config/branding.ts`, plus one non-functional code comment in `globals.css` — confirming the Module 1 architectural decision to centralize the product name in one place worked as intended: zero components had the name hardcoded.

## Audit — Action Engine Milestones 1–3, complete verification pass

**No functional changes made during this audit** — verification only, per explicit instruction.

**Result: all checks passed.** Full findings in the audit report delivered alongside this changelog entry. Summary:
- `tsc`/`eslint`/`build` all clean, 22 routes, no dead routes
- Byte-level comparison confirmed zero drift in: Super Admin Panel, Google OAuth integration, customer-facing flow, review-generation engine, Segment Engine, Customer Pulse, Customer Brain core files (`customerVoice.ts`, `demandDetector.ts`, `period.ts`, `experienceScore.ts`)
- Live regression: recommendation pipeline, 3-state lifecycle constraint (widened but still enforced — verified both directions), baseline never-overwritten guarantee, business-level isolation across all 3 Action Engine tables, Admin Panel, Segment data, customer/anon flow — all confirmed intact
- No duplicate policy/constraint names across all 13 migrations; sequence is gap-free
- All Action Engine function exports confirmed genuinely used (no dead code)

**Exact file/database inventory across Milestones 1–3:**
- Added: `src/app/dashboard/actions/page.tsx`, `src/components/dashboard/actions/ActionLifecycleControls.tsx`, migrations `0012` and `0013`
- Modified additively: `src/lib/insights/types.ts`, `src/lib/insights/businessAdvisor.ts`, `src/app/dashboard/intelligence/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/intelligence/actions.ts`, `src/types/database.ts`
- Database: `business_action_status.status` constraint widened (0012); new table `action_baseline_snapshots` with 2 RLS policies + 1 index (0013)

**UI: not visually verified — a manual testing checklist was provided instead, covering the Customer Actions page, lifecycle controls, baseline display, empty/error states, mobile layout, and isolation, with explicit Test ID → action → expected → failure format for each.**

## Audit — Action Engine Milestones 1–3 Verification Pass

**Status: audit complete, no functional/UI changes made** (per explicit instruction — findings only, no redesign).

**Finding 1 (real, actionable): `/dashboard/actions` is an orphaned route.** Confirmed by direct code search — it does not appear in `Sidebar.tsx`'s `navItems`, nor is it linked from any other page. It's fully functional and reachable by direct URL, but undiscoverable through normal navigation. Not fixed in this audit; flagged for your decision on a small, targeted follow-up.

**Finding 2 (non-issue, investigated and resolved):** one rate-limiter regression test in this audit returned an unexpected `f, f` result instead of the expected `t, f`. Investigated by reading `check_rate_limit()`'s actual source (count-then-insert logic, verified correct) and re-testing with a guaranteed-fresh scope string, which produced the correct `t, f`. The original anomaly traced to one pre-existing row under the same test scope string, not a code defect.

**All other audit items: confirmed clean.** See the full report delivered in conversation for the complete 12-point breakdown, file/database-object inventory, and manual testing checklist.

## v2.4 — Final Customer Experience Simplification: Emoji-Only Reaction Flow

**Status: complete and verified. Single file changed — the smallest possible implementation, exactly as required.**

**Important, flagged prominently (not implemented silently):** this milestone explicitly directs that negative/neutral-rated customers (1–3) no longer see the Google review option at all — a direct reversal of "no review gating, every rating gets the same Google option," a principle repeated as foundational throughout this entire project. Implemented exactly as instructed, since it's an explicit, clear product decision from the owner — flagged here clearly in case it wasn't meant as a deliberate reversal.

**File changed:** `src/components/feedback/FeedbackFlow.tsx` only. Confirmed via file-modification-time check — zero other files touched, including `feedback/[code]/page.tsx` (zero changes needed there at all).

**OLD → NEW flow:**
- Old: `questions (2 business questions) → rating (stars) → tags (multi-select) → message (free text) → draft (editable AI review) → save+redirect`
- New positive (🙂/🤩, rating 4–5): `emoji tap → generating → ready (checkmarks, auto-copied) → "Continue to Google" → save+redirect`
- New negative (😡/😕/😐, rating 1–3): `emoji tap → recovery detail (1 optional quick-select) → save → thank-you (no Google)`

**Zero backend changes required — confirmed before writing any code, not assumed:** `generateDraft()`, `submitFeedback()`, and `reviewDraft.ts`'s template engine already accepted empty `tags`/`message` (proven by the old flow's own "optional" steps) and already had anti-fabrication/variation built in since Module 2. The negative-flow's "what went wrong" quick-select reuses the *existing* segment-aware `tags` prop (from `feedback_links`) directly — no new vocabulary, no new configuration.

**The owner's question-management system is fully intact, simply unused by this flow:** `business_context_questions`, `ContextQuestionsEditor.tsx`, and the admin CRUD actions are completely untouched — owners can still configure questions; the customer just never sees them in this new flow. The `questions` prop remains in `FeedbackFlow`'s type signature for compatibility, never rendered.

**Google handoff ordering, verified correct in code:** the review is generated and clipboard-copied entirely *before* the customer ever sees a Google-related button — copy is attempted the moment the draft exists (inside the `generating → ready` transition), not deferred to the "Continue to Google" click. Clicking that button only then saves (the one database write) and redirects.

**Clipboard failure fallback, verified present:** wrapped in try/catch; on failure, the UI shows a manual "Tap to copy your review" affordance with the draft text visible on screen, never a false "✓ Copied" claim, and never blocks the flow.

**One real test-methodology artifact caught during verification, not a code bug:** an initial live-Postgres test used an `INSERT...SELECT` subquery against `feedback_submissions` as `anon` to simulate the notification insert — silently inserted 0 rows, because `anon` has no SELECT policy on that table (by design, confirmed repeatedly in this project). The *real* `submitFeedback()` code never does this — it generates the submission ID explicitly in JavaScript before either insert, exactly as already established in the owner-notifications milestone. Redone matching that real pattern; both inserts succeeded correctly.

**Tests performed, all live:**
- Live Postgres: exact new positive-path call shape (empty tags/message, rating 5) and negative-path call shape (single-tag array, rating 2 + owner notification) both verified end-to-end
- Full cross-module regression: businesses, feedback submissions, owner notifications, Google reviews, admin role, public feedback page, rate limiter — all passed
- `tsc --noEmit` PASS (one real unused-variable warning caught by lint and fixed before this report — a leftover `googleUrl` state variable), `eslint` PASS, `next build` PASS — **23 routes, unchanged**

**Confirmed untouched:** Admin panel, Super Admin, Google OAuth foundation, Google Reviews API integration, AI reply engine, owner dashboard, RLS, all 16 existing migrations, owner notification creation logic itself (only the trigger-side rating classification changed, which was already how the existing notification system worked).

**What remains genuinely unverified:** actual visual rendering and the emoji micro-interactions (scale/bounce/glow) on a real device — no browser capability in this environment, as throughout this project. The sequencing and state-machine logic above are verified by code tracing and live database testing, not by sight.

## v2.3 — Premium Design System Pass (visual/UX only, no functional changes)

**Status: complete, verified technically. Prompted by real screenshots of the running app — the first genuine visual ground truth available in this entire project — confirming the exact problems described: a tiny floating card on a vast empty canvas, weak buttons, flat pill chips, plain sidebar.**

**Files changed (46):** `globals.css` (new design tokens), `Button.tsx`, `Field.tsx`, `Alert.tsx`, `AuthShell.tsx`, `Sidebar.tsx` (rebuilt), `Header.tsx` (rebuilt), `FeedbackFlow.tsx`, `feedback/[code]/page.tsx`, `ComingSoon.tsx`, `settings/page.tsx`; plus 12 dashboard/admin pages (h1 typography) and ~20 component files (shared card/empty-state patterns, upgraded via precise, verified mechanical replacement rather than individual hand-edits).

**New design tokens (`globals.css`):** a warm-tinted shadow scale (`shadow-xs/sm/md/lg/premium`), a 12–16px radius scale, a `--gradient-canvas` page-background wash — all registered in Tailwind's `@theme` as real utility classes, not one-off inline styles.

**The core reported bug, fixed directly:** `feedback/[code]/page.tsx` had `max-w-md` centered in a full-viewport flex container with no background treatment — exactly producing the screenshot's "tiny card on huge blank page." Fixed with a `bg-canvas` background, a proper content container, and a materially upgraded `FeedbackFlow.tsx`: elevated/gradient business avatar, bolder progress indicator, all 5 step-cards upgraded to `shadow-lg`, pill chips changed from a weak tint-outline to a strong filled selected state, star rating given a hover/active micro-interaction.

**Dashboard shell rebuilt:** `Sidebar.tsx` — hand-crafted inline SVG icons (no new dependency), grouped into Overview/Customer Experience/Reputation/Workspace, mobile tab bar upgraded to filled pill style. `Header.tsx` — sticky/blurred, gradient avatar, workspace-name pill, stronger notification badge.

**Settings → Google**, per the explicit requirement that it "should look like a serious product module, not simply another text link" — rebuilt as an icon + title + description card with hover lift, not a bare bordered link.

**Applied consistently, not patched page-by-page:** page-title typography upgraded identically across 12 dashboard/admin pages (via a precise, tag-anchored replacement — confirmed it did NOT also touch a stat-card value in `admin/page.tsx` sharing the same class string, which a blind find-replace would have wrongly caught); the common card pattern (26 instances) and empty-state dashed-box pattern (12 instances) upgraded identically across every dashboard/admin/component file that used them, via the same verified mechanical technique already proven safe in earlier milestones.

**Two real risks caught and corrected during implementation, not after:**
1. The new mobile nav's active-state accent bar was initially designed with `-left-5` absolute positioning, which would have rendered outside the sidebar's actual visible area (no reserved gutter space existed for it) — caught through direct layout reasoning before testing, replaced with a robust `border-l-[3px]` pattern that cannot render incorrectly regardless of surrounding spacing.
2. A blind global find-replace for the page-title typography pattern would have also incorrectly upgraded a dashboard stat-card *value* in `admin/page.tsx` that happened to share the exact same className string — caught by checking actual usage before running the replacement, fixed by anchoring the match to the `<h1` tag specifically.

**Confirmed zero functional impact:** every single change in this pass is presentational (CSS classes, SVG icons, JSX layout/spacing) — no component's props, state, business logic, data-fetching, or event-handler behavior was altered. Verified: the customer feedback flow's 5-step state machine (`questions → rating → tags → message → draft`) is byte-identical in logic to before. Full live-Postgres regression (businesses, feedback, Google reviews, admin role, public feedback page, rate limiter) — all passed, confirming the database/RLS layer is completely unaffected, as expected from a design-only pass.

**Build verification:** `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS — **23 routes, unchanged** (confirms no routing impact). A scan for malformed/duplicated output from the broad mechanical replacements found none.

**What remains genuinely unverified:** actual visual rendering. I have no ability to view a rendered page in this environment — everything above is reasoned from code and verified by compilation/build/regression, not by sight. The screenshots you provided were the first real evidence of how this app actually looks; I have no way to independently confirm this pass actually resolves what they showed without you looking at it again.

**Not done in this pass, honestly flagged:** the public landing page (already inherits the new tokens automatically via its existing `text-verified`/`Logo` usage, confirmed in an earlier branding pass, but not individually re-reviewed here); no modals exist in this app to upgrade (confirmed via search); loading-state spinners were not individually redesigned beyond what `Button`'s existing spinner already provides.

## v2.2 — Complete Google Review → AI Reply → Publish Workflow

**Status: code/build/RLS/logic fully verified server-side; live Google verification deliberately deferred to one comprehensive real-world test (see the final test checklist below), per explicit instruction not to pause after each milestone for partial browser testing.**

**Files changed (7):** new migration `0016_google_reply_workflow.sql`, `src/app/dashboard/reputation/replyActions.ts`, `src/components/dashboard/ReviewReplyCard.tsx`; modified additively: `src/lib/google/reviewsClient.ts` (+publishReply/deleteReply), `src/app/dashboard/reputation/{actions.ts,page.tsx}`, `src/types/database.ts`.

**Database:** one additive `ALTER TABLE` on the existing `google_reviews` (0015) — 5 new columns (`ai_reply_draft`, `draft_status`, `draft_updated_at`, `publish_attempted_at`, `publish_error`) plus one new CHECK constraint. No new table, no existing migration edited, no RLS policy touched (the existing owner-only/admin-read-only policies on `google_reviews` automatically cover the new columns, since RLS is row-level not column-level — confirmed live).

**AI reply generation:** `generateReplyDraft()` reuses `generateGoogleReplies()` (`src/lib/reviewEngine/replyGenerator.ts`) **unmodified** — zero changes to the reply engine itself. A Google review (rating + comment, no structured tags) maps onto the same `ReviewContext` every other caller already uses. Verified via **real, unmocked execution** of the actual engine (not simulated): a 2-star review produced an apology-toned reply without fabricating details not present in the original text; a 5-star review produced a distinctly different, thankful tone; compliance checking and quality scoring both ran as part of the same unmodified pipeline.

**Owner edit/approval:** `updateReplyDraft()` — local to BD Clarity, nothing sent to Google until explicit approval.

**Publish to Google:** `publishReviewReply()` calls the real `updateReply` v4 endpoint (confirmed current via live documentation research during this session). **One important finding from that research, confirming rather than contradicting the implementation:** Google's own REST reference confirms `reviewId` is a bare identifier, distinct from the full `name` resource path — validating that this project's resource-path reconstruction (`accounts/{id}/locations/{id}/reviews/{reviewId}`) follows Google's own documented pattern exactly. Simplified an unnecessarily defensive string operation in the implementation once this was confirmed, with the reasoning documented in code.

**Reply status, error handling, retry:** full state machine — `none → drafted → edited → publishing → published` or `→ failed`. A failure preserves the draft text and captures Google's real error message (never fabricated); retry reuses the existing draft via the same `publishReviewReply()` call, with no separate retry function needed. Verified live, end-to-end, including the full failure-then-successful-retry path.

**Premium dashboard metrics:** average rating, total reviews, new-in-7-days, awaiting-reply — pure aggregation over already-synced `google_reviews` rows, no new Google call, reusing the existing card/shadow/typography tokens from the branding pass rather than inventing new styling.

**Tests performed, all real:**
- 4 live-Postgres schema/RLS tests for the new columns (default correctness, owner write via the existing policy, cross-business isolation unaffected, constraint enforcement)
- 11 mocked unit tests for `publishReply`/`deleteReply` (correct HTTP method/endpoint, real Google error message capture, graceful fallback on unparseable error bodies, network-failure handling)
- 6 real (unmocked) execution tests of the actual `generateGoogleReplies()` engine with Google-review-shaped input
- 8-step live-Postgres state-machine test covering the complete lifecycle including failure and retry, plus cross-business isolation and admin read access at the end state
- Full cross-module regression (businesses, feedback, notifications, Google connection, admin role, public feedback page, rate limiter)
- `tsc --noEmit`, `eslint`, `next build` — all clean, **23 routes, unchanged** (no new route — extends the existing Reputation page)

**Confirmed untouched:** the Google OAuth foundation, `google_business_connections` (no duplicate connection/location tables created), the existing review/reply engine's own logic, customer feedback flow, Customer Brain, Customer Pulse, Action Engine, Segment Engine, Admin/Super Admin, and migrations `0001`–`0015`.

**What remains genuinely unverified, honestly stated:** everything above is correct server-side logic, real database behavior, and a real (not mocked) exercise of the AI engine — but **no part of this has been exercised against Google's real servers**, because no real OAuth credentials or approved API access exist in this environment. This is not claimed as live-verified. See the comprehensive final test checklist for the one real-world pass that will actually confirm it end-to-end.

## v2.1 — Google Review Retrieval, Milestone 1: Foundation (read-only)

**Status: complete, code/build/RLS verified; live Google API retrieval NOT verified — no real credentials exist in this environment.**

**Files changed (7):** new migration `0015_google_reviews_milestone1.sql`, `src/lib/google/reviewsClient.ts`, `src/app/dashboard/reputation/{actions.ts,page.tsx}`, `src/components/dashboard/SyncReviewsButton.tsx`; modified additively: `src/types/database.ts`, `src/components/dashboard/Sidebar.tsx` (one new nav entry).

**Database:** one new table, `google_reviews`, deliberately reusing the *existing* `google_business_connections` table for all OAuth/identity data rather than creating duplicate connection/location tables, exactly per the approved scope. Dedup key: `unique(connection_id, google_review_id)`. No existing migration edited.

**RLS:** owner-only full access, admin read-only, zero anon access — identical established pattern. 7 live tests passed: owner insert/read, cross-business isolation, anon fully blocked (read and write), admin read-only parity, invalid-rating rejection, and critically — **re-upserting the same `google_review_id` updates the existing row rather than creating a duplicate (confirmed: count stayed at 1 after a second upsert with changed content).**

**API functions implemented:** `listReviews()` and `getReview()` only (`src/lib/google/reviewsClient.ts`) — real, current Google Business Profile v4 REST endpoints, verified against live documentation during inspection. Reply publishing (`updateReply`/`deleteReply`) deliberately not implemented — out of scope for this milestone.

**Sync behavior:** owner-triggered "Sync Google Reviews" button → `syncGoogleReviews()` server action → decrypts the connection's stored token (refreshing first if expired, reusing the exact existing refresh logic) → paginates through every page Google returns → upserts. A page-fetch failure after some pages already succeeded reports partial success honestly rather than discarding already-synced data.

**One real scope correction made during implementation:** initially wrote an audit-log call for the sync action, then caught that the existing narrow owner audit policy (from the Google OAuth milestone) only permits two specific connect/disconnect actions — extending it would mean touching an already-existing migration's effective policy, outside this milestone's approved "one new table only" scope, and audit logging wasn't actually requested. Removed before it shipped, documented here rather than silently dropped.

**UI:** `/dashboard/reputation` — connection status, last-synced time, and a read-only review list (star rating, reviewer name if provided, comment, existing Google-side reply if any, reply status). Added to the sidebar navigation (lesson learned from a previous orphaned-route finding) rather than left reachable only by direct URL.

**Tests performed:**
- 7 live-Postgres RLS/dedup/validation tests, all passed
- **13 mocked, unit-level tests** against a realistic, schema-accurate simulated Google API response — verifying the rating-enum mapping (`FIVE→5`, unspecified→`null`, never fabricated), field extraction, existing-reply parsing, and graceful failure on a bad HTTP response. **Clearly mocked, not live** — no real Google server was contacted.
- Full cross-module regression (businesses, feedback, notifications, admin role, public feedback page, rate limiter) — all passed
- `tsc --noEmit`, `eslint`, `next build` — all clean, **23 routes** (correctly +1)

**What was NOT tested, and cannot be, in this environment:** actual retrieval from a real Google Business Profile account. No `GOOGLE_OAUTH_CLIENT_ID`/`SECRET` exist here, and real API access additionally requires Google's Sensitive-scope verification and separate Business Profile API approval (same external blockers as the OAuth foundation milestone). The parsing/pagination/dedup *logic* is verified; the live *network behavior* against Google's actual servers is not, and must not be claimed as verified until real credentials and approved access exist.

**Confirmed untouched:** customer feedback flow, Customer Brain, Customer Pulse, Action Engine, Segment Engine, the existing Google OAuth foundation, the existing review/reply engine, Admin/Super Admin, and every migration `0001`–`0014`.

## v2.0 — Premium BD Clarity + Banao Digital branding pass (design/branding only)

**Status: complete and verified.** Design/branding enhancement only, exactly as scoped — zero database, RLS, API, routing, or business-logic changes.

**Files modified (9 total, all presentational):**
- `src/app/globals.css` — retinted the existing `--color-verified*` design tokens from green to the Banao Digital copper-orange from the reference image; added a new `--gradient-brand` token used sparingly for premium accents. Deliberately kept the CSS/Tailwind class *name* ("verified") unchanged rather than renaming it — a rename would require touching ~50 component files' worth of Tailwind classes for a purely cosmetic reason, a larger blast radius than this design pass calls for. Every `bg-verified`/`text-verified`/`border-verified` usage across the entire app (already used everywhere as the primary interactive color) picked up the new brand color automatically, with zero component files touched for this alone.
- `src/components/ui/Logo.tsx` — two-tone "BD" (charcoal) + "Clarity" (orange) wordmark matching the reference, derived from the existing `branding.productShortName` config value rather than hardcoded; icon badge now uses the new gradient token instead of a flat fill.
- `src/components/ui/BanaoAttribution.tsx` — new, small reusable "Powered by Banao Digital" component (two variants: subtle footer line, slightly more prominent card treatment for auth screens). Deliberately text-only, no repeated large logo.
- `src/components/auth/AuthShell.tsx` — added the tagline (login only, via a new optional prop), a subtle brand-gradient wash at low opacity, and the Banao attribution — cascades to all 4 auth pages (login/signup/forgot-password/reset-password) from this one shared component.
- `src/app/(auth)/login/page.tsx` — opted into the tagline via the new prop.
- `src/app/dashboard/layout.tsx` — added a footer with the attribution; fixed the flex container to `flex-col md:flex-row` (see bug fix below) and added `min-w-0` to the main content area.
- `src/app/admin/layout.tsx` — added a matching footer with the attribution; added `min-w-0` to the main content area.
- `src/components/dashboard/Sidebar.tsx` — added mobile navigation (a horizontally-scrolling tab bar, shown only below `md`) reusing the exact same nav items as the desktop sidebar. Previously, nothing at all was shown on mobile — the sidebar simply vanished with no replacement.
- `src/app/feedback/[code]/page.tsx` — added the attribution to the customer-facing feedback page's footer.

**One real layout bug caught and fixed before it could ship, not after:** adding the new mobile nav bar as a sibling of `<main>` inside a container that was always `flex` (row direction, no responsive override) would have placed the mobile nav *beside* the main content horizontally on narrow screens, rather than stacked above it — exactly the kind of horizontal-layout problem explicitly flagged as a risk. Caught during implementation via direct reasoning about the flex layout, fixed by making the container `flex-col md:flex-row`.

**Landing page: required zero changes.** Confirmed by direct inspection that `Header.tsx`, `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx`, `WhySection.tsx`, `TrustSection.tsx`, and `Footer.tsx` already use `Logo`, `branding.tagline`, `branding.parentBrand`, and `text-verified`/`bg-verified-tint` extensively — the entire public marketing site inherits the new two-tone logo and Banao orange automatically, with no component edits needed.

**Confirmed NOT touched:** database schema, RLS policies, server actions, API routes, Admin/Super Admin business logic, Action Engine logic, Google OAuth logic, review workflows, permissions — verified via file-modification-time check against the pre-branding checkpoint (exactly 9 files, all presentational).

**Build verification:** `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS — **22 routes, unchanged** (confirms zero routing impact). Live-Postgres spot check confirmed the database/RLS/admin layer is completely unaffected, as expected given zero backend files were touched.

**Limitations, stated plainly:**
- No visual/mobile rendering has been observed by me — the new mobile tab bar, the gradient wash, the two-tone logo, and every other visual change described here has never been looked at in an actual browser. This is a design change I'm describing from code, not confirming by sight.
- The specific orange hex values (`#c1611e` / `#9c4e18` / `#fbeee2`) are my best-effort reading of the reference image's copper-orange tone, not a pixel-sampled exact match — worth a visual color check against the real logo asset once you can view it rendered.
- The Google connection page (`/dashboard/settings/google`), Action Engine cards, and Admin business list were not individually restyled beyond what they already inherit from the token retint + new footers — they were not visually "upgraded" component-by-component, per the instruction to avoid unnecessary redesign of working screens.

## Audit — Action Engine Milestones 1–3, full verification pass

**Status: audit complete. No functional changes made — read-only verification, exactly as scoped.**

**Scope:** independently re-verify all 3 completed Action Engine milestones, confirm zero unintended impact on the recommendation engine, Customer Brain, Customer Pulse, Segment Engine, Admin Panel, Google integration, and business-level isolation.

**Method:** built a completely fresh database (`drai_audit`) from scratch, applied all 13 migrations in sequence with `ON_ERROR_STOP`, seeded new test data independent of any prior session, and re-ran the core functional/security tests from first principles rather than trusting prior results.

**Findings:**

1. **Migration consistency: clean.** All 13 migrations (`0001`–`0013`) apply cleanly, in order, on a fresh database — zero errors, zero conflicts. `business_action_status`'s status constraint shows exactly one active `CHECK` (confirming `0012`'s `DROP...IF EXISTS` + `ADD CONSTRAINT` correctly replaced the original rather than leaving two).
2. **Functional re-verification, all 3 milestones: PASS**, fresh data, fresh database — recommendation query pattern, full `open → in_progress → done` lifecycle, baseline capture with the never-overwritten guarantee (re-confirmed: a second insert attempt with a different value was rejected by the unique constraint).
3. **Business-level isolation: PASS.** Owner B gets 0 rows against every one of Cafe A's three relevant data surfaces (feedback, action status, baselines).
4. **Admin read access: PASS**, matching the established pattern.
5. **Anon: fully blocked** from both the modified and new tables.
6. **Recommendation engine, Customer Brain, Segment Engine: confirmed untouched** — zero references to "Action Engine" found anywhere in `customerVoice.ts`, `demandDetector.ts`, `priority.ts`, or any `src/lib/segments/*` file.
7. **Admin Panel, Google integration, customer flow, review-generation engine: confirmed untouched** — zero files modified in any of these areas since their own respective last-verified backups.
8. **Dead code/duplicate logic: none found.** `eslint` (which flags unused imports/variables project-wide) is clean; `setActionStatus()` and `ActionLifecycleControls` each exist exactly once, correctly reused rather than duplicated.
9. **Build: clean**, 22 routes, all real — no orphaned route in the build output itself.

**Real issue found, NOT fixed during this audit (per your explicit instruction):**
- **`/dashboard/actions` (all of Milestones 1–3's UI) is not in the sidebar navigation** (`Sidebar.tsx`'s `navItems`). It's only reachable by direct URL or a one-way link from the Intelligence page. This is a genuine navigation gap, detected via static code inspection, not browser testing.
- **Secondary, related observation:** `/dashboard/settings` is marked `enabled: false` ("Soon") in the sidebar, but the route now has real, working content (the Google connection link, added in an earlier milestone) — the sidebar's disabled state is stale relative to what the page actually does.

**Minor, pre-existing design note (not a defect, not introduced by these milestones):** `business_action_status` has no admin-read RLS policy (unlike `action_baseline_snapshots`, which does) — this asymmetry traces back to the original Module 6 migration, predating the Admin Panel's existence entirely.

**Recommendation:** both navigation findings are small, low-risk fixes (adding two lines to `Sidebar.tsx`'s array) — but per your explicit instruction, no fix was made during this audit. Flagging for your approval as a possible small follow-up, separate from any new feature milestone.

## v1.9 — Customer Experience Action Engine, Milestone 3: Measurement / baseline comparison

**Status: complete and verified.** The final piece of the originally-approved 3-milestone Action Engine plan.

**Files added:** none new — all changes are additive to existing files, plus one migration.

**Files modified, additively only:**
- `src/types/database.ts` — new `action_baseline_snapshots` table type
- `src/app/dashboard/intelligence/actions.ts` — `setActionStatus()` gains `captureBaselineIfNeeded()`, called only when transitioning to `in_progress`/`done`; reuses the exact same `computeCustomerVoice`/`computeDemandSignals` functions every intelligence page already calls — no new computation engine
- `src/app/dashboard/actions/page.tsx` — fetches baselines, passes them to each `ActionCard`, renders a real before/after comparison line when one exists

**Database:** one new migration, `0013_action_engine_milestone3.sql` — new table `action_baseline_snapshots` (business_id, action_key, baseline_count, evidence_label, captured_at), unique on `(business_id, action_key)` so a baseline is captured exactly once and never overwritten. Owner-only RLS + admin read-only, matching the established pattern exactly. No existing table touched.

**Evidence integrity — the core design decision this milestone required:** the baseline count is never client-supplied. `captureBaselineIfNeeded()` independently recomputes the current period's real insights server-side, at the moment of the status transition, and only stores what it actually finds — if the matching insight can't be found (e.g. dropped below the visibility threshold), no baseline is captured at all, rather than a fabricated one.

**Tests performed, all live and real:**
- 8 RLS/validation tests: owner insert/read, cross-business isolation, forgery rejection, anon fully blocked, unique constraint prevents a second baseline for the same action, negative-count rejected, admin read-only parity — one test (#8) initially returned an unexpected empty result, traced to a test-setup gap (I hadn't re-seeded the admin test user in this fresh Postgres session after an infrastructure reset, not a code issue), confirmed correct once properly seeded
- **End-to-end test combining real computation and real persistence:** seeded 6 realistic `feedback_submissions` rows, ran the actual `computeCustomerVoice()` function via real Node execution to get the genuinely-computed evidence count (6), then verified the exact check-then-insert flow `captureBaselineIfNeeded()` performs against live Postgres
- **Never-overwritten guarantee verified at both layers simultaneously:** a baseline already existed from earlier RLS testing (14) for the same action_key; the attempt to write the freshly-computed value (6) was correctly rejected by the database's unique constraint — proving both the application-layer early-return check *and* the database-level backup enforcement protect this guarantee independently
- Full regression: businesses, business_action_status, admin read access to the new table, rate limiter, all confirmed intact
- `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS — **22 routes, unchanged** (no new route this milestone)

**Backups:** `digital-review-ai-pre-actionengine-m3-checkpoint.zip` (before this work).

**Limitations:** no visual/mobile testing (no browser capability, as throughout this project) — the baseline comparison display has never been rendered or looked at.

**Action Engine plan status: all 3 originally-approved milestones now complete** (Customer Actions view → 3-state lifecycle → measurement/baseline comparison). No further Action Engine work is planned unless separately approved.

## v1.8 — Customer Experience Action Engine, Milestone 2: 3-state lifecycle

**Status: complete and verified.** Widens the existing binary `open`/`done` lifecycle to `open → in_progress → done`, exactly per the approved plan. One infrastructure interruption occurred mid-implementation (the sandbox reset again); recovered by restoring the verified `digital-review-ai-actionengine-milestone1-backup.zip` — checksum-confirmed identical to what was created and reported at the end of the prior turn — rather than reconstructing anything from memory.

**Note on interpretation:** this milestone's approval message said "proceed with Milestone 2" without specifying which of two open tracks (Google Review Retrieval, or the Action Engine's own lifecycle milestone). Since my immediately preceding message specifically ended asking for approval on the Action Engine's lifecycle milestone, I proceeded on that reading and flagged it plainly at the start, rather than guessing silently.

**Files added:** `src/components/dashboard/actions/ActionLifecycleControls.tsx` — the only new UI this milestone introduces.

**Files modified, additively only:**
- `src/lib/insights/types.ts` — `RecommendedAction.status` widened from `"open" | "done"` to `"open" | "in_progress" | "done"`
- `src/lib/insights/businessAdvisor.ts` — `statusByKey` parameter type widened to match; no logic changed
- `src/app/dashboard/intelligence/actions.ts` — `setActionStatus()` (the *existing* action, reused rather than duplicated) now accepts `"in_progress"` alongside its original two values
- `src/app/dashboard/intelligence/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/dashboard/actions/page.tsx` — status-map type annotations widened to match
- `src/app/dashboard/actions/page.tsx` — each action card now renders `ActionLifecycleControls`

**Explicitly NOT touched, confirmed by design:** `src/components/dashboard/intelligence/RecommendationsPanel.tsx` — verified before implementation that its `=== "done"` checks degrade safely with the new `in_progress` value (treated as "not done," exactly as `open` already was) — zero changes needed or made there. One honest, minor behavioral note: `topActionsForToday()` (used by the "What Should I Do Today" widget) still filters `status === "open"` only, so an action moved to `in_progress` no longer appears there — a reasonable existing behavior, left unchanged rather than silently altered.

**Database:** one new migration, `0012_action_engine_milestone2.sql` — widens the existing `business_action_status_status_check` CHECK constraint to allow `in_progress`. No new table, no new column, `0004` (where the table originates) not edited.

**Tests performed, all live and real:**
- 4 constraint/backward-compatibility tests: existing `open`/`done` values still work unchanged, `in_progress` now accepted, a genuinely invalid value (`'archived'`) still correctly rejected (constraint is widened, not removed), existing cross-owner RLS isolation completely unaffected
- Full lifecycle test: `open → in_progress → done → open` (Reopen), all four transitions succeeded via the exact upsert pattern `setActionStatus()` uses
- Full regression: businesses/status data, rate limiter, all confirmed intact
- `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS — **22 routes, unchanged** (no new route this milestone — confirms minimal footprint)

**Backups:** `digital-review-ai-pre-actionengine-m2-checkpoint.zip` (before this work; also served as the recovery point after the mid-session reset).

**Limitations:** no visual/mobile testing (no browser capability, as throughout this project) — the new lifecycle buttons have never been clicked in an actual browser.

## v1.7 — Customer Experience Action Engine, Milestone 1: Customer Actions View

**Status: complete and verified.** Reuses the existing recommendation engine entirely — no new intelligence, no new database table, exactly as scoped.

**Files added:** `src/app/dashboard/actions/page.tsx` — the new "Customer Actions" view.

**Files modified, additively only:**
- `src/lib/insights/types.ts` — `RecommendedAction` extended with `expectedSignal: string` and `evidencePeriod: string`
- `src/lib/insights/businessAdvisor.ts` — added `expectedSignalFor()` (deterministic template, same discipline as the existing `titleFor`/`whyFor`), added an optional `periodLabel` parameter (defaults to `"the current period"` so any pre-existing call site keeps compiling unchanged)
- `src/app/dashboard/intelligence/page.tsx`, `src/app/dashboard/page.tsx` — both already had `range.label` in scope; threaded it through to `buildRecommendedActions()` so their existing output now also carries the real evidence period instead of the generic fallback

**Database changes: none.** No migration created — confirmed directly (`supabase/migrations/` still ends at `0011`), exactly matching the explicit "do not create a new database table" requirement.

**Before/after recommendation behavior — verified via 27 real, executed tests, not simulated:** every core field (`actionKey`, `priority`, `priorityLevel`, `title`, `why`, `recommendation`, `evidence`) is byte-identical whether or not the new `periodLabel` parameter is passed — confirmed by calling `buildRecommendedActions()` both ways against identical input and asserting equality field-by-field. Only the two new fields (`expectedSignal`, `evidencePeriod`) appear; nothing existing was altered, removed, or reordered.

**One test-authoring mistake caught during verification, not a code bug:** my first test asserted a 12-mention frustration insight should classify as `high` priority; it actually correctly classifies as `critical`, because with only one frustration insight in the test data its *share* of total frustration mentions is 100% (≥ the existing, unmodified 40% critical-share threshold from `priority.ts`). Re-verified the threshold logic directly in the source, confirmed my test's expectation was wrong, corrected it, re-ran clean.

**Priority grouping (the "🔴 Action Needed / 🟡 Watch / 🟢 Positive Signal" buckets):** a pure, new *presentation-layer* function (`groupByBucket()`) that only sorts already-computed `RecommendedAction[]` by their already-computed `priorityLevel` — critical/high → red, medium/low → yellow, monitor → green. Verified live: a critical frustration action correctly bucketed red, a monitor-level love action correctly bucketed green. This is a regrouping of existing output, not new prioritization logic.

**Evidence/reasoning display:** each action card shows title, priority badge, why-this-matters, suggested action (when a segment rule matches), expected signal, evidence count/total/label, and evidence period — all sourced directly from the existing `RecommendedAction` object, nothing invented.

**Branch safety, exactly as required:**
1. Business-level isolation re-verified live (Owner B: 0 rows querying Cafe A's data via the identical query pattern the new page uses)
2. No branch selector exists anywhere on the new page
3. Nothing on the page claims or implies any action is branch-specific
4. Explicit on-page copy: *"Shows business-level data. Per-branch views are not yet available."*
5. No existing branch context was found anywhere in the feedback/action data path to preserve — confirmed again during this milestone's implementation (no `business_branches` table, no `branch_id` on `feedback_submissions`/`business_action_status`)
6. Documented in both the page's own code comments and this changelog entry: true per-branch Action isolation remains deferred until Module 7 Milestone 3 (Branch Management)

**Explicitly NOT implemented, exactly as scoped:** action lifecycle/database state beyond the existing binary `open`/`done`, measurement/baseline comparison, any new action table, per-branch isolation, Customer Pulse integration changes, new AI recommendation logic.

**Build verification:** `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS — **22 routes** (correctly +1 for `/dashboard/actions`, the only genuinely new route).

**Protection re-confirmed:** zero changes to Super Admin/Admin Panel, customer experience, Google OAuth integration, review-generation/reply engine, Customer Voice, Customer Pulse, or the Segment Engine's own logic.

## v1.6 — Google Business Profile Integration, Milestone 1: Connection Foundation

**Status: complete, database and encryption layers fully tested; OAuth round-trip against real Google servers untestable in this environment (real, external dependency — see below).**

**Files added:** migration `0011_google_oauth_milestone1.sql`, `src/lib/google/tokenCrypto.ts`, `src/lib/google/oauth.ts`, `src/lib/google/businessProfileClient.ts`, `src/app/api/google/oauth/callback/route.ts`, `src/app/dashboard/settings/google/actions.ts`, `src/app/dashboard/settings/google/page.tsx`, `src/components/dashboard/GoogleConnectionPanel.tsx`.

**Files modified:** `src/types/database.ts` (new table type), `src/app/dashboard/settings/page.tsx` (one link added to the existing "Coming Soon" placeholder — placeholder content itself untouched).

**Database:** one new table, `google_business_connections` (pending/connected/disconnected states; tokens stored as encrypted `bytea`, never plaintext). One narrow, explicitly-justified addition to the *existing* `audit_logs` table (`audit_logs_insert_owner_google` policy) — added because `writeAuditLog()` otherwise requires `is_admin()`, which a business owner is not; scoped to exactly the 2 named Google-connection actions, the caller's own id, and a business they actually own. `0008` (where `audit_logs` was originally defined) was not edited.

**OAuth flow:** standard authorization-code flow — `buildGoogleAuthorizationUrl()` (with CSRF `state`, `access_type=offline`, `prompt=consent` for refresh-token issuance) → owner authorizes on Google's real consent screen → callback route validates `state` against an httpOnly cookie → exchanges the code server-side → stores encrypted tokens as a `pending` connection (no location chosen yet) → owner selects a location → `finalizeConnection()` marks it `connected`.

**Google scope used:** exactly one — `https://www.googleapis.com/auth/business.manage`, the scope Google's own current documentation specifies for Business Profile API access (verified in the approved inspection). No broader scope requested.

**Token storage/protection:** AES-256-GCM, encrypted/decrypted entirely in Node.js application code (`tokenCrypto.ts`), keyed by `GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY` (a server-only env var, never touching the database layer for the key — same discipline as every other secret in this project). Verified live: 9/9 tests — round-trip correctness, random IV per encryption (same plaintext → different ciphertext each time), genuine tamper detection via GCM's auth tag, and fail-closed behavior when the key is unset. No server action or RLS policy ever selects the encrypted token columns into a client-facing response — decryption happens only inside the two server actions that genuinely need it (`listAvailableLocationsForPendingConnection`, and token refresh), and the decrypted value never appears in either function's return value.

**Business → branch → Google location mapping:** interim design, flagged clearly per the approved inspection (no `business_branches` table exists — Module 7 Milestone 3 was never built). A business can create multiple `google_business_connections` rows, each with an optional free-text `branch_label` (e.g. "Nashik"). Verified live: a second connection with a different label was created successfully alongside the first.

**Disconnect behavior:** soft — sets `status='disconnected'`, `disconnected_at`, `disconnected_by`. Does not revoke the token on Google's side (out of scope; governed by the owner's own Google account security settings) and does not delete the row (preserves history, same immutability-adjacent philosophy as the rest of this project). Verified live via the unique-active constraint: a disconnected location can later be reconnected without conflict.

**Server-side authorization, verified live (14 tests across the two tables):**
- Owner can insert/read/update only their own business's connections; a different owner gets 0 rows and RLS-rejected forgery attempts
- `anon` blocked entirely, both read and write
- Admin retains read-only visibility (matching the established `_select_admin` pattern) — grants no more than the owner already has
- The new narrow owner audit-log policy: owner can log only the 2 named actions, only for themselves, only against a business they own; cross-business and off-scope-action attempts correctly rejected; the *existing* admin-only audit policy re-confirmed completely unaffected

**One real debugging finding, documented not hidden:** an early manual test appeared to show the new audit policy failing — root cause was that my test script added a `RETURNING` clause not present in the real application code; `RETURNING` implicitly requires a matching `SELECT` policy, which owners don't have on `audit_logs` (by design — the real `writeAuditLog()` never requests one). Confirmed the actual code path works correctly once tested to match it exactly.

**Whether real Google API access is available: No.** Confirmed by design of this milestone, not overlooked: this sandbox has no Google Cloud project, no OAuth client ID/secret, no approved Business Profile API access. `isGoogleOAuthConfigured()`/`isGoogleIntegrationAvailable()` correctly report `false` here, and the UI shows an honest "not configured" state rather than a broken or fake "Connect" button — same fail-closed pattern as `GOOGLE_PLACES_API_KEY` throughout this project.

**What requires your Google Cloud/Business Profile approval or configuration, exactly:**
1. A real Google Cloud project with OAuth 2.0 credentials (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`)
2. A registered, approved redirect URI (`GOOGLE_OAUTH_REDIRECT_URI`) matching wherever this app is actually deployed
3. Google's **Sensitive-scope app verification** for `business.manage` — a real review process, separate from and in addition to this code
4. Google's separate **Business Profile API access approval** (the 60-day-verified-listing prerequisite, confirmed in the inspection) — entirely outside this project's control
5. `GOOGLE_OAUTH_TOKEN_ENCRYPTION_KEY` — a 64-character hex string (32 random bytes) you generate and set as a server env var; not obtained from Google

**Tests performed:** 9 token-encryption tests (pure function, real execution), 14 live-Postgres RLS/authorization tests across `google_business_connections` and the new `audit_logs` policy, full regression across Modules 1–2, 7 A–D, 7 E–F, Super Admin Milestones 1–2, and the simplified customer flow. `tsc --noEmit`, `eslint`, `next build` all pass — **21 routes** (correctly +2: `/api/google/oauth/callback`, `/dashboard/settings/google`).

**Limitations, stated plainly:**
- The actual OAuth round-trip (redirect to Google, consent, callback, token exchange) has never run against real Google servers — cannot be tested without the external approvals above.
- `listGoogleAccounts`/`listGoogleLocations` (the Business Profile API calls) are written correctly per current documentation but likewise never exercised live.
- Branch mapping is a free-text label, not a real foreign-key relationship — will need a follow-up migration once Module 7 Milestone 3 (Branch Management) exists.
- No automatic cleanup of abandoned `pending` connections (owner starts OAuth, never finishes) — harmless clutter (encrypted, RLS-protected, invisible to anyone but the owner/admin), not a security issue, but worth a small cleanup job eventually.
- No visual/mobile testing performed — no browser/device capability in this environment, as throughout this project.

**Not implemented, exactly as scoped:** review retrieval, reply-publishing workflow, any automatic action on Google, any change to the customer-facing flow or `businesses.google_review_url` behavior — all confirmed untouched.

## v1.5 — Remove intermediate "done" screen; Review Ready becomes the final BD Clarity screen

**Status: complete and verified.** Targeted follow-up to v1.4, exactly as approved.

**Change:** the "Your voice has been heard" done-screen is fully removed. The review-ready screen is now the last screen the customer sees before leaving for Google. Its primary button is relabeled "Continue to Google →" and now performs the save-then-redirect in one action: submit feedback (same single `submitFeedback()` call as before) → on success, immediately `window.location.href` to the existing `googleReviewUrl` — same-tab, no new screen shown first.

**Double-submission/double-redirect safeguards, all implemented exactly as required:**
- Explicit `if (isPending) return;` guard at the top of `submit()`, in addition to the pre-existing `loading={isPending}` on the button (confirmed by reading `Button.tsx`: `loading` sets real `disabled`, not just a spinner) — two independent layers, not one.
- Failed submission (`"error" in result`) returns immediately, before any redirect logic runs — never navigates away on failure, existing error `Alert` still shown, button re-enabled automatically once `isPending` clears.
- Redirect fires from exactly one code path, guarded by the same early returns.

**One real gap caught and fixed during implementation, not shipped broken:** the message step's pre-existing "Skip — I'll write my own" link also calls `submit()`. If that business had no Google URL, the confirmation would have had nowhere to render (my new no-URL fallback was originally nested only under `step === "draft"`, which Skip never sets). Fixed by having `submit()` set `step` to the review screen only in the no-redirect branch — both entry points now correctly converge on one final screen; the successful-redirect path is untouched by this fix (no extra re-render before navigating away).

**Files modified:** `src/components/feedback/FeedbackFlow.tsx` only.

**Confirmed exactly as scoped:** no database migration, no admin file touched (verified via file-modification-time check), no change to `submitFeedback()`'s server-side logic, no change to the Google URL itself, no new Google API/OAuth/routing code — `window.location.href` is a plain browser navigation, not a new integration.

**Tests executed, live:**
- `tsc --noEmit` / `eslint` / `next build`: all PASS, 19 routes unchanged
- Code-verified: exactly one `submitFeedback()` call site; zero remaining references to the removed `"done"` step; exactly one `window.location.href` call; the explicit `isPending` guard present
- Live Postgres: full regression across Modules 1–2, 7 A–D, 7 E–F, and Super Admin Milestones 1–2, all intact

**Before/after flow:**
- Before: `Review Ready → (click) → "Your voice has been heard" → (click) → Google`
- After: `Review Ready → (click "Continue to Google →") → Google`, in one action

**Not verified (unchanged limitation):** actual click-through/visual/mobile testing — no browser or device capability in this environment, as throughout this project.

## v1.4 — Customer Journey Simplification (removes the "submitting twice" feeling)

**Status: complete and verified.** Scope strictly limited per your approval: no Google routing/OAuth added, no journey-status field added, no database migration, Super Admin Panel and admin modules completely untouched.

**The problem, precisely diagnosed (not assumed):** there was never a literal duplicate database write — `submitFeedback()` already ran exactly once. The friction was an extra confirmation *screen*: after reviewing/editing the AI-generated draft and clicking "Continue" (which saves to the database), the customer landed on a separate "done" screen and had to click *again* ("Continue to Google →") before reaching Google. Two distinct continue-actions in a row created the "am I submitting this twice?" feeling.

**Fix:** merged the "draft" and "done" steps into one continuous visual card in `src/components/feedback/FeedbackFlow.tsx`. Same underlying state machine, same single `submitFeedback()` call site — only the *presentation* changed: before submission, the card shows the editable review with Edit/Regenerate/Copy; the moment "Continue" is clicked, the same card's content updates in place to show the thank-you message, the final review text for reference, Copy (still available), and the Google link — no second screen, no second "continue" click required to reach it.

**Interpretation flagged transparently, not guessed silently:** per your explicit "Confirmed — your assessment is correct" response to my two proposed options, the existing, already-working, simple `<a href={googleReviewUrl}>` link was kept unchanged (not removed, not rebuilt) — this is not new Google routing logic, just preservation of what already existed. Flagged directly to you in case this reading was wrong.

**Files modified:** `src/components/feedback/FeedbackFlow.tsx` only. No other file touched.

**Confirmed NOT done, exactly as scoped:**
- No Google API/OAuth changes
- No journey-status tracking field added
- No database migration (`supabase/migrations/` still ends at `0010`, unchanged)
- Zero admin files modified — confirmed via file-modification-time check against the last admin backup

**Tests actually executed, live:**
- `tsc --noEmit`: PASS
- `eslint`: PASS
- `next build`: PASS — **19 routes, unchanged count**, confirming no new/removed routes
- Code-level confirmation: exactly one `submitFeedback()` call site in the entire component (grep-verified, not assumed)
- Live Postgres: customer (anon) flow re-verified working — business resolution, exactly 2 active questions returned, 2-question rule enforced at the database level exactly as before
- Live Postgres: customer/admin isolation re-confirmed — anon gets 0 rows querying business status data
- Full regression: Modules 1–2, 7 A–D, 7 E–F, and Super Admin Milestones 1–2 (including `get_admin_role()` still resolving correctly) all re-verified intact

**Checkpoints created this session:** `digital-review-ai-pre-customerflow-checkpoint.zip` (before this change).

**Google integration milestone:** explicitly not started, per your instruction — the existing link is preserved as-is; genuine branch-aware/API-based Google routing remains future work, pending your separate approval.

## v1.3 — Super Admin Panel, Milestone 2: Business Account Management (application layer)

**Status: complete and verified.** Business accounts list/search/detail, activate/suspend/reactivate wired to the verified `admin_set_business_status()` function, support notes UI, account history view.

**Files added:**
- `src/app/admin/businesses/actions.ts` — `searchBusinesses`, `getBusinessDetail`, `setBusinessStatus`, `listSupportNotes`, `addSupportNote`, `getBusinessAuditHistory`. Every function starts with `getCurrentAdmin()` and, for writes, `hasCapability()` — server-side only, never trusting client state.
- `src/app/admin/businesses/page.tsx` — business list with search (`ilike` on business name)
- `src/app/admin/businesses/[id]/page.tsx` — detail view combining profile, status control, support notes, and history
- `src/components/admin/BusinessStatusControl.tsx` — activate/suspend/reactivate UI, calls `setBusinessStatus` (which routes through the `admin_set_business_status()` RPC, never a direct table update)
- `src/components/admin/SupportNotesPanel.tsx` — add/view notes UI

**Files modified:**
- `src/types/database.ts` — added the `business_support_notes` table type (genuinely missed when its migration was written last session — caught immediately by `tsc`, not shipped broken) and the `admin_set_business_status` RPC function type

**Two real issues found by the type-checker and fixed before anything ran:**
1. `business_support_notes` table type was missing from `database.ts` entirely — its own migration (`0009`) had been applied and tested at the SQL level, but the TypeScript types were never added. Caught by `tsc`, not by manual review.
2. The RPC function type for `admin_set_business_status` was also missing, plus a status-value type-narrowing issue in `setBusinessStatus()`. Both fixed; `tsc --noEmit` now passes with zero errors.

**Tests actually executed, live Postgres:**
- All 6 server-action query patterns tested directly, across permission tiers: business list (Read-only Analyst confirmed can view — `view_dashboard` is universal), search filter, owner-email resolution, support-notes read (Support Admin), audit history read.
- **One result initially looked like a bug and wasn't:** a "Support Admin can view notes" test returned 0 rows. Investigation confirmed this was the *same* Support Admin test user deliberately revoked during Milestone 1 testing — `get_admin_role()` correctly returns null for them, so RLS correctly blocks them. Re-tested with a freshly-seeded, active Support Admin and confirmed the real 2 notes are visible — the revocation is doing exactly what it's supposed to do, cascading correctly into this new table too.
- Full write-path test: fresh Support Admin added a note (succeeded), Operations Admin changed Cafe A's status to `inactive` and back to `active` via the actual RPC (succeeded both times).
- Full regression: Modules 1–2, 7 A–D, 7 E–F, Milestone 1's self-escalation guard, all re-verified intact.

**Build verification:** `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS — **19 routes**, correctly +2 for the two new genuinely-new pages (`/admin/businesses`, `/admin/businesses/[id]`).

**Checkpoints created this session:** `digital-review-ai-pre-m2-applayer-checkpoint.zip` (before this work).

**Audit log verification:** every write path (`setBusinessStatus` via the RPC's own atomic logging; `addSupportNote` via an explicit `writeAuditLog()` call) produces a real `audit_logs` row — confirmed live for both.

## v1.2 — Super Admin Panel, Milestone 2 fix: admin business-status write path

**Status: complete and verified.** A real, self-reported issue found during Milestone 2 testing — flagged and fixed per your explicit approval, not silently patched.

**Issue:** Milestone 1 added `businesses.status` but no RLS write path existed for it — the only `UPDATE` policy on `businesses` is owner-scoped (`businesses_update_own`). An Operations Admin's attempt to change a business's status was silently filtered to zero rows by RLS.

**Fix — file added:** `supabase/migrations/0010_admin_business_status_function.sql` — a single, narrow `SECURITY DEFINER` function, `admin_set_business_status(business_id, new_status, reason)`, following the same single-purpose-function pattern already used for `is_admin()`/`get_admin_role()`/`check_rate_limit()`. Deliberately not a broad admin `UPDATE` policy, which would have let an authorized admin change *any* business column, not just status.

**All 10 approved safeguards implemented and verified live, not just reasoned about:**
1. Identity/role resolved from `admin_role_assignments` via `auth.uid()` — no parameter accepts a client-supplied user ID or role.
2. Restricted to `super_admin`/`operations_admin`; Support Admin and Read-only Analyst explicitly rejected — verified live (both produced `Not authorized to change business status.`).
3. Updates only the `status` column — no other statement touches `businesses` in the function body.
4. Validates `business_id` (nonexistent → rejected), `new_status` (null → rejected; invalid value → rejected at the Postgres enum-type level before the function body even runs), `reason` (>500 chars → rejected).
5. Audit log written in the same function body/implicit transaction as the status change — verified the resulting `audit_logs` row has accurate `old_status`/`new_status` metadata.
6. `set search_path = public` baked into the function definition — verified live: even with the *calling session's* search_path hijacked to `pg_catalog`, the function still resolved and executed correctly.
7. No new direct `UPDATE` grant added to `businesses` for any role; `EXECUTE` revoked from `public`/`anon`, granted only to `authenticated`.
8. No role/user-id parameter exists for a caller to supply — no escalation vector.
9. Tested live against real Postgres RLS for every tier: Super Admin ✓, Operations Admin ✓, Support Admin ✗ (correctly rejected), Read-only Analyst ✗ (correctly rejected), plain business owner ✗ (correctly rejected), anon ✗ (rejected at the Postgres privilege level itself — `permission denied for function`, before even reaching the function body).
10. Full regression confirmed: `is_admin()`/`get_admin_role()` unaffected, Milestone 1's self-escalation guard and `audit_logs` immutability re-verified independently working, Milestone 2's `business_support_notes` unaffected, Modules 1–2/7 A–D/7 E–F all re-verified intact.

**One incidental finding, corrected, not a security issue:** during the `business_support_notes` permission testing, my own test comment incorrectly asserted Read-only Analyst should be able to *read* support notes. Re-checking the actually-approved permission matrix confirmed the RLS policy (scoped to only `super_admin`/`operations_admin`/`support_admin` for both read and write) is correct as built — the test comment was simply mislabeled, not the code.

**Build verification:** `tsc --noEmit` PASS, `eslint` PASS (no TypeScript files were touched by this fix — SQL only).

**Checkpoints created this session:** `digital-review-ai-pre-milestone2-checkpoint.zip` (before Milestone 2's `business_support_notes` table), `digital-review-ai-pre-statusfix-checkpoint.zip` (before this fix).

**Remaining risk, honestly stated:** this fix resolves the write-path gap for `status` specifically. The rest of Milestone 2's application layer (business list/search UI, detail view, activate/suspend buttons calling this function, support-notes UI, account-history view) has not been built yet — only the database layer (migration `0009` + this fix) has been implemented and tested so far this milestone.

## v1.1 — Super Admin Panel, Milestone 1: Foundation

**Status: complete and verified.** Approved plan: role/permission model (4 tiers), `businesses.status`, insert-only `audit_logs`, real (non-placeholder) admin dashboard.

**Files added:**
- `supabase/migrations/0008_admin_panel_milestone1.sql` — `admin_role` enum, `admin_role_assignments` table (self-escalation trigger, tier-restricted RLS), `get_admin_role()` function, `businesses.status` column (additive, default `active`), `audit_logs` table (insert-only, immutable)
- `src/lib/admin/permissions.ts` — `getCurrentAdmin()`, the approved permission matrix (`PERMISSION_MATRIX`), `writeAuditLog()`
- `src/app/admin/page.tsx` — rewritten from a hardcoded `"—"` placeholder shell into a real dashboard reading genuine `businesses`/`feedback_links`/`feedback_submissions`/`audit_logs` counts. Branch stats and AI-usage stats explicitly marked "Coming in Milestone 3/5" rather than shown as fake zeros.

**Files modified:**
- `src/types/database.ts` — `AdminRole` type, `admin_role_assignments`/`audit_logs` table types, `businesses.status` field added
- `src/app/admin/layout.tsx` — added a second, tiered gate on top of the existing unchanged `profiles.role === 'admin'` check; shows a clear "no admin role assigned yet" message rather than silently proceeding when an admin has no active tier

**Nothing in Modules 1–6 or Module 7 A–F was modified.** Confirmed by tracing every dependency and by full regression (below).

**Security decisions implemented exactly as approved:**
- Self-escalation prevention: a `BEFORE INSERT OR UPDATE` trigger blocks any user — including a Super Admin — from creating or modifying their own `admin_role_assignments` row. Verified live: the seeded Super Admin's own self-update was rejected; a *second* Super Admin successfully modified the first's row (and revoked a tier), proving the block is specifically self-action, not all writes.
- Only `super_admin` can grant/change/revoke roles (RLS `WITH CHECK`, not just UI hiding) — verified live: a Support Admin's attempt to insert/update `admin_role_assignments` was rejected by RLS.
- `audit_logs` is insert-only and immutable for every role, including the row's own author — verified live: `UPDATE 0` / `DELETE 0` on an attempted edit by the same admin who wrote it.
- An admin can only ever attribute an audit log entry to themselves, never forge another admin as the actor — verified live via RLS rejection.
- `businesses.status` is additive with a safe default; existing owner read/update behavior is provably unaffected (verified live).
- Every pre-existing `"_select_admin"` RLS policy (9 tables, from Modules 1–7F) re-verified still functioning, unchanged.

**Bootstrap note (real, unresolved — needs your input, not fabricated):** no admin existed to grant the very first Super Admin role through the app, so `admin_role_assignments` ships with no seed row. The exact bootstrap statement is:
```sql
insert into public.admin_role_assignments (user_id, admin_role, granted_by)
values ('<your-real-auth.users.id>', 'super_admin', null);
```
This needs to be run once, directly in the Supabase SQL editor, using your actual `auth.users.id` (find it via Supabase Auth dashboard, or `select id from auth.users where email = '<your-email>'`) — I do not have this value and have not fabricated a placeholder for it.

**Tests actually executed (live Postgres, this session):** 3 `businesses.status` tests, 8 `admin_role_assignments` tests (grant, tier resolution, self-escalation block, non-super-admin write block, cross-super-admin management, revocation, non-admin/anon isolation), 5 `audit_logs` tests (insert, forgery block, non-admin block, immutability, CHECK constraint), 3 layout-gating scenarios (business_owner → redirect path confirmed, admin-with-no-tier → message path confirmed, admin-with-active-tier → real dashboard data confirmed), full regression across Modules 1–2/7 A–D/7 E–F. All passed.

**Build verification:** `tsc --noEmit` PASS, `eslint` PASS, `next build` PASS (18 routes, unchanged — `/admin` already existed as a route).

**Known limitation:** the dashboard's "New (7 days)"/"New (30 days)" and status-breakdown figures are correct as of Milestone 1, but there is no way yet to *act* on them (no suspend/reactivate UI) — that's Milestone 2, not yet started, per your explicit instruction not to proceed further without approval.

## Current Version

**Unversioned — pre-dates formal versioning.** Per Section 14 of the change-control process, this document was created in INSPECT-only mode; no version number is assigned yet (Section 8: *"Do not invent a new version number until the previous change is verified"* — and per Section 10, prior work has been individually verified stage-by-stage, but never re-verified as one consolidated whole against this changelog). The first number this project should carry, once you confirm, is **v1.0 — "Milestone F + Dashboard Polish"**, not v1.1, since the change-control process itself is only starting now and there is no earlier numbered version to increment from.

## Current Known-Good Checkpoint

**Discrepancy flagged, not yet resolved — see "Discrepancies" below.** The change-control document names `digital-review-ai-milestone-e-backup.zip` as the known final backup. That backup genuinely exists and is intact, but it is **not the current state of the project on disk**. Two more rounds of already-implemented, already-tested, already-backed-up work exist beyond it (Module 7 Milestone F, and the dashboard visual polish pass). The most recent verified backup that matches the actual current tree is `digital-review-ai-dashboard-polish-backup.zip` (Sep 10, 18:31).

## Completed Modules (verified against the actual project tree, not assumed)

| Module | Status | Evidence |
|---|---|---|
| Module 1 — Foundation, Auth, Business Profile | Complete | Present in tree; regression-tested repeatedly throughout this project |
| Module 2 — QR Feedback System | Complete | `supabase/migrations/0002_qr_feedback.sql`, `0003_module2_hardening.sql` present |
| Module 3 — Feedback Inbox + AI tone options | Complete | Present, unaffected by later work |
| Module 4 — Google review URL / Places lookup | Complete | Present, unaffected by later work |
| Module 5 — Analytics | Complete | Present, unaffected by later work |
| Module 6 — Customer Intelligence + Pulse | Complete | `0004_module6_customer_intelligence.sql` present |
| Module 7 Milestone A — Business Segment Engine | Complete | `0005_module7_segment_engine.sql`, `src/lib/segments/` present |
| Module 7 Milestone B — Segment-aware tags/Pulse | Complete | Verified in prior sessions |
| Module 7 Milestone C — Segment-aware Business Advisor | Complete | `businessAdvisor.ts` segment/recommendation wiring present |
| Module 7 Milestone D — Priority levels, Business Snapshot, Getting Started | Complete | `priority.ts`, `businessSnapshot.ts` present |
| Module 7 Milestone E — Owner context questions + review-generation engine | Complete | `0006_module7_milestone_e_questions.sql`, `src/lib/reviewEngine/` present |
| **Module 7 Milestone F — Customer-side question-answering + automatic review generation** | **Complete, but NOT in the change-control document's "Current completed scope" list** | `0007_module7_milestone_f_customer_flow.sql`, `FeedbackFlow.tsx`'s "questions" step (5 references), `feedback_question_answers` table — all present and were regression-tested when built |
| **Dashboard visual polish (greeting + hero cards + empty-state reuse)** | **Complete, but NOT in the change-control document's "Current completed scope" list** | `DashboardGreeting.tsx`, `DashboardHeroCards.tsx` present, wired into `/dashboard` |

## Protected Areas (per Section 2, accepted as written — these already existed and remain untouched by anything below)

- Modules 1–6
- Module 7 Milestones A–D
- Question system (context questions, owner management, customer read-only/active-only, RLS, migrations 0001–0006)
- Intelligence (Customer Intelligence, Customer Pulse, Business Advisor, Recommendations)
- Review system (review engine, customer/owner generation, evidence-based generation, approval workflow)

**Note:** given the discrepancy above, this protected list should be extended once confirmed to also cover Milestone F (the customer-facing question-answering + automatic generation flow) and the dashboard hero-card/greeting components, since those are equally real, tested, shipped functionality that a future change request could otherwise accidentally break or duplicate.

## Existing Backup References (verified present in the outputs directory, sizes/dates as of inspection)

| File | Size | Date | Covers |
|---|---|---|---|
| `digital-review-ai-module-1-2-backup.zip` | 144,334 B | Aug 12 | Modules 1–2 |
| `digital-review-ai-module-1-3-backup.zip` | 148,859 B | Aug 12 | Modules 1–3 |
| `digital-review-ai-module-1-4-backup.zip` | 154,089 B | Aug 13 | Modules 1–4 |
| `digital-review-ai-module-1-5-backup.zip` | 159,039 B | Aug 13 | Modules 1–5 |
| `digital-review-ai-module-1-6-backup.zip` | 208,877 B | Sep 1 | Modules 1–6 |
| `digital-review-ai-current-module7-backup.zip` | 213,229 B | Sep 4 | Modules 1–6 + Module 7 A–D |
| `pre-restore-reviewengine-checkpoint.zip` | 14,428 B | Sep 9, 17:17 | Safety checkpoint of 8 review-engine files, taken immediately before a baseline restore |
| `digital-review-ai-milestone-e-backup.zip` | 239,066 B | Sep 9, 17:29 | Modules 1–6 + Module 7 A–E (named in the change-control doc as current baseline) |
| `digital-review-ai-milestone-f-backup.zip` | 243,681 B | Sep 10, 09:17 | + Module 7 Milestone F (customer flow) |
| `digital-review-ai-milestone-f-polish-backup.zip` | 244,113 B | Sep 10, 11:15 | + customer-flow copy/UX polish |
| **`digital-review-ai-dashboard-polish-backup.zip`** | **248,115 B** | **Sep 10, 18:31** | **+ owner dashboard greeting/hero cards — most recent, matches current tree** |

SHA-256 checksums for each were recorded and verified at creation time in this conversation's history; not re-listed here to keep this document focused, but available on request.

## Pending Work

None currently queued. No Change Request has been submitted yet under this new process.

## Discrepancies Between the Documented State and the Actual Project Tree

1. **Scope gap:** the change-control document's "Current completed scope" (Section 1) and "Current Status Entry" (Section 10) list Modules 1–6, Module 7 A–D, Module 7-E, and "Milestone E" as complete, with no mention of Module 7 Milestone F or the dashboard polish work. Both of those are genuinely present in the current tree, were implemented in direct response to your own prior requests in this same conversation, and were independently type-checked, built, and regression-tested at the time (including live-Postgres RLS/permission tests for Milestone F's new `feedback_question_answers` table). This isn't unreviewed or speculative work — it's already-approved, already-verified functionality that the new baseline documentation just hasn't caught up to yet.
2. **Baseline pointer:** Section 1 names `digital-review-ai-milestone-e-backup.zip` as "the current verified Milestone E state" / Known Good Baseline. As a snapshot of Milestone E specifically, that's accurate. As "the current baseline" for future change-control purposes, it's two rounds of verified work behind the actual project.
3. **No changelog previously existed** — this is the first one, created now per Section 14. All the "completed modules"/"backup history" content above was reconstructed from direct filesystem inspection and this conversation's history, not from a pre-existing document.

I have not repaired any of these discrepancies — per your instruction, this is INSPECT → REPORT → WAIT. Awaiting your direction on: (a) which backup should be treated as the actual Known Good Baseline going forward (I'd suggest `digital-review-ai-dashboard-polish-backup.zip`, since it's the only one matching the current tree), and (b) whether Milestone F and the dashboard polish should be folded into the "Protected Areas" and "Completed Modules" lists before any new Change Request is accepted.
