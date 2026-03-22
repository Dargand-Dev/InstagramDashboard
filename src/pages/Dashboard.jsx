import { Activity, Users, Film, Clock, Lock } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'

export default function Dashboard() {
  const { data: runsData } = useApi('/api/automation/runs?limit=1')
  const { data: accounts } = useApi('/api/accounts')
  const { data: content } = useApi('/api/automation/content-status')
  const { data: schedule } = useApi('/api/automation/schedule')
  const { data: lockStatus, error: lockError } = useApi('/api/automation/lock-status')

  const lastRun = runsData?.runs?.[0]
  const activeAccounts = accounts?.filter(a => a.status === 'ACTIVE')?.length || 0
  const totalAccounts = accounts?.length || 0

  const isLocked = lockStatus?.locked || lockError

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Last Run" icon={Activity}>
          {lastRun ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <StatusBadge status={lastRun.status || 'SUCCESS'} />
                <span className="text-xs text-text-muted">{lastRun.duration || '—'}</span>
              </div>
              <p className="text-sm text-text-muted">
                {lastRun.timestamp ? new Date(lastRun.timestamp).toLocaleString() : '—'}
              </p>
              {lastRun.successCount !== undefined && (
                <p className="text-sm">
                  <span className="text-success">{lastRun.successCount} success</span>
                  {' / '}
                  <span className="text-error">{lastRun.failureCount || 0} failed</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-text-muted text-sm">No runs yet</p>
          )}
        </Card>

        <Card title="Accounts" icon={Users}>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-white">{activeAccounts}</span>
            <span className="text-text-muted text-sm mb-1">/ {totalAccounts} total</span>
          </div>
          <p className="text-sm text-success mt-2">Active accounts</p>
        </Card>

        <Card title="Content Stock" icon={Film}>
          {content ? (
            <div className="space-y-2">
              {(Array.isArray(content) ? content : content.identities || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm truncate mr-2">{item.identityName || item.identity || `Identity ${i + 1}`}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{item.reelCount ?? item.count ?? 0}</span>
                    {item.alert && <StatusBadge status={item.alert} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm">Loading...</p>
          )}
        </Card>

        <Card title="Next Scheduled Run" icon={Clock}>
          {schedule ? (
            <div className="space-y-2">
              <StatusBadge status={schedule.enabled ? 'ENABLED' : 'DISABLED'} />
              <p className="text-sm text-text-muted mt-2">
                Next: {schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : '—'}
              </p>
            </div>
          ) : (
            <p className="text-text-muted text-sm">Loading...</p>
          )}
        </Card>

        <Card title="Execution Lock" icon={Lock}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLocked ? 'bg-warning animate-pulse' : 'bg-success'}`} />
            <span className="text-lg font-semibold text-white">
              {isLocked ? 'Locked' : 'Available'}
            </span>
          </div>
          {isLocked && lockStatus?.lockedBy && (
            <p className="text-sm text-text-muted mt-2">By: {lockStatus.lockedBy}</p>
          )}
        </Card>
      </div>
    </div>
  )
}
