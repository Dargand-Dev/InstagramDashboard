import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import {
  Play,
  Loader2,
  Settings,
  Key,
  Video,
  Image,
  UserPlus,
  Shield,
  Smartphone,
  Container,
  RefreshCw,
  Trash2,
  Clipboard,
  Lock,
  LockOpen,
  Unlock,
  Rocket,
  Layers,
  Square,
  Zap,
  Search,
  X,
  ExternalLink,
  CheckCircle,
  XCircle,
} from 'lucide-react'

// Action metadata for icons/colors
const ACTION_META = {
  SetupProfessionalAccount: { icon: Settings, color: '#3B82F6', desc: 'Convert to professional/business account', group: 'Account' },
  Enable2FA: { icon: Key, color: '#F59E0B', desc: 'Enable two-factor authentication', group: 'Account' },
  VerifyAccount: { icon: Shield, color: '#06B6D4', desc: 'Verify account (phone/email)', group: 'Account' },
  RegisterInstagramAccount: { icon: UserPlus, color: '#22C55E', desc: 'Register a new Instagram account', group: 'Account' },
  PostReel: { icon: Video, color: '#8B5CF6', desc: 'Post a reel from Drive content', group: 'Content' },
  PostStory: { icon: Image, color: '#EC4899', desc: 'Post a story', group: 'Content' },
  TransferVideoToDevice: { icon: Smartphone, color: '#6366F1', desc: 'Push video to device via AFC', group: 'Device' },
  CreateCraneContainer: { icon: Container, color: '#14B8A6', desc: 'Create a new Crane container', group: 'Device' },
  SwitchCraneContainer: { icon: RefreshCw, color: '#F97316', desc: 'Switch to another Crane container', group: 'Device' },
  Cleanup: { icon: Trash2, color: '#EF4444', desc: 'Clean up device state', group: 'Device' },
  TestClipboardPaste: { icon: Clipboard, color: '#A1A1AA', desc: 'Test clipboard paste functionality', group: 'Utility' },
}

const DEFAULT_META = { icon: Play, color: '#52525B', desc: '', group: 'Other' }

const ACTION_PARAMS = {
  PostReel: [
    { name: 'captionText', label: 'Caption', type: 'textarea', required: true, placeholder: 'Write your reel caption...' },
    { name: 'expectedUsername', label: 'Expected Username', type: 'text', required: false, placeholder: 'Optional — verify account' },
  ],
  PostStory: [
    { name: 'storyLinkUrl', label: 'Story Link URL', type: 'text', required: true, placeholder: 'https://...' },
  ],
  SwitchCraneContainer: [
    { name: 'containerName', label: 'Container Name', type: 'text', required: true, placeholder: 'e.g. container-1' },
  ],
  TestClipboardPaste: [
    { name: 'text', label: 'Text to Paste', type: 'text', required: true, placeholder: 'Text content' },
  ],
  VerifyAccount: [
    { name: 'expectedUsername', label: 'Expected Username', type: 'text', required: true, placeholder: 'Username to verify' },
  ],
  TransferVideoToDevice: [
    { name: 'videoPath', label: 'Video Path', type: 'text', required: true, placeholder: '/path/to/video.mp4' },
  ],
  Cleanup: [
    { name: 'videoPath', label: 'Video Path', type: 'text', required: true, placeholder: '/path/to/video.mp4' },
    { name: 'identityId', label: 'Identity ID', type: 'text', required: true, placeholder: 'e.g. sofia' },
    { name: 'reelContent', label: 'Reel Content (JSON)', type: 'textarea', required: false, placeholder: '{"key": "value"} (optional)' },
  ],
}

