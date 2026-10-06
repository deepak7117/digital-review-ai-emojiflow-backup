import "server-only";

/**
 * Google Places lookup — integration boundary.
 *
 * Mirrors the pattern in src/lib/ai/reviewDraft.ts: this is the ONLY place
 * that talks to the Google Places API, and it fails closed, not open.
 *
 * Configuration:
 *   - GOOGLE_PLACES_API_KEY unset (default in this environment): every call
 *     to searchGooglePlaces() short-circuits to an empty result without any
 *     network request. isGooglePlacesConfigured() returns false, and the
 *     dashboard UI shows an honest "not configured" state — it never
 *     pretends this feature works when it doesn't.
 *   - GOOGLE_PLACES_API_KEY set: performs a real Text Search against the
 *     Places API (New) and maps results to a review-link candidate. If the
 *     request fails for any reason, this returns an empty array rather than
 *     throwing, so a misconfigured key degrades to "no results" instead of
 *     breaking the profile page.
 *
 * This has NOT been exercised against a live Google API key in this
 * environment — see README "Known limitations" for Module 4.
 */

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
  googleReviewUrl: string;
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

interface PlacesApiPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
}

export async function searchGooglePlaces(query: string): Promise<PlaceCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const trimmed = query.trim();
  if (!apiKey || !trimmed) return [];

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: trimmed, maxResultCount: 5 }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const places: PlacesApiPlace[] = Array.isArray(data?.places) ? data.places : [];

    return places
      .filter((p): p is PlacesApiPlace & { id: string } => Boolean(p.id))
      .map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? "Unknown business",
        address: p.formattedAddress ?? "",
        // The "writereview" deep-link form works for any place id and takes
        // the customer straight to Google's review composer for that place.
        googleReviewUrl: `https://search.google.com/local/writereview?placeid=${p.id}`,
      }));
  } catch {
    // Network/config issue — fail closed to no results, never throw into
    // the caller (this is a convenience lookup, not a critical path).
    return [];
  }
}
