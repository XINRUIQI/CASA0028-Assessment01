/**
 * DualMapPanel  (C5 + D1 + D3)
 * ──────────────────────────────────────────────────────────────────────────
 * Two MapLibre GL maps, side-by-side, fully synced.
 *
 * metricCompare mode
 *   Left  – Theft Count   (currentFeatures)
 *   Right – Risk Index    (currentFeatures)
 *
 * monthCompare mode, showDelta = false   [A | B]
 *   Left  – Risk Index, Month A   (featuresA)
 *   Right – Risk Index, Month B   (featuresB)
 *
 * monthCompare mode, showDelta = true    [Δ]
 *   Left  – Risk Index, Month A   (featuresA)  ← anchor / reference
 *   Right – Δ Risk Index (B − A)  (deltaFeatures)
 *
 * D3: every Borough with alert_level 'warning' gets a red border;
 *     'watch' gets a yellow border.  The selected Borough always gets
 *     an orange border at the highest priority.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Map, Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

// ── MapLibre paint expressions ───────────────────────────────────────────────

const THEFT_COUNT_COLOR = [
  'step', ['coalesce', ['get', 'theft_count'], -1], '#475569',
  0,   '#ffffff',  1,   '#c7d2fe',  20,  '#818cf8',
  40,  '#4f46e5',  65,  '#3730a3',  100, '#1e1b4b',
]

const RISK_INDEX_COLOR = [
  'step', ['coalesce', ['get', 'risk_index'], -1], '#475569',
  0.0, '#fee2e2',  0.6, '#fca5a5',  0.85, '#ef4444',
  1.15,'#dc2626',  1.5, '#991b1b',  2.0,  '#450a0a',
]

const DELTA_RISK_COLOR = [
  'step', ['coalesce', ['get', 'delta_risk_index'], 0],
  '#1d4ed8',
  -1.5, '#60a5fa',  -0.8, '#bfdbfe',  -0.4, '#ffffff',
   0.4, '#fca5a5',   0.8, '#dc2626',   1.5, '#7f1d1d',
]

// ── Legend definitions ───────────────────────────────────────────────────────

const COUNT_LEGEND = {
  title: 'Theft Count',
  items: [
    { color: '#ffffff', label: '0' },         { color: '#c7d2fe', label: '1–19' },
    { color: '#818cf8', label: '20–39' },      { color: '#4f46e5', label: '40–64' },
    { color: '#3730a3', label: '65–99' },      { color: '#1e1b4b', label: '≥ 100' },
  ],
}

const RISK_LEGEND = {
  title: 'Risk Index',
  subtitle: 'baseline = 1.0',
  items: [
    { color: '#fee2e2', label: '< 0.6' },      { color: '#fca5a5', label: '0.6–0.85' },
    { color: '#ef4444', label: '0.85–1.15' },  { color: '#dc2626', label: '1.15–1.5' },
    { color: '#991b1b', label: '1.5–2.0' },    { color: '#450a0a', label: '> 2.0' },
  ],
}

const DELTA_LEGEND = {
  title: 'Δ Risk Index (B − A)',
  subtitle: 'change vs month A',
  items: [
    { color: '#1d4ed8', label: '≤ −1.5  big drop' },
    { color: '#60a5fa', label: '−1.5 to −0.8  drop' },
    { color: '#bfdbfe', label: '−0.8 to −0.4  slight drop' },
    { color: '#ffffff', label: '≈ 0  stable' },
    { color: '#fca5a5', label: '0.4–0.8  rise' },
    { color: '#dc2626', label: '0.8–1.5  large rise' },
    { color: '#7f1d1d', label: '≥ 1.5  big rise' },
  ],
}

// alert border legends (appended at bottom of main legend)
const ALERT_LEGEND_ITEMS = [
  { color: '#ef4444', label: '── Warning alert' },
  { color: '#fbbf24', label: '── Watch alert' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1, 1).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
}

// ── Legend overlay (default open, collapses on click) ────────────────────────

function Legend({ def, showAlerts }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="absolute bottom-5 left-0 z-10 flex items-end select-none">

      {/* ── Collapsible panel (slides in from the left) ── */}
      <div style={{
        overflow: 'hidden',
        maxWidth: open ? 200 : 0,
        opacity: open ? 1 : 0,
        transition: 'max-width 0.22s ease, opacity 0.15s ease',
        pointerEvents: 'none',
      }}>
        <div
          className="bg-slate-900/90 backdrop-blur-sm text-[10px] border-t border-r border-b border-slate-700"
          style={{ width: 166, borderRadius: '0 8px 8px 0', padding: '10px 10px 10px 12px' }}
        >
          <p className="font-semibold text-slate-200 mb-0.5 whitespace-nowrap">{def.title}</p>
          {def.subtitle && (
            <p className="text-slate-500 mb-1.5 whitespace-nowrap">{def.subtitle}</p>
          )}
          <div className="space-y-1">
            {def.items.map(it => (
              <div key={it.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: it.color }} />
                <span className="text-slate-300 whitespace-nowrap">{it.label}</span>
              </div>
            ))}
            {showAlerts && (
              <div className="border-t border-slate-700 mt-1.5 pt-1.5">
                <p className="text-slate-500 mb-1">Alert borders:</p>
                {ALERT_LEGEND_ITEMS.map(it => (
                  <div key={it.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 shrink-0 rounded" style={{ backgroundColor: it.color }} />
                    <span className="text-slate-300 whitespace-nowrap">{it.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toggle tab (always visible at the left edge) ── */}
      <button
        onClick={() => setOpen(v => !v)}
        title={open ? 'Collapse legend' : 'Expand legend'}
        className="bg-slate-900/90 backdrop-blur-sm border-t border-r border-b border-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer flex items-center justify-center"
        style={{
          borderLeft: 'none',
          borderRadius: '0 6px 6px 0',
          padding: '8px 5px',
        }}
      >
        {/* Chevron: points right (▶) when collapsed, left (◀) when open */}
        <svg
          width="11" height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        >
          <path d="M8 5l8 7-8 7z"/>
        </svg>
      </button>

    </div>
  )
}

// ── Map header label ──────────────────────────────────────────────────────────

function MapLabel({ title, month, accentClass }) {
  return (
    <div className="absolute top-3 left-3 z-10 bg-slate-900/85 backdrop-blur-sm rounded-lg px-3.5 py-1.5 border border-slate-600 pointer-events-none shadow-lg">
      <span className={`text-[15px] font-bold tracking-wide ${accentClass}`}>{title}</span>
      {month && <span className="text-[13px] text-slate-300 font-medium ml-1.5">· {fmtMonth(month)}</span>}
    </div>
  )
}

// ── Compact attribution (always starts collapsed; expands on click) ────────────

function CompactAttribution() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 20 }}>
      {/* ⓘ toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Map attribution"
        style={{
          width: 20, height: 20,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.75)',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: 12,
          lineHeight: 1,
          color: '#333',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      >
        i
      </button>

      {/* expanded panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 26,
          right: 0,
          background: 'rgba(255,255,255,0.88)',
          padding: '4px 8px',
          borderRadius: 3,
          fontSize: 11,
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          color: '#222',
        }}>
          © <a href="https://www.maplibre.org/" target="_blank" rel="noreferrer" style={{ color: '#1a6cc4' }}>MapLibre</a>
          {' | '}
          © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" style={{ color: '#1a6cc4' }}>CARTO</a>
          {' | '}
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ color: '#1a6cc4' }}>OpenStreetMap</a> contributors
        </div>
      )}
    </div>
  )
}

// ── Custom scale bar (replaces MapLibre ScaleControl for precise positioning) ─

function CustomScaleBar({ viewState }) {
  const zoom = viewState?.zoom    ?? 9.2
  const lat  = viewState?.latitude ?? 51.507

  // Web Mercator meters-per-pixel at 512 px tiles
  const metersPerPx = 78271.517 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)

  // Target ~80 px, snap to a nice round distance
  const targetM = metersPerPx * 80
  const steps   = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const niceM   = steps.find(s => s >= targetM) ?? steps[steps.length - 1]
  const barW    = Math.round(niceM / metersPerPx)
  const label   = niceM >= 1000 ? `${niceM / 1000} km` : `${niceM} m`

  return (
    <div style={{
      position: 'absolute',
      bottom: 10,
      right: 15,          /* ← exact pixel control, 5 px left of the button group edge */
      zIndex: 10,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 3,
    }}>
      <span style={{
        fontSize: 10,
        fontFamily: 'sans-serif',
        color: '#fff',
        textShadow: '0 0 3px rgba(0,0,0,0.95)',
        lineHeight: 1,
        letterSpacing: '0.02em',
      }}>
        {label}
      </span>
      <div style={{
        width: barW,
        height: 4,
        background: 'rgba(255,255,255,0.88)',
        border: '1.5px solid rgba(0,0,0,0.65)',
        borderRadius: 1,
        boxSizing: 'border-box',
      }} />
    </div>
  )
}

