import { useState, Fragment } from 'react'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'

export default function Runs() {
  const { data: runs, loading } = useApi('/api/automation/runs?limit=20')
  const [expandedId, setExpandedId] = useState(null)

  function formatDuration(ms) {
    if (!ms) return '—'
    if (typeof ms === 'string') return ms
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <History size={24} />
        Run History
      </h2>

      <div className="bg-surface-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 w-8" />
              <th className="px-4 py-3 text-text-muted font-medium">Date</th>
              <th className="px-4 py-3 text-text-muted font-medium">Trigger</th>
              <th className="px-4 py-3 text-text-muted font-medium">Duration</th>
              <th className="px-4 py-3 text-text-muted font-medium">Status</th>
              <th className="px-4 py-3 text-text-muted font-medium">Results</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : !runs?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No runs found</td></tr>
            ) : (
              runs.map((run, idx) => {
                const id = run.id || idx
                const isExpanded = expandedId === id
                return (
                  <Fragment key={id}>
                    <tr
                      className="border-b border-border hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                    >
                      <td className="px-4 py-3 text-text-muted">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          run.trigger === 'manual' ? 'bg-primary-dim text-primary' : 'bg-surface-alt text-text-muted'
                        }`}>
                          {run.trigger || 'scheduled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{formatDuration(run.duration || run.durationMs)}</td>
                      <td className="px-4 py-3"><StatusBadge status={run.status || 'SUCCESS'} /></td>
                      <td className="px-4 py-3">
                        <span className="text-success">{run.successCount || 0}</span>
                        {' / '}
                        <span className="text-error">{run.failureCount || 0}</span>
                      </td>
                    </tr>
                    {isExpanded && run.details && (
                      <tr className="border-b border-border">
                        <td colSpan={6} className="px-8 py-4 bg-surface-alt/50">
                          <div className="space-y-2">
                            {(Array.isArray(run.details) ? run.details : []).map((detail, di) => (
                              <div key={di} className="flex items-center justify-between text-sm">
                                <span className="text-white">{detail.account || detail.username || `Account ${di + 1}`}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-text-muted">{detail.action || '—'}</span>
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
    </div>
  )
}
