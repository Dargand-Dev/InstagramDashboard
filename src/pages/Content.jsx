import { Film } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'

export default function Content() {
  const { data: content, loading } = useApi('/api/automation/content-status')

  const identities = content
    ? Array.isArray(content) ? content : content.identities || []
    : []

  if (loading) return <p className="text-text-muted">Loading content status...</p>

  return (
    <div>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <Film size={24} />
        Content Stock
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {identities.length === 0 ? (
          <p className="text-text-muted col-span-full">No identity data available</p>
        ) : (
          identities.map((identity, i) => {
            const count = identity.reelCount ?? identity.count ?? 0
            const max = identity.maxReels ?? identity.capacity ?? 20
            const pct = Math.min((count / max) * 100, 100)
            const barColor = identity.alert === 'EMPTY'
              ? 'bg-error'
              : identity.alert === 'LOW_STOCK'
                ? 'bg-warning'
                : 'bg-success'

            return (
              <Card key={i}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold">
                    {identity.identityName || identity.identity || `Identity ${i + 1}`}
                  </h3>
                  {identity.alert && <StatusBadge status={identity.alert} />}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-muted">Reels available</span>
                    <span className="text-white font-mono">{count} / {max}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {identity.accounts && identity.accounts.length > 0 && (
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="text-xs text-text-muted mb-2">Associated accounts</p>
                    <div className="flex flex-wrap gap-1">
                      {identity.accounts.map((acc, j) => (
                        <span key={j} className="text-xs bg-surface-alt px-2 py-0.5 rounded text-text-muted">
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
    </div>
  )
}
