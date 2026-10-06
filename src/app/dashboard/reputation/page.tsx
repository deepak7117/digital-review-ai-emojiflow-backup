import Link from "next/link";
import {
  listStoredReviews,
  getActiveConnectionSummary,
  getReputationMetrics,
} from "@/app/dashboard/reputation/actions";
import { SyncReviewsButton } from "@/components/dashboard/SyncReviewsButton";
import { ReviewReplyCard } from "@/components/dashboard/ReviewReplyCard";

/**
 * Google Reputation — Review Retrieval Milestone 1. Read-only: shows
 * whatever has already been synced via listStoredReviews(), plus a
 * client-side "Sync Google Reviews" control that calls the real Google
 * Reviews API server-side. No reply publishing anywhere on this page —
 * explicitly deferred to a later, separately-approved milestone.
 */
export default async function GoogleReputationPage() {
  const connection = await getActiveConnectionSummary();
  const reviewsResult = await listStoredReviews();
  const reviews = "data" in reviewsResult ? reviewsResult.data : [];
  const metrics = connection ? await getReputationMetrics() : null;

  if (!connection) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Google Reputation</h1>
        <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-6 text-sm text-slate">
          No Google Business Profile is connected yet.{" "}
          <Link href="/dashboard/settings/google" className="text-verified hover:underline">
            Connect one in Settings →
          </Link>
        </div>
      </div>
    );
  }

  const lastSynced = reviews.length > 0 ? reviews[0].syncedAt : null;

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] sm:text-3xl font-semibold tracking-tight text-ink">Google Reputation</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {connection.locationName ?? "Connected location"} ·{" "}
            <span className="text-verified">🟢 Connected</span>
          </p>
        </div>
        <SyncReviewsButton />
      </div>

      {lastSynced && (
        <p className="mt-2 text-xs text-slate">
          Last synced {new Date(lastSynced).toLocaleString()}
        </p>
      )}

      {metrics && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Average rating", value: metrics.averageRating ?? "—" },
            { label: "Total reviews", value: metrics.totalReviews },
            { label: "New (7 days)", value: metrics.newReviewsLast7Days },
            { label: "Awaiting reply", value: metrics.awaitingReply },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-4 shadow-xs shadow-sm"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate">
                {item.label}
              </p>
              <p className="mt-1.5 font-display text-xl font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {reviews.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-ink/[0.015] p-8 text-center text-sm text-slate">
            No reviews synced yet. Click &ldquo;Sync Google Reviews&rdquo; to import them.
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="rounded-[var(--radius-md)] border border-border-strong bg-paper-raised p-5 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {"★".repeat(review.rating)}
                    <span className="text-border-strong">{"★".repeat(5 - review.rating)}</span>
                  </span>
                  <span className="text-xs text-slate">{review.reviewerName ?? "Anonymous"}</span>
                </div>
                {review.reviewCreatedAt && (
                  <span className="text-[10px] text-slate">
                    {new Date(review.reviewCreatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {review.comment && <p className="mt-2 text-sm text-ink-soft">{review.comment}</p>}

              <ReviewReplyCard
                review={review}
                initialDraft={review.aiReplyDraft}
                initialDraftStatus={review.draftStatus}
                initialPublishError={review.publishError}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
