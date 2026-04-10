import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import {
  useAutoCreationStatus,
  useAutoCreationConfig,
  useUpdateConfig,
  useUpdateMode,
  useToggleGlobal,
  useDeleteConfig,
  useBatchCreateContainers,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import {
  UserPlus, Plus, Trash2, Pencil, Clock, Timer, Calendar,
  Settings2, ChevronDown, ChevronUp, Check, X, History, Container,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ───── Mode constants ─────

const AUTO_CREATION_MODES = {
  DISABLED: 'DISABLED',
  AUTOMATIC_CONTAINER_CREATION: 'AUTOMATIC_CONTAINER_CREATION',
  EXISTING_CONTAINER: 'EXISTING_CONTAINER',
}

const MODE_LABELS = {
  DISABLED: 'Disabled',
  AUTOMATIC_CONTAINER_CREATION: 'Auto (create container)',
  EXISTING_CONTAINER: 'Existing container',
}

const MODE_LABELS_LONG = {
  DISABLED: 'Disabled',
  AUTOMATIC_CONTAINER_CREATION: 'Automatic container creation',
  EXISTING_CONTAINER: 'Use existing containers',
}

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
  const updateMode = useUpdateMode()
  const deleteConfig = useDeleteConfig()

  const totalTarget = device.identityProgress?.reduce((sum, ip) => sum + ip.targetCount, 0) || 0
  const totalActive = device.identityProgress?.reduce((sum, ip) => sum + Math.min(ip.currentCount, ip.targetCount), 0) || 0
  const progress = totalTarget > 0 ? Math.round((totalActive / totalTarget) * 100) : 0
  const currentMode = device.mode || AUTO_CREATION_MODES.DISABLED

  return (
    <Card className="bg-[#111111] border-[#1a1a1a]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm text-[#FAFAFA]">{device.deviceName}</CardTitle>
            <StatusBadge status={device.currentStatus} />
            {currentMode === AUTO_CREATION_MODES.EXISTING_CONTAINER && (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 border-[#8B5CF6]/30 text-[#8B5CF6] bg-[#8B5CF6]/10"
              >
                <Container className="w-2.5 h-2.5 mr-1" />
                Existing
              </Badge>
            )}
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
            <Select
              value={currentMode}
              onValueChange={(mode) =>
                updateMode.mutate(
                  { deviceUdid: device.deviceUdid, mode },
                  {
                    onSuccess: () => toast.success(`Mode: ${MODE_LABELS[mode]}`),
                    onError: (e) => toast.error(e.message || 'Failed to update mode'),
                  }
                )
              }
            >
              <SelectTrigger className="h-7 text-[10px] w-[180px] bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                {Object.values(AUTO_CREATION_MODES).map(mode => (
                  <SelectItem key={mode} value={mode} className="text-[11px] text-[#FAFAFA]">
                    {MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <p>Mode: <span className="text-[#A1A1AA]">{MODE_LABELS_LONG[currentMode]}</span></p>
            {currentMode === AUTO_CREATION_MODES.EXISTING_CONTAINER && device.availableContainers && (
              <div>
                <p>Available containers:</p>
                <ul className="pl-3 space-y-0.5">
                  {Object.entries(device.availableContainers).map(([identityId, count]) => (
                    <li key={identityId}>
                      <span className="text-[#A1A1AA]">{identityId}</span>: {count} remaining
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ───── Bulk Create Containers Dialog ─────

/**
 * Modal permettant de créer en série N containers Crane via CLI pour une identité donnée.
 * Appelle POST /api/auto-creation/configs/{udid}/containers/{identityId}/batch-create.
 * Au retour, appelle onCreated(identityId, createdContainers) pour que le parent
 * append les nouveaux containers à son state local containerPools.
 */
/**
 * Wrapper qui utilise `key` pour forcer un remount complet du BulkCreateDialogInner
 * à chaque ouverture. Évite le besoin d'un useEffect de reset (qui déclencherait
 * la règle react-hooks/set-state-in-effect).
 */
function BulkCreateDialog(props) {
  // Le compteur d'ouverture change à chaque open → React remount le composant enfant
  // et ses useState initialisent à nouveau leurs valeurs par défaut.
  const openCount = props.open ? 1 : 0
  return <BulkCreateDialogInner key={openCount} {...props} />
}

function BulkCreateDialogInner({ open, onOpenChange, deviceUdid, device, identityIds, onCreated }) {
  const [identityId, setIdentityId] = useState(identityIds[0] || '')
  const [count, setCount] = useState(5)
  const [presetId, setPresetId] = useState('RANDOM')
  const batchCreate = useBatchCreateContainers()

  const presets = device?.presets || []

  const handleCreate = () => {
    if (!identityId) {
      toast.error('Select an identity')
      return
    }
    if (count < 1 || count > 10) {
      toast.error('Count must be between 1 and 10')
      return
    }

    batchCreate.mutate(
      {
        deviceUdid,
        identityId,
        count,
        presetId: presetId === 'RANDOM' ? null : presetId,
      },
      {
        onSuccess: (response) => {
          // Erreur fatale avant la boucle (device, preset invalide, etc.)
          if (response.error) {
            toast.error(`Bulk create failed: ${response.error}`)
            return
          }
          // Merge des containers créés dans le state parent
          if (response.created && response.created.length > 0) {
            onCreated(identityId, response.created)
          }
          // Échec à mi-parcours : certains créés + une erreur
          if (response.failed) {
            toast.error(
              `Created ${response.successCount}/${response.requested}, then failed at #${response.failed.index + 1}: ${response.failed.message}`,
            )
          } else {
            toast.success(`${response.successCount} container(s) created for ${identityId}`)
          }
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(`Request failed: ${err?.message || err}`)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm text-[#FAFAFA] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#3B82F6]" />
            Bulk create containers
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-[10px] text-[#52525B]">
            Creates containers via crane-cli + ghost-cli on the device. Names are auto-incremented
            (<code className="text-[#FAFAFA]">{'<identity>_<n>'}</code>) based on the existing pool.
            This can take ~30s per container.
          </p>

          <div className="space-y-1">
            <Label className="text-[10px] text-[#52525B]">Identity</Label>
            <Select value={identityId} onValueChange={setIdentityId}>
              <SelectTrigger className="text-xs h-8 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]">
                <SelectValue placeholder="Select an identity" />
              </SelectTrigger>
              <SelectContent className="bg-[#0A0A0A] border-[#1a1a1a]">
                {identityIds.map((id) => (
                  <SelectItem key={id} value={id} className="text-xs text-[#FAFAFA]">
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-[#52525B]">Count (1-10)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(10, +e.target.value || 1)))}
              className="text-xs h-8 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-[#52525B]">Ghost preset</Label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger className="text-xs h-8 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0A0A0A] border-[#1a1a1a]">
                <SelectItem value="RANDOM" className="text-xs text-[#FAFAFA]">
                  Random (different preset per container)
                </SelectItem>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs text-[#FAFAFA]">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presets.length === 0 && (
              <p className="text-[10px] text-[#EF4444] italic">
                No presets configured for this device. Add presets in Device settings first.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => onOpenChange(false)}
            disabled={batchCreate.isPending}
          >
            Cancel
          </Button>
          <Button
            className="text-xs bg-[#3B82F6] hover:bg-[#2563EB]"
            onClick={handleCreate}
            disabled={batchCreate.isPending || presets.length === 0 || !identityId}
          >
            {batchCreate.isPending ? `Creating ${count}...` : `Create ${count} container(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ───── Container Pool Editor (local sub-component) ─────

function ContainerPoolEditor({ identityId, containers, onChange }) {
  const addContainer = () => onChange([...containers, { name: '', id: '' }])
  const removeContainer = (i) => onChange(containers.filter((_, idx) => idx !== i))
  const updateContainer = (i, field, value) => {
    const updated = [...containers]
    updated[i] = { ...updated[i], [field]: value }
    onChange(updated)
  }

  return (
    <div className="space-y-2 p-3 border border-[#1a1a1a] rounded-md bg-[#0A0A0A]/50">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[#FAFAFA] font-medium">{identityId}</Label>
        <span className="text-[10px] text-[#52525B]">{containers.length} container{containers.length !== 1 ? 's' : ''}</span>
      </div>
      {containers.length === 0 && (
        <p className="text-[10px] text-[#52525B] italic">No containers yet — add one below.</p>
      )}
      {containers.map((c, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="name (ex: sofia-42)"
            value={c.name || ''}
            onChange={e => updateContainer(i, 'name', e.target.value)}
            className="text-[11px] h-7 flex-1 bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
          />
          <Input
            placeholder="UUID"
            value={c.id || ''}
            onChange={e => updateContainer(i, 'id', e.target.value)}
            className="text-[10px] h-7 flex-[1.5] bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] font-mono"
          />
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-[#52525B] hover:text-[#EF4444]"
            onClick={() => removeContainer(i)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost" size="sm"
        className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] h-6 px-2"
        onClick={addContainer}
      >
        <Plus className="w-3 h-3 mr-1" />
        Add container
      </Button>
    </div>
  )
}

// ───── Add/Edit Config Dialog ─────

function ConfigDialog({ open, onOpenChange, devices, identities, existingConfigs, editDevice }) {
  const isEditing = !!editDevice
  const [deviceUdid, setDeviceUdid] = useState('')
  const [mode, setMode] = useState(AUTO_CREATION_MODES.DISABLED)
  const [targets, setTargets] = useState([{ identityId: '', targetCount: 5 }])
  const [containerPools, setContainerPools] = useState({})
  const [taskPriority, setTaskPriority] = useState(200)
  const [bufferMultiplier, setBufferMultiplier] = useState(1.5)
  const [extraBufferMinutes, setExtraBufferMinutes] = useState(5)
  const [bulkOpen, setBulkOpen] = useState(false)

  const updateConfig = useUpdateConfig()

  // Fetch complete config when editing (status endpoint ne renvoie pas les containerPools détaillés)
  const { data: fullConfig } = useAutoCreationConfig(
    open && isEditing ? editDevice.deviceUdid : null
  )

  // Pre-fill form when opening in edit mode, or reset when closing.
  // Quand fullConfig est chargé (GET /configs/{udid}), on écrase avec ses données autoritatives.
  useEffect(() => {
    if (!open) {
      setDeviceUdid('')
      setMode(AUTO_CREATION_MODES.DISABLED)
      setTargets([{ identityId: '', targetCount: 5 }])
      setContainerPools({})
      setTaskPriority(200)
      setBufferMultiplier(1.5)
      setExtraBufferMinutes(5)
      return
    }

    if (editDevice) {
      setDeviceUdid(editDevice.deviceUdid)
      // Les champs détaillés viennent en priorité de fullConfig si disponible
      if (fullConfig) {
        setMode(fullConfig.mode || AUTO_CREATION_MODES.DISABLED)
        setTargets(
          fullConfig.identityTargets?.length
            ? fullConfig.identityTargets.map(t => ({
                identityId: t.identityId,
                targetCount: t.targetCount,
              }))
            : [{ identityId: '', targetCount: 5 }]
        )
        setContainerPools(fullConfig.containerPools || {})
        if (fullConfig.taskPriority != null) setTaskPriority(fullConfig.taskPriority)
        if (fullConfig.timeBufferMultiplier != null) setBufferMultiplier(fullConfig.timeBufferMultiplier)
        if (fullConfig.extraBufferMinutes != null) setExtraBufferMinutes(fullConfig.extraBufferMinutes)
      } else {
        // Fallback : utiliser ce qui est dispo dans la vue /status en attendant fullConfig
        setMode(editDevice.mode || AUTO_CREATION_MODES.DISABLED)
        setTargets(
          editDevice.identityProgress?.length
            ? editDevice.identityProgress.map(ip => ({
                identityId: ip.identityId,
                targetCount: ip.targetCount,
              }))
            : [{ identityId: '', targetCount: 5 }]
        )
      }
    }
  }, [open, editDevice, fullConfig])

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

    // Validation client : mode EXISTING_CONTAINER requires ≥1 container par identity target
    if (mode === AUTO_CREATION_MODES.EXISTING_CONTAINER) {
      for (const target of validTargets) {
        const pool = containerPools[target.identityId] || []
        const validContainers = pool.filter(c => c.name?.trim() && c.id?.trim())
        if (validContainers.length === 0) {
          toast.error(`Identity "${target.identityId}" has no containers configured`)
          return
        }
      }
    }

    // Ne garder que les pools pour les identités présentes dans les targets
    const activeIdentityIds = new Set(validTargets.map(t => t.identityId))
    const filteredPools = {}
    Object.entries(containerPools).forEach(([identityId, pool]) => {
      if (activeIdentityIds.has(identityId)) {
        // Garder uniquement les conteneurs avec name ET id non-vides
        filteredPools[identityId] = pool.filter(c => c.name?.trim() && c.id?.trim())
      }
    })

    updateConfig.mutate(
      {
        deviceUdid,
        config: {
          mode,
          identityTargets: validTargets.map(t => ({
            identityId: t.identityId,
            targetCount: t.targetCount,
          })),
          containerPools: filteredPools,
          taskPriority,
          timeBufferMultiplier: bufferMultiplier,
          extraBufferMinutes,
        },
      },
      {
        onSuccess: () => {
          toast.success('Configuration saved')
          onOpenChange(false)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const validTargetsForPools = targets.filter(t => t.identityId)
  const showContainersTab = mode === AUTO_CREATION_MODES.EXISTING_CONTAINER

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEditing ? 'Edit Auto-Creation Config' : 'Add Auto-Creation Config'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="grid grid-cols-2 bg-[#0A0A0A] border border-[#1a1a1a]">
            <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
            <TabsTrigger
              value="containers"
              className="text-xs"
              disabled={!showContainersTab}
            >
              Containers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            {/* Mode selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#A1A1AA]">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                  {Object.values(AUTO_CREATION_MODES).map(m => (
                    <SelectItem key={m} value={m} className="text-xs text-[#FAFAFA]">
                      {MODE_LABELS_LONG[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#A1A1AA]">Device</Label>
              {isEditing ? (
                <div className="text-xs bg-[#0A0A0A] border border-[#1a1a1a] rounded-md px-3 h-8 flex items-center text-[#A1A1AA]">
                  {devices.find(d => d.udid === deviceUdid)?.name || deviceUdid?.slice(-8) || 'Unknown'}
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
          </TabsContent>

          <TabsContent value="containers" className="space-y-3 pt-4">
            {validTargetsForPools.length === 0 ? (
              <p className="text-xs text-[#52525B] italic">
                Add at least one identity target in the General tab first.
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] text-[#52525B] flex-1">
                    Configure one container list per identity. Containers are consumed in order:
                    the first one is used for the next account creation, then removed from the list.
                    If the workflow fails before Enable2FA, the container is also deleted from Crane.
                  </p>
                  <Button
                    size="sm"
                    className="text-[10px] h-7 bg-[#3B82F6] hover:bg-[#2563EB] shrink-0"
                    onClick={() => setBulkOpen(true)}
                    disabled={!deviceUdid}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Bulk create
                  </Button>
                </div>
                {validTargetsForPools.map(target => (
                  <ContainerPoolEditor
                    key={target.identityId}
                    identityId={target.identityId}
                    containers={containerPools[target.identityId] || []}
                    onChange={(containers) =>
                      setContainerPools({ ...containerPools, [target.identityId]: containers })
                    }
                  />
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>

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

      <BulkCreateDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        deviceUdid={deviceUdid}
        device={devices.find(d => d.udid === deviceUdid)}
        identityIds={validTargetsForPools.map(t => t.identityId)}
        onCreated={(identityId, created) => {
          setContainerPools(prev => ({
            ...prev,
            [identityId]: [
              ...(prev[identityId] || []),
              ...created.map(c => ({ name: c.name, id: c.id })),
            ],
          }))
        }}
      />
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
    select: (res) => {
      const raw = res?.data || res || []
      return Array.isArray(raw) ? raw : []
    },
  })

  const { data: identities = [] } = useQuery({
    queryKey: ['identities'],
    queryFn: () => apiGet('/api/identities'),
    select: (res) => {
      const raw = res?.data || res || []
      return Array.isArray(raw) ? raw : []
    },
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
