import { useState, useCallback } from 'react'
import { Play, Loader2, Settings, Key, Video, Image, UserPlus, Shield, Smartphone, Container, RefreshCw, Trash2, Clipboard, MoreHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiPost } from '@/hooks/useApi'

const ACTION_META = {
  'SetupProfessionalAccount': { icon: Settings, color: 'text-blue-400', desc: 'Convert to professional/business account', group: 'Account' },
  'Enable2FA':               { icon: Key, color: 'text-amber-400', desc: 'Enable two-factor authentication', group: 'Account' },
  'VerifyAccount':           { icon: Shield, color: 'text-cyan-400', desc: 'Verify account (phone/email)', group: 'Account' },
  'RegisterInstagramAccount':{ icon: UserPlus, color: 'text-green-400', desc: 'Register a new Instagram account', group: 'Account' },
  'PostReel':                { icon: Video, color: 'text-purple-400', desc: 'Post a reel from Drive content', group: 'Content' },
  'PostStory':               { icon: Image, color: 'text-pink-400', desc: 'Post a story', group: 'Content' },
  'TransferVideoToDevice':   { icon: Smartphone, color: 'text-indigo-400', desc: 'Push video to device via AFC', group: 'Device' },
  'CreateCraneContainer':    { icon: Container, color: 'text-teal-400', desc: 'Create a new Crane container', group: 'Device' },
  'SwitchCraneContainer':    { icon: RefreshCw, color: 'text-orange-400', desc: 'Switch to another Crane container', group: 'Device' },
  'Cleanup':                 { icon: Trash2, color: 'text-red-400', desc: 'Clean up device state', group: 'Device' },
  'TestClipboardPaste':      { icon: Clipboard, color: 'text-gray-400', desc: 'Test clipboard paste functionality', group: 'Utility' },
}

const DEFAULT_META = { icon: Play, color: 'text-muted-foreground', desc: '', group: 'Other' }

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

function ParamsDialog({ actionName, open, onOpenChange, onSubmit }) {
  const fields = ACTION_PARAMS[actionName] || []
  const meta = ACTION_META[actionName] || DEFAULT_META
  const Icon = meta.icon
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.name, ''])))
  const isValid = fields.filter(f => f.required).every(f => values[f.name]?.trim())

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Icon size={16} className={meta.color} />
            {actionName}
          </DialogTitle>
          {meta.desc && <p className="text-[11px] text-muted-foreground">{meta.desc}</p>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map(field => (
            <div key={field.name}>
              <label className="block text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <Textarea
                  value={values[field.name]}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={4}
                  className="font-mono text-xs"
                />
              ) : (
                <Input
                  value={values[field.name]}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="text-xs"
                />
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!isValid}>
              <Play size={14} />
              Run {actionName}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function QuickActionsDropdown({ devices, accounts, actionsList }) {
  const [running, setRunning] = useState(false)
  const [runningAction, setRunningAction] = useState(null)
  const [result, setResult] = useState(null)
  const [modalAction, setModalAction] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')

  const deviceUdid = selectedDevice || (devices?.[0]?.udid ?? '')

  const handleAction = useCallback(async (actionName, modalParams) => {
    setRunning(true)
    setRunningAction(actionName)
    setResult(null)
    try {
      let parameters = { ...modalParams }
      if (Object.keys(parameters).length === 0) parameters = undefined
      await apiPost('/api/automation/execute', {
        actionName,
        deviceUdid,
        username: selectedAccount || undefined,
        parameters,
      })
      setResult({ type: 'success', message: `"${actionName}" executed` })
    } catch (err) {
      setResult({ type: 'error', message: `"${actionName}" failed: ${err.message}` })
    } finally {
      setRunning(false)
      setRunningAction(null)
    }
  }, [deviceUdid, selectedAccount])

  const handleClick = useCallback((actionName) => {
    if (ACTION_PARAMS[actionName]) {
      setModalAction(actionName)
    } else {
      handleAction(actionName)
    }
  }, [handleAction])

  // Group actions
  const groups = {}
  const list = actionsList || []
  for (const name of list) {
    const meta = ACTION_META[name] || DEFAULT_META
    const g = meta.group
    if (!groups[g]) groups[g] = []
    groups[g].push({ name, ...meta })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <MoreHorizontal size={14} />
            Quick Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Device & Account selectors */}
          <div className="px-2 py-1.5 space-y-1.5">
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Device</label>
              <select
                value={deviceUdid}
                onChange={e => setSelectedDevice(e.target.value)}
                className="w-full mt-0.5 bg-accent border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none"
              >
                {(devices || []).map(d => (
                  <option key={d.udid} value={d.udid}>{d.name} — ...{d.udid.slice(-8)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Account (optional)</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full mt-0.5 bg-accent border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="">— None —</option>
                {(accounts || []).map(a => (
                  <option key={a.id} value={a.username}>{a.username}</option>
                ))}
              </select>
            </div>
          </div>
          <DropdownMenuSeparator />

          {Object.entries(groups).map(([group, actions]) => (
            <div key={group}>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">{group}</DropdownMenuLabel>
              {actions.map((action) => {
                const ActionIcon = action.icon
                return (
                  <DropdownMenuItem
                    key={action.name}
                    onClick={() => handleClick(action.name)}
                    disabled={running}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {runningAction === action.name ? (
                      <Loader2 size={14} className="animate-spin text-muted-foreground" />
                    ) : (
                      <ActionIcon size={14} className={action.color} />
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{action.name}</span>
                      {action.desc && <span className="text-[10px] text-muted-foreground leading-tight">{action.desc}</span>}
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </div>
          ))}

          {result && (
            <>
              <DropdownMenuSeparator />
              <div className={`mx-2 mb-1.5 p-2 rounded-md text-[10px] font-medium ${
                result.type === 'error'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {result.message}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {modalAction && (
        <ParamsDialog
          actionName={modalAction}
          open={!!modalAction}
          onOpenChange={(open) => { if (!open) setModalAction(null) }}
          onSubmit={(params) => handleAction(modalAction, params)}
        />
      )}
    </>
  )
}
