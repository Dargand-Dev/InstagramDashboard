import { useDeviceQueue } from '@/hooks/useDeviceQueue'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import { ListOrdered, PauseCircle } from 'lucide-react'

export default function DeviceQueueTab({ device }) {
  const { queues, loading } = useDeviceQueue()

  const queue = queues[device.udid] || {}
  const tasks = queue.tasks || []
  const history = queue.history || []
  const paused = queue.paused || false
  const queuedCount = queue.queuedCount ?? tasks.length

  if (loading) {
    return (
      <div className="space-y-2 pb-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 bg-[#111111]" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Paused banner */}
      {paused && (
        <div className="p-3 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/10 flex items-center gap-2">
          <PauseCircle className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-xs font-medium text-[#F59E0B]">Queue paused</span>
        </div>
      )}

      {/* Queued tasks */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium text-[#A1A1AA]">Queued Tasks</p>
          {queuedCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20">
              {queuedCount}
            </Badge>
          )}
        </div>
        {tasks.length > 0 ? (
          <div className="rounded-lg border border-[#1a1a1a] bg-[#111111] divide-y divide-[#1a1a1a]">
            {tasks.map((task, i) => (
              <div key={task.id || i} className="flex items-center justify-between px-3 py-2.5 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#FAFAFA] font-medium">{task.actionName || task.workflowType || task.type || 'Task'}</span>
                    <StatusBadge status={task.status || 'QUEUED'} />
                  </div>
                  {task.priority != null && (
                    <span className="text-[10px] text-[#52525B]">Priority: {task.priority}</span>
                  )}
                </div>
                <div className="text-right">
                  {task.accounts && (
                    <span className="text-[#52525B]">{Array.isArray(task.accounts) ? task.accounts.length : task.accounts} accounts</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={ListOrdered} title="Queue empty" description="No tasks queued for this device." className="py-6" />
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#A1A1AA] mb-2">Recent History</p>
          <div className="rounded-lg border border-[#1a1a1a] bg-[#111111] divide-y divide-[#1a1a1a]">
            {history.slice(0, 10).map((task, i) => (
              <div key={task.id || i} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[#A1A1AA]">{task.actionName || task.workflowType || 'Task'}</span>
                  <StatusBadge status={task.status} />
                </div>
                <TimeAgo date={task.completedAt || task.updatedAt} className="text-[#52525B]" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
