/** Shared, strongly typed analytics primitives for REFLEX.
 * Kept dependency-free so the browser app can adopt these incrementally.
 */
export interface ReactionResult {
  ms: number;
  at: string;
}

export interface ReactionSummary {
  count: number;
  averageMs: number | null;
  medianMs: number | null;
  bestMs: number | null;
  slowestMs: number | null;
  standardDeviationMs: number | null;
  percentile90Ms: number | null;
}

function mean(values: readonly number[]): number | null {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function summarizeReactions(results: readonly ReactionResult[]): ReactionSummary {
  const valid = results
    .map(({ ms }) => ms)
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  const averageMs = mean(valid);
  const medianMs = median(valid);
  const variance = valid.length > 1 && averageMs !== null
    ? valid.reduce((sum, value) => sum + (value - averageMs) ** 2, 0) / (valid.length - 1)
    : null;

  return {
    count: valid.length,
    averageMs: averageMs === null ? null : Number(averageMs.toFixed(2)),
    medianMs: medianMs === null ? null : Number(medianMs.toFixed(2)),
    bestMs: valid.length ? Math.min(...valid) : null,
    slowestMs: valid.length ? Math.max(...valid) : null,
    standardDeviationMs: variance === null ? null : Number(Math.sqrt(variance).toFixed(2)),
    percentile90Ms: percentile(valid, 0.9),
  };
}
