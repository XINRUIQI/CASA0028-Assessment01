function ToggleChip({ active, onClick, color, children }) {
  const colors = {
    red:    active ? 'bg-red-500/20 border-red-500/60 text-red-300'          : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500',
    yellow: active ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300' : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${colors[color]}`}
    >
      {children}
    </button>
  )
}

export default function FilterPanel({
  filterAlertsOnly, setFilterAlertsOnly,
  alertThreshold,   setAlertThreshold,
  alertCount,
}) {
  const pct = Math.round(alertThreshold * 100)

  return (
    <div className="px-4 pt-3 pb-3 border-b border-slate-700/80 bg-slate-800/60">
      {/* Row 1: toggle chips */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <ToggleChip
          active={filterAlertsOnly}
          onClick={() => setFilterAlertsOnly(v => !v)}
          color="red"
        >
          <span className={filterAlertsOnly ? 'text-red-400' : 'text-slate-500'}>⚠</span>
          Alerts only
          {alertCount > 0 && (
            <span className={`ml-0.5 px-1 rounded text-[9px] font-bold ${
              filterAlertsOnly ? 'bg-red-500/30 text-red-200' : 'bg-slate-600 text-slate-400'
            }`}>{alertCount}</span>
          )}
        </ToggleChip>
      </div>

      {/* Row 2: alert threshold slider */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] text-slate-500">Spike threshold</span>
          <span className="text-[10px] font-mono text-orange-300">+{pct}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={pct}
          onChange={e => setAlertThreshold(+e.target.value / 100)}
          className="w-full"
        />
        <p className="text-[9px] text-slate-600 mt-0.5 leading-snug">
          Flag spike when risk exceeds 6-month mean by more than this %
        </p>
      </div>
    </div>
  )
}
