/**
 * recomputeAlerts
 * JS re-implementation of utils_alerts.py so the threshold slider triggers a
 * full live recalculation without any round-trip to the server.
 */

const BASELINE_WINDOW = 6   // months of history for rolling mean
const MIN_PERIODS     = 3   // minimum history months before alerting

export function recomputeAlerts(features, threshold) {
  if (!features?.length) return features ?? []

  // Group by area, preserving original order within each group
  const byArea = new Map()
  for (const f of features) {
    if (!byArea.has(f.area_id)) byArea.set(f.area_id, [])
    byArea.get(f.area_id).push(f)
  }

  const result = []
  for (const [, rows] of byArea) {
    const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))

    for (let t = 0; t < sorted.length; t++) {
      const row = sorted[t]
      const ri  = row.risk_index ?? null

      // ── Spike: risk_index > 6-month rolling mean × (1 + threshold) ──────
      const history = sorted
        .slice(Math.max(0, t - BASELINE_WINDOW), t)
        .map(r => r.risk_index)
        .filter(v => v != null)

      const baseline =
        history.length >= MIN_PERIODS
          ? history.reduce((s, v) => s + v, 0) / history.length
          : null

      const alertSpike =
        baseline != null && ri != null
          ? ri > baseline * (1 + threshold)
          : false

      // ── Trend3: rising for 3 consecutive months ───────────────────────
      const riPrev1 = t >= 1 ? (sorted[t - 1].risk_index ?? null) : null
      const riPrev2 = t >= 2 ? (sorted[t - 2].risk_index ?? null) : null
      const alertTrend3 =
        ri != null && riPrev1 != null && riPrev2 != null &&
        ri > riPrev1 && riPrev1 > riPrev2

      const n = (alertSpike ? 1 : 0) + (alertTrend3 ? 1 : 0)
      const alertLevel = n === 0 ? 'none' : n === 1 ? 'watch' : 'warning'

      result.push({
        ...row,
        alert_spike:  alertSpike,
        alert_trend3: alertTrend3,
        alert_level:  alertLevel,
      })
    }
  }
  return result
}
