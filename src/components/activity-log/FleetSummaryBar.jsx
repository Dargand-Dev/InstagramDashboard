import { Smartphone, Play, AlertTriangle, ScrollText } from 'lucide-react'

const STATS = [
  { key: 'total', label: 'Total Devices', icon: Smartphone, color: '#A1A1AA' },
  { key: 'running', label: 'Running', icon: Play, color: '#3B82F6' },
  { key: 'error', label: 'Error', icon: AlertTriangle, color: '#EF4444' },
  { key: 'runsToday', label: 'Runs Today', icon: ScrollText, color: '#22C55E' },
]

export default function FleetSummaryBar({ devices, runs }) {
  const running = devices.filter(d => d.status === 'RUNNING').length
  const error = devices.filter(d => d.status === 'ERROR').length

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const runsToday = (runs || []).filter(r => {
    const t = r.startTime || r.startedAt || r.date
    return t && new Date(t) >= todayStart
  }).length

  const values = { total: devices.length, running, error, runsToday }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STATS.map(s => (
        <div key={s.key} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
            <span className="text-xs text-[#52525B]">{s.label}</span>
          </div>
          <p className="text-lg font-semibold" style={{ color: s.color }}>{values[s.key]}</p>
        </div>
      ))}
    </div>
  )
}
