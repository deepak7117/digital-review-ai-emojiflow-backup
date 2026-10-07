"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { looksLikeGoogleReviewUrl } from "@/lib/google/reviewUrl";
import { searchBusinessOnGoogle } from "@/app/dashboard/profile/actions";
import type { PlaceCandidate } from "@/lib/google/placesLookup";
import { getIndustries, getSegmentsForIndustry } from "@/lib/segments/engine";

const CATEGORIES = [
  "Restaurant / Cafe",
  "Retail / Shop",
  "Salon / Spa",
  "Healthcare / Clinic",
  "Fitness / Gym",
  "Professional Services",
  "Automotive",
  "Home Services",
  "Hospitality",
  "Other",
];

export interface BusinessProfileData {
  business_name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  website: string;
  google_review_url: string;
  industry_slug: string;
  segment_slug: string;
}

const emptyProfile: BusinessProfileData = {
  business_name: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  website: "",
  google_review_url: "",
  industry_slug: "",
  segment_slug: "",
};

export function BusinessProfileForm({
  initialData,
  hasExistingRecord,
  businessId,
  googlePlacesConfigured,
}: {
  initialData: BusinessProfileData | null;
  hasExistingRecord: boolean;
  /** The specific business being edited — required for updates now that one owner can have multiple businesses. Not needed when creating the first/a new one. */
  businessId: string | null;
  googlePlacesConfigured: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<BusinessProfileData>(initialData ?? emptyProfile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceCandidate[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeSearched, setPlaceSearched] = useState(false);

  function update<K extends keyof BusinessProfileData>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.business_name.trim()) next.business_name = "Business name is required.";
    if (!form.category) next.category = "Choose a category.";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    if (form.website && !/^https?:\/\/.+/i.test(form.website)) {
      next.website = "Include https:// at the start of your website.";
    }
    if (form.google_review_url && !/^https?:\/\/.+/i.test(form.google_review_url)) {
      next.google_review_url = "Include https:// at the start of the link.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSearch() {
    setPlaceError(null);
    setPlaceSearching(true);
    setPlaceSearched(true);
    const result = await searchBusinessOnGoogle(placeQuery);
    setPlaceSearching(false);
    if (result.error) {
      setPlaceError(result.error);
      return;
    }
    setPlaceResults(result.results);
  }

  function applyCandidate(candidate: PlaceCandidate) {
    update("google_review_url", candidate.googleReviewUrl);
    setPlaceResults([]);
    setPlaceSearched(false);
    setPlaceQuery("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");
    setErrorMessage(null);
    if (!validate()) return;

    setStatus("saving");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStatus("error");
      setErrorMessage("Your session expired. Please log in again.");
      return;
    }

    const payload = { ...form, owner_id: user.id };

    // Fixed as part of the Multi-Store milestone: this used to update by
    // owner_id alone, which was harmless when an owner could only ever
    // have one business, but would silently update EVERY business that
    // owner owns (or the wrong one) now that they can have several.
    // Scoping by the specific business id — re-checked against
    // owner_id too, and RLS enforces this regardless — targets exactly
    // the business being edited.
    const { error } =
      hasExistingRecord && businessId
        ? await supabase.from("businesses").update(payload).eq("id", businessId).eq("owner_id", user.id)
        : await supabase.from("businesses").insert(payload);

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("success");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {status === "success" && <Alert tone="success">Business profile saved.</Alert>}
      {status === "error" && <Alert tone="error">{errorMessage}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="business_name" error={errors.business_name} required>
          <Input
            id="business_name"
            value={form.business_name}
            onChange={(e) => update("business_name", e.target.value)}
            invalid={!!errors.business_name}
          />
        </Field>

        <Field label="Category" htmlFor="category" error={errors.category} required>
          <select
            id="category"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className={`w-full rounded-md border bg-paper-raised px-3.5 py-2.5 text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-verified/30 ${
              errors.category ? "border-danger" : "border-border-strong focus:border-verified"
            }`}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>

        <Field label="Business email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            invalid={!!errors.email}
          />
        </Field>

        <Field label="Address" htmlFor="address">
          <Input
            id="address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </Field>

        <Field label="City" htmlFor="city">
          <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} />
        </Field>

        <Field label="Website" htmlFor="website" error={errors.website} hint="e.g. https://example.com">
          <Input
            id="website"
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
            invalid={!!errors.website}
          />
        </Field>

        <Field
          label="Google review URL"
          htmlFor="google_review_url"
          error={errors.google_review_url}
          hint="Where customers post their Google review."
        >
          <div className="flex gap-2">
            <Input
              id="google_review_url"
              value={form.google_review_url}
              onChange={(e) => update("google_review_url", e.target.value)}
              invalid={!!errors.google_review_url}
              className="flex-1"
            />
            {form.google_review_url && !errors.google_review_url && (
              <a
                href={form.google_review_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-border-strong px-3 py-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                Test link
              </a>
            )}
          </div>
          <p className="text-xs text-slate">
            For the most reliable link, use your Business Profile&rsquo;s own{" "}
            <strong>&ldquo;Ask for reviews&rdquo;</strong> or{" "}
            <strong>&ldquo;Share review form&rdquo;</strong> link from Google (not
            every link format is equally dependable, and links can occasionally stop
            working if your listing changes) — click &ldquo;Test link&rdquo; above
            periodically to confirm it still opens correctly.
          </p>
          {form.google_review_url &&
            !errors.google_review_url &&
            !looksLikeGoogleReviewUrl(form.google_review_url) && (
              <p className="text-xs text-gold">
                This doesn&rsquo;t look like a typical Google review link (usually
                g.page, goo.gl, or google.com). It may still be correct —
                click &ldquo;Test link&rdquo; above to double-check.
              </p>
            )}
        </Field>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Find your Google review link
        </p>
        {googlePlacesConfigured ? (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              Search for your business on Google to fill in the link automatically.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="Your business name and city"
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleSearch}
                loading={placeSearching}
                disabled={!placeQuery.trim()}
              >
                Search
              </Button>
            </div>
            {placeError && (
              <div className="mt-3">
                <Alert tone="error">{placeError}</Alert>
              </div>
            )}
            {!placeError && placeSearched && !placeSearching && placeResults.length === 0 && (
              <p className="mt-3 text-xs text-slate">No matches found. Try a different search.</p>
            )}
            {placeResults.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {placeResults.map((candidate) => (
                  <li
                    key={candidate.placeId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border-strong px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{candidate.name}</p>
                      {candidate.address && (
                        <p className="truncate text-xs text-slate">{candidate.address}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => applyCandidate(candidate)}
                    >
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate">
            Automatic Google lookup isn&rsquo;t configured for this deployment yet
            — paste your review link directly into the field above. You can
            usually find it in your Google Business Profile under &ldquo;Ask for
            reviews,&rdquo; or by searching for your business on Google Maps and
            using its share link.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
          Business segment
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate">
          Optional — picking your segment adapts feedback questions, tags,
          and future insights to your type of business. Separate from
          &ldquo;Category&rdquo; above, which is just a display label.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Industry" htmlFor="industry_slug">
            <select
              id="industry_slug"
              value={form.industry_slug}
              onChange={(e) => {
                update("industry_slug", e.target.value);
                update("segment_slug", ""); // segment must be re-picked for the new industry
              }}
              className="w-full rounded-md border border-border-strong bg-paper-raised px-3.5 py-2.5 text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-verified/30 focus:border-verified"
            >
              <option value="">Not set</option>
              {getIndustries().map((industry) => (
                <option key={industry.slug} value={industry.slug}>
                  {industry.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Segment" htmlFor="segment_slug">
            <select
              id="segment_slug"
              value={form.segment_slug}
              onChange={(e) => update("segment_slug", e.target.value)}
              disabled={!form.industry_slug}
              className="w-full rounded-md border border-border-strong bg-paper-raised px-3.5 py-2.5 text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-verified/30 focus:border-verified disabled:opacity-50"
            >
              <option value="">{form.industry_slug ? "Not set" : "Choose an industry first"}</option>
              {form.industry_slug &&
                getSegmentsForIndustry(form.industry_slug).map((segment) => (
                  <option key={segment.segmentSlug} value={segment.segmentSlug}>
                    {segment.displayName}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </div>

      <div>
        <Button type="submit" loading={status === "saving"}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
