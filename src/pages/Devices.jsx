import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  Smartphone,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Monitor,
  Clock,
  AlertTriangle,
  User,
  Loader2,
  Settings,
  History,
} from 'lucide-react'
import { toast } from 'sonner'

const STATUS_DOT = {
  IDLE: 'bg-[#22C55E]',
  RUNNING: 'bg-[#3B82F6] animate-subtle-pulse',
  ERROR: 'bg-[#EF4444]',
  OFFLINE: 'bg-[#52525B]',
}

function DeviceCard({ device, onSelect, onToggle }) {
  const statusColor = STATUS_DOT[device.status] || STATUS_DOT.OFFLINE
  const isRunning = device.status === 'RUNNING'
  const isError = device.status === 'ERROR'

  return (
    <div
      className="group relative bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-4 hover:bg-[#111111] hover:border-[#222222] transition-all duration-150 cursor-pointer"
      onClick={() => onSelect(device)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#111111] border border-[#1a1a1a] flex items-center justify-center group-hover:bg-[#161616]">
            <Smartphone className="w-4 h-4 text-[#A1A1AA]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#FAFAFA]">{device.name || device.label || 'Unnamed Device'}</p>
            <p className="text-xs text-[#52525B] font-mono">{device.udid ? `${device.udid.slice(0, 12)}...` : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-[#52525B]">{device.status || 'OFFLINE'}</span>
        </div>
      </div>

      {isRunning && (
        <div className="mb-3 p-2 rounded-md bg-[#3B82F6]/5 border border-[#3B82F6]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#3B82F6] mb-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="font-medium">{device.currentWorkflow || 'Running workflow'}</span>
          </div>
          {device.currentAccount && (
            <div className="flex items-center gap-1 text-xs text-[#A1A1AA]">
              <User className="w-3 h-3" />
              <span>{device.currentAccount}</span>
            </div>
          )}
          {device.elapsedTime && (
            <div className="flex items-center gap-1 text-xs text-[#52525B] mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{device.elapsedTime}</span>
            </div>
          )}
        </div>
      )}

      {isError && device.lastError && (
        <div className="mb-3 p-2 rounded-md bg-[#EF4444]/5 border border-[#EF4444]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#EF4444]">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{device.lastError}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
          {device.status === 'OFFLINE' ? (
            <WifiOff className="w-3 h-3" />
          ) : (
            <Wifi className="w-3 h-3 text-[#22C55E]" />
          )}
          <span>{device.port ? `Port ${device.port}` : 'No port'}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={device.enabled !== false}
            onCheckedChange={() => onToggle(device)}
            size="sm"
          />
        </div>
      </div>
    </div>
  )
}

function DeviceDetailSheet({ device, open, onOpenChange }) {
  const queryClient = useQueryClient()
  const [editForm, setEditForm] = useState({})
  const [editing, setEditing] = useState(false)

  const { data: runHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['device-runs', device?.id],
    queryFn: () => apiGet(`/api/automation/runs?deviceUdid=${device?.udid}&limit=20`),
    enabled: !!device?.udid && open,
    select: (res) => res.data || res || [],
  })

  useEffect(() => {
    if (device) {
      setEditForm({
        name: device.name || device.label || '',
        port: device.port || '',
        proxyUrl: device.proxyUrl || '',
      })
      setEditing(false)
    }
  }, [device])

  const updateMutation = useMutation({
    mutationFn: (body) => apiPut(`/api/devices/${device.id}`, body),
    onSuccess: () => {
      toast.success('Device updated')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setEditing(false)
    },
  })

  if (!device) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#0A0A0A] border-[#1a1a1a] sm:max-w-md w-full">
        <SheetHeader className="border-b border-[#1a1a1a] pb-4">
          <SheetTitle className="text-[#FAFAFA] flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#A1A1AA]" />
            {device.name || device.label || 'Device'}
          </SheetTitle>
          <SheetDescription className="text-[#52525B] font-mono text-xs">
            {device.udid || 'No UDID'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-4 px-4">
          <Tabs defaultValue="info">
            <TabsList variant="line" className="w-full justify-start mb-4">
              <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">Run History</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 pb-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#111111] border border-[#1a1a1a]">
                <span className="text-xs text-[#52525B]">Status</span>
                <StatusBadge status={device.status || 'OFFLINE'} />
              </div>

              {device.status === 'RUNNING' && (
                <div className="p-3 rounded-lg bg-[#3B82F6]/5 border border-[#3B82F6]/10 space-y-2">
                  <p className="text-xs font-medium text-[#3B82F6]">Current Run</p>
                  <div className="space-y-1 text-xs text-[#A1A1AA]">
                    {device.currentWorkflow && <p>Workflow: {device.currentWorkflow}</p>}
                    {device.currentAccount && <p>Account: {device.currentAccount}</p>}
                    {device.elapsedTime && <p>Elapsed: {device.elapsedTime}</p>}
                    {device.currentRunId && (
                      <a
                        href={`/execution-center?run=${device.currentRunId}`}
                        className="text-[#3B82F6] hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        <Monitor className="w-3 h-3" /> View in Execution Center
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#A1A1AA]">Configuration</p>
                  {!editing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                      onClick={() => setEditing(true)}
                    >
                      <Settings className="w-3 h-3 mr-1" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate(editForm)}
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3">
                    {[
                      { key: 'name', label: 'Name' },
                      { key: 'port', label: 'Port' },
                      { key: 'proxyUrl', label: 'Proxy URL' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs text-[#52525B]">{label}</Label>
                        <Input
                          value={editForm[key]}
                          onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="h-8 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[
                      ['UDID', device.udid],
                      ['Port', device.port],
                      ['Proxy', device.proxyUrl],
                      ['Enabled', device.enabled !== false ? 'Yes' : 'No'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
                        <span className="text-xs text-[#52525B]">{label}</span>
                        <span className="text-xs text-[#A1A1AA] font-mono">{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-2 pb-4">
              {loadingHistory ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-[#111111]" />
                ))
              ) : runHistory.length === 0 ? (
                <EmptyState icon={History} title="No run history" description="This device hasn't executed any runs yet." />
              ) : (
                runHistory.map((run) => (
                  <div key={run.id} className="p-3 rounded-lg bg-[#111111] border border-[#1a1a1a] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#FAFAFA]">{run.workflowType || run.type || 'Run'}</span>
                      <StatusBadge status={run.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#52525B]">
                      <span>{run.accountUsername || run.account || '—'}</span>
                      <TimeAgo date={run.startedAt || run.createdAt} />
                    </div>
                    {run.error && <p className="text-xs text-[#EF4444] truncate mt-1">{run.error}</p>}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function AddDeviceDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', udid: '', port: '', proxyUrl: '' })

  const createMutation = useMutation({
    mutationFn: (body) => apiPost('/api/devices', body),
    onSuccess: () => {
      toast.success('Device added')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      onOpenChange(false)
      setForm({ name: '', udid: '', port: '', proxyUrl: '' })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#FAFAFA]">Add Device</DialogTitle>
          <DialogDescription className="text-[#52525B]">Register a new device for automation workflows.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#52525B]">Device Name</Label>
            <Input
              placeholder="iPhone 15 Pro"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-9 bg-[#111111] border-[#1a1a1a] text-sm text-[#FAFAFA] placeholder:text-[#52525B]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#52525B]">UDID</Label>
            <Input
              placeholder="00008101-..."
              value={form.udid}
              onChange={(e) => setForm((f) => ({ ...f, udid: e.target.value }))}
              className="h-9 bg-[#111111] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono placeholder:text-[#52525B]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#52525B]">Port</Label>
              <Input
                placeholder="8100"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                className="h-9 bg-[#111111] border-[#1a1a1a] text-sm text-[#FAFAFA] placeholder:text-[#52525B]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#52525B]">Proxy URL</Label>
              <Input
                placeholder="http://..."
                value={form.proxyUrl}
                onChange={(e) => setForm((f) => ({ ...f, proxyUrl: e.target.value }))}
                className="h-9 bg-[#111111] border-[#1a1a1a] text-sm text-[#FAFAFA] placeholder:text-[#52525B]"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="border-[#1a1a1a] text-[#A1A1AA]" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!form.udid || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
            {createMutation.isPending ? 'Adding...' : 'Add Device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Devices() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const { subscribe, isConnected } = useWebSocket()

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet('/api/devices/live-status'),
    select: (res) => res.data || res || [],
    refetchInterval: 10000,
  })

  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/devices/status', (update) => {
      queryClient.setQueryData(['devices'], (old) => {
        if (!old) return old
        const list = old.data || old || []
        const updated = list.map((d) => (d.id === update.id ? { ...d, ...update } : d))
        return old.data ? { ...old, data: updated } : updated
      })
    })
    return unsub
  }, [isConnected, subscribe, queryClient])

  const toggleMutation = useMutation({
    mutationFn: (device) => apiPut(`/api/devices/${device.id}/enabled`, { enabled: device.enabled === false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })

  const filtered = useMemo(() => {
    if (!search) return devices
    const q = search.toLowerCase()
    return devices.filter(
      (d) =>
        (d.name || d.label || '').toLowerCase().includes(q) ||
        (d.udid || '').toLowerCase().includes(q)
    )
  }, [devices, search])

  const statusCounts = useMemo(() => {
    const counts = { IDLE: 0, RUNNING: 0, ERROR: 0, OFFLINE: 0 }
    devices.forEach((d) => {
      const s = d.status || 'OFFLINE'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [devices])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Devices</h1>
          <p className="text-sm text-[#52525B] mt-0.5">{devices.length} device{devices.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Device
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Idle', count: statusCounts.IDLE, color: '#22C55E', dot: 'bg-[#22C55E]' },
          { label: 'Running', count: statusCounts.RUNNING, color: '#3B82F6', dot: 'bg-[#3B82F6]' },
          { label: 'Error', count: statusCounts.ERROR, color: '#EF4444', dot: 'bg-[#EF4444]' },
          { label: 'Offline', count: statusCounts.OFFLINE, color: '#52525B', dot: 'bg-[#52525B]' },
        ].map((s) => (
          <div key={s.label} className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              <span className="text-xs text-[#52525B]">{s.label}</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52525B]" />
        <Input
          placeholder="Search devices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B] h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 bg-[#111111] rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title={search ? 'No devices match' : 'No devices'}
          description={search ? 'Try a different search term.' : 'Add your first device to get started.'}
          actionLabel={!search ? 'Add Device' : undefined}
          onAction={!search ? () => setAddDialogOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onSelect={(d) => {
                setSelectedDevice(d)
                setSheetOpen(true)
              }}
              onToggle={(d) => toggleMutation.mutate(d)}
            />
          ))}
        </div>
      )}

      <DeviceDetailSheet device={selectedDevice} open={sheetOpen} onOpenChange={setSheetOpen} />
      <AddDeviceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  )
}