function ActionParamsDialog({ actionName, open, onOpenChange, onSubmit }) {
  const fields = ACTION_PARAMS[actionName] || []
  const meta = ACTION_META[actionName] || DEFAULT_META
  const Icon = meta.icon
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.name, ''])))
  const isValid = fields.filter(f => f.required).every(f => values[f.name]?.trim())

  useEffect(() => {
    if (open) setValues(Object.fromEntries(fields.map(f => [f.name, ''])))
  }, [open, actionName])

  function handleSubmit(e) {
    e.preventDefault()
    if (!isValid) return
    const params = {}
    for (const field of fields) {
      const v = values[field.name]?.trim()
      if (!v) continue
      if (field.name === 'reelContent') {
        try { params[field.name] = JSON.parse(v) } catch { params[field.name] = v }
      } else {
        params[field.name] = v
      }
    }
    onSubmit(params)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111111] border-[#1a1a1a] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#FAFAFA]">
            <Icon className="w-4 h-4" style={{ color: meta.color }} />
            {actionName}
          </DialogTitle>
          {meta.desc && <DialogDescription className="text-[#52525B]">{meta.desc}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(field => (
            <div key={field.name}>
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                {field.label}
                {field.required && <span className="text-[#EF4444] ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <Textarea
                  value={values[field.name]}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={4}
                  className="font-mono text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46]"
                />
              ) : (
                <Input
                  value={values[field.name]}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46]"
                />
              )}
            </div>
          ))}
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" className="text-[#A1A1AA]" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!isValid} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LockStatusIndicator({ lockStatus, onRefresh, onForceUnlock }) {
  const lock = lockStatus?.data || lockStatus || {}
  const isLocked = lock.locked || lock.totalLocked > 0
  const devices = lock.devices || {}
  const totalLocked = lock.totalLocked || (isLocked ? 1 : 0)

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1a1a1a] bg-[#111111] hover:bg-[#161616] transition-colors text-xs font-medium">
          <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'}`} />
          {isLocked ? (
            <span className="text-[#F59E0B] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {totalLocked} locked
            </span>
          ) : (
            <span className="text-[#22C55E] flex items-center gap-1">
              <LockOpen className="w-3 h-3" />
              Idle
            </span>
          )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 bg-[#111111] border-[#1a1a1a]">
        <div className="p-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#FAFAFA]">Lock Status</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-[#52525B]" onClick={onRefresh}>
              <RefreshCw className="w-3 h-3" />
            </Button>
            {isLocked && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 text-[#EF4444] hover:bg-[#EF4444]/10"
                onClick={() => onForceUnlock()}
              >
                <Unlock className="w-3 h-3 mr-1" />
                Unlock All
              </Button>
            )}
          </div>
        </div>
        <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
          {Object.keys(devices).length === 0 ? (
            <p className="text-[10px] text-[#52525B] text-center py-2">No active locks</p>
          ) : (
            Object.entries(devices).map(([deviceId, info]) => (
              <div key={deviceId} className="flex items-center justify-between rounded-md bg-[#0A0A0A] px-2.5 py-1.5">
                <div>
                  <span className="text-[11px] text-[#FAFAFA] font-mono">...{deviceId.slice(-8)}</span>
                  <span className="text-[10px] text-[#52525B] ml-2">{info.action} · {info.elapsedSeconds}s</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-[#EF4444] hover:bg-[#EF4444]/10 px-1.5"
                  onClick={() => onForceUnlock(deviceId)}
                >
                  Unlock
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function QuickActionCard({ action, meta, onClick, running, isThisRunning }) {
  const Icon = meta.icon
  return (
    <button
      className="flex flex-col items-start gap-2 p-4 rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] hover:bg-[#111111] hover:border-[#1a1a1a] transition-all text-left group disabled:opacity-50"
      onClick={onClick}
      disabled={running}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}15` }}>
        {isThisRunning ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: meta.color }} />
        ) : (
          <Icon className="w-4 h-4" style={{ color: meta.color }} />
        )}
      </div>
      <div>
        <span className="text-sm font-medium text-[#FAFAFA] group-hover:text-white transition-colors">
          {action.name || action}
        </span>
        {meta.desc && (
          <p className="text-[11px] text-[#52525B] mt-0.5 line-clamp-2">{meta.desc}</p>
        )}
      </div>
    </button>
  )
}

export default function Actions() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Target state
  const [selectedDevice, setSelectedDevice] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [appiumPort, setAppiumPort] = useState('4723')

  // Quick action state
  const [paramDialog, setParamDialog] = useState(null)
  const [runningAction, setRunningAction] = useState(null)

  // Creation state
  const [creationDevice, setCreationDevice] = useState('')
  const [creationIdentity, setCreationIdentity] = useState('sofia')
  const [creationContainers, setCreationContainers] = useState('')

  // Trigger run state
  const [selectedUsernames, setSelectedUsernames] = useState(new Set())
  const [usernameSearch, setUsernameSearch] = useState('')

  // Data queries
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet('/api/devices'),
  })

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet('/api/accounts'),
  })

  const { data: actionsData, isLoading: actionsLoading } = useQuery({
    queryKey: ['actions'],
    queryFn: () => apiGet('/api/automation/actions'),
  })

  const { data: lockData, isLoading: lockLoading } = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => apiGet('/api/automation/lock-status'),
    refetchInterval: 5000,
  })

  const devices = useMemo(() => {
    const d = devicesData?.data || devicesData || []
    return Array.isArray(d) ? d : []
  }, [devicesData])

  const accounts = useMemo(() => {
    const a = accountsData?.data || accountsData || []
    return Array.isArray(a) ? a : []
  }, [accountsData])

  const actionsList = useMemo(() => {
    const a = actionsData?.data?.actions || actionsData?.actions || actionsData?.data || actionsData || []
    return Array.isArray(a) ? a : []
  }, [actionsData])

  const lock = lockData?.data || lockData || {}
  const isLocked = lock.locked || lock.totalLocked > 0

  // Set default device
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) setSelectedDevice(devices[0].udid)
    if (devices.length > 0 && !creationDevice) setCreationDevice(devices[0].udid)
  }, [devices])

  // Mutations
  const executeAction = useMutation({
    mutationFn: ({ actionName, params }) =>
      apiPost('/api/automation/execute', {
        actionName,
        deviceUdid: selectedDevice,
        username: selectedAccount || undefined,
        appiumPort: appiumPort ? parseInt(appiumPort) : undefined,
        parameters: params && Object.keys(params).length > 0 ? params : undefined,
      }),
    onSuccess: (_, { actionName }) => {
      toast.success(`"${actionName}" executed successfully`)
      setRunningAction(null)
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    },
    onError: (err) => {
      setRunningAction(null)
    },
  })

  const triggerRun = useMutation({
    mutationFn: (body) => apiPost('/api/automation/trigger', body),
    onSuccess: (data) => {
      toast.success(
        selectedUsernames.size > 0
          ? `Run triggered for ${selectedUsernames.size} account(s)`
          : 'Run triggered (all accounts)'
      )
      setSelectedUsernames(new Set())
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    },
  })

  const stopRun = useMutation({
    mutationFn: () => apiPost('/api/automation/stop'),
    onSuccess: () => {
      toast.success('Stop signal sent')
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    },
  })

  const forceUnlock = useMutation({
    mutationFn: (deviceUdid) => apiPost('/api/automation/force-unlock', deviceUdid ? { deviceUdid } : {}),
    onSuccess: () => {
      toast.success('Unlocked')
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    },
  })

  const createAccounts = useMutation({
    mutationFn: (body) => apiPost('/api/automation/workflow/create-account-existing', body),
    onSuccess: () => {
      toast.success('Account creation workflow started')
      setCreationContainers('')
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    },
  })

  function handleQuickAction(actionName) {
    const params = ACTION_PARAMS[actionName]
    if (params && params.length > 0) {
      setParamDialog(actionName)
    } else {
      setRunningAction(actionName)
      executeAction.mutate({ actionName, params: {} })
    }
  }

  function handleParamsSubmit(params) {
    setRunningAction(paramDialog)
    executeAction.mutate({ actionName: paramDialog, params })
    setParamDialog(null)
  }

  // Group actions
  const groupedActions = useMemo(() => {
    const groups = {}
    const items = actionsList.length > 0 ? actionsList : Object.keys(ACTION_META)
    for (const action of items) {
      const name = typeof action === 'string' ? action : action.name
      const meta = ACTION_META[name] || DEFAULT_META
      const group = meta.group
      if (!groups[group]) groups[group] = []
      groups[group].push({ name, meta })
    }
    return groups
  }, [actionsList])

  const parsedContainers = creationContainers.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)

  const filteredAccounts = useMemo(() => {
    if (!usernameSearch) return accounts
    const q = usernameSearch.toLowerCase()
    return accounts.filter(a => (a.username || '').toLowerCase().includes(q))
  }, [accounts, usernameSearch])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Actions</h1>
          <p className="text-xs text-[#52525B] mt-0.5">Execute automation actions and workflows</p>
        </div>
        <LockStatusIndicator
          lockStatus={lockData}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['lock-status'] })}
          onForceUnlock={(deviceUdid) => forceUnlock.mutate(deviceUdid)}
        />
      </div>

      {/* Target Section */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA]">Target Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                Device
              </label>
              {devicesLoading ? (
                <Skeleton className="h-8 bg-[#1a1a1a]" />
              ) : (
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                    {devices.map(d => (
                      <SelectItem key={d.udid} value={d.udid} className="text-xs text-[#FAFAFA]">
                        {d.name} — ...{d.udid.slice(-8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                Account (optional)
              </label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                  <SelectValue placeholder="Any account" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                  <SelectItem value="" className="text-xs text-[#52525B]">Any account</SelectItem>
                  {accounts.slice(0, 50).map(a => (
                    <SelectItem key={a.id || a.username} value={a.username} className="text-xs text-[#FAFAFA]">
                      {a.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                Appium Port
              </label>
              <Input
                value={appiumPort}
                onChange={e => setAppiumPort(e.target.value)}
                placeholder="4723"
                className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46] h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 bg-[#1a1a1a] rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActions).map(([group, actions]) => (
                <div key={group}>
                  <h3 className="text-[11px] text-[#3f3f46] font-semibold uppercase tracking-wider mb-3">{group}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {actions.map(({ name, meta }) => (
                      <QuickActionCard
                        key={name}
                        action={{ name }}
                        meta={meta}
                        onClick={() => handleQuickAction(name)}
                        running={executeAction.isPending}
                        isThisRunning={runningAction === name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trigger Posting Run */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#3B82F6]" />
              Trigger Posting Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Account selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] text-[#52525B] font-semibold uppercase tracking-wider">
                    Select Accounts
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#3f3f46] tabular-nums">
                      {selectedUsernames.size}/{filteredAccounts.length}
                    </span>
                    <button
                      className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] font-medium"
                      onClick={() => {
                        const all = filteredAccounts.map(a => a.username)
                        const allSelected = all.every(u => selectedUsernames.has(u))
                        setSelectedUsernames(allSelected ? new Set() : new Set(all))
                      }}
                    >
                      {filteredAccounts.every(a => selectedUsernames.has(a.username)) ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#52525B]" />
                  <Input
                    value={usernameSearch}
                    onChange={e => setUsernameSearch(e.target.value)}
                    placeholder="Search accounts..."
                    className="pl-7 h-7 text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46]"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] divide-y divide-[#141414]">
                  {filteredAccounts.slice(0, 50).map(a => (
                    <button
                      key={a.username}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#111111] transition-colors ${
                        selectedUsernames.has(a.username) ? 'bg-[#3B82F6]/5' : ''
                      }`}
                      onClick={() => {
                        setSelectedUsernames(prev => {
                          const next = new Set(prev)
                          next.has(a.username) ? next.delete(a.username) : next.add(a.username)
                          return next
                        })
                      }}
                    >
                      <span className="text-xs text-[#A1A1AA]">{a.username}</span>
                      <StatusBadge status={a.status || 'ACTIVE'} />
                    </button>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <p className="text-xs text-[#52525B] text-center py-3">No accounts found</p>
                  )}
                </div>
              </div>

              {/* Trigger buttons */}
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                  disabled={triggerRun.isPending || selectedUsernames.size === 0}
                  onClick={() => triggerRun.mutate({ usernames: [...selectedUsernames] })}
                >
                  {triggerRun.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {triggerRun.isPending ? 'Triggering...' : 'Trigger Run'}
                </Button>
                {isLocked && (
                  <Button
                    variant="ghost"
                    className="text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    onClick={() => stopRun.mutate()}
                    disabled={stopRun.isPending}
                  >
                    <Square className="w-3.5 h-3.5 mr-1.5" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Creation */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#F97316]" />
              Create Accounts (Existing Containers)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                  Device
                </label>
                <Select value={creationDevice} onValueChange={setCreationDevice}>
                  <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                    {devices.map(d => (
                      <SelectItem key={d.udid} value={d.udid} className="text-xs text-[#FAFAFA]">
                        {d.name} — ...{d.udid.slice(-8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                  Identity ID
                </label>
                <Input
                  value={creationIdentity}
                  onChange={e => setCreationIdentity(e.target.value)}
                  placeholder="sofia"
                  className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46] h-8"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                  Container Names
                </label>
                <Textarea
                  value={creationContainers}
                  onChange={e => setCreationContainers(e.target.value)}
                  placeholder={'5, 8, 12\nor one per line'}
                  rows={3}
                  className="font-mono text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46]"
                />
                <p className="text-[10px] text-[#3f3f46] mt-1">Comma or newline separated</p>
              </div>

              {parsedContainers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {parsedContainers.map((name, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-mono border-[#1a1a1a] text-[#A1A1AA] gap-1 pr-1">
                      {name}
                      <button
                        onClick={() => {
                          const remaining = parsedContainers.filter((_, j) => j !== i)
                          setCreationContainers(remaining.join(', '))
                        }}
                        className="ml-0.5 hover:text-[#FAFAFA] text-[#52525B]"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                  <span className="text-[10px] text-[#3f3f46] self-center ml-1">
                    {parsedContainers.length} container{parsedContainers.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <Button
                className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white"
                disabled={createAccounts.isPending || parsedContainers.length === 0}
                onClick={() => createAccounts.mutate({
                  deviceUdid: creationDevice,
                  identityId: creationIdentity || undefined,
                  containerNames: parsedContainers,
                })}
              >
                {createAccounts.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                )}
                {createAccounts.isPending ? 'Creating...' : 'Create Accounts'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Params Dialog */}
      {paramDialog && (
        <ActionParamsDialog
          actionName={paramDialog}
          open={!!paramDialog}
          onOpenChange={(open) => !open && setParamDialog(null)}
          onSubmit={handleParamsSubmit}
        />
      )}
    </div>
  )
}
