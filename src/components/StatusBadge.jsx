const statusStyles = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  SUSPENDED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  BANNED: 'bg-red-500/10 text-red-400 border-red-500/20',
  ERROR: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
  PARTIAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  ABORTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  RUNNING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  STOPPING: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  ENABLED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DISABLED: 'bg-[#141414] text-[#555] border-[#1a1a1a]',
  CLEAN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW_STOCK: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  EMPTY: 'bg-red-500/10 text-red-400 border-red-500/20',
  OK: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function StatusBadge({ status }) {
  const style = statusStyles[status] || 'bg-[#141414] text-[#555] border-[#1a1a1a]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold tracking-wide uppercase ${style}`}>
      {status}
    </span>
  )
}
