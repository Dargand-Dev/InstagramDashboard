import { Users, Activity, Film, Clock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'

function deriveRunStatus(run) {
  if (run.status) return run.status
  if (run.failureCount > 0 && run.successCount === 0) return 'FAILED'
  if (run.failureCount > 0 && run.successCount > 0) return 'PARTIAL'
  return 'SUCCESS'
}

function formatDuration(ms) {
  if (!ms) return '—'
  if (typeof ms === 'string') return ms
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export default function Dashboard() {
  const { data: runsData } = useApi('/api/automation/runs?limit=5')
  const { data: accounts } = useApi('/api/accounts')
  const { data: content } = useApi('/api/automation/content-status')
  const { data: schedule } = useApi('/api/automation/schedule')
  const { data: lockStatus, error: lockError } = useApi('/api/automation/lock-status')
  const navigate = useNavigate()

  const lastRun = runsData?.runs?.[0]
  const activeAccounts = accounts?.filter(a => a.status === 'ACTIVE')?.length || 0
  const totalAccounts = accounts?.length || 0
  const suspendedAccounts = accounts?.filter(a => a.status === 'SUSPENDED')?.length || 0
  const bannedAccounts = accounts?.filter(a => a.status === 'BANNED')?.length || 0
  const isLocked = lockStatus?.locked || lockError

  const identities = content
    ? Array.isArray(content) ? content : content.identities || []
    : []

  const totalReels = identities.reduce((sum, i) => sum + (i.availableReels ?? i.reelCount ?? i.count ?? 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-[#333] mt-0.5">Instagram automation overview</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-warning animate-pulse' : 'bg-success'}`} />
          <span className="text-xs text-[#555] font-medium">
            {isLocked ? 'System locked' : 'System idle'}
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Active accounts */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Active Accounts</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/10">
              <Users size={14} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{activeAccounts}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: totalAccounts ? `${(activeAccounts / totalAccounts) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-[10px] text-[#555] font-medium">/ {totalAccounts}</span>
          </div>
        </Card>

        {/* Last run */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Last Run</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-500/10">
              <Activity size={14} className="text-blue-400" />
            </div>
          </div>
          {lastRun ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={deriveRunStatus(lastRun)} />
                <span className="text-[10px] text-[#555]">{formatDuration(lastRun.duration || lastRun.durationMs)}</span>
              </div>
              <p className="text-xs text-[#333]">
                {lastRun.timestamp ? new Date(lastRun.timestamp).toLocaleString() : '—'}
              </p>
              {lastRun.successCount !== undefined && (
                <p className="text-xs mt-1">
                  <span className="text-emerald-400">{lastRun.successCount}</span>
                  <span className="text-[#333]"> / </span>
                  <span className="text-red-400">{lastRun.failureCount || 0}</span>
                </p>
              )}
            </>
          ) : (
            <span className="text-xs text-[#333]">No runs yet</span>
          )}
        </Card>

        {/* Content stock */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Content Stock</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-purple-500/10">
              <Film size={14} className="text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{totalReels}</div>
          <p className="text-xs text-[#333] mt-1">reels across {identities.length} identities</p>
        </Card>

        {/* Next run */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <span className="label-upper">Next Run</span>
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-amber-500/10">
              <Clock size={14} className="text-amber-400" />
            </div>
          </div>
          {schedule ? (
            <>
              <StatusBadge status={schedule.enabled ? 'ENABLED' : 'DISABLED'} />
              <p className="text-xs text-[#333] mt-2">
                {schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : '—'}
              </p>
            </>
          ) : (
            <span className="text-xs text-[#333]">Loading...</span>
          )}
        </Card>
      </div>

      {/* Bottom section: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Recent runs table */}
        <div className="lg:col-span-3">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <span className="label-upper">Recent Runs</span>
              <button
                onClick={() => navigate('/activity')}
                className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white transition-colors font-medium"
              >
                View all <ArrowRight size={10} />
              </button>
            </div>
            <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Date</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Status</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Duration</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Results</th>
                  </tr>
                </thead>
                <tbody>
                  {!runsData?.runs?.length ? (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-[#333]">No runs yet</td></tr>
                  ) : (
                    runsData.runs.slice(0, 5).map((run, i) => (
                      <tr key={run.id || i} className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors">
                        <td className="px-3 py-2.5 text-[#555]">
                          {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={deriveRunStatus(run)} />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#555]">{formatDuration(run.duration || run.durationMs)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-emerald-400">{run.successCount || 0}</span>
                          <span className="text-[#333]"> / </span>
                          <span className="text-red-400">{run.failureCount || 0}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-3">
          {/* Content by identity */}
          <Card>
            <span className="label-upper block mb-3">Content by Identity</span>
            {identities.length === 0 ? (
              <p className="text-xs text-[#333]">No data</p>
            ) : (
              <div className="space-y-3">
                {identities.map((identity, i) => {
                  const count = identity.availableReels ?? identity.reelCount ?? identity.count ?? 0
                  const max = identity.maxReels ?? identity.capacity ?? 200
                  const pct = Math.min((count / max) * 100, 100)
                  const barColor = identity.status === 'EMPTY' || identity.alert === 'EMPTY'
                    ? 'bg-red-500'
                    : identity.status === 'LOW_STOCK' || identity.alert === 'LOW_STOCK'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-white font-medium">
                          {identity.identityId || identity.identityName || identity.identity || `Identity ${i + 1}`}
                        </span>
                        <span className="text-[10px] font-mono text-[#555]">{count}/{max}</span>
                      </div>
                      <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Account health */}
          <Card>
            <span className="label-upper block mb-3">Account Health</span>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xl font-extrabold text-emerald-400">{activeAccounts}</div>
                <span className="text-[10px] text-[#555] font-medium">Active</span>
              </div>
              <div className="text-center">
                <div className="text-xl font-extrabold text-amber-400">{suspendedAccounts}</div>
                <span className="text-[10px] text-[#555] font-medium">Suspended</span>
              </div>
              <div className="text-center">
                <div className="text-xl font-extrabold text-red-400">{bannedAccounts}</div>
                <span className="text-[10px] text-[#555] font-medium">Banned</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
