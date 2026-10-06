"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isGooglePlacesConfigured,
  searchGooglePlaces,
  type PlaceCandidate,
} from "@/lib/google/placesLookup";
import { checkRateLimit } from "@/lib/utils/rateLimit";

const SEARCH_RATE_LIMIT = { maxCount: 15, windowSeconds: 600 }; // 15 / 10 min per user

/**
 * Searches Google Places for the caller's business, so they can pick the
 * correct review link instead of hunting for it manually. Requires an
 * authenticated session (this would call a paid external API once
 * configured) and is rate-limited per user via the same primitive Module 2
 * uses for the public feedback endpoints.
 */
export async function searchBusinessOnGoogle(
  query: unknown
): Promise<{ configured: boolean; results: PlaceCandidate[]; error?: string }> {
  const configured = isGooglePlacesConfigured();
  if (!configured) {
    return { configured: false, results: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { configured, results: [], error: "You need to be logged in." };
  }

  const trimmed = typeof query === "string" ? query.trim().slice(0, 200) : "";
  if (!trimmed) return { configured, results: [] };

  const allowed = await checkRateLimit(
    supabase,
    "google-places-search",
    user.id,
    SEARCH_RATE_LIMIT.maxCount,
    SEARCH_RATE_LIMIT.windowSeconds
  );
  if (!allowed) {
    return { configured, results: [], error: "Too many searches. Please wait a bit and try again." };
  }

  const results = await searchGooglePlaces(trimmed);
  return { configured, results };
}
