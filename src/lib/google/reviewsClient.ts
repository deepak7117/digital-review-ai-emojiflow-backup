import "server-only";

/**
 * Google Business Profile Reviews API — read-only in this milestone
 * (list + get). Verified against current official Google documentation
 * as part of this milestone's inspection: these are real, current
 * endpoints on the v4 domain — reviews were NOT migrated to the newer
 * federated v1 APIs the way Account Management/Business Information were
 * (see businessProfileClient.ts). This has NOT been exercised against a
 * live Google account or an approved Google Cloud project in this
 * environment — no real credentials exist here. See the Milestone 1
 * report for exactly what remains externally blocked.
 *
 * Deliberately does NOT implement reply publishing (updateReply/
 * deleteReply) — out of scope for this milestone per the approved plan.
 */

const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

export interface GoogleReview {
  reviewId: string;
  reviewerName: string | null;
  starRating: number | null;
  comment: string | null;
  createTime: string | null;
  updateTime: string | null;
  reviewReplyComment: string | null;
  reviewReplyUpdateTime: string | null;
}

export interface ListReviewsResult {
  reviews: GoogleReview[];
  nextPageToken: string | null;
  averageRating: number | null;
  totalReviewCount: number | null;
}

/** Google's rating is returned as an enum string, not a number — maps it to the 1-5 scale used everywhere else in this project. */
const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

interface RawGoogleReview {
  reviewId?: string;
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

function parseReview(raw: RawGoogleReview): GoogleReview | null {
  if (typeof raw.reviewId !== "string") return null;
  return {
    reviewId: raw.reviewId,
    reviewerName: raw.reviewer?.displayName ?? null,
    starRating: typeof raw.starRating === "string" ? (STAR_RATING_MAP[raw.starRating] ?? null) : null,
    comment: typeof raw.comment === "string" ? raw.comment : null,
    createTime: typeof raw.createTime === "string" ? raw.createTime : null,
    updateTime: typeof raw.updateTime === "string" ? raw.updateTime : null,
    reviewReplyComment: typeof raw.reviewReply?.comment === "string" ? raw.reviewReply.comment : null,
    reviewReplyUpdateTime:
      typeof raw.reviewReply?.updateTime === "string" ? raw.reviewReply.updateTime : null,
  };
}

/**
 * Lists reviews for one location. accountName/locationName are the full
 * Google resource names (e.g. "accounts/123", "locations/456") already
 * stored on the connection row — never reconstructed or guessed here.
 */
export async function listReviews(
  accessToken: string,
  accountName: string,
  locationName: string,
  pageToken?: string
): Promise<ListReviewsResult | null> {
  const params = new URLSearchParams({ pageSize: "50" });
  if (pageToken) params.set("pageToken", pageToken);

  try {
    const response = await fetch(
      `${REVIEWS_BASE}/${accountName}/${locationName}/reviews?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const rawReviews: unknown[] = Array.isArray(data?.reviews) ? data.reviews : [];
    const reviews = rawReviews
      .map((r) => parseReview(r as RawGoogleReview))
      .filter((r): r is GoogleReview => r !== null);

    return {
      reviews,
      nextPageToken: typeof data?.nextPageToken === "string" ? data.nextPageToken : null,
      averageRating: typeof data?.averageRating === "number" ? data.averageRating : null,
      totalReviewCount: typeof data?.totalReviewCount === "number" ? data.totalReviewCount : null,
    };
  } catch {
    return null;
  }
}

/** Fetches one review by its full resource name, e.g. "accounts/123/locations/456/reviews/abc". */
export async function getReview(accessToken: string, reviewName: string): Promise<GoogleReview | null> {
  try {
    const response = await fetch(`${REVIEWS_BASE}/${reviewName}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;

    const data = await response.json();
    return parseReview(data as RawGoogleReview);
  } catch {
    return null;
  }
}

export interface PublishReplyResult {
  ok: boolean;
  /** Raw error detail from Google's response, if the call failed — stored for the owner/retry UI, never fabricated. */
  errorDetail: string | null;
}

/**
 * Publishes (creates or updates — Google's updateReply endpoint does
 * both, per current official documentation: PUT is idempotent-create) the
 * BUSINESS OWNER's reply to an existing review. Never touches the
 * review's own rating or text — Google's API has no endpoint for that at
 * all, by design (confirmed in this project's own inspection: "reviews
 * cannot be deleted via the API, and star ratings cannot be changed —
 * you can only reply").
 */
export async function publishReply(
  accessToken: string,
  reviewName: string,
  replyText: string
): Promise<PublishReplyResult> {
  try {
    const response = await fetch(`${REVIEWS_BASE}/${reviewName}/reply`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: replyText }),
    });

    if (!response.ok) {
      let errorDetail: string | null = null;
      try {
        const errorBody = await response.json();
        errorDetail =
          typeof errorBody?.error?.message === "string"
            ? errorBody.error.message
            : `HTTP ${response.status}`;
      } catch {
        errorDetail = `HTTP ${response.status}`;
      }
      return { ok: false, errorDetail };
    }

    return { ok: true, errorDetail: null };
  } catch (err) {
    return { ok: false, errorDetail: err instanceof Error ? err.message : "Network error" };
  }
}

/** Removes the business owner's reply from a review — officially supported (deleteReply), distinct from removing the review itself, which no endpoint supports. */
export async function deleteReply(accessToken: string, reviewName: string): Promise<PublishReplyResult> {
  try {
    const response = await fetch(`${REVIEWS_BASE}/${reviewName}/reply`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return { ok: false, errorDetail: `HTTP ${response.status}` };
    }
    return { ok: true, errorDetail: null };
  } catch (err) {
    return { ok: false, errorDetail: err instanceof Error ? err.message : "Network error" };
  }
}
