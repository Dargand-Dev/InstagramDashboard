import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Smartphone, UserPlus, Play, Rocket, Unlock, Loader2, CheckCircle, XCircle, AlertTriangle, Shield, Settings, Key, Video, Image, Clipboard, Container, RefreshCw, Trash2, X, Layers, ExternalLink, Search, Users, CheckSquare, Square } from 'lucide-react'
import Card from '../components/Card'
import { useApi, apiPost } from '../hooks/useApi'
import { useIncognito } from '../contexts/IncognitoContext'

const DEVICES_FALLBACK = []

const ACTION_META = {
  'SetupProfessionalAccount': { icon: Settings, color: 'bg-blue-500/8 text-blue-400 border-blue-500/15', desc: 'Convert to professional/business account' },
  'Enable2FA':               { icon: Key, color: 'bg-amber-500/8 text-amber-400 border-amber-500/15', desc: 'Enable two-factor authentication' },
  'PostReel':                { icon: Video, color: 'bg-purple-500/8 text-purple-400 border-purple-500/15', desc: 'Post a reel from Drive content' },
  'PostStory':               { icon: Image, color: 'bg-pink-500/8 text-pink-400 border-pink-500/15', desc: 'Post a story' },
  'RegisterInstagramAccount':{ icon: UserPlus, color: 'bg-green-500/8 text-green-400 border-green-500/15', desc: 'Register a new Instagram account' },
  'VerifyAccount':           { icon: Shield, color: 'bg-cyan-500/8 text-cyan-400 border-cyan-500/15', desc: 'Verify account (phone/email)' },
  'TransferVideoToDevice':   { icon: Smartphone, color: 'bg-indigo-500/8 text-indigo-400 border-indigo-500/15', desc: 'Push video to device via AFC' },
  'CreateCraneContainer':    { icon: Container, color: 'bg-teal-500/8 text-teal-400 border-teal-500/15', desc: 'Create a new Crane container' },
  'SwitchCraneContainer':    { icon: RefreshCw, color: 'bg-orange-500/8 text-orange-400 border-orange-500/15', desc: 'Switch to another Crane container' },
  'Cleanup':                 { icon: Trash2, color: 'bg-red-500/8 text-red-400 border-red-500/15', desc: 'Clean up device state' },
  'TestClipboardPaste':      { icon: Clipboard, color: 'bg-gray-500/8 text-gray-400 border-gray-500/15', desc: 'Test clipboard paste functionality' },
}

const DEFAULT_META = { icon: Play, color: 'bg-white/5 text-[#555] border-[#1a1a1a]', desc: '' }

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

const inputClass = 'w-full bg-[#0a0a0a] border border-[#1a1a1a] text-white rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#333]'
const labelClass = 'block text-[11px] text-[#555] font-semibold uppercase tracking-wider mb-1.5'

