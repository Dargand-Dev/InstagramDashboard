import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Hand,
  LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import { useManualControl } from '@/hooks/useManualControl'

const STATUS_DOT = {
  IDLE: 'bg-[#22C55E]',
  RUNNING: 'bg-[#3B82F6] animate-subtle-pulse',
  ERROR: 'bg-[#EF4444]',
  OFFLINE: 'bg-[#52525B]',
  DISCONNECTED: 'bg-[#F59E0B] animate-subtle-pulse',
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

// Convertit un ISO string (ou Instant sérialisé) en valeur `datetime-local` (YYYY-MM-DDTHH:mm)
function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatProxyExpiry(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString()
}

function proxyExpiryColor(iso) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return '#EF4444'
  if (ms <= ONE_DAY_MS) return '#F59E0B'
  return null
}

function DeviceCard({ device, onSelect, onToggle, onTakeControl }) {
  const statusColor = STATUS_DOT[device.status] || STATUS_DOT.OFFLINE
  const isRunning = device.status === 'RUNNING'
  const isError = device.status === 'ERROR'
  const isDisconnected = device.status === 'DISCONNECTED'
  const isManual = device.manualMode === true

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
            <span className="font-medium">{device.currentAction || device.currentWorkflow || 'Running workflow'}</span>
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

      {isDisconnected && (
        <div className="mb-3 p-2 rounded-md bg-[#F59E0B]/5 border border-[#F59E0B]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#F59E0B] mb-1">
            <AlertTriangle className="w-3 h-3 shrink-0 animate-pulse" />
            <span className="font-medium">USB cable disconnected</span>
          </div>
          <p className="text-xs text-[#A1A1AA]">
            {device.currentAction || 'Waiting for reconnection (max 5 min)'}
          </p>
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
          <span>{(device.port || device.ports?.appium) ? `Port ${device.port || device.ports?.appium}` : 'No port'}</span>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isManual ? (
            <span className="flex items-center gap-1 text-xs text-[#EF4444] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
              Manual
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
              onClick={() => onTakeControl(device)}
              disabled={device.status === 'OFFLINE'}
              title="Prendre le contrôle manuel via TrollVNC"
            >
              <Hand className="w-3 h-3 mr-1" />
              Take Control
            </Button>
          )}
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
  const [activeTab, setActiveTab] = useState('info')

  const { data: runHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['device-runs', device?.id],
    queryFn: () => apiGet(`/api/automation/runs?deviceUdid=${device?.udid}&limit=20`),
    enabled: !!device?.udid && open,
    select: (res) => {
      const raw = res.data || res || {}
      if (Array.isArray(raw)) return raw
      return raw.runs || []
    },
  })

  useEffect(() => {
    if (device) {
      setEditForm({
        name: device.name || device.label || '',
        port: device.port || '',
        proxyHost: device.proxyHost || '',
        proxyPort: device.proxyPort || '',
        proxyUsername: device.proxyUsername || '',
        proxyPassword: device.proxyPassword || '',
        proxyUrl: device.proxyUrl || '',
        rotatingUrl: device.rotatingUrl || '',
        proxyExpiresAt: toDatetimeLocal(device.proxyExpiresAt),
      })
      setEditing(false)
    }
  }, [device])

  const updateMutation = useMutation({
    mutationFn: (body) => apiPut(`/api/devices/${device.id}`, {
      ...body,
      proxyPort: body.proxyPort ? Number(body.proxyPort) : null,
      proxyExpiresAt: body.proxyExpiresAt ? new Date(body.proxyExpiresAt).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success('Device updated')
      queryClient.invalidateQueries({ queryKey: ['devices-config'] })
      queryClient.invalidateQueries({ queryKey: ['devices-proxy-expiring'] })
      setEditing(false)
    },
  })

  const setField = (key) => (e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))

  if (!device) return null

  const expiryColor = proxyExpiryColor(device.proxyExpiresAt)
  const expiryFormatted = formatProxyExpiry(device.proxyExpiresAt)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0A0A0A] border-[#1a1a1a] w-[92vw] sm:max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="border-b border-[#1a1a1a] px-6 py-4 shrink-0">
          <DialogTitle className="text-[#FAFAFA] flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#A1A1AA]" />
            {device.name || device.label || 'Device'}
            <StatusBadge status={device.status || 'OFFLINE'} />
          </DialogTitle>
          <DialogDescription className="text-[#52525B] font-mono text-xs break-all">
            {device.udid || 'No UDID'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 border-b border-[#1a1a1a] px-6 shrink-0">
          {[
            { key: 'info', label: 'Info & Proxy' },
            { key: 'history', label: 'Run History' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-[#FAFAFA] text-[#FAFAFA]'
                  : 'border-transparent text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5">
            {activeTab === 'info' && (
              <div className="space-y-5 pb-2">
                {device.status === 'RUNNING' && (
                  <div className="p-3 rounded-lg bg-[#3B82F6]/5 border border-[#3B82F6]/10 space-y-2">
                    <p className="text-xs font-medium text-[#3B82F6]">Current Run</p>
                    <div className="space-y-1 text-xs text-[#A1A1AA]">
                      {(device.currentAction || device.currentWorkflow) && <p>Workflow: {device.currentAction || device.currentWorkflow}</p>}
                      {device.currentAccount && <p>Account: {device.currentAccount}</p>}
                      {device.lastActivityAt && <p>Last activity: <TimeAgo date={device.lastActivityAt} /></p>}
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

                {/* Header with Edit / Save / Cancel */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wide">Device</p>
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

                {/* Device basics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldRow label="Name" editing={editing} value={device.name || device.label}>
                    <Input value={editForm.name || ''} onChange={setField('name')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA]" />
                  </FieldRow>
                  <FieldRow label="Appium port" editing={editing} value={device.port}>
                    <Input value={editForm.port || ''} onChange={setField('port')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                  </FieldRow>
                  <FieldRow label="UDID" editing={false} value={device.udid} mono />
                  <FieldRow label="Enabled" editing={false} value={device.enabled !== false ? 'Yes' : 'No'} />
                </div>

                {/* Proxy section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wide">Proxy HTTP</p>
                    {expiryFormatted && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded border"
                        style={{
                          color: expiryColor || '#A1A1AA',
                          borderColor: (expiryColor || '#1a1a1a') + '40',
                          backgroundColor: expiryColor ? expiryColor + '10' : 'transparent',
                        }}
                      >
                        {expiryColor === '#EF4444' ? 'Expired' : expiryColor === '#F59E0B' ? 'Expires soon' : 'Active'} · {expiryFormatted}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldRow label="Host" editing={editing} value={device.proxyHost} mono>
                      <Input placeholder="proxy.example.com" value={editForm.proxyHost || ''} onChange={setField('proxyHost')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                    </FieldRow>
                    <FieldRow label="Port" editing={editing} value={device.proxyPort} mono>
                      <Input type="number" placeholder="8080" value={editForm.proxyPort || ''} onChange={setField('proxyPort')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                    </FieldRow>
                    <FieldRow label="Username" editing={editing} value={device.proxyUsername} mono>
                      <Input placeholder="user" value={editForm.proxyUsername || ''} onChange={setField('proxyUsername')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                    </FieldRow>
                    <FieldRow label="Password" editing={editing} value={device.proxyPassword ? '••••••••' : null} mono>
                      <Input type="password" placeholder="••••••••" value={editForm.proxyPassword || ''} onChange={setField('proxyPassword')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                    </FieldRow>
                  </div>

                  <FieldRow label="Proxy URL (full, optional)" editing={editing} value={device.proxyUrl} mono>
                    <Input placeholder="http://user:pass@host:port" value={editForm.proxyUrl || ''} onChange={setField('proxyUrl')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                  </FieldRow>

                  <FieldRow label="Rotating URL" editing={editing} value={device.rotatingUrl} mono>
                    <Input placeholder="https://..." value={editForm.rotatingUrl || ''} onChange={setField('rotatingUrl')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA] font-mono" />
                  </FieldRow>

                  <FieldRow label="Expires at" editing={editing} value={expiryFormatted} valueColor={expiryColor}>
                    <Input type="datetime-local" value={editForm.proxyExpiresAt || ''} onChange={setField('proxyExpiresAt')} className="h-9 bg-[#0A0A0A] border-[#1a1a1a] text-sm text-[#FAFAFA]" />
                  </FieldRow>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2 pb-2">
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
                        <span className="text-xs font-medium text-[#FAFAFA]">{run.workflowName || run.workflowType || run.type || 'Run'}</span>
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
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({ label, editing, value, mono, valueColor, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">{label}</Label>
      {editing && children ? (
        children
      ) : (
        <div
          className={`min-h-9 px-3 py-2 rounded-md bg-[#111111] border border-[#1a1a1a] text-sm ${mono ? 'font-mono' : ''} break-all`}
          style={{ color: valueColor || '#A1A1AA' }}
        >
          {value || <span className="text-[#3f3f46]">—</span>}
        </div>
      )}
    </div>
  )
}

const EMPTY_ADD_FORM = {
  name: '',
  udid: '',
  port: '',
  proxyHost: '',
  proxyPort: '',
  proxyUsername: '',
  proxyPassword: '',
  proxyUrl: '',
  rotatingUrl: '',
  proxyExpiresAt: '',
}

function AddDeviceDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_ADD_FORM)
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const createMutation = useMutation({
    mutationFn: (body) => apiPost('/api/devices', {
      ...body,
      proxyPort: body.proxyPort ? Number(body.proxyPort) : null,
      proxyExpiresAt: body.proxyExpiresAt ? new Date(body.proxyExpiresAt).toISOString() : null,
    }),
    onSuccess: () => {
      toast.success('Device added')
      queryClient.invalidateQueries({ queryKey: ['devices-config'] })
      queryClient.invalidateQueries({ queryKey: ['devices-proxy-expiring'] })
      onOpenChange(false)
      setForm(EMPTY_ADD_FORM)
    },
  })

  const inputCls = 'h-9 bg-[#111111] border-[#1a1a1a] text-sm text-[#FAFAFA] placeholder:text-[#52525B]'
  const monoInputCls = inputCls + ' font-mono'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-[#1a1a1a] w-[92vw] sm:max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="border-b border-[#1a1a1a] px-6 py-4 shrink-0">
          <DialogTitle className="text-[#FAFAFA]">Add Device</DialogTitle>
          <DialogDescription className="text-[#52525B]">Register a new device and its HTTP proxy.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-5">
            <p className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wide">Device</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Name</Label>
                <Input placeholder="iPhone 15 Pro" value={form.name} onChange={setField('name')} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Appium port</Label>
                <Input placeholder="8100" value={form.port} onChange={setField('port')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">UDID</Label>
                <Input placeholder="00008101-..." value={form.udid} onChange={setField('udid')} className={monoInputCls} />
              </div>
            </div>

            <p className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wide pt-2">Proxy HTTP</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Host</Label>
                <Input placeholder="proxy.example.com" value={form.proxyHost} onChange={setField('proxyHost')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Port</Label>
                <Input type="number" placeholder="8080" value={form.proxyPort} onChange={setField('proxyPort')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Username</Label>
                <Input placeholder="user" value={form.proxyUsername} onChange={setField('proxyUsername')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Password</Label>
                <Input type="password" placeholder="••••••••" value={form.proxyPassword} onChange={setField('proxyPassword')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Proxy URL (full, optional)</Label>
                <Input placeholder="http://user:pass@host:port" value={form.proxyUrl} onChange={setField('proxyUrl')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Rotating URL</Label>
                <Input placeholder="https://..." value={form.rotatingUrl} onChange={setField('rotatingUrl')} className={monoInputCls} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px] uppercase tracking-wide text-[#52525B]">Expires at</Label>
                <Input type="datetime-local" value={form.proxyExpiresAt} onChange={setField('proxyExpiresAt')} className={inputCls} />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-[#1a1a1a] px-6 py-3 shrink-0">
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
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const { subscribe, isConnected } = useWebSocket()

  const { data: staticDevices = [], isLoading: loadingStatic } = useQuery({
    queryKey: ['devices-config'],
    queryFn: () => apiGet('/api/devices'),
    select: (res) => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
  })

  const { data: liveStatuses = [], isLoading: loadingLive } = useQuery({
    queryKey: ['devices-live'],
    queryFn: () => apiGet('/api/devices/live-status'),
    select: (res) => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
    refetchInterval: 10000,
  })

  const { data: expiringProxies = [] } = useQuery({
    queryKey: ['devices-proxy-expiring'],
    queryFn: () => apiGet('/api/devices/proxy-expiring?withinHours=24'),
    select: (res) => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
  })

  useEffect(() => {
    if (expiringProxies.length === 0) return
    const now = Date.now()
    const expired = expiringProxies.filter((d) => new Date(d.proxyExpiresAt).getTime() <= now)
    const soon = expiringProxies.filter((d) => new Date(d.proxyExpiresAt).getTime() > now)
    if (expired.length > 0) {
      toast.error(
        `${expired.length} proxy expiré(s) : ${expired.map((d) => d.name || d.udid).join(', ')}`,
        { id: 'proxy-expired', duration: 8000 }
      )
    }
    if (soon.length > 0) {
      toast.warning(
        `${soon.length} proxy expire dans moins de 24h : ${soon.map((d) => d.name || d.udid).join(', ')}`,
        { id: 'proxy-soon', duration: 8000 }
      )
    }
  }, [expiringProxies])

  // Merge static device config with live status
  const devices = useMemo(() => {
    const liveMap = {}
    liveStatuses.forEach(ls => {
      liveMap[ls.deviceUdid || ls.udid] = ls
    })
    return staticDevices.map(d => {
      const live = liveMap[d.udid] || {}
      return {
        ...d,
        name: d.name || live.deviceName,
        status: live.status || 'OFFLINE',
        currentAction: live.currentAction,
        currentAccount: live.currentAccount,
        currentRunId: live.currentRunId,
        lastActivityAt: live.lastActivityAt,
        manualMode: !!live.manualMode,
        port: d.ports?.appium || d.port,
      }
    })
  }, [staticDevices, liveStatuses])

  const isLoading = loadingStatic || loadingLive

  const { takeControl, isTaking } = useManualControl()

  const handleTakeControlClick = (device) => {
    // Évite les double-clics pendant qu'une requête est en vol
    if (isTaking) return
    takeControl({ udid: device.udid, deviceName: device.name })
  }

  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/devices/status', () => {
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
    })
    return unsub
  }, [isConnected, subscribe, queryClient])

  const toggleMutation = useMutation({
    mutationFn: (device) => apiPut(`/api/devices/${device.id}/enabled`, { enabled: device.enabled === false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-config'] })
      queryClient.invalidateQueries({ queryKey: ['devices-proxy-expiring'] })
    },
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
    const counts = { IDLE: 0, RUNNING: 0, ERROR: 0, OFFLINE: 0, DISCONNECTED: 0 }
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#1a1a1a] text-[#A1A1AA] hover:text-[#FAFAFA]"
            onClick={() => navigate('/devices/wall')}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" /> VNC Wall
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Device
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Idle', count: statusCounts.IDLE, color: '#22C55E', dot: 'bg-[#22C55E]' },
          { label: 'Running', count: statusCounts.RUNNING, color: '#3B82F6', dot: 'bg-[#3B82F6]' },
          { label: 'Disconnected', count: statusCounts.DISCONNECTED, color: '#F59E0B', dot: 'bg-[#F59E0B]' },
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
              onTakeControl={handleTakeControlClick}
            />
          ))}
        </div>
      )}

      <DeviceDetailSheet device={selectedDevice} open={sheetOpen} onOpenChange={setSheetOpen} />
      <AddDeviceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  )
}