// ── Map Controls Overlay ──────────────────────────────────────────────────────
// Zoom ± / Compass / Home  (placed bottom-right, above the scale bar)

function MapControlsOverlay({ viewState, onZoomIn, onZoomOut, onResetNorth, onHome }) {
  const bearing = viewState?.bearing ?? 0

  const grp = {
    background: '#fff',
    borderRadius: '4px',
    boxShadow: '0 0 0 2px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
  const btn = {
    width: 29,
    height: 29,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    color: '#333',
  }
  const divider = { height: 1, background: 'rgba(0,0,0,0.12)' }

  return (
    <div style={{
      position: 'absolute',
      bottom: 50,
      right: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 10,
    }}>

      {/* ── Zoom in / out ── */}
      <div style={grp}>
        <button style={btn} onClick={onZoomIn} title="Zoom in" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
          </svg>
        </button>
        <div style={divider} />
        <button style={btn} onClick={onZoomOut} title="Zoom out" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 11H5v2h14z"/>
          </svg>
        </button>
      </div>

      {/* ── Compass / North arrow ── */}
      <div style={grp}>
        <button style={btn} onClick={onResetNorth} title="Click to reset north" type="button">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.15s ease' }}
          >
            {/* N tip – red */}
            <path d="M12 3L9.2 11h5.6L12 3z" fill="#e74c3c"/>
            {/* S tip – dark */}
            <path d="M12 21L9.2 13h5.6L12 21z" fill="#555"/>
            {/* Centre dot */}
            <circle cx="12" cy="12" r="1.6" fill="#555"/>
          </svg>
        </button>
      </div>

      {/* ── Home / Reset view ── */}
      <div style={grp}>
        <button style={btn} onClick={onHome} title="Reset to home view" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </button>
      </div>

    </div>
  )
}

// ── Single map wrapper ────────────────────────────────────────────────────────

function OneMap({
  id, geoJSON, fillColor, selectedAreaId,
  filterAlertsOnly,
  viewState, onMove, onClick, getCursor,
  onZoomIn, onZoomOut, onResetNorth, onHome,
  label, month, accentClass, legend, hasAlerts,
}) {
  // ── Breathing animation for alert borders (20 fps, 2-second period) ──────
  // breath oscillates 0 → 1 → 0 via sine wave; only warning/watch borders use it.
  const [breath, setBreath] = useState(1)
  useEffect(() => {
    const id = setInterval(() => {
      const phase = (Date.now() % 1800) / 1800          // 0 → 1 over 1 s
      setBreath(0.5 + 0.5 * Math.sin(phase * Math.PI * 2))
    }, 50)                                               // ~20 fps
    return () => clearInterval(id)
  }, [])

  // ── D4: fill opacity responds to filter toggles ──────────────────────────
  // Priority: selected > alert (preserved) > filters (dim) > default
  const fillOpacity = useMemo(() => [
    'case',
    // 1. Selected area: always fully visible
    ['==', ['get', 'area_id'], selectedAreaId ?? ''], 0.92,
    // 2. When "Alerts only": non-alert areas become ghost
    ...(filterAlertsOnly
      ? [['!', ['in', ['get', 'alert_level'], ['literal', ['warning', 'watch']]]], 0.06]
      : []),
    // 3. Default
    0.72,
  ], [selectedAreaId, filterAlertsOnly])

  // ── D3 + D4: border — selection > alert borders (animated) > filter dimming
  const borderPaint = useMemo(() => {
    // Breathing values — warning pulses harder than watch
    const warnOpacity  = 0.50 + 0.50 * breath   // 0.50 → 1.00
    const watchOpacity = 0.38 + 0.47 * breath   // 0.38 → 0.85
    const warnWidth    = 1.6  + 1.0  * breath   // 1.6  → 2.6
    const watchWidth   = 1.1  + 0.7  * breath   // 1.1  → 1.8

    return {
      'line-color': ['case',
        ['==', ['get', 'area_id'], selectedAreaId ?? ''], '#f97316',
        ['==', ['get', 'alert_level'], 'warning'],        '#ef4444',
        ['==', ['get', 'alert_level'], 'watch'],          '#fbbf24',
        '#0f172a',
      ],
      'line-width': ['case',
        ['==', ['get', 'area_id'], selectedAreaId ?? ''], 2.5,
        ['==', ['get', 'alert_level'], 'warning'],        warnWidth,   // breathing
        ['==', ['get', 'alert_level'], 'watch'],          watchWidth,  // breathing
        0.5,                                                           // static
      ],
      'line-opacity': ['case',
        ['==', ['get', 'area_id'], selectedAreaId ?? ''], 1.0,
        ['==', ['get', 'alert_level'], 'warning'],        warnOpacity,  // breathing
        ['==', ['get', 'alert_level'], 'watch'],          watchOpacity, // breathing
        filterAlertsOnly ? 0.0 : 0.35,                                 // static
      ],
    }
  }, [selectedAreaId, filterAlertsOnly, breath])

  return (
    <div className="flex-1 relative overflow-hidden">
      <MapLabel title={label} month={month} accentClass={accentClass} />
      <Map
        id={id}
        {...viewState}
        onMove={onMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        interactiveLayerIds={['borough-fill']}
        onClick={onClick}
        getCursor={getCursor}
        attributionControl={false}
      >
        <Source id="boroughs" type="geojson" data={geoJSON}>
          <Layer
            id="borough-fill"
            type="fill"
            paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }}
          />
          {/* D3: alert + selection borders */}
          <Layer id="alert-borders" type="line" paint={borderPaint} />
        </Source>
      </Map>
      <Legend def={legend} showAlerts={hasAlerts} />
      {/* ── Scale bar ── */}
      <CustomScaleBar viewState={viewState} />
      {/* ── Custom controls: zoom / compass / home ── */}
      <MapControlsOverlay
        viewState={viewState}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetNorth={onResetNorth}
        onHome={onHome}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

// zoom 9.0 → metersPerPx ≈ 95 → targetM ≈ 7 600 m → niceM = 10 000 → scale bar shows "10 km"
const INITIAL_VIEW = { longitude: -0.118, latitude: 51.507, zoom: 9.0 }

export default function DualMapPanel({
  areas,
  currentFeatures,   // metricCompare: current month
  featuresA,         // monthCompare: month A rows
  featuresB,         // monthCompare: month B rows
  deltaFeatures,     // monthCompare: pre-computed Δ rows
  selectedAreaId,
  onSelectArea,
  currentMonth,
  monthA,
  monthB,
  mode,              // 'metricCompare' | 'monthCompare'
  showDelta,         // monthCompare only: false=[A|B]  true=[Δ right panel]
  filterAlertsOnly,  // D4: dim non-alert areas on map
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW)

  // ── Build enriched GeoJSON from a feature-row array ───────────────────────
  const makeGeoJSON = useCallback((rows) => {
    if (!areas) return null
    if (!rows?.length) return areas
    const dataByArea = Object.fromEntries(rows.map(f => [f.area_id, f]))
    return {
      type: 'FeatureCollection',
      features: areas.features.map(f => ({
        ...f,
        properties: { ...f.properties, ...(dataByArea[f.properties.area_id] ?? {}) },
      })),
    }
  }, [areas])

  // GeoJSON for each panel
  const leftGeoJSON = useMemo(() => {
    const rows = mode === 'metricCompare' ? currentFeatures : featuresA
    return makeGeoJSON(rows)
  }, [makeGeoJSON, mode, currentFeatures, featuresA])

  const rightGeoJSON = useMemo(() => {
    if (mode === 'metricCompare') return makeGeoJSON(currentFeatures)
    if (showDelta)                return makeGeoJSON(deltaFeatures)
    return makeGeoJSON(featuresB)
  }, [makeGeoJSON, mode, showDelta, currentFeatures, featuresB, deltaFeatures])

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleMove  = useCallback(evt => setViewState(evt.viewState), [])
  const handleClick = useCallback(evt => {
    const clickedId = evt.features?.[0]?.properties?.area_id ?? null
    onSelectArea(clickedId === selectedAreaId ? null : clickedId)
  }, [selectedAreaId, onSelectArea])
  const getCursor = useCallback(
    ({ isHovering, isDragging }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab',
    []
  )

  // ── Map control handlers (shared by both maps via viewState) ──────────────
  const handleZoomIn     = useCallback(() => setViewState(v => ({ ...v, zoom: Math.min(18, (v.zoom ?? 9.2) + 1) })), [])
  const handleZoomOut    = useCallback(() => setViewState(v => ({ ...v, zoom: Math.max(2,  (v.zoom ?? 9.2) - 1) })), [])
  const handleResetNorth = useCallback(() => setViewState(v => ({ ...v, bearing: 0 })), [])
  const handleHome       = useCallback(() => setViewState({ ...INITIAL_VIEW }), [])

  if (!leftGeoJSON || !rightGeoJSON) return null

  // ── Label / colour / legend config per mode ───────────────────────────────
  let leftLabel, rightLabel, leftMonth, rightMonth
  let leftFill, rightFill, leftLegend, rightLegend

  if (mode === 'metricCompare') {
    leftLabel  = 'Theft Count';  rightLabel  = 'Risk Index'
    leftMonth  = currentMonth;   rightMonth  = currentMonth
    leftFill   = THEFT_COUNT_COLOR
    rightFill  = RISK_INDEX_COLOR
    leftLegend = COUNT_LEGEND;   rightLegend = RISK_LEGEND
  } else if (showDelta) {
    leftLabel  = 'Risk Index A';  rightLabel  = 'Δ Risk Index'
    leftMonth  = monthA;          rightMonth  = null
    leftFill   = RISK_INDEX_COLOR
    rightFill  = DELTA_RISK_COLOR
    leftLegend = RISK_LEGEND;    rightLegend = DELTA_LEGEND
  } else {
    leftLabel  = 'Risk Index A';  rightLabel  = 'Risk Index B'
    leftMonth  = monthA;          rightMonth  = monthB
    leftFill   = RISK_INDEX_COLOR
    rightFill  = RISK_INDEX_COLOR
    leftLegend = RISK_LEGEND;    rightLegend = RISK_LEGEND
  }

  // Check if any alerts exist to decide whether to show alert legend items
  const hasAlerts = [...(featuresA ?? []), ...(currentFeatures ?? [])]
    .some(f => f.alert_level && f.alert_level !== 'none')

  const common = {
    viewState, onMove: handleMove, onClick: handleClick, getCursor,
    selectedAreaId, hasAlerts,
    filterAlertsOnly: !!filterAlertsOnly,
    onZoomIn:      handleZoomIn,
    onZoomOut:     handleZoomOut,
    onResetNorth:  handleResetNorth,
    onHome:        handleHome,
  }

  return (
    <div className="flex h-full">
      <OneMap
        id="map-left"
        geoJSON={leftGeoJSON}
        fillColor={leftFill}
        label={leftLabel}
        month={leftMonth}
        accentClass="text-sky-400"
        legend={leftLegend}
        {...common}
      />
      <div className="w-px bg-slate-700 flex-shrink-0" />
      <OneMap
        id="map-right"
        geoJSON={rightGeoJSON}
        fillColor={rightFill}
        label={rightLabel}
        month={rightMonth}
        accentClass={showDelta && mode === 'monthCompare' ? 'text-purple-400' : 'text-orange-400'}
        legend={rightLegend}
        {...common}
      />
    </div>
  )
}
