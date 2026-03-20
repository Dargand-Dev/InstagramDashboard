import { useState } from 'react'
import { Clock, Play } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { useApi, apiPost } from '../hooks/useApi'

export default function Scheduler() {
  const { data: schedule, loading, refetch } = useApi('/api/automation/schedule')
  const [triggering, setTriggering] = useState(false)

  async function handleTrigger() {
    if (!confirm('Trigger a manual run now?')) return
    setTriggering(true)
    try {
      await apiPost('/api/automation/trigger', {})
      refetch()
    } catch (err) {
      alert('Trigger failed: ' + err.message)
    } finally {
      setTriggering(false)
    }
  }

  if (loading) return <p className="text-text-muted">Loading scheduler...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock size={24} />
          Scheduler
        </h2>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Play size={16} />
          {triggering ? 'Triggering...' : 'Trigger Manual Run'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Status">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${schedule?.enabled ? 'bg-success' : 'bg-error'}`} />
            <span className="text-lg font-semibold text-white">
              {schedule?.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </Card>

        <Card title="Timing">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-text-muted text-sm">Last Run</span>
              <span className="text-sm text-white">
                {schedule?.lastRun ? new Date(schedule.lastRun).toLocaleString() : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted text-sm">Next Run</span>
              <span className="text-sm text-white">
                {schedule?.nextRun ? new Date(schedule.nextRun).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </Card>

        {schedule?.windows && (
          <Card title="Posting Windows" className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Array.isArray(schedule.windows) ? schedule.windows : []).map((window, i) => (
                <div key={i} className="bg-surface-alt rounded-lg p-3">
                  <p className="text-sm font-medium text-white">{window.name || `Window ${i + 1}`}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {window.startTime || window.start} — {window.endTime || window.end}
                  </p>
                  {window.days && (
                    <p className="text-xs text-text-muted mt-1">{window.days}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
