/**
 * ControlsBar
 * The top control strip containing:
 *   - metricCompare mode: single-thumb slider + metric toggle
 *   - monthCompare  mode: dual-thumb slider (A = sky, B = orange) + delta toggle
 *   - Mode toggle always visible at fixed position
 *
 * Layout strategy
 * ───────────────
 * The bar is a single flex row.  To prevent position/size shifts when the
 * mode changes we:
 *   1. Both slider variants share the same height structure (20px track
 *      container + 22px ticks + 12px label row = 54 px content).
 *   2. The right-toggle section always occupies the same width by keeping
 *      BOTH SegmentedControls in the DOM — the inactive one uses
 *      `visibility: hidden` so it reserves space without being clickable.
 *      The active one is overlaid absolutely on top.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

/** Format 'YYYY-MM' → 'Jan 2025' */
function fmtMonth(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
}

// ── sub-components ───────────────────────────────────────────────────────────

/**
 * SegmentedControl — pill-shaped toggle for 2–3 options.
 */
/**
 * stretch — when true, the control fills its parent width and each button
 * uses flex-1 so that an overlaid control matches the reference control's width.
 */
function SegmentedControl({ options, value, onChange, accent = 'bg-orange-500', stretch = false }) {
  return (
    <div className={`flex items-center bg-slate-900/70 border border-slate-700 rounded-lg p-0.5 gap-0.5${stretch ? ' w-full' : ''}`}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${stretch ? 'flex-1 text-center' : ''} px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
              active
                ? `${accent} text-white shadow`
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// Tick marks shared by both slider variants.
// thumbR = 8 (half of 16 px thumb width) — corrects for thumb travel range.
function Ticks({ months, maxIdx, activeA, activeB, thumbR = 8 }) {
  return (
    <div className="relative mt-0.5" style={{ height: 22 }}>
      {months.map((m, i) => {
        const pct   = maxIdx === 0 ? 0 : (i / maxIdx) * 100
        const shift = thumbR * (1 - pct / 50)
        const isA   = i === activeA
        const isB   = activeB !== undefined && i === activeB
        const both  = isA && isB
        const abbr  = new Date(m + '-01').toLocaleString('en-GB', { month: 'short' })
        return (
          <div
            key={m}
            className="absolute flex flex-col items-center"
            style={{ left: `calc(${pct}% + ${shift}px)`, transform: 'translateX(-50%)', top: 0 }}
          >
            <div className={`w-px transition-all ${
              both  ? 'h-3   bg-sky-300'
              : isA && activeB !== undefined ? 'h-2.5 bg-sky-400'
              : isB ? 'h-2.5 bg-orange-400'
              : isA ? 'h-2.5 bg-orange-400'   // single-slider active
              :       'h-1.5 bg-slate-600'
            }`} />
            <span className={`text-[8px] leading-none mt-px transition-colors ${
              both  ? 'text-sky-200    font-bold'
              : isA && activeB !== undefined ? 'text-sky-300   font-bold'
              : isB ? 'text-orange-300 font-bold'
              : isA ? 'text-orange-300 font-bold'
              :       'text-slate-600'
            }`}>{abbr}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * SingleRangeSlider — used in metricCompare mode.
 * Height structure matches DualRangeSlider exactly so the bar never resizes.
 *   20 px track container + 0.5 gap + 22 px ticks + 0.5 gap + 12 px label = 54 px
 */
function SingleRangeSlider({ months, monthIndex, setMonthIndex }) {
  const maxIdx = months.length - 1
  return (
    <div className="flex flex-col flex-1">
      {/* Track — fixed 20 px container matches DualRangeSlider */}
      <div style={{ height: 20 }} className="flex items-center">
        <input
          type="range"
          min={0} max={maxIdx} step={1}
          value={monthIndex}
          onChange={e => setMonthIndex(+e.target.value)}
          className="w-full"
          style={{ margin: 0 }}
        />
      </div>

      <Ticks months={months} maxIdx={maxIdx} activeA={monthIndex} />

      {/* Label row — fixed 12 px to match DualRangeSlider's A/B label row */}
      <div className="flex justify-center mt-0.5" style={{ height: 12 }}>
        <span className="text-[10px] font-semibold text-orange-300 leading-none">
          {fmtMonth(months[monthIndex])}
        </span>
      </div>
    </div>
  )
}

/**
 * DualRangeSlider — used in monthCompare mode.
 *   Thumb A = sky-blue  (CSS class "range-a")
 *   Thumb B = orange    (CSS class "range-b")
 *
 * Two <input type="range"> stacked absolutely:
 *   pointer-events: none on the <input>, pointer-events: all on each thumb
 *   (via index.css ::-webkit-slider-thumb rules).
 */
function DualRangeSlider({ months, monthA, monthB, onChangeA, onChangeB }) {
  const maxIdx = months.length - 1
  const idxA   = Math.max(0, months.indexOf(monthA))
  const idxB   = Math.max(0, months.indexOf(monthB))

  const pctA   = maxIdx > 0 ? (idxA / maxIdx) * 100 : 0
  const pctB   = maxIdx > 0 ? (idxB / maxIdx) * 100 : 100
  const minPct = Math.min(pctA, pctB)
  const maxPct = Math.max(pctA, pctB)
  const rPct   = 100 - maxPct
  const thumbR = 8

  return (
    <div className="flex flex-col flex-1">
      {/* Track container — same 20 px height as SingleRangeSlider's wrapper */}
      <div className="relative" style={{ height: 20 }}>
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-600 rounded-full" />
        {/* Highlight between A and B */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-slate-400/40 rounded-full"
          style={{
            left:  `calc(${minPct}% + ${thumbR * (1 - minPct / 50)}px)`,
            right: `calc(${rPct}%  + ${thumbR * (1 - rPct   / 50)}px)`,
          }}
        />
        {/* Thumb A — sky-blue */}
        <input
          type="range" className="range-a"
          min={0} max={maxIdx} step={1}
          value={idxA}
          onChange={e => onChangeA(months[+e.target.value])}
        />
        {/* Thumb B — orange (rendered last → visually on top when overlapping) */}
        <input
          type="range" className="range-b"
          min={0} max={maxIdx} step={1}
          value={idxB}
          onChange={e => onChangeB(months[+e.target.value])}
        />
      </div>

      <Ticks months={months} maxIdx={maxIdx} activeA={idxA} activeB={idxB} />

      {/* A / B label row — fixed 12 px height */}
      <div className="flex justify-between items-center mt-0.5" style={{ height: 12 }}>
        <span className="text-[10px] font-semibold text-sky-400 leading-none">A: {fmtMonth(monthA)}</span>
        {monthA === monthB && (
          <span className="text-[10px] text-yellow-500 leading-none">⚠ same month</span>
        )}
        <span className="text-[10px] font-semibold text-orange-400 leading-none">B: {fmtMonth(monthB)}</span>
      </div>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────

export default function ControlsBar({
  meta,
  mode,          setMode,
  monthIndex,    setMonthIndex,
  monthA,        setMonthA,
  monthB,        setMonthB,
  displayMetric, setDisplayMetric,
  showDelta,     setShowDelta,
}) {
  if (!meta?.months) return null
  const months = meta.months

  const isMetric = mode === 'metricCompare'

  return (
    <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-2
                    flex items-center gap-x-6">

      {/* ── Slider section — flex-1, consistent height in both modes ──── */}
      <div className="flex items-center min-w-[300px] flex-1">
        {isMetric
          ? <SingleRangeSlider months={months} monthIndex={monthIndex} setMonthIndex={setMonthIndex} />
          : <DualRangeSlider   months={months} monthA={monthA} monthB={monthB} onChangeA={setMonthA} onChangeB={setMonthB} />
        }
      </div>

      {/* ── Mode toggle — position fixed by the right section's constant width ── */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500">Mode:</span>
        <SegmentedControl
          options={[
            { value: 'metricCompare', label: 'Count vs Risk' },
            { value: 'monthCompare',  label: 'Month Comparison' },
          ]}
          value={mode}
          onChange={setMode}
          accent="bg-orange-500"
        />
      </div>

      {/* ── Right toggle — constant width via `visibility` trick ────────
          Both SegmentedControls stay in the DOM.  The inactive one is
          `visibility:hidden` (reserves space) and `pointer-events:none`.
          The active one is absolutely overlaid on top.
          Container width is always set by the wider metric control.       ── */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Label changes dynamically but same char-count keeps widths stable */}
        <span className="text-xs text-slate-500 w-7 text-right">
          {isMetric ? 'Show:' : 'Map:'}
        </span>

        <div className="relative flex items-center">
          {/* Metric control — always in DOM; sets the container width */}
          <div
            style={{
              visibility:    isMetric ? 'visible' : 'hidden',
              pointerEvents: isMetric ? 'auto'    : 'none',
            }}
          >
            <SegmentedControl
              options={[
                { value: 'risk_index',  label: 'Risk Index' },
                { value: 'theft_count', label: 'Theft Count' },
              ]}
              value={displayMetric}
              onChange={setDisplayMetric}
              accent="bg-sky-600"
            />
          </div>

          {/* Map control — absolutely overlaid; stretch=true fills metric control's width */}
          <div
            className="absolute inset-0 flex items-center"
            style={{
              visibility:    isMetric ? 'hidden'  : 'visible',
              pointerEvents: isMetric ? 'none'    : 'auto',
            }}
          >
            <SegmentedControl
              options={[
                { value: false, label: 'A | B' },
                { value: true,  label: 'Δ Delta' },
              ]}
              value={showDelta}
              onChange={setShowDelta}
              accent="bg-sky-600"
              stretch
            />
          </div>
        </div>
      </div>
    </div>
  )
}
