import { useState, useEffect, useMemo } from 'react'
import { useDataLoader }       from './hooks/useDataLoader'
import { recomputeAlerts }     from './utils/recomputeAlerts'
import ControlsBar             from './components/ControlsBar'
import DualMapPanel            from './components/DualMapPanel'
import ExplainCard             from './components/ExplainCard'
import TrendChart              from './components/TrendChart'
import RankingChart            from './components/RankingChart'
import ErrorBoundary           from './components/ErrorBoundary'
import LoadingScreen           from './components/LoadingScreen'
import ErrorScreen             from './components/ErrorScreen'
import FilterPanel             from './components/FilterPanel'

// ── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const { areas, features, meta, loading, error } = useDataLoader()

  // ── Core state ───────────────────────────────────────────────────────────
  const [mode,             setMode]             = useState('metricCompare')
  const [monthIndex,       setMonthIndex]       = useState(0)
  const [monthA,           setMonthA]           = useState('')
  const [monthB,           setMonthB]           = useState('')
  const [selectedAreaId,   setSelectedAreaId]   = useState(null)
  const [displayMetric,    setDisplayMetric]    = useState('risk_index')
  const [showDelta,        setShowDelta]        = useState(false)

  // ── D4: Filter & threshold state ─────────────────────────────────────────
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false)
  const [alertThreshold,   setAlertThreshold]   = useState(0.5)  // 50% default

  // Initialise month selectors once meta loads
  useEffect(() => {
    if (!meta?.months?.length) return
    const months = meta.months
    setMonthIndex(months.length - 1)
    setMonthA(months[Math.max(0, months.length - 7)])
    setMonthB(months[months.length - 1])
  }, [meta])

  // ── Recompute alert flags when threshold changes (D4: ★ slider) ──────────
  const recomputedFeatures = useMemo(
    () => recomputeAlerts(features, alertThreshold),
    [features, alertThreshold]
  )

  // ── Derived data ─────────────────────────────────────────────────────────
  const currentMonth = meta?.months[monthIndex] ?? ''

  const currentFeatures = useMemo(() => {
    if (!recomputedFeatures || !currentMonth) return []
    return recomputedFeatures.filter(f => f.month === currentMonth)
  }, [recomputedFeatures, currentMonth])

  const featuresA = useMemo(() => {
    if (!recomputedFeatures || !monthA) return []
    return recomputedFeatures.filter(f => f.month === monthA)
  }, [recomputedFeatures, monthA])

  const featuresB = useMemo(() => {
    if (!recomputedFeatures || !monthB) return []
    return recomputedFeatures.filter(f => f.month === monthB)
  }, [recomputedFeatures, monthB])

  const deltaFeatures = useMemo(() => {
    if (!recomputedFeatures || !monthA || !monthB || monthA === monthB) return []
    const byArea = m =>
      Object.fromEntries(recomputedFeatures.filter(f => f.month === m).map(f => [f.area_id, f]))
    const aMap = byArea(monthA)
    const bMap = byArea(monthB)
    const allIds = new Set([...Object.keys(aMap), ...Object.keys(bMap)])
    return [...allIds].map(id => {
      const a = aMap[id] ?? {}
      const b = bMap[id] ?? {}
      const riA = a.risk_index ?? null
      const riB = b.risk_index ?? null
      return {
        area_id:           id,
        area_name:         a.area_name ?? b.area_name ?? '',
        delta_risk_index:  riA !== null && riB !== null ? +(riB - riA).toFixed(4) : null,
        delta_count:       (b.theft_count ?? 0) - (a.theft_count ?? 0),
        risk_index_a:      riA,
        risk_index_b:      riB,
        theft_count_a:     a.theft_count ?? 0,
        theft_count_b:     b.theft_count ?? 0,
        alert_level:       b.alert_level ?? 'none',
        stability_flag:    b.stability_flag ?? false,
      }
    })
  }, [recomputedFeatures, monthA, monthB])

  // Alert borough count (for badge on toggle chip)
  const alertCount = useMemo(() => {
    const source = mode === 'monthCompare' ? deltaFeatures : currentFeatures
    return source.filter(f => f.alert_level && f.alert_level !== 'none').length
  }, [mode, currentFeatures, deltaFeatures])

  // ── D4: Filtered + ranked Top-N ──────────────────────────────────────────
  const rankedTopN = useMemo(() => {
    const source = mode === 'monthCompare' ? deltaFeatures : currentFeatures
    const metric = mode === 'monthCompare' ? 'delta_risk_index' : displayMetric
    return [...source]
      .filter(f => f[metric] != null && !Number.isNaN(f[metric]))
      .filter(f => !filterAlertsOnly || (f.alert_level && f.alert_level !== 'none'))
      .sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity))
      .slice(0, 10)
  }, [mode, currentFeatures, deltaFeatures, displayMetric, filterAlertsOnly])

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen message={error} />

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 h-11 bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-orange-400">🚲</span>
          <span className="font-semibold text-base tracking-wide">Bike Theft: Counts vs Risk</span>
          <span className="text-slate-500 text-base">Compare counts vs risk index, detect abnormal months with alerts.</span>
        </div>
      </header>

      {/* ── Controls ── */}
      <ControlsBar
        meta={meta}
        mode={mode}             setMode={setMode}
        monthIndex={monthIndex} setMonthIndex={setMonthIndex}
        monthA={monthA}         setMonthA={setMonthA}
        monthB={monthB}         setMonthB={setMonthB}
        displayMetric={displayMetric} setDisplayMetric={setDisplayMetric}
        showDelta={showDelta}   setShowDelta={setShowDelta}
      />

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Map area ── */}
        <div className="flex-1 overflow-hidden">
          <ErrorBoundary>
            <DualMapPanel
              areas={areas}
              currentFeatures={currentFeatures}
              featuresA={featuresA}
              featuresB={featuresB}
              deltaFeatures={deltaFeatures}
              selectedAreaId={selectedAreaId}
              onSelectArea={setSelectedAreaId}
              currentMonth={currentMonth}
              monthA={monthA}
              monthB={monthB}
              mode={mode}
              showDelta={showDelta}
              filterAlertsOnly={filterAlertsOnly}
            />
          </ErrorBoundary>
        </div>

        {/* ── Right panel ── */}
        {/* ── Right panel ─────────────────────────────────────────────────────
             Layout (flex-col, overflow-hidden):
               ┌─ scrollable area (flex-1 overflow-y-auto) ──────────────────┐
               │  1. About text  OR  Borough snapshot (ExplainCard)           │
               │  2. Alerts only + Spike threshold (FilterPanel)              │
               │  3. Risk index over time (TrendChart, selected only)         │
               │  4. Top-10 ranking (RankingChart)                            │
               └─────────────────────────────────────────────────────────────┘
               ┌─ fixed footer (flex-shrink-0) ──────────────────────────────┐
               │  Data sources + © attribution — always visible at bottom     │
               └─────────────────────────────────────────────────────────────┘
        ── */}
        <aside className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden flex-shrink-0">

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* 1a. About panel (no borough selected) */}
            {!selectedAreaId && (
              <div className="px-4 pt-4 pb-4 border-b border-slate-700 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  You can see where bike thefts happen most — and whether
                  that's because there are more bikes parked there, or
                  because the area is genuinely riskier.
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Compare any two months to spot how risk has changed over
                  time, with automatic alerts flagging boroughs that show
                  unusual spikes or rising trends.
                </p>
                <div className="space-y-1.5 text-[11px] text-slate-500 leading-relaxed">
                  <p>
                    <span className="text-sky-400 font-semibold">Left map</span>
                    {' '}— theft count or risk index for the selected month.
                  </p>
                  <p>
                    <span className="text-orange-400 font-semibold">Right map</span>
                    {' '}— risk index, or a second month / delta for comparison.
                  </p>
                  <p>
                    <span className="text-slate-300 font-semibold">Risk Index</span>
                    {' '}= (borough_theft_count ÷ borough_exposure) ÷ city_mean.
                  </p>
                  <p>
                    Values <span className="text-red-400">&gt; 1</span> indicate
                    above-average risk per parking spot.
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Click any borough on the map to explore its full risk profile →
                </p>
              </div>
            )}

            {/* 1b. Borough snapshot (ExplainCard, borough selected) */}
            {selectedAreaId && (
              <ExplainCard
                selectedAreaId={selectedAreaId}
                features={recomputedFeatures}
                currentFeatures={currentFeatures}
                deltaFeatures={deltaFeatures}
                meta={meta}
                mode={mode}
                currentMonth={currentMonth}
                monthA={monthA}
                monthB={monthB}
                alertThreshold={alertThreshold}
                onClose={() => setSelectedAreaId(null)}
              />
            )}

            {/* 2. Alerts only + Spike threshold (FilterPanel) */}
            <FilterPanel
              filterAlertsOnly={filterAlertsOnly} setFilterAlertsOnly={setFilterAlertsOnly}
              alertThreshold={alertThreshold}     setAlertThreshold={setAlertThreshold}
              alertCount={alertCount}
            />

            <ErrorBoundary>
              {/* 3. Risk index over time (TrendChart, borough selected only) */}
              {selectedAreaId && (
                <TrendChart
                  features={recomputedFeatures}
                  selectedAreaId={selectedAreaId}
                  meta={meta}
                  currentMonthIndex={monthIndex}
                />
              )}

              {/* 4. Top-10 ranking (RankingChart) */}
              <RankingChart
                rankedTopN={rankedTopN}
                mode={mode}
                displayMetric={displayMetric}
                selectedAreaId={selectedAreaId}
                onSelectArea={setSelectedAreaId}
              />
            </ErrorBoundary>

            {/* Alert level legend */}
            <div className="px-4 py-2.5 border-t border-slate-700/60 space-y-0.5">
              <p className="text-[9px] text-slate-600 leading-snug">
                <span className="text-yellow-400">● Watch</span>
                {' '}— 1 signal: spike <span className="text-slate-700">or</span> 3-month rise
              </p>
              <p className="text-[9px] text-slate-600 leading-snug">
                <span className="text-red-400">⚠ Warning</span>
                {' '}— 2 signals: spike <span className="text-slate-700">and</span> 3-month rise
              </p>
            </div>

            {/* ── Footer — scrolls with content ── */}
            <div className="px-4 py-3 border-t border-slate-700 space-y-1.5">
            <div className="text-[10px] text-slate-600 leading-relaxed space-y-0.5">
              <p>Data sources:</p>
              <p>· UK Police Open Data API (bicycle theft incidents)</p>
              <p>· OpenStreetMap Overpass API (cycle parking exposure)</p>
              <p>· GLA London Borough Boundaries</p>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              ©{' '}
              <a href="https://www.maplibre.org/" target="_blank" rel="noreferrer"
                 className="underline hover:text-slate-400">MapLibre</a>
              {' | '}©{' '}
              <a href="https://carto.com/attributions" target="_blank" rel="noreferrer"
                 className="underline hover:text-slate-400">CARTO</a>
              {' | '}©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer"
                 className="underline hover:text-slate-400">OpenStreetMap</a>{' '}contributors
            </p>
            </div>

          </div>{/* end scrollable */}

        </aside>
      </div>
    </div>
  )
}
