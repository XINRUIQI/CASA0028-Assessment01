export default function ErrorScreen({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-300 gap-3">
      <span className="text-3xl">⚠</span>
      <p className="text-base font-medium text-red-400">Failed to load data</p>
      <p className="text-sm text-slate-500 max-w-sm text-center">{message}</p>
      <p className="text-xs text-slate-600 text-center">
        Make sure <code className="text-slate-400">public/data/</code> contains{' '}
        <code className="text-slate-400">areas.geojson</code>,{' '}
        <code className="text-slate-400">features.json</code> and{' '}
        <code className="text-slate-400">meta.json</code>.
      </p>
    </div>
  )
}
