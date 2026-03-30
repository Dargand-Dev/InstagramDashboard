import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
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
import DataTable from '@/components/shared/DataTable'
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
} from 'lucide-react'

export default function Queue() {
  const queryClient = useQueryClient()
  const [selectedRows, setSelectedRows] = useState([])
  const [clearAllOpen, setClearAllOpen] = useState(false)

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: () => apiGet('/api/queue'),
    refetchInterval: 15000,
  })

  const cancelTask = useMutation({
    mutationFn: (taskId) => apiDelete(`/api/queue/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      toast.success('Task cancelled')
    },
  })

  const reprioritize = useMutation({
    mutationFn: ({ taskId, priority }) => apiPut(`/api/queue/${taskId}/priority`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      toast.success('Priority updated')
    },
  })

  const cancelSelected = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedRows.map(row => apiDelete(`/api/queue/${row.id}`)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] })
      setSelectedRows([])
      toast.success(`${selectedRows.length} tasks cancelled`)
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

  // Backend returns { queues: { deviceUdid: [tasks] }, totalQueued, ... }
  const queue = (() => {
    const raw = queueData?.data || queueData || {}
    if (Array.isArray(raw)) return raw
    if (raw.queues) {
      return Object.entries(raw.queues).flatMap(([deviceUdid, tasks]) =>
        tasks.map(t => ({ ...t, deviceName: deviceUdid }))
      )
    }
    return []
  })()

  const columns = [
    {
      accessorKey: 'accountName',
      header: 'Account',
      cell: ({ row }) => (
        <span className="text-[#FAFAFA] text-sm">
          {row.original.accountName || row.original.account || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'deviceName',
      header: 'Device',
      cell: ({ row }) => (
        <span className="text-[#A1A1AA] text-sm">
          {row.original.deviceName || row.original.device || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <span className="text-[#A1A1AA] text-sm">
          {row.original.actionName || row.original.action || row.original.workflow || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'scheduledAt',
      header: 'Scheduled',
      cell: ({ row }) => <TimeAgo date={row.original.createdAt || row.original.scheduledAt} className="text-sm text-[#52525B]" />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status || 'QUEUED'} />,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const p = row.original.priority ?? 0
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#A1A1AA] tabular-nums w-4 text-center">{p}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[#52525B] hover:text-[#22C55E]"
              onClick={(e) => {
                e.stopPropagation()
                reprioritize.mutate({ taskId: row.original.id, priority: p + 1 })
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
                reprioritize.mutate({ taskId: row.original.id, priority: Math.max(0, p - 1) })
              }}
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#52525B] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
          onClick={(e) => {
            e.stopPropagation()
            cancelTask.mutate(row.original.id)
          }}
        >
          <XCircle className="w-3.5 h-3.5" />
        </Button>
      ),
      size: 40,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Queue</h1>
        <div className="flex items-center gap-2">
          {selectedRows.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => cancelSelected.mutate()}
              disabled={cancelSelected.isPending}
            >
              <Trash2 className="w-3 h-3 mr-1.5" />
              Cancel Selected ({selectedRows.length})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-[#52525B] hover:text-[#A1A1AA]"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['queue'] })}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Refresh
          </Button>
          {Array.isArray(queue) && queue.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => setClearAllOpen(true)}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Queue Stats */}
      {Array.isArray(queue) && queue.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20 text-xs">
              {queue.length} queued
            </Badge>
          </div>
          <span className="text-xs text-[#3f3f46]">Auto-refreshing every 15s</span>
        </div>
      )}

      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className={Array.isArray(queue) && queue.length > 0 ? 'p-4' : 'p-0'}>
          {Array.isArray(queue) && queue.length > 0 ? (
            <DataTable
              columns={columns}
              data={queue}
              loading={isLoading}
              searchable
              searchPlaceholder="Search queue..."
              selectable
              onSelectionChange={setSelectedRows}
              pageSize={20}
            />
          ) : isLoading ? (
            <DataTable columns={columns} data={[]} loading={true} />
          ) : (
            <EmptyState
              icon={ListOrdered}
              title="Queue is empty"
              description="No tasks are currently queued for execution"
            />
          )}
        </CardContent>
      </Card>

      {/* Clear All Confirmation */}
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Clear Entire Queue?</DialogTitle>
            <DialogDescription className="text-[#52525B]">
              This will cancel all {queue.length} queued tasks. This action cannot be undone.
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
