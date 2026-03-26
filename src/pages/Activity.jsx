import { useState, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, AlertTriangle, Trash2, UserPlus, Send } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import LogStreamCard, { formatDuration } from '../components/LogStreamCard'
import { useApi } from '../hooks/useApi'
import { Blur } from '../contexts/IncognitoContext'

const TABS = [
  { id: 'content', label: 'Content' },
  { id: 'trash', label: 'Drive Trash' },
  { id: 'logs', label: 'Logs' },
]

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
  CreateAccount: { label: 'Account Creation', icon: UserPlus, cls: 'bg-violet-500/8 text-violet-400 border-violet-500/15' },
  CreateAccountFromExistingContainer: { label: 'Account Creation', icon: UserPlus, cls: 'bg-violet-500/8 text-violet-400 border-violet-500/15' },
}

const DEFAULT_RUN_TYPE = { label: 'Unknown', icon: Send, cls: 'bg-[#141414] text-[#555] border-[#1a1a1a]' }

function getRunType(run) {
  const type = run.workflowType
  if (type && RUN_TYPE_CONFIG[type]) return RUN_TYPE_CONFIG[type]
  return DEFAULT_RUN_TYPE
}

export function RunsTab({ workflowFilter } = {}) {
  const { data: runsData, loading } = useApi('/api/automation/runs?limit=50')
  const allRuns = runsData?.runs || []
  const runs = workflowFilter
    ? allRuns.filter(r => {
        const type = r.workflowType
        if (workflowFilter === 'creation') return type === 'CreateAccount' || type === 'CreateAccountFromExistingContainer'
        if (workflowFilter === 'posting') return type === 'PostReel'
        return true
      })
    : allRuns
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            <th className="px-3 py-3 w-8" />
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Date</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Type</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Trigger</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Duration</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Status</th>
            <th className="px-3 py-3 text-right label-upper !text-[10px] !mb-0">Results</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-[#333]">Loading...</td></tr>
          ) : !runs.length ? (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-[#333]">No runs found</td></tr>
          ) : (
            runs.map((run, idx) => {
              const id = run.id || idx
              const isExpanded = expandedId === id
              return (
                <Fragment key={id}>
                  <tr
                    className="border-b border-[#141414] hover:bg-[#111] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                  >
                    <td className="px-3 py-2.5 text-[#333]">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-3 py-2.5 text-[#555]">
                      {timeAgo(run.startTime || run.timestamp)}
                    </td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        const rt = getRunType(run)
                        const Icon = rt.icon
                        return (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${rt.cls}`}>
                            <Icon size={10} />
                            {rt.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                        run.trigger === 'manual'
                          ? 'bg-blue-500/8 text-blue-400 border-blue-500/15'
                          : 'bg-[#141414] text-[#555] border-[#1a1a1a]'
                      }`}>
                        {run.trigger || 'scheduled'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#555]">{formatDuration(run.duration || run.durationMs)}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={deriveRunStatus(run)} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-emerald-400">{run.successCount || 0}</span>
                      <span className="text-[#333]"> / </span>
                      <span className="text-red-400">{run.failureCount || 0}</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-[#141414]">
                      <td colSpan={7} className="px-6 py-3 bg-[#050505]">
                        {(() => {
                          const results = Array.isArray(run.accountResults) ? run.accountResults
                            : Array.isArray(run.details) ? run.details : []
                          if (!results.length) {
                            return <p className="text-[#333] text-xs">No account details available</p>
                          }
                          return (
                            <div className="space-y-1.5">
                              {results.map((detail, di) => (
                                <div key={di} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium"><Blur>{detail.username || detail.account || `Account ${di + 1}`}</Blur></span>
                                    {detail.identityId && (
                                      <span className="text-[#333] text-[10px]"><Blur>{detail.identityId}</Blur></span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {detail.failureReason && (
                                      <span className="text-red-400/70 truncate max-w-[300px]" title={detail.failureReason}>{detail.failureReason}</span>
                                    )}
                                    {detail.completedSteps != null && detail.totalSteps != null && (
                                      <span className="text-[#555] font-mono">{detail.completedSteps}/{detail.totalSteps} steps</span>
                                    )}
                                    {detail.durationMs > 0 && (
                                      <span className="text-[#555] font-mono">{formatDuration(detail.durationMs)}</span>
                                    )}
                                    <StatusBadge status={detail.status || 'SUCCESS'} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function ContentTab() {
  const { data: content, loading } = useApi('/api/automation/content-status')

  const identities = content
    ? Array.isArray(content) ? content : content.identities || []
    : []

  if (loading) return <p className="text-xs text-[#333]">Loading content status...</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {identities.length === 0 ? (
        <p className="text-xs text-[#333] col-span-full">No identity data available</p>
      ) : (
        identities.map((identity, i) => {
          const count = identity.availableReels ?? identity.reelCount ?? identity.count ?? 0
          const max = identity.maxReels ?? identity.capacity ?? 200
          const pct = Math.min((count / max) * 100, 100)
          const barColor = identity.status === 'EMPTY' || identity.alert === 'EMPTY'
            ? 'bg-red-500'
            : identity.status === 'LOW_STOCK' || identity.alert === 'LOW_STOCK'
              ? 'bg-amber-500'
              : 'bg-emerald-500'

          return (
            <Card key={i}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold text-sm">
                  <Blur>{identity.identityId || identity.identityName || identity.identity || `Identity ${i + 1}`}</Blur>
                </h3>
                {(identity.status || identity.alert) && <StatusBadge status={identity.status || identity.alert} />}
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#555]">Reels available</span>
                  <span className="text-white font-mono font-semibold">{count} / {max}</span>
                </div>
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {/* Story media pool alerts */}
              {identity.storyMediaPool && identity.storyMediaPool.length > 0 && (
                <div className="border-t border-[#141414] pt-3 mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] text-[#555] font-medium uppercase tracking-wider">Story Media Pool</p>
                    {identity.totalStoryMedia != null && (
                      <span className="text-[10px] font-mono text-[#555]">{identity.totalStoryMedia} total</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {identity.storyMediaPool.map((pool, j) => {
                      const isExhausted = pool.status === 'EXHAUSTED'
                      const isLow = pool.status === 'LOW'
                      return (
                        <div key={j} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-md border ${
                          isExhausted
                            ? 'bg-red-500/5 border-red-500/15'
                            : isLow
                              ? 'bg-amber-500/5 border-amber-500/15'
                              : 'bg-[#0a0a0a] border-[#1a1a1a]'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            {isExhausted && <AlertTriangle size={10} className="text-red-400" />}
                            <span className={isExhausted ? 'text-red-400 font-medium' : 'text-[#555]'}>
                              <Blur>{pool.username}</Blur>
                            </span>
                          </div>
                          <span className={`font-mono text-[10px] ${
                            isExhausted ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-[#555]'
                          }`}>
                            {pool.remaining}/{pool.totalMedia} left
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {identity.accounts && identity.accounts.length > 0 && (
                <div className="border-t border-[#141414] pt-3 mt-3">
                  <p className="text-[10px] text-[#555] font-medium uppercase tracking-wider mb-2">Accounts</p>
                  <div className="flex flex-wrap gap-1">
                    {identity.accounts.map((acc, j) => (
                      <span key={j} className="text-[10px] bg-[#111] border border-[#1a1a1a] px-2 py-0.5 rounded-md text-[#555] font-medium">
                        <Blur>{typeof acc === 'string' ? acc : acc.username}</Blur>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}

function TrashTab() {
  const { data: trashQueue, loading } = useApi('/api/automation/drive/trash-queue')

  const items = trashQueue
    ? Array.isArray(trashQueue) ? trashQueue : trashQueue.files || []
    : []

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">File Name</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Identity</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Status</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Queued At</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={4} className="px-3 py-8 text-center text-[#333]">Loading...</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-8 text-center text-[#333]">No files in trash queue</td></tr>
          ) : (
            items.map((file, i) => (
              <tr key={i} className="border-b border-[#141414] hover:bg-[#111] transition-colors">
                <td className="px-3 py-2.5 text-white font-medium">{file.fileName || file.name || '—'}</td>
                <td className="px-3 py-2.5 text-[#555]"><Blur>{file.identity || file.identityName || '—'}</Blur></td>
                <td className="px-3 py-2.5"><StatusBadge status={file.status || 'PENDING'} /></td>
                <td className="px-3 py-2.5 text-[#555]">
                  {file.queuedAt || file.createdAt ? new Date(file.queuedAt || file.createdAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function getActiveRuns() {
  try {
    return JSON.parse(localStorage.getItem('activeWorkflowRuns') || '[]')
  } catch { return [] }
}

function LogsTab() {
  const [runs, setRuns] = useState(getActiveRuns)

  // Sync with localStorage changes (cross-tab via storage event)
  useEffect(() => {
    const onStorage = () => setRuns(getActiveRuns())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function handleRemove(runId) {
    const updated = runs.filter(r => r.runId !== runId)
    localStorage.setItem('activeWorkflowRuns', JSON.stringify(updated))
    setRuns(updated)
  }

  function handleClearAll() {
    localStorage.setItem('activeWorkflowRuns', JSON.stringify([]))
    setRuns([])
  }

  if (runs.length === 0) {
    return (
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-8 text-center">
        <p className="text-[#333] text-xs">No active workflow runs</p>
        <p className="text-[#222] text-[10px] mt-1">Trigger a workflow from the Actions page to see real-time logs here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={handleClearAll}
          className="text-[10px] text-[#333] hover:text-red-400 font-medium transition-colors flex items-center gap-1">
          <Trash2 size={10} /> Clear all
        </button>
      </div>
      {runs.map(run => (
        <LogStreamCard key={run.runId} run={run} onRemove={handleRemove} />
      ))}
    </div>
  )
}

export default function Activity() {
  const [searchParams] = useSearchParams()
  const initialTab = TABS.find(t => t.id === searchParams.get('tab'))?.id || 'content'
  const [tab, setTab] = useState(initialTab)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Activity</h1>
        <p className="text-xs text-[#333] mt-0.5">Content stock, drive cleanup, and workflow logs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[#1a1a1a]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors relative ${
              tab === t.id
                ? 'text-white'
                : 'text-[#555] hover:text-white'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        ))}
      </div>

      {tab === 'content' && <ContentTab />}
      {tab === 'trash' && <TrashTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  )
}
