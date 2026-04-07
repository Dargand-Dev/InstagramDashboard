import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import {
  useAutoCreationStatus,
  useUpdateConfig,
  useToggleDevice,
  useToggleGlobal,
  useDeleteConfig,
} from '@/hooks/useAutoCreation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import {
  UserPlus, Plus, Trash2, Pencil, Clock, Timer, Calendar,
  Settings2, ChevronDown, ChevronUp, Check, X, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function formatDuration(ms) {
  if (!ms) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const s = sec % 60
  return `${min}m${s > 0 ? ` ${s}s` : ''}`
}

function formatTimeUntil(instant) {
  if (!instant) return null
  const diff = new Date(instant) - new Date()
  if (diff < 0) return 'now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ───── Stats Row ─────

function StatsRow({ status }) {
  const remaining = (status.totalTargetAccounts || 0) - (status.totalActiveAccounts || 0)

  const stats = [
    { label: 'Remaining', value: Math.max(0, remaining), color: '#A1A1AA' },
    { label: 'Active', value: status.totalActiveAccounts || 0, color: '#22C55E' },
    { label: 'Failed', value: status.totalFailed || 0, color: '#EF4444' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map(s => (
        <Card key={s.label} className="bg-[#0A0A0A] border-[#1a1a1a]">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">{s.label}</p>
            <p className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="bg-[#0A0A0A] border-[#1a1a1a]">
        <CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Avg Creation</p>
          <p className="text-xl font-semibold text-[#FAFAFA]">{formatDuration(status.avgCreationTimeMs)}</p>
        </CardContent>
      </Card>
      <Card className="bg-[#0A0A0A] border-[#1a1a1a]">
        <CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Next Schedule</p>
          <p className="text-xl font-semibold text-[#8B5CF6]">
            {formatTimeUntil(status.nextScheduledRun) || '—'}
          </p>
          {status.nextScheduledRun && (
            <p className="text-[10px] text-[#52525B]">
              {new Date(status.nextScheduledRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ───── Identity Progress ─────

function IdentityProgressSection({ identityProgress }) {
  if (!identityProgress?.length) return null

  return (
    <div className="space-y-3">
      {identityProgress.map(ip => {
        const pct = Math.min(ip.percentage, 100)
        const done = ip.currentCount >= ip.targetCount

        return (
          <div key={ip.identityId} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#FAFAFA] font-medium">{ip.identityId}</span>
                {done && <Check className="w-3.5 h-3.5 text-[#22C55E]" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A1A1AA]">
                  {ip.currentCount}/{ip.targetCount}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0',
                    done
                      ? 'border-[#22C55E]/30 text-[#22C55E]'
                      : 'border-[#3B82F6]/30 text-[#3B82F6]'
                  )}
                >
                  {Math.round(pct)}%
                </Badge>
              </div>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: done
                    ? '#22C55E'
                    : pct > 60
                      ? 'linear-gradient(90deg, #3B82F6, #22C55E)'
                      : '#3B82F6',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ───── History Section ─────

function HistorySection({ recentHistory }) {
  const [expanded, setExpanded] = useState(false)

  if (!recentHistory?.length) return null

  const displayed = expanded ? recentHistory : recentHistory.slice(0, 5)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
      >
        <History className="w-3 h-3" />
        Recent creations ({recentHistory.length})
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {(expanded || recentHistory.length <= 5) && (
        <div className="border border-[#1a1a1a] rounded-md overflow-hidden">
          {displayed.map((h, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between px-2.5 py-1.5 text-[11px]',
                i % 2 === 0 ? 'bg-[#0A0A0A]/50' : 'bg-transparent',
                i < displayed.length - 1 && 'border-b border-[#1a1a1a]'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: h.success ? '#22C55E' : '#EF4444' }}
                />
                <span className="text-[#A1A1AA]">{h.identityId}</span>
                {h.success && h.username ? (
                  <span className="text-[#22C55E]">@{h.username}</span>
                ) : h.errorMessage ? (
                  <span className="text-[#EF4444] truncate max-w-[180px]">{h.errorMessage}</span>
                ) : (
                  <span className="text-[#EF4444]">Failed</span>
                )}
              </div>
              <span className="text-[#52525B] flex-shrink-0 ml-2">{formatTimeAgo(h.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ───── Device Card ─────

function DeviceCard({ device, onEdit }) {
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const toggleDevice = useToggleDevice()
  const deleteConfig = useDeleteConfig()

  const totalTarget = device.identityProgress?.reduce((sum, ip) => sum + ip.targetCount, 0) || 0
  const totalActive = device.identityProgress?.reduce((sum, ip) => sum + Math.min(ip.currentCount, ip.targetCount), 0) || 0
  const progress = totalTarget > 0 ? Math.round((totalActive / totalTarget) * 100) : 0

  return (
    <Card className="bg-[#111111] border-[#1a1a1a]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm text-[#FAFAFA]">{device.deviceName}</CardTitle>
            <StatusBadge status={device.currentStatus} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-[#52525B] hover:text-[#FAFAFA]"
              onClick={() => onEdit(device)}
              title="Edit config"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-[#52525B] hover:text-[#EF4444]"
              onClick={() => deleteConfig.mutate(device.deviceUdid, {
                onSuccess: () => toast.success('Config deleted'),
              })}
              title="Delete config"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-4 bg-[#1a1a1a]" />
            <span className="text-[10px] text-[#52525B]">{device.enabled ? 'Active' : 'Disabled'}</span>
            <Switch
              checked={device.enabled}
              onCheckedChange={(checked) =>
                toggleDevice.mutate(
                  { deviceUdid: device.deviceUdid, enabled: checked },
                  { onSuccess: () => toast.success(`Auto-creation ${checked ? 'enabled' : 'disabled'}`) }
                )
              }
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Global progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-[#52525B]">
              {totalActive}/{totalTarget} accounts
              <span className="ml-1 text-[#52525B]">
                ({device.identityProgress?.length || 0} {device.identityProgress?.length === 1 ? 'identity' : 'identities'})
              </span>
            </span>
            <span className="text-[#A1A1AA]">{progress}%</span>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress >= 100 ? '#22C55E' : '#3B82F6',
              }}
            />
          </div>
        </div>

        {/* Identity progress breakdown */}
        <IdentityProgressSection identityProgress={device.identityProgress} />

        {/* History */}
        <HistorySection recentHistory={device.recentHistory} />

        {/* Expandable settings */}
        <button
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className="flex items-center gap-1 text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
        >
          <Settings2 className="w-3 h-3" />
          Advanced settings
          {settingsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {settingsExpanded && (
          <div className="text-[10px] text-[#52525B] space-y-1 pl-4 border-l border-[#1a1a1a]">
            <p>UDID: <span className="text-[#A1A1AA] font-mono">{device.deviceUdid}</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ───── Add/Edit Config Dialog ─────

function ConfigDialog({ open, onOpenChange, devices, identities, existingConfigs, editDevice }) {
  const isEditing = !!editDevice
  const [deviceUdid, setDeviceUdid] = useState('')
  const [targets, setTargets] = useState([{ identityId: '', targetCount: 5 }])
  const [taskPriority, setTaskPriority] = useState(200)
  const [bufferMultiplier, setBufferMultiplier] = useState(1.5)
  const [extraBufferMinutes, setExtraBufferMinutes] = useState(5)

  const updateConfig = useUpdateConfig()

  // Pre-fill form when opening in edit mode
  useEffect(() => {
    if (open && editDevice) {
      setDeviceUdid(editDevice.deviceUdid)
      setTargets(
        editDevice.identityProgress?.length
          ? editDevice.identityProgress.map(ip => ({
              identityId: ip.identityId,
              targetCount: ip.targetCount,
            }))
          : [{ identityId: '', targetCount: 5 }]
      )
    } else if (!open) {
      setDeviceUdid('')
      setTargets([{ identityId: '', targetCount: 5 }])
      setTaskPriority(200)
      setBufferMultiplier(1.5)
      setExtraBufferMinutes(5)
    }
  }, [open, editDevice])

  const availableDevices = devices.filter(
    d => !existingConfigs?.some(c => c.deviceUdid === d.udid)
  )

  const addTarget = () => {
    setTargets([...targets, { identityId: '', targetCount: 5 }])
  }

  const removeTarget = (index) => {
    if (targets.length <= 1) return
    setTargets(targets.filter((_, i) => i !== index))
  }

  const updateTarget = (index, field, value) => {
    const updated = [...targets]
    updated[index] = { ...updated[index], [field]: value }
    setTargets(updated)
  }

  // Identities already selected in other rows
  const selectedIdentities = targets.map(t => t.identityId).filter(Boolean)

  const handleSubmit = () => {
    if (!deviceUdid) {
      toast.error('Select a device')
      return
    }

    const validTargets = targets.filter(t => t.identityId && t.targetCount > 0)
    if (validTargets.length === 0) {
      toast.error('Add at least one identity target')
      return
    }

    updateConfig.mutate(
      {
        deviceUdid,
        config: {
          identityTargets: validTargets.map(t => ({
            identityId: t.identityId,
            targetCount: t.targetCount,
          })),
          taskPriority,
          timeBufferMultiplier: bufferMultiplier,
          extraBufferMinutes,
        },
      },
      {
        onSuccess: () => {
          toast.success('Configuration saved')
          onOpenChange(false)
          setDeviceUdid('')
          setTargets([{ identityId: '', targetCount: 5 }])
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{isEditing ? 'Edit Auto-Creation Config' : 'Add Auto-Creation Config'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Device select */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[#A1A1AA]">Device</Label>
            {isEditing ? (
              <div className="text-xs bg-[#0A0A0A] border border-[#1a1a1a] rounded-md px-3 h-8 flex items-center text-[#A1A1AA]">
                {devices.find(d => d.udid === deviceUdid)?.name || deviceUdid.slice(-8)}
              </div>
            ) : (
              <Select value={deviceUdid} onValueChange={setDeviceUdid}>
                <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                  {availableDevices.map(d => (
                    <SelectItem key={d.udid} value={d.udid} className="text-xs text-[#FAFAFA]">
                      {d.name} ({d.udid.slice(-8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Identity targets */}
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Identity Targets</Label>
            {targets.map((target, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={target.identityId}
                  onValueChange={(val) => updateTarget(i, 'identityId', val)}
                >
                  <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8 flex-1">
                    <SelectValue placeholder="Identity" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                    {identities
                      .filter(id => !selectedIdentities.includes(id.identityId) || id.identityId === target.identityId)
                      .map(id => (
                        <SelectItem key={id.identityId} value={id.identityId} className="text-xs text-[#FAFAFA]">
                          {id.identityId}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={target.targetCount}
                  onChange={(e) => updateTarget(i, 'targetCount', Math.max(1, +e.target.value))}
                  className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8 w-20"
                  placeholder="Target"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[#52525B] hover:text-[#EF4444]"
                  onClick={() => removeTarget(i)}
                  disabled={targets.length <= 1}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] h-7"
              onClick={addTarget}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add identity
            </Button>
          </div>

          {/* Advanced */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-[#52525B]">Priority</Label>
              <Input
                type="number" value={taskPriority} onChange={e => setTaskPriority(+e.target.value)}
                className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-7"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[#52525B]">Buffer x</Label>
              <Input
                type="number" step="0.1" value={bufferMultiplier} onChange={e => setBufferMultiplier(+e.target.value)}
                className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-7"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[#52525B]">Extra (min)</Label>
              <Input
                type="number" value={extraBufferMinutes} onChange={e => setExtraBufferMinutes(+e.target.value)}
                className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-7"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="text-xs bg-[#3B82F6] hover:bg-[#2563EB]"
            onClick={handleSubmit}
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending ? 'Saving...' : 'Save Config'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ───── Main Page ─────

export default function AutoCreation() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDevice, setEditDevice] = useState(null)
  const { data: status, isLoading } = useAutoCreationStatus()
  const toggleGlobal = useToggleGlobal()

  const openAddDialog = () => {
    setEditDevice(null)
    setDialogOpen(true)
  }

  const openEditDialog = (device) => {
    setEditDevice(device)
    setDialogOpen(true)
  }

  const { data: devices = [] } = useQuery({
    queryKey: ['devices-config'],
    queryFn: () => apiGet('/api/devices'),
    select: (res) => Array.isArray(res) ? res : res?.devices || [],
  })

  const { data: identities = [] } = useQuery({
    queryKey: ['identities'],
    queryFn: () => apiGet('/api/identities'),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64 bg-[#1a1a1a]" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-[#1a1a1a]" />
          ))}
        </div>
        <Skeleton className="h-48 bg-[#1a1a1a]" />
      </div>
    )
  }

  const globalEnabled = status?.globalEnabled ?? false

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-[#3B82F6]" />
          <h1 className="text-lg font-semibold text-[#FAFAFA]">Auto-Creation</h1>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px]',
              globalEnabled
                ? 'border-[#22C55E]/30 text-[#22C55E] bg-[#22C55E]/10'
                : 'border-[#52525B]/30 text-[#52525B] bg-[#52525B]/10'
            )}
          >
            {globalEnabled ? 'ACTIVE' : 'OFF'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline" size="sm"
            className="text-xs border-[#1a1a1a] text-[#FAFAFA] hover:bg-[#1a1a1a]"
            onClick={openAddDialog}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Device
          </Button>
          <div className="flex items-center gap-2 pl-3 border-l border-[#1a1a1a]">
            <span className="text-xs text-[#52525B]">Global</span>
            <Switch
              checked={globalEnabled}
              onCheckedChange={(checked) =>
                toggleGlobal.mutate(checked, {
                  onSuccess: () => toast.success(`Auto-creation ${checked ? 'enabled' : 'disabled'} globally`),
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      {status && <StatsRow status={status} />}

      {/* Device cards */}
      {!status?.devices?.length ? (
        <EmptyState
          icon={UserPlus}
          title="No devices configured"
          description="Add a device configuration to start auto-creating accounts"
        />
      ) : (
        <div className="space-y-4">
          {status.devices.map(device => (
            <DeviceCard
              key={device.deviceUdid}
              device={device}
              onEdit={openEditDialog}
            />
          ))}
        </div>
      )}

      {/* Add/Edit config dialog */}
      <ConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        devices={devices}
        identities={identities}
        existingConfigs={status?.devices}
        editDevice={editDevice}
      />
    </div>
  )
}
