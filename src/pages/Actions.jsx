import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
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
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import StatusBadge from '@/components/shared/StatusBadge'
import { useIncognito } from '@/contexts/IncognitoContext'
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
  Search,
  X,
  ExternalLink,
  CheckCircle,
  XCircle,
  ChevronRight,
  MoreHorizontal,
  ChevronDown,
  Clock,
} from 'lucide-react'

// ── Action metadata ──────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────
function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Sub-components ──────────────────────────────────────────────
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
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => onForceUnlock()}>
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
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-[#EF4444] hover:bg-[#EF4444]/10 px-1.5" onClick={() => onForceUnlock(deviceId)}>
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
            <Button type="button" variant="ghost" className="text-[#A1A1AA]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
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

// ── Posting Run: account row ────────────────────────────────────
function formatLastPost(dateStr) {
  if (!dateStr) return { text: 'Never', color: 'text-[#EF4444]' }
  const diff = Date.now() - new Date(dateStr).getTime()
  const hrs = Math.floor(diff / 3600000)
  const color = hrs >= 24 ? 'text-[#EF4444]' : hrs >= 12 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
  if (hrs < 1) return { text: `${Math.floor(diff / 60000)}m ago`, color }
  if (hrs < 24) return { text: `${hrs}h ago`, color }
  const days = Math.floor(hrs / 24)
  return { text: `${days}d ago`, color }
}

function AccountRow({ account, selected, onToggle }) {
  const { isIncognito } = useIncognito()
  const lastPost = formatLastPost(account.lastPost)
  return (
    <div
      onClick={() => onToggle(account.username)}
      className={`flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-[#111111] transition-colors border-b border-[#141414] last:border-b-0 cursor-pointer ${
        selected ? 'bg-[#3B82F6]/5' : ''
      }`}
    >
      <Checkbox checked={selected} className="shrink-0 pointer-events-none" />
      <span className={`text-xs font-medium text-[#FAFAFA] min-w-[120px] ${isIncognito ? 'incognito-blur' : ''}`}>
        {account.username}
      </span>
      <div className="flex items-center gap-3 flex-1 text-[10px] text-[#52525B]">
        <span title="Views">{account.totalViews?.toLocaleString() ?? '—'}</span>
        <span title="Followers">{account.followersCount?.toLocaleString() ?? '—'}</span>
        <span title="Posts">{account.postsCount ?? '—'}</span>
        <span
          title="Last post"
          className={`ml-auto ${lastPost.color}`}
        >
          {lastPost.text}
        </span>
      </div>
      <StatusBadge status={account.status} />
    </div>
  )
}

// ── Posting Run: device group ───────────────────────────────────
function DeviceGroup({ device, deviceAccounts, selectedUsernames, onToggle, onToggleAll, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const selectedCount = deviceAccounts.filter(a => selectedUsernames.has(a.username)).length
  const allSelected = deviceAccounts.length > 0 && selectedCount === deviceAccounts.length

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] overflow-hidden">
        <CollapsibleTrigger className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#111111] transition-colors text-left">
          <ChevronRight className={`w-3.5 h-3.5 text-[#52525B] transition-transform ${open ? 'rotate-90' : ''}`} />
          <Smartphone className="w-3.5 h-3.5 text-[#52525B]" />
          <span className="text-xs font-semibold text-[#FAFAFA] flex-1">{device.name}</span>
          <span className="text-[10px] text-[#3f3f46] font-mono">{selectedCount}/{deviceAccounts.length}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); e.preventDefault(); onToggleAll(deviceAccounts.map(a => a.username)) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggleAll(deviceAccounts.map(a => a.username)) } }}
            className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] font-semibold uppercase tracking-wider px-1.5 transition-colors cursor-pointer"
          >
            {allSelected ? 'Clear' : 'All'}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[#1a1a1a]">
            {deviceAccounts.map(a => (
              <AccountRow key={a.id || a.username} account={a} selected={selectedUsernames.has(a.username)} onToggle={onToggle} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function Actions() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── Posting run state ──
  const [postingDevice, setPostingDevice] = useState('all')
  const [selectedUsernames, setSelectedUsernames] = useState(new Set())
  const [usernameSearch, setUsernameSearch] = useState('')

  // ── Creation state ──
  const [creationDevice, setCreationDevice] = useState('')
  const [creationIdentity, setCreationIdentity] = useState('')
  const [creationContainers, setCreationContainers] = useState('')

  // ── Quick actions state ──
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [appiumPort, setAppiumPort] = useState('4723')
  const [paramDialog, setParamDialog] = useState(null)
  const [runningAction, setRunningAction] = useState(null)

  // ── Data queries ──
  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet('/api/devices'),
  })

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet('/api/accounts'),
  })

  const { data: actionsData } = useQuery({
    queryKey: ['actions'],
    queryFn: () => apiGet('/api/automation/actions'),
  })

  const { data: lockData } = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => apiGet('/api/automation/lock-status'),
    refetchInterval: 5000,
  })

  const { data: identitiesData } = useQuery({
    queryKey: ['identities'],
    queryFn: () => apiGet('/api/identities'),
  })

  // ── Derived data ──
  const devices = useMemo(() => {
    const d = devicesData?.data || devicesData || []
    return Array.isArray(d) ? d : []
  }, [devicesData])

  const accounts = useMemo(() => {
    const a = accountsData?.data || accountsData || []
    return Array.isArray(a) ? a : []
  }, [accountsData])

  const identities = useMemo(() => {
    const raw = identitiesData?.data || identitiesData || []
    return Array.isArray(raw) ? raw : []
  }, [identitiesData])

  const actionsList = useMemo(() => {
    const a = actionsData?.data?.actions || actionsData?.actions || actionsData?.data || actionsData || []
    return Array.isArray(a) ? a : []
  }, [actionsData])

  const lock = lockData?.data || lockData || {}
  const isLocked = lock.locked || lock.totalLocked > 0

  // ── Defaults ──
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) setSelectedDevice(devices[0].udid)
    if (devices.length > 0 && !creationDevice) setCreationDevice(devices[0].udid)
  }, [devices])

  useEffect(() => {
    if (identities.length > 0 && !creationIdentity) {
      setCreationIdentity(identities[0].identityId || identities[0].name || identities[0].identityName || '')
    }
  }, [identities])

  // ── Posting run: only ACTIVE accounts, filter by device ──
  const activeAccounts = useMemo(() => accounts.filter(a => a.status === 'ACTIVE'), [accounts])

  const filteredPostingAccounts = useMemo(() => {
    let list = activeAccounts
    if (postingDevice !== 'all') {
      list = list.filter(a => a.deviceUdid === postingDevice)
    }
    if (usernameSearch) {
      const q = usernameSearch.toLowerCase()
      list = list.filter(a => (a.username || '').toLowerCase().includes(q))
    }
    return list
  }, [activeAccounts, postingDevice, usernameSearch])

  const stalePostingAccounts = useMemo(() => {
    const twelveHours = 12 * 60 * 60 * 1000
    return filteredPostingAccounts.filter(a => {
      if (!a.lastPost) return true
      return Date.now() - new Date(a.lastPost).getTime() >= twelveHours
    })
  }, [filteredPostingAccounts])

  // Group accounts by device for the device view
  const deviceGroups = useMemo(() => {
    const grouped = {}
    for (const d of devices) {
      grouped[d.udid] = { device: d, accounts: [] }
    }
    const unknown = []
    for (const a of filteredPostingAccounts) {
      if (a.deviceUdid && grouped[a.deviceUdid]) {
        grouped[a.deviceUdid].accounts.push(a)
      } else {
        unknown.push(a)
      }
    }
    const groups = Object.values(grouped).filter(g => g.accounts.length > 0)
    if (unknown.length > 0) {
      groups.push({ device: { udid: '__unknown', name: 'Unknown Device' }, accounts: unknown })
    }
    return groups
  }, [devices, filteredPostingAccounts])

  // ── Mutations ──
  const triggerRun = useMutation({
    mutationFn: (body) => apiPost('/api/automation/trigger', body),
    onSuccess: () => {
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
    onError: () => setRunningAction(null),
  })

  // ── Posting run helpers ──
  function toggleUsername(username) {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      next.has(username) ? next.delete(username) : next.add(username)
      return next
    })
  }

  function toggleAllUsernames(usernames) {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      const allSelected = usernames.every(u => next.has(u))
      usernames.forEach(u => allSelected ? next.delete(u) : next.add(u))
      return next
    })
  }

  // ── Quick action helpers ──
  function handleQuickAction(actionName) {
    if (ACTION_PARAMS[actionName]?.length > 0) {
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

  // ── Quick actions grouped ──
  const groupedActions = useMemo(() => {
    const groups = {}
    const items = actionsList.length > 0 ? actionsList : Object.keys(ACTION_META)
    for (const action of items) {
      const name = typeof action === 'string' ? action : action.name
      const meta = ACTION_META[name] || DEFAULT_META
      if (!groups[meta.group]) groups[meta.group] = []
      groups[meta.group].push({ name, meta })
    }
    return groups
  }, [actionsList])

  const parsedContainers = creationContainers.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)

  const allPostingSelected = filteredPostingAccounts.length > 0 && filteredPostingAccounts.every(a => selectedUsernames.has(a.username))

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
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

      {/* ── PRIMARY: Trigger Posting Run ──────────────────── */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-[#3B82F6]" />
              Trigger Posting Run
            </span>
            <span className="text-[10px] text-[#3f3f46] font-mono font-normal">
              {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Toolbar: device filter + search */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={postingDevice} onValueChange={v => { setPostingDevice(v); setSelectedUsernames(new Set()) }}>
                <SelectTrigger className="w-[200px] text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                  <Smartphone className="w-3 h-3 text-[#52525B] mr-1.5" />
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                  <SelectItem value="all" className="text-xs text-[#A1A1AA]">All devices</SelectItem>
                  {devices.map(d => (
                    <SelectItem key={d.udid} value={d.udid} className="text-xs text-[#FAFAFA]">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#52525B]" />
                <Input
                  value={usernameSearch}
                  onChange={e => setUsernameSearch(e.target.value)}
                  placeholder="Search accounts..."
                  className="pl-8 h-8 text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46]"
                />
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] text-[#3f3f46] font-mono tabular-nums">
                  {selectedUsernames.size}/{filteredPostingAccounts.length}
                </span>
                {stalePostingAccounts.length > 0 && (
                  <button
                    className="flex items-center gap-1 text-[10px] text-[#F59E0B] hover:text-[#FBBF24] font-semibold uppercase tracking-wider"
                    onClick={() => setSelectedUsernames(new Set(stalePostingAccounts.map(a => a.username)))}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    Stale 12h+ ({stalePostingAccounts.length})
                  </button>
                )}
                <button
                  className="text-[10px] text-[#3B82F6] hover:text-[#60A5FA] font-semibold uppercase tracking-wider"
                  onClick={() => toggleAllUsernames(filteredPostingAccounts.map(a => a.username))}
                >
                  {allPostingSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            </div>

            {/* Accounts grouped by device */}
            {accountsLoading || devicesLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-16 bg-[#1a1a1a] rounded-lg" />)}
              </div>
            ) : deviceGroups.length === 0 ? (
              <p className="text-xs text-[#52525B] text-center py-8">No active accounts found</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {deviceGroups.map(({ device, accounts: deviceAccounts }) => (
                  <DeviceGroup
                    key={device.udid}
                    device={device}
                    deviceAccounts={deviceAccounts}
                    selectedUsernames={selectedUsernames}
                    onToggle={toggleUsername}
                    onToggleAll={toggleAllUsernames}
                    defaultOpen={deviceGroups.length <= 3}
                  />
                ))}
              </div>
            )}

            {/* Trigger buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a1a]">
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
                {triggerRun.isPending
                  ? 'Triggering...'
                  : `Trigger Run (${selectedUsernames.size})`}
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

      {/* ── PRIMARY: Create Accounts ─────────────────────── */}
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#F97316]" />
            Create Accounts (Existing Containers)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Device */}
            <div>
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                Device
              </label>
              {devicesLoading ? (
                <Skeleton className="h-8 bg-[#1a1a1a]" />
              ) : (
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
              )}
            </div>

            {/* Identity dropdown */}
            <div>
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                Identity
              </label>
              <Select value={creationIdentity} onValueChange={setCreationIdentity}>
                <SelectTrigger className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] h-8">
                  <SelectValue placeholder="Select identity" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#1a1a1a]">
                  {identities.map(id => {
                    const name = id.identityId || id.name || id.identityName
                    return (
                      <SelectItem key={id.id || name} value={name} className="text-xs text-[#FAFAFA]">
                        {name}
                      </SelectItem>
                    )
                  })}
                  {identities.length === 0 && (
                    <SelectItem value="sofia" className="text-xs text-[#52525B]">sofia (default)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Container names */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">
                Container Names
              </label>
              <Input
                value={creationContainers}
                onChange={e => setCreationContainers(e.target.value)}
                placeholder="5, 8, 12"
                className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46] h-8 font-mono"
              />
            </div>
          </div>

          {/* Chips preview + action */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5 flex-1 min-h-[32px] items-center">
              {parsedContainers.length > 0 ? (
                <>
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
                  <span className="text-[10px] text-[#3f3f46] ml-1">
                    {parsedContainers.length} container{parsedContainers.length > 1 ? 's' : ''}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-[#3f3f46]">Enter container names (comma separated)</span>
              )}
            </div>

            <Button
              className="bg-[#F97316] hover:bg-[#EA580C] text-white shrink-0"
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

      {/* ── SECONDARY: Quick Actions (collapsible) ───────── */}
      <Collapsible open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-[#0A0A0A]/50 transition-colors">
              <CardTitle className="text-sm text-[#52525B] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MoreHorizontal className="w-4 h-4" />
                  Quick Actions
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {/* Target config */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                <div>
                  <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">Device</label>
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
                  <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">Account (optional)</label>
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
                  <label className="block text-[11px] text-[#52525B] font-semibold uppercase tracking-wider mb-1.5">Appium Port</label>
                  <Input
                    value={appiumPort}
                    onChange={e => setAppiumPort(e.target.value)}
                    placeholder="4723"
                    className="text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#3f3f46] h-8"
                  />
                </div>
              </div>

              {/* Action grid */}
              <div className="space-y-5">
                {Object.entries(groupedActions).map(([group, actions]) => (
                  <div key={group}>
                    <h3 className="text-[11px] text-[#3f3f46] font-semibold uppercase tracking-wider mb-3">{group}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {actions.map(({ name, meta }) => {
                        const Icon = meta.icon
                        const isThisRunning = runningAction === name
                        return (
                          <button
                            key={name}
                            className="flex items-center gap-2.5 p-3 rounded-lg border border-[#1a1a1a] bg-[#0A0A0A] hover:bg-[#111111] transition-all text-left group disabled:opacity-50"
                            onClick={() => handleQuickAction(name)}
                            disabled={executeAction.isPending}
                          >
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${meta.color}15` }}>
                              {isThisRunning ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: meta.color }} />
                              ) : (
                                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-[#FAFAFA] group-hover:text-white transition-colors block truncate">
                                {name}
                              </span>
                              {meta.desc && (
                                <p className="text-[10px] text-[#52525B] mt-0.5 truncate">{meta.desc}</p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
