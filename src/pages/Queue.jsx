import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import {
  ListOrdered,
  Trash2,
  ArrowUp,
  ArrowDown,
  XCircle,
  RefreshCw,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

function formatDuration(startStr) {
  if (!startStr) return null
  const start = new Date(startStr).getTime()
  if (isNaN(start)) return null
  const ms = Date.now() - start
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function ElapsedTime({ startedAt }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const dur = formatDuration(startedAt)
  if (!dur) return null
  return <span className="tabular-nums text-xs text-[#A1A1AA]">{dur}</span>
}

function BatchProgressBar({ summary }) {
  if (!summary || !summary.total) return null
  const { total, completed, failed, running, skipped } = summary
  const processed = (completed || 0) + (failed || 0) + (skipped || 0)
  const pct = Math.round((processed / total) * 100)

  return (
    <div className="w-full mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#52525B]">
          {processed}/{total} accounts ({pct}%)
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {completed > 0 && <span className="text-[#22C55E]">{completed} done</span>}
          {failed > 0 && <span className="text-[#EF4444]">{failed} failed</span>}
          {running > 0 && <span className="text-[#3B82F6]">{running} active</span>}
        </div>
      </div>
      <div className="h-1.5 bg-[#0A0A0A] rounded-full overflow-hidden flex">
        {completed > 0 && (
          <div className="h-full bg-[#22C55E]" style={{ width: `${(completed / total) * 100}%` }} />
        )}
        {failed > 0 && (
          <div className="h-full bg-[#EF4444]" style={{ width: `${(failed / total) * 100}%` }} />
        )}
        {running > 0 && (
          <div className="h-full bg-[#3B82F6] animate-pulse" style={{ width: `${(running / total) * 100}%` }} />
        )}
        {skipped > 0 && (
          <div className="h-full bg-[#52525B]" style={{ width: `${(skipped / total) * 100}%` }} />
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, onCancel, onReprioritize }) {
  const [expanded, setExpanded] = useState(false)
  const isRunning = task.status === 'RUNNING'
  const isPaused = task.status === 'PAUSED'
  const summary = task.accountSummary
  const entries = task.accountEntries || []

  return (
    <div className={`rounded-lg border ${
      isRunning ? 'border-[#3B82F6]/30 bg-[#3B82F6]/5' :
      isPaused ? 'border-[#F59E0B]/30 bg-[#F59E0B]/5' :
      'border-[#1a1a1a] bg-[#111111]'
    }`}>
      {/* Task Header */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isRunning ? 'bg-[#3B82F6]/10' :
              isPaused ? 'bg-[#F59E0B]/10' :
              'bg-[#8B5CF6]/10'
            }`}>
              {isRunning ? <Play className="w-3.5 h-3.5 text-[#3B82F6]" /> :
               isPaused ? <Pause className="w-3.5 h-3.5 text-[#F59E0B]" /> :
               <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#FAFAFA] truncate">
                  {task.actionName}
                </span>
                <StatusBadge status={task.status || 'QUEUED'} />
                {isRunning && task.startedAt && <ElapsedTime startedAt={task.startedAt} />}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-[#52525B]">{task.deviceName}</span>
                {task.currentAccount && (
                  <>
                    <span className="text-xs text-[#3f3f46]">·</span>
                    <span className="text-xs text-[#3B82F6]">@ {task.currentAccount}</span>
                  </>
                )}
                {summary && summary.total > 0 && (
                  <>
                    <span className="text-xs text-[#3f3f46]">·</span>
                    <span className="text-xs text-[#52525B]">
                      <Users className="w-3 h-3 inline mr-0.5" />
                      {summary.total} accounts
                    </span>
                  </>
                )}
                {!summary && (
                  <>
                    <span className="text-xs text-[#3f3f46]">·</span>
                    <TimeAgo date={task.createdAt} className="text-xs text-[#3f3f46]" />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {task.status === 'QUEUED' && (
              <>
                <div className="flex items-center gap-0.5 mr-1">
                  <span className="text-[10px] text-[#52525B] tabular-nums w-4 text-center">{task.priority}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-[#52525B] hover:text-[#22C55E]"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReprioritize(task.id, task.priority + 1)
                    }}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-[#52525B] hover:text-[#F59E0B]"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReprioritize(task.id, Math.max(0, task.priority - 1))
                    }}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#52525B] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={(e) => {
                e.stopPropagation()
                onCancel(task.id)
              }}
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>
            {entries.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[#52525B]"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            )}
          </div>
        </div>

        {summary && <BatchProgressBar summary={summary} />}
      </div>

      {/* Expanded Account List */}
      {expanded && entries.length > 0 && (
        <div className="border-t border-[#1a1a1a] px-3 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 max-h-48 overflow-y-auto">
            {entries.map((entry, i) => (
              <div
                key={entry.containerName || i}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-[#0A0A0A]"
              >
                {entry.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-[#22C55E] shrink-0" />}
                {entry.status === 'FAILED' && <AlertCircle className="w-3 h-3 text-[#EF4444] shrink-0" />}
                {entry.status === 'RUNNING' && <Loader2 className="w-3 h-3 text-[#3B82F6] animate-spin shrink-0" />}
                {entry.status === 'PENDING' && <Clock className="w-3 h-3 text-[#52525B] shrink-0" />}
                {entry.status === 'SKIPPED' && <XCircle className="w-3 h-3 text-[#52525B] shrink-0" />}
                <span className={`truncate ${
                  entry.status === 'RUNNING' ? 'text-[#3B82F6]' :
                  entry.status === 'COMPLETED' ? 'text-[#22C55E]' :
                  entry.status === 'FAILED' ? 'text-[#EF4444]' :
                  'text-[#A1A1AA]'
                }`}>
                  {entry.containerName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Queue() {
  const queryClient = useQueryClient()
  const { subscribe, isConnected } = useWebSocket()
  const [clearAllOpen, setClearAllOpen] = useState(false)

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: () => apiGet('/api/queue'),
    refetchInterval: isConnected ? 5000 : 15000,
  })

  // WebSocket: refresh queue on task/device events
  useEffect(() => {
    if (!isConnected) return
    const unsubs = [
      subscribe('/topic/executions/status', () => {
        queryClient.invalidateQueries({ queryKey: ['queue'] })
      }),
      subscribe('/topic/devices/status', () => {
        queryClient.invalidateQueries({ queryKey: ['queue'] })
      }),
    ]
    return () => unsubs.forEach(fn => fn && fn())
  }, [isConnected, subscribe, queryClient])

  const cancelTask = useMutation({
    mutationFn: (taskId) => apiDelete(`/api/queue/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      toast.success('Task cancelled')
    },
    onError: () => {
      toast.error('Cannot cancel this task (may be running or already completed)')
    },
  })

  const reprioritize = useMutation({
    mutationFn: ({ taskId, priority }) => apiPut(`/api/queue/tasks/${taskId}/priority`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      toast.success('Priority updated')
    },
  })

  const clearAll = useMutation({
    mutationFn: () => apiDelete('/api/queue'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      setClearAllOpen(false)
      toast.success('Queue cleared')
    },
  })

  // Parse enriched backend response
  const raw = queueData?.data || queueData || {}
  const queues = raw.queues || {}
  const deviceNames = raw.deviceNames || {}
  const totalQueued = raw.totalQueued || 0
  const totalRunning = raw.totalRunning || 0
  const totalPaused = raw.totalPaused || 0
  const totalTasks = totalQueued + totalRunning + totalPaused

  // Group tasks by device
  const deviceGroups = Object.entries(queues).map(([udid, tasks]) => ({
    udid,
    name: (tasks[0] && tasks[0].deviceName) || deviceNames[udid] || udid,
    tasks: Array.isArray(tasks) ? tasks : [],
    runningCount: Array.isArray(tasks) ? tasks.filter(t => t.status === 'RUNNING').length : 0,
    queuedCount: Array.isArray(tasks) ? tasks.filter(t => t.status === 'QUEUED').length : 0,
    pausedCount: Array.isArray(tasks) ? tasks.filter(t => t.status === 'PAUSED').length : 0,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Queue</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-[#52525B] hover:text-[#A1A1AA]"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['queue'] })}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Refresh
          </Button>
          {totalTasks > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => setClearAllOpen(true)}
            >
              <Trash2 className="w-3 h-3 mr-1.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {totalTasks > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {totalRunning > 0 && (
            <Badge variant="outline" className="bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 text-xs">
              <Play className="w-3 h-3 mr-1" />
              {totalRunning} running
            </Badge>
          )}
          {totalQueued > 0 && (
            <Badge variant="outline" className="bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20 text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {totalQueued} queued
            </Badge>
          )}
          {totalPaused > 0 && (
            <Badge variant="outline" className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 text-xs">
              <Pause className="w-3 h-3 mr-1" />
              {totalPaused} paused
            </Badge>
          )}
          <Badge variant="outline" className="bg-[#111111] text-[#52525B] border-[#1a1a1a] text-xs">
            <Smartphone className="w-3 h-3 mr-1" />
            {deviceGroups.length} devices
          </Badge>
          <span className="text-xs text-[#3f3f46]">
            {isConnected ? 'Live updates' : 'Auto-refreshing every 15s'}
          </span>
        </div>
      )}

      {/* Device Groups */}
      {deviceGroups.length > 0 ? (
        <div className="space-y-4">
          {deviceGroups.map((group) => (
            <Card key={group.udid} className="bg-[#111111] border-[#1a1a1a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  {group.name}
                  <span className="text-[10px] text-[#3f3f46] font-normal">{group.udid}</span>
                </CardTitle>
                <CardAction>
                  <div className="flex items-center gap-1.5">
                    {group.runningCount > 0 && (
                      <Badge variant="outline" className="bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 text-[10px] h-5">
                        {group.runningCount} running
                      </Badge>
                    )}
                    {group.queuedCount > 0 && (
                      <Badge variant="outline" className="bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20 text-[10px] h-5">
                        {group.queuedCount} queued
                      </Badge>
                    )}
                    {group.pausedCount > 0 && (
                      <Badge variant="outline" className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 text-[10px] h-5">
                        {group.pausedCount} paused
                      </Badge>
                    )}
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {group.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onCancel={(id) => cancelTask.mutate(id)}
                    onReprioritize={(id, priority) => reprioritize.mutate({ taskId: id, priority })}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isLoading ? (
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 text-[#52525B] animate-spin" />
              <span className="text-sm text-[#52525B]">Loading queue...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardContent className="p-0">
            <EmptyState
              icon={ListOrdered}
              title="Queue is empty"
              description="No tasks are currently queued for execution"
            />
          </CardContent>
        </Card>
      )}

      {/* Clear All Confirmation */}
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Clear Entire Queue?</DialogTitle>
            <DialogDescription className="text-[#52525B]">
              This will cancel all {totalQueued} queued tasks across {deviceGroups.length} devices. Running and paused tasks will not be affected. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" className="text-[#A1A1AA]" />}>
              Cancel
            </DialogClose>
            <Button
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
            >
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
