import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'

const TABS = [
  { id: 'runs', label: 'Runs' },
  { id: 'content', label: 'Content' },
  { id: 'trash', label: 'Drive Trash' },
]

function formatDuration(ms) {
  if (!ms) return '—'
  if (typeof ms === 'string') return ms
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function RunsTab() {
  const { data: runs, loading } = useApi('/api/automation/runs?limit=20')
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1a1a1a]">
            <th className="px-3 py-3 w-8" />
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Date</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Trigger</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Duration</th>
            <th className="px-3 py-3 text-left label-upper !text-[10px] !mb-0">Status</th>
            <th className="px-3 py-3 text-right label-upper !text-[10px] !mb-0">Results</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-[#333]">Loading...</td></tr>
          ) : !runs?.length ? (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-[#333]">No runs found</td></tr>
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
                      {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
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
                    <td className="px-3 py-2.5"><StatusBadge status={run.status || 'SUCCESS'} /></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-emerald-400">{run.successCount || 0}</span>
                      <span className="text-[#333]"> / </span>
                      <span className="text-red-400">{run.failureCount || 0}</span>
                    </td>
                  </tr>
                  {isExpanded && run.details && (
                    <tr className="border-b border-[#141414]">
                      <td colSpan={6} className="px-6 py-3 bg-[#050505]">
                        <div className="space-y-1.5">
                          {(Array.isArray(run.details) ? run.details : []).map((detail, di) => (
                            <div key={di} className="flex items-center justify-between text-xs">
                              <span className="text-white font-medium">{detail.account || detail.username || `Account ${di + 1}`}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[#555]">{detail.action || '—'}</span>
                                <StatusBadge status={detail.status || 'SUCCESS'} />
                              </div>
                            </div>
                          ))}
                        </div>
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
                  {identity.identityId || identity.identityName || identity.identity || `Identity ${i + 1}`}
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
              {identity.accounts && identity.accounts.length > 0 && (
                <div className="border-t border-[#141414] pt-3 mt-3">
                  <p className="text-[10px] text-[#555] font-medium uppercase tracking-wider mb-2">Accounts</p>
                  <div className="flex flex-wrap gap-1">
                    {identity.accounts.map((acc, j) => (
                      <span key={j} className="text-[10px] bg-[#111] border border-[#1a1a1a] px-2 py-0.5 rounded-md text-[#555] font-medium">
                        {typeof acc === 'string' ? acc : acc.username}
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
                <td className="px-3 py-2.5 text-[#555]">{file.identity || file.identityName || '—'}</td>
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

export default function Activity() {
  const [tab, setTab] = useState('runs')

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Activity</h1>
        <p className="text-xs text-[#333] mt-0.5">Run history, content stock, and drive cleanup</p>
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

      {tab === 'runs' && <RunsTab />}
      {tab === 'content' && <ContentTab />}
      {tab === 'trash' && <TrashTab />}
    </div>
  )
}
