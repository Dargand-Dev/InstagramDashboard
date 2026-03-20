import { useState, useEffect } from 'react'
import { Zap, Smartphone, UserPlus, Play, Rocket, Unlock, Loader2, CheckCircle, XCircle, AlertTriangle, Shield, Settings, Key, Video, Image, Clipboard, Container, RefreshCw, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import { useApi, apiPost } from '../hooks/useApi'

const DEVICES = [
  { label: 'iPhone 1', udid: '00008120-001A256C3C8B801E' },
  { label: 'iPhone 2', udid: '00008130-0019196E0207C01E' },
  { label: 'iPhone 3', udid: '00008120-001234567890ABCD' },
]

const ACTION_META = {
  'SetupProfessionalAccount': { icon: Settings, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', desc: 'Convert to professional/business account' },
  'Enable2FA':               { icon: Key, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', desc: 'Enable two-factor authentication' },
  'PostReel':                { icon: Video, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', desc: 'Post a reel from Drive content' },
  'PostStory':               { icon: Image, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20', desc: 'Post a story' },
  'RegisterInstagramAccount':{ icon: UserPlus, color: 'bg-green-500/10 text-green-400 border-green-500/20', desc: 'Register a new Instagram account' },
  'VerifyAccount':           { icon: Shield, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', desc: 'Verify account (phone/email)' },
  'TransferVideoToDevice':   { icon: Smartphone, color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', desc: 'Push video to device via AFC' },
  'CreateCraneContainer':    { icon: Container, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20', desc: 'Create a new Crane container' },
  'SwitchCraneContainer':    { icon: RefreshCw, color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', desc: 'Switch to another Crane container' },
  'Cleanup':                 { icon: Trash2, color: 'bg-red-500/10 text-red-400 border-red-500/20', desc: 'Clean up device state' },
  'TestClipboardPaste':      { icon: Clipboard, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', desc: 'Test clipboard paste functionality' },
}

const DEFAULT_META = { icon: Play, color: 'bg-white/5 text-text-muted border-white/10', desc: '' }

function ResultBanner({ result }) {
  if (!result) return null
  const isError = result.type === 'error'
  return (
    <div className={`flex items-center gap-2 mt-3 p-3 rounded-lg text-sm ${
      isError ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
    }`}>
      {isError ? <XCircle size={16} /> : <CheckCircle size={16} />}
      {result.message}
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
      className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${meta.color}`}
    >
      <div className="flex items-center justify-between w-full">
        <Icon size={20} />
        {isThis && <Loader2 size={14} className="animate-spin" />}
      </div>
      <span className="text-sm font-semibold">{actionName}</span>
      {meta.desc && <span className="text-xs opacity-70">{meta.desc}</span>}
    </button>
  )
}

export default function Actions() {
  // Account selection for actions
  const { data: accounts } = useApi('/api/accounts')
  const [selectedAccount, setSelectedAccount] = useState('')

  // Create Account state
  const [caDevice, setCaDevice] = useState(DEVICES[0].udid)
  const [caIdentity, setCaIdentity] = useState('sofia')
  const [caLoading, setCaLoading] = useState(false)
  const [caResult, setCaResult] = useState(null)

  // Execute Action state
  const { data: actionsData, loading: actionsLoading } = useApi('/api/automation/actions')
  const [exDevice, setExDevice] = useState(DEVICES[0].udid)
  const [exPort, setExPort] = useState('4723')
  const [exParams, setExParams] = useState('')
  const [exLoading, setExLoading] = useState(false)
  const [exRunningAction, setExRunningAction] = useState(null)
  const [exResult, setExResult] = useState(null)

  // Advanced mode toggle
  const [advancedMode, setAdvancedMode] = useState(false)
  const [advAction, setAdvAction] = useState('')

  // Manual Run state
  const [lockStatus, setLockStatus] = useState(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState(null)
  const [unlockLoading, setUnlockLoading] = useState(false)

  const actionsList = actionsData?.actions || []
  const accountList = accounts || []

  // Auto-select device when account is chosen
  useEffect(() => {
    if (selectedAccount) {
      const acc = accountList.find(a => a.username === selectedAccount)
      if (acc?.deviceUdid) {
        setExDevice(acc.deviceUdid)
      }
    }
  }, [selectedAccount, accountList])

  useEffect(() => {
    if (actionsList.length > 0 && !advAction) setAdvAction(actionsList[0])
  }, [actionsList, advAction])

  async function checkLockStatus() {
    setLockLoading(true)
    try {
      const res = await fetch('/api/automation/lock-status')
      if (res.status === 423) {
        const body = await res.json().catch(() => ({}))
        setLockStatus({ locked: true, ...body })
      } else {
        const body = await res.json().catch(() => ({}))
        setLockStatus({ locked: false, ...body })
      }
    } catch {
      setLockStatus({ locked: false })
    } finally {
      setLockLoading(false)
    }
  }

  useEffect(() => { checkLockStatus() }, [])

  async function handleCreateAccount() {
    setCaLoading(true)
    setCaResult(null)
    try {
      await apiPost('/api/automation/workflow/create-account', {
        deviceUdid: caDevice,
        identityId: caIdentity || undefined,
      })
      setCaResult({ type: 'success', message: 'Account creation workflow accepted ✓' })
    } catch (err) {
      setCaResult({ type: 'error', message: err.message })
    } finally {
      setCaLoading(false)
    }
  }

  async function handleQuickAction(actionName) {
    setExLoading(true)
    setExRunningAction(actionName)
    setExResult(null)
    try {
      let parameters
      if (exParams.trim()) {
        try { parameters = JSON.parse(exParams) } catch { /* ignore */ }
      }
      const res = await apiPost('/api/automation/execute', {
        actionName,
        deviceUdid: exDevice,
        appiumPort: exPort || undefined,
        username: selectedAccount || undefined,
        parameters,
      })
      setExResult({ type: 'success', message: `"${actionName}" executed ✓` })
    } catch (err) {
      setExResult({ type: 'error', message: `"${actionName}" failed: ${err.message}` })
    } finally {
      setExLoading(false)
      setExRunningAction(null)
    }
  }

  async function handleTrigger() {
    await checkLockStatus()
    if (lockStatus?.locked) return
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      await apiPost('/api/automation/trigger', {})
      setTriggerResult({ type: 'success', message: 'Manual run triggered ✓' })
    } catch (err) {
      setTriggerResult({ type: 'error', message: err.message })
    } finally {
      setTriggerLoading(false)
    }
  }

  async function handleForceUnlock() {
    setUnlockLoading(true)
    try {
      await apiPost('/api/automation/force-unlock', {})
      await checkLockStatus()
      setTriggerResult({ type: 'success', message: 'Lock released ✓' })
    } catch (err) {
      setTriggerResult({ type: 'error', message: err.message })
    } finally {
      setUnlockLoading(false)
    }
  }

  const inputClass = 'w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary'
  const labelClass = 'block text-sm text-text-muted mb-1'

  return (
    <div>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <Zap size={24} />
        Actions
      </h2>

      <div className="space-y-6">
        {/* Target Selection */}
        <Card title="Target" icon={Smartphone}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Account (optional)</label>
              <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className={inputClass}>
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
                {DEVICES.map(d => (
                  <option key={d.udid} value={d.udid}>{d.label} — {d.udid.slice(-8)}</option>
                ))}
                {/* Show account's device if not in DEVICES list */}
                {selectedAccount && (() => {
                  const acc = accountList.find(a => a.username === selectedAccount)
                  if (acc?.deviceUdid && !DEVICES.find(d => d.udid === acc.deviceUdid)) {
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

        {/* Quick Actions Grid */}
        <Card title="Run Action" icon={Play}>
          {actionsLoading ? (
            <p className="text-text-muted text-sm">Loading actions...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {actionsList.map(name => {
                  const meta = ACTION_META[name] || DEFAULT_META
                  return (
                    <QuickActionCard
                      key={name}
                      actionName={name}
                      meta={meta}
                      onRun={handleQuickAction}
                      running={exLoading}
                      runningAction={exRunningAction}
                    />
                  )
                })}
              </div>

              <ResultBanner result={exResult} />

              {/* Advanced: custom params */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => setAdvancedMode(!advancedMode)}
                  className="text-xs text-text-muted hover:text-white transition-colors"
                >
                  {advancedMode ? '▼' : '▶'} Advanced (custom parameters)
                </button>
                {advancedMode && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className={labelClass}>Parameters JSON</label>
                      <textarea value={exParams} onChange={e => setExParams(e.target.value)}
                        placeholder='{"key": "value"}' rows={3}
                        className={`${inputClass} font-mono`} />
                    </div>
                    <p className="text-xs text-text-muted">These parameters will be passed to whichever action you click above.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Create Account Workflow */}
        <Card title="Create Account (Full Workflow)" icon={UserPlus}>
          <p className="text-xs text-text-muted mb-4">Runs the full workflow: Crane → Register → Professional Setup → 2FA</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Device</label>
              <select value={caDevice} onChange={e => setCaDevice(e.target.value)} className={inputClass}>
                {DEVICES.map(d => (
                  <option key={d.udid} value={d.udid}>{d.label} — {d.udid.slice(-8)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Identity ID</label>
              <input value={caIdentity} onChange={e => setCaIdentity(e.target.value)} placeholder="sofia" className={inputClass} />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleCreateAccount} disabled={caLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {caLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {caLoading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
          <ResultBanner result={caResult} />
        </Card>

        {/* Manual Posting Run */}
        <Card title="Manual Posting Run" icon={Rocket}>
          {lockStatus?.locked && (
            <div className="flex items-center justify-between bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertTriangle size={16} />
                Automation is currently locked
                {lockStatus.currentExecution && (
                  <span className="text-xs opacity-70">
                    — {lockStatus.currentExecution.action} on {lockStatus.currentExecution.deviceId} ({lockStatus.currentExecution.elapsedSeconds}s)
                  </span>
                )}
              </div>
              <button onClick={handleForceUnlock} disabled={unlockLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-error hover:bg-error/80 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                {unlockLoading ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                Force Unlock
              </button>
            </div>
          )}
          <div className="flex items-center gap-4">
            <button onClick={handleTrigger} disabled={triggerLoading || lockStatus?.locked}
              className="flex items-center gap-2 px-6 py-3 bg-success hover:bg-success/80 text-white rounded-lg text-base font-semibold transition-colors disabled:opacity-50">
              {triggerLoading ? <Loader2 size={20} className="animate-spin" /> : <Rocket size={20} />}
              {triggerLoading ? 'Triggering...' : 'Trigger Manual Run'}
            </button>
            <button onClick={checkLockStatus} disabled={lockLoading}
              className="text-text-muted hover:text-white text-sm transition-colors">
              {lockLoading ? 'Checking...' : 'Refresh lock status'}
            </button>
          </div>
          <ResultBanner result={triggerResult} />
        </Card>
      </div>
    </div>
  )
}
