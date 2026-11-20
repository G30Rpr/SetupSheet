/** Server-side sampling only; this is not a shared request-rate limit. */
export function sampleReportLog(): number | null {
  const configured = process.env.REPORT_LOG_SAMPLE_RATE?.trim();
  const value = configured ? Number(configured) : NaN;
  const rate = Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.1;
  if (rate === 0) return null;
  return rate === 1 || Math.random() < rate ? rate : null;
}
