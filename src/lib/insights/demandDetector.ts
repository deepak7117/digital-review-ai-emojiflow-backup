import type { Insight } from "./types";
import { MIN_SIGNAL_COUNT } from "./types";

export interface UnmetDemandRow {
  reason: string;
  detail: string | null;
  created_at: string;
}

const REASON_LABELS: Record<string, string> = {
  product_unavailable: "Product unavailable",
  size_unavailable: "Size unavailable",
  colour_unavailable: "Colour unavailable",
  too_expensive: "Price concerns",
  service_unavailable: "Service unavailable",
  timing_issue: "Timing/opening-hours issue",
  other: "Other",
};

// Which of the fixed enum reasons read as "stock" (📦, an inventory gap)
// vs "request" (💡, something to consider adding/changing). This is a
// deliberate, documented split — not hidden logic — and is the honest
// boundary of what this module can determine without free-text NLP: we
// group by the reason the customer explicitly selected, never by
// interpreting what they typed in the optional detail field.
const STOCK_REASONS = new Set(["product_unavailable", "size_unavailable", "colour_unavailable"]);

function truncateSnippet(text: string, maxLen = 140): string {
  const trimmed = text.trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen).trimEnd()}…` : trimmed;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function groupByReason(rows: UnmetDemandRow[]): Map<string, UnmetDemandRow[]> {
  const map = new Map<string, UnmetDemandRow[]>();
  for (const row of rows) {
    const list = map.get(row.reason) ?? [];
    list.push(row);
    map.set(row.reason, list);
  }
  return map;
}

/**
 * Turns raw unmet_demand_reports into Insight[]. Each reason the customer
 * explicitly selected becomes its own signal — no clustering of free-text
 * "detail" answers into invented categories (that would require real NLP,
 * which this deterministic engine deliberately does not attempt; an AI
 * enhancement layer could do it later, see src/lib/ai — but even then it
 * must recompute counts from actual matches, never report a count itself).
 */
export function computeDemandSignals(
  currentRows: UnmetDemandRow[],
  previousRows: UnmetDemandRow[]
): Insight[] {
  if (currentRows.length === 0) return [];

  const total = currentRows.length;
  const currentByReason = groupByReason(currentRows);
  const previousByReason = groupByReason(previousRows);

  const insights: Insight[] = [];

  for (const [reason, rows] of currentByReason.entries()) {
    if (rows.length < MIN_SIGNAL_COUNT) continue;

    const prevCount = previousByReason.get(reason)?.length ?? 0;
    const withDetail = rows.filter((r) => r.detail && r.detail.trim());

    insights.push({
      id: `${STOCK_REASONS.has(reason) ? "stock" : "request"}:${reason}`,
      category: STOCK_REASONS.has(reason) ? "stock" : "request",
      label: REASON_LABELS[reason] ?? reason,
      evidence: { count: rows.length, outOf: total, label: "customers reported this" },
      trendPct: pctChange(rows.length, prevCount),
      exampleSnippets: withDetail.slice(0, 3).map((r) => truncateSnippet(r.detail as string)),
      source: "deterministic",
    });
  }

  insights.sort((a, b) => b.evidence.count - a.evidence.count);
  return insights;
}
