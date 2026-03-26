import { Users, Activity, Film, Clock, ArrowRight, AlertTriangle, UserPlus, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import LiveExecutionPanel from '../components/LiveExecutionPanel'
import { formatDuration } from '../components/LogStreamCard'
import { useApi } from '../hooks/useApi'
import { useActiveRuns } from '../hooks/useActiveRuns'
import { Blur } from '../contexts/IncognitoContext'

function deriveRunStatus(run) {
  if (run.status) return run.status
  if (run.failureCount > 0 && run.successCount === 0) return 'FAILED'
  if (run.failureCount > 0 && run.successCount > 0) return 'PARTIAL'
  return 'SUCCESS'
}

function timeAgo(date) {
  if (!date) return '—'
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  if (diff < 0) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const RUN_TYPE_CONFIG = {
  PostReel: { label: 'Post', icon: Send, cls: 'bg-cyan-500/8 text-cyan-400 border-cyan-500/15' },
  CreateAccount: { label: 'Creation', icon: UserPlus, cls: 'bg-violet-500/8 text-violet-400 border-violet-500/15' },
  CreateAccountFromExistingContainer: { label: 'Creation', icon: UserPlus, cls: 'bg-violet-500/8 text-violet-400 border-violet-500/15' },
}
const DEFAULT_RUN_TYPE = { label: 'Unknown', icon: Send, cls: 'bg-[#141414] text-[#555] border-[#1a1a1a]' }

function getRunType(run) {
  const type = run.workflowType
  if (type && RUN_TYPE_CONFIG[type]) return RUN_TYPE_CONFIG[type]
  return DEFAULT_RUN_TYPE
}

export default function Dashboard() {
  const { data: runsData } = useApi('/api/automation/runs?limit=5')
  const { data: accounts } = useApi('/api/accounts')
  const { data: content } = useApi('/api/automation/content-status')
  const { data: schedule } = useApi('/api/automation/schedule')
  const { data: lockStatus, error: lockError } = useApi('/api/automation/lock-status')
  const { activeRuns, hasActiveRuns } = useActiveRuns(4000)
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

  const exhaustedStoryPools = identities.flatMap(identity =>
    (identity.storyMediaPool || [])
      .filter(p => p.status === 'EXHAUSTED')
      .map(p => ({ ...p, identityId: identity.identityId }))
  )

  return (
    <div>
      {exhaustedStoryPools.length > 0 && (
        <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/15 rounded-md p-3 mb-4">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-red-400 text-xs font-medium">
            Story media pool exhausted for: <Blur>{exhaustedStoryPools.map(p => p.username).join(', ')}</Blur> — add new media to Drive to resume story posting
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-[#333] mt-0.5">Instagram automation overview</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${hasActiveRuns ? 'bg-blue-400 animate-pulse' : isLocked ? 'bg-warning animate-pulse' : 'bg-success'}`} />
          <span className="text-xs text-[#555] font-medium">
            {hasActiveRuns ? 'Workflow running' : isLocked ? 'System locked' : 'System idle'}
          </span>
        </div>
      </div>

      <LiveExecutionPanel activeRuns={activeRuns} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
                {timeAgo(lastRun.startTime || lastRun.timestamp)}
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
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
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Type</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Status</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Duration</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Results</th>
                  </tr>
                </thead>
                <tbody>
                  {!runsData?.runs?.length ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[#333]">No runs yet</td></tr>
                  ) : (
                    runsData.runs.slice(0, 5).map((run, i) => (
                      <tr key={run.id || i} className="border-b border-[#141414] last:border-0 hover:bg-[#111] transition-colors">
                        <td className="px-3 py-2.5 text-[#555]">
                          {timeAgo(run.startTime || run.timestamp)}
                        </td>
                        <td className="px-3 py-2.5">
                          {(() => {
                            const rt = getRunType(run)
                            const Icon = rt.icon
                            return (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border inline-flex items-center gap-1 ${rt.cls}`}>
                                <Icon size={9} />
                                {rt.label}
                              </span>
                            )
                          })()}
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

        <div className="lg:col-span-2 space-y-3">
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
                          <Blur>{identity.identityId || identity.identityName || identity.identity || `Identity ${i + 1}`}</Blur>
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