function ParamsModal({ actionName, meta, onSubmit, onClose }) {
  const fields = ACTION_PARAMS[actionName] || []
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.name, ''])))
  const Icon = meta.icon
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md border ${meta.color}`}>
              <Icon size={16} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{actionName}</h3>
              {meta.desc && <p className="text-[10px] text-[#555] mt-0.5">{meta.desc}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-[#333] hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {fields.map(field => (
            <div key={field.name}>
              <label className={labelClass}>
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.name]}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={4}
                  className={`${inputClass} resize-y font-mono`}
                />
              ) : (
                <input
                  type="text"
                  value={values[field.name]}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              Run {actionName}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#555] hover:text-white border border-[#1a1a1a] hover:border-[#333] rounded-md text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ResultBanner({ result, navigate }) {
  if (!result) return null
  const isError = result.type === 'error'
  return (
    <div className={`flex items-center justify-between mt-3 p-3 rounded-md border text-xs font-medium ${
      isError ? 'bg-red-500/5 text-red-400 border-red-500/15' : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
    }`}>
      <div className="flex items-center gap-2">
        {isError ? <XCircle size={14} /> : <CheckCircle size={14} />}
        {result.message}
      </div>
      {result.runId && navigate && (
        <button
          onClick={() => navigate('/activity?tab=logs')}
          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-semibold"
        >
          View logs <ExternalLink size={10} />
        </button>
      )}
    </div>
  )
}

function QuickActionCard({ actionName, meta, onRun, running, runningAction }) {
  const Icon = meta.icon
  const isThis = runningAction === actionName
  return (
    <button
      onClick={() => onRun(actionName)}
      disabled={running}
      className={`flex flex-col items-start gap-2 p-3.5 rounded-[10px] border transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 text-left ${meta.color}`}
    >
      <div className="flex items-center justify-between w-full">
        <Icon size={18} />
        {isThis && <Loader2 size={12} className="animate-spin" />}
      </div>
      <span className="text-xs font-bold">{actionName}</span>
      {meta.desc && <span className="text-[10px] opacity-50 leading-tight">{meta.desc}</span>}
    </button>
  )
}

function saveWorkflowRun(runId, workflowName) {
  try {
    const runs = JSON.parse(localStorage.getItem('activeWorkflowRuns') || '[]')
    runs.unshift({ runId, workflowName, timestamp: Date.now() })
    localStorage.setItem('activeWorkflowRuns', JSON.stringify(runs))
  } catch { /* ignore */ }
}

export default function Actions() {
  const navigate = useNavigate()
  const { data: accounts } = useApi('/api/accounts')
  const { data: devicesData } = useApi('/api/devices')
  const devices = Array.isArray(devicesData) ? devicesData : DEVICES_FALLBACK
  const [selectedAccount, setSelectedAccount] = useState('')
  const [caDevice, setCaDevice] = useState('')
  const [caIdentity, setCaIdentity] = useState('sofia')
  const [caLoading, setCaLoading] = useState(false)
  const [caResult, setCaResult] = useState(null)
  const { data: actionsData, loading: actionsLoading } = useApi('/api/automation/actions')
  const [exDevice, setExDevice] = useState('')
  const [exPort, setExPort] = useState('4723')
  const [exParams, setExParams] = useState('')
  const [exLoading, setExLoading] = useState(false)
  const [exRunningAction, setExRunningAction] = useState(null)
  const [exResult, setExResult] = useState(null)
  const [modalAction, setModalAction] = useState(null)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [advAction, setAdvAction] = useState('')
  const [ecDevice, setEcDevice] = useState('')
  const [ecIdentity, setEcIdentity] = useState('sofia')
  const [ecContainers, setEcContainers] = useState('')
  const [ecLoading, setEcLoading] = useState(false)
  const [ecResult, setEcResult] = useState(null)
  const [lockStatus, setLockStatus] = useState(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState(null)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [selectiveMode, setSelectiveMode] = useState(false)
  const [selectedUsernames, setSelectedUsernames] = useState(new Set())
  const [accountSearch, setAccountSearch] = useState('')

  // Set default device when devices load (intentionally run-once)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (devices.length > 0 && !caDevice) {
      setCaDevice(devices[0].udid)
      setExDevice(devices[0].udid)
      setEcDevice(devices[0].udid)
    }
  }, [devices])

  const { isIncognito } = useIncognito()
  const actionsList = actionsData?.actions || []
  const accountList = accounts || []

  useEffect(() => {
    if (selectedAccount) {
      const acc = accountList.find(a => a.username === selectedAccount)
      if (acc?.deviceUdid) setExDevice(acc.deviceUdid)
    }
  }, [selectedAccount, accountList])

  useEffect(() => {
    if (actionsList.length > 0 && !advAction) setAdvAction(actionsList[0])
  }, [actionsList, advAction])

  async function checkLockStatus() {
    setLockLoading(true)
    try {
      const res = await fetch('/api/automation/lock-status')
      const body = await res.json().catch(() => ({}))
      // Normalize: support both old (single lock) and new (per-device) format
      const status = {
        locked: res.status === 423 || body.locked || false,
        devices: body.devices || (body.currentExecution ? { [body.currentExecution.deviceId]: body.currentExecution } : {}),
        totalLocked: body.totalLocked || (res.status === 423 || body.locked ? 1 : 0),
        ...body
      }
      setLockStatus(status)
      return status
    } catch {
      const status = { locked: false, devices: {}, totalLocked: 0 }
      setLockStatus(status)
      return status
    } finally { setLockLoading(false) }
  }

  useEffect(() => { checkLockStatus() }, [])

  async function handleCreateAccount() {
    setCaLoading(true)
    setCaResult(null)
    try {
      const data = await apiPost('/api/automation/workflow/create-account', {
        deviceUdid: caDevice,
        identityId: caIdentity || undefined,
      })
      if (data.runId) saveWorkflowRun(data.runId, 'CreateAccount')
      setCaResult({ type: 'success', message: 'Account creation workflow accepted', runId: data.runId })
    } catch (err) {
      setCaResult({ type: 'error', message: err.message })
    } finally { setCaLoading(false) }
  }

  async function handleCreateAccountExisting() {
    const names = ecContainers
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (names.length === 0) return
    setEcLoading(true)
    setEcResult(null)
    try {
      const data = await apiPost('/api/automation/workflow/create-account-existing', {
        deviceUdid: ecDevice,
        identityId: ecIdentity || undefined,
        containerNames: names,
      })
      if (data.runId) saveWorkflowRun(data.runId, 'CreateAccountFromExistingContainer')
      setEcResult({ type: 'success', message: `Batch workflow accepted for ${names.length} container(s)`, runId: data.runId })
    } catch (err) {
      setEcResult({ type: 'error', message: err.message })
    } finally { setEcLoading(false) }
  }

  async function handleQuickAction(actionName, modalParams) {
    setExLoading(true)
    setExRunningAction(actionName)
    setExResult(null)
    try {
      let parameters = { ...modalParams }
      if (exParams.trim()) {
        try { Object.assign(parameters, JSON.parse(exParams)) } catch { /* ignore */ }
      }
      if (Object.keys(parameters).length === 0) parameters = undefined
      await apiPost('/api/automation/execute', {
        actionName,
        deviceUdid: exDevice,
        appiumPort: exPort || undefined,
        username: selectedAccount || undefined,
        parameters,
      })
      setExResult({ type: 'success', message: `"${actionName}" executed` })
    } catch (err) {
      setExResult({ type: 'error', message: `"${actionName}" failed: ${err.message}` })
    } finally {
      setExLoading(false)
      setExRunningAction(null)
    }
  }

  const handleActionClick = useCallback((actionName) => {
    if (ACTION_PARAMS[actionName]) {
      setModalAction(actionName)
    } else {
      handleQuickAction(actionName)
    }
  }, [exDevice, exPort, selectedAccount, exParams])

  // Accounts eligible for posting (active + scheduling enabled)
  const schedulingAccounts = accountList.filter(a => a.status === 'ACTIVE' && a.schedulingEnabled)
  const filteredSchedulingAccounts = schedulingAccounts.filter(a =>
    a.username.toLowerCase().includes(accountSearch.toLowerCase())
  )

  function toggleUsername(username) {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      next.has(username) ? next.delete(username) : next.add(username)
      return next
    })
  }

  function toggleAllFiltered() {
    const allSelected = filteredSchedulingAccounts.every(a => selectedUsernames.has(a.username))
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      filteredSchedulingAccounts.forEach(a => allSelected ? next.delete(a.username) : next.add(a.username))
      return next
    })
  }

  async function handleTrigger() {
    await checkLockStatus()
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const body = selectiveMode && selectedUsernames.size > 0
        ? { usernames: [...selectedUsernames] }
        : {}
      const data = await apiPost('/api/automation/trigger', body)
      if (data.runId) saveWorkflowRun(data.runId, 'PostReel')
      const label = selectiveMode && selectedUsernames.size > 0
        ? `Manual run triggered for ${selectedUsernames.size} account(s)`
        : 'Manual run triggered (all accounts)'
      setTriggerResult({ type: 'success', message: label, runId: data.runId })
    } catch (err) {
      setTriggerResult({ type: 'error', message: err.message })
    } finally { setTriggerLoading(false) }
  }

  async function handleForceUnlock(deviceUdid) {
    setUnlockLoading(true)
    try {
      await apiPost('/api/automation/force-unlock', deviceUdid ? { deviceUdid } : {})
      await checkLockStatus()
      setTriggerResult({ type: 'success', message: deviceUdid ? `Device ${deviceUdid.slice(-8)} unlocked` : 'All locks released' })
    } catch (err) {
      setTriggerResult({ type: 'error', message: err.message })
    } finally { setUnlockLoading(false) }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Actions</h1>
        <p className="text-xs text-[#333] mt-0.5">Execute automation actions and workflows</p>
      </div>

      <div className="space-y-4">
        {/* Target */}
        <Card title="Target" icon={Smartphone} iconColor="bg-indigo-500/10 text-indigo-400">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Account (optional)</label>
              <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className={`${inputClass} ${isIncognito ? 'incognito-blur' : ''}`}>
                <option value="">— No account —</option>
                {accountList.map(a => (
                  <option key={a.id} value={a.username}>
                    {a.username} {a.status !== 'ACTIVE' ? `(${a.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Device</label>
              <select value={exDevice} onChange={e => setExDevice(e.target.value)} className={inputClass}>
                {devices.map(d => (
                  <option key={d.udid} value={d.udid}>{d.name} — {d.udid.slice(-8)}</option>
                ))}
                {selectedAccount && (() => {
                  const acc = accountList.find(a => a.username === selectedAccount)
                  if (acc?.deviceUdid && !devices.find(d => d.udid === acc.deviceUdid)) {
                    return <option value={acc.deviceUdid}>Account device — {acc.deviceUdid.slice(-8)}</option>
                  }
                  return null
                })()}
              </select>
            </div>
            <div>
              <label className={labelClass}>Appium Port</label>
              <input value={exPort} onChange={e => setExPort(e.target.value)} placeholder="4723" className={inputClass} />
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card title="Run Action" icon={Play} iconColor="bg-blue-500/10 text-blue-400">
          {actionsLoading ? (
            <p className="text-xs text-[#333]">Loading actions...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {actionsList.map(name => (
                  <QuickActionCard
                    key={name}
                    actionName={name}
                    meta={ACTION_META[name] || DEFAULT_META}
                    onRun={handleActionClick}
                    running={exLoading}
                    runningAction={exRunningAction}
                  />
                ))}
              </div>
              <ResultBanner result={exResult} />
              <div className="mt-3 pt-3 border-t border-[#141414]">
                <button
                  onClick={() => setAdvancedMode(!advancedMode)}
                  className="text-[10px] text-[#333] hover:text-[#555] transition-colors font-medium uppercase tracking-wider"
                >
                  {advancedMode ? '- Hide' : '+ Advanced'} parameters
                </button>
                {advancedMode && (
                  <div className="mt-3">
                    <label className={labelClass}>Parameters JSON</label>
                    <textarea value={exParams} onChange={e => setExParams(e.target.value)}
                      placeholder='{"key": "value"}' rows={3}
                      className={`${inputClass} font-mono`} />
                    <p className="text-[10px] text-[#333] mt-1">Merged with modal params when clicking an action.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Create Account */}
        <Card title="Create Account (Full Workflow)" icon={UserPlus} iconColor="bg-emerald-500/10 text-emerald-400">
          <p className="text-[10px] text-[#333] mb-3">{'Runs: Crane > Register > Professional Setup > 2FA'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Device</label>
              <select value={caDevice} onChange={e => setCaDevice(e.target.value)} className={inputClass}>
                {devices.map(d => (
                  <option key={d.udid} value={d.udid}>{d.name} — {d.udid.slice(-8)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Identity ID</label>
              <input value={caIdentity} onChange={e => setCaIdentity(e.target.value)} placeholder="sofia" className={inputClass} />
            </div>
          </div>
          <div className="mt-3">
            <button onClick={handleCreateAccount} disabled={caLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-40">
              {caLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {caLoading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
          <ResultBanner result={caResult} navigate={navigate} />
        </Card>

        {/* Create Account (Existing Containers) */}
        <Card title="Create Account (Existing Containers)" icon={Layers} iconColor="bg-orange-500/10 text-orange-400">
          <p className="text-[10px] text-[#333] mb-3">{'Runs: Switch Container > Register > Professional Setup > 2FA — for each container in the list'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Device</label>
              <select value={ecDevice} onChange={e => setEcDevice(e.target.value)} className={inputClass}>
                {devices.map(d => (
                  <option key={d.udid} value={d.udid}>{d.name} — {d.udid.slice(-8)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Identity ID</label>
              <input value={ecIdentity} onChange={e => setEcIdentity(e.target.value)} placeholder="sofia" className={inputClass} />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelClass}>Container Names</label>
            <textarea
              value={ecContainers}
              onChange={e => setEcContainers(e.target.value)}
              placeholder={'5, 8, 12\nor one per line'}
              rows={3}
              className={`${inputClass} font-mono`}
            />
            <p className="text-[10px] text-[#333] mt-1">Comma or newline separated list of existing Crane container names.</p>
          </div>
          <div className="mt-3">
            <button
              onClick={handleCreateAccountExisting}
              disabled={ecLoading || !ecContainers.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-40"
            >
              {ecLoading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
              {ecLoading ? 'Creating...' : 'Create Accounts'}
            </button>
          </div>
          <ResultBanner result={ecResult} navigate={navigate} />
        </Card>

        {/* Manual Posting Run */}
        <Card title="Manual Posting Run" icon={Rocket} iconColor="bg-emerald-500/10 text-emerald-400">
          {lockStatus?.locked && (
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-md p-3 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                  <AlertTriangle size={14} />
                  {lockStatus.totalLocked || 1} device{(lockStatus.totalLocked || 1) > 1 ? 's' : ''} locked
                </div>
                <button onClick={() => handleForceUnlock()} disabled={unlockLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 rounded-md text-[10px] font-semibold transition-colors disabled:opacity-40">
                  {unlockLoading ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                  Unlock All
                </button>
              </div>
              {lockStatus.devices && Object.entries(lockStatus.devices).map(([deviceId, info]) => (
                <div key={deviceId} className="flex items-center justify-between bg-black/20 rounded px-2.5 py-1.5">
                  <span className="text-[10px] text-amber-400/70 font-mono">
                    {deviceId.slice(-8)} — {info.action} ({info.elapsedSeconds}s)
                  </span>
                  <button
                    onClick={() => handleForceUnlock(deviceId)}
                    disabled={unlockLoading}
                    className="text-[10px] text-red-400/70 hover:text-red-400 font-semibold transition-colors disabled:opacity-40"
                  >
                    Unlock
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Account selection toggle */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => { setSelectiveMode(false); setSelectedUsernames(new Set()) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                !selectiveMode
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
              }`}
            >
              <Users size={13} />
              All accounts
            </button>
            <button
              onClick={() => setSelectiveMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                selectiveMode
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
              }`}
            >
              <CheckSquare size={13} />
              Select accounts
            </button>
          </div>

          {/* Account selector */}
          {selectiveMode && (
            <div className="mb-3 border border-[#1a1a1a] rounded-[10px] overflow-hidden">
              {/* Search + controls */}
              <div className="flex items-center gap-2 p-2.5 border-b border-[#1a1a1a] bg-[#080808]">
                <div className="flex items-center gap-2 flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-2.5 py-1.5">
                  <Search size={13} className="text-[#333] shrink-0" />
                  <input
                    value={accountSearch}
                    onChange={e => setAccountSearch(e.target.value)}
                    placeholder="Search accounts..."
                    className="bg-transparent text-white text-xs w-full focus:outline-none placeholder-[#333]"
                  />
                </div>
                <button
                  onClick={toggleAllFiltered}
                  className="text-[10px] text-[#555] hover:text-white font-semibold uppercase tracking-wider whitespace-nowrap transition-colors px-2"
                >
                  {filteredSchedulingAccounts.length > 0 && filteredSchedulingAccounts.every(a => selectedUsernames.has(a.username))
                    ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-[10px] text-[#555] font-mono whitespace-nowrap">
                  {selectedUsernames.size}/{schedulingAccounts.length}
                </span>
              </div>
              {/* Account list */}
              <div className="max-h-52 overflow-y-auto">
                {filteredSchedulingAccounts.length === 0 ? (
                  <p className="text-[10px] text-[#333] p-3 text-center">No accounts found</p>
                ) : (
                  filteredSchedulingAccounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => toggleUsername(a.username)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-white/[0.02] transition-colors border-b border-[#0f0f0f] last:border-b-0"
                    >
                      {selectedUsernames.has(a.username)
                        ? <CheckSquare size={14} className="text-emerald-400 shrink-0" />
                        : <Square size={14} className="text-[#333] shrink-0" />}
                      <span className={`text-xs font-medium ${selectedUsernames.has(a.username) ? 'text-white' : 'text-[#555]'} ${isIncognito ? 'incognito-blur' : ''}`}>
                        {a.username}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleTrigger} disabled={triggerLoading || (!selectiveMode && lockStatus?.devices && devices?.length > 0 && devices.every(d => lockStatus.devices[d.udid])) || (selectiveMode && selectedUsernames.size === 0)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-500/80 text-white rounded-md text-sm font-bold transition-colors disabled:opacity-40">
              {triggerLoading ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
              {triggerLoading ? 'Triggering...' : selectiveMode && selectedUsernames.size > 0
                ? `Trigger Run (${selectedUsernames.size} account${selectedUsernames.size > 1 ? 's' : ''})`
                : 'Trigger Manual Run'}
            </button>
            <button onClick={checkLockStatus} disabled={lockLoading}
              className="text-[#333] hover:text-[#555] text-xs font-medium transition-colors">
              {lockLoading ? 'Checking...' : 'Refresh lock'}
            </button>
          </div>
          <ResultBanner result={triggerResult} navigate={navigate} />
        </Card>
      </div>

      {modalAction && (
        <ParamsModal
          actionName={modalAction}
          meta={ACTION_META[modalAction] || DEFAULT_META}
          onClose={() => setModalAction(null)}
          onSubmit={(params) => {
            setModalAction(null)
            handleQuickAction(modalAction, params)
          }}
        />
      )}
    </div>
  )
}
