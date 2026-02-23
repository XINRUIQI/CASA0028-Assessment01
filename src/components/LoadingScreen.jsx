export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-slate-300 gap-4">
      <div className="w-10 h-10 border-4 border-slate-600 border-t-orange-400 rounded-full animate-spin" />
      <p className="text-sm tracking-widest uppercase">Loading data…</p>
    </div>
  )
}
