export type Period = "today" | "7d" | "30d" | "90d";

export interface PeriodRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
}

const PERIOD_DAYS: Record<Period, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

/**
 * Returns the current window and the immediately preceding window of equal
 * length, so trend comparisons are always symmetric (e.g. "last 30 days"
 * vs "the 30 days before that") — never comparing unequal spans.
 */
export function getPeriodRange(period: Period, now: Date = new Date()): PeriodRange {
  const days = PERIOD_DAYS[period];
  const dayMs = 24 * 60 * 60 * 1000;
  const end = now;
  const start = new Date(end.getTime() - days * dayMs);
  const previousEnd = start;
  const previousStart = new Date(previousEnd.getTime() - days * dayMs);

  return { start, end, previousStart, previousEnd, label: PERIOD_LABELS[period] };
}

export function isWithin(dateIso: string, start: Date, end: Date): boolean {
  const t = new Date(dateIso).getTime();
  return t > start.getTime() && t <= end.getTime();
}
