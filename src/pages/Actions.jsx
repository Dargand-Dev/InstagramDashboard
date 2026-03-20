import { useState, useEffect } from 'react'
import { Zap, Smartphone, UserPlus, Play, Rocket, Unlock, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Card from '../components/Card'
import { useApi, apiPost } from '../hooks/useApi'

const DEVICES = [
  { label: 'iPhone 1', udid: '00008120-001A256C3C8B801E' },
  { label: 'iPhone 2', udid: '00008130-0019196E0207C01E' },
  { label: 'iPhone 3', udid: '00008120-001234567890ABCD' },
]

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

export default function Actions() {
  // Create Account state
  const [caDevice, setCaDevice] = useState(DEVICES[0].udid)
  const [caIdentity, setCaIdentity] = useState('sofia')
  const [caLoading, setCaLoading] = useState(false)
  const [caResult, setCaResult] = useState(null)

  // Execute Action state
  const { data: actionsData, loading: actionsLoading } = useApi('/api/automation/actions')
  const [exAction, setExAction] = useState('')
  const [exDevice, setExDevice] = useState(DEVICES[0].udid)
  const [exPort, setExPort] = useState('4723')
  const [exUsername, setExUsername] = useState('')
  const [exParams, setExParams] = useState('')
  const [exLoading, setExLoading] = useState(false)
  const [exResult, setExResult] = useState(null)

  // Manual Run state
  const [lockStatus, setLockStatus] = useState(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState(null)
  const [unlockLoading, setUnlockLoading] = useState(false)

  const actionsList = actionsData?.actions || []

  useEffect(() => {
    if (actionsList.length > 0 && !exAction) setExAction(actionsList[0])
  }, [actionsList, exAction])

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
      setCaResult({ type: 'success', message: 'Account creation accepted' })
    } catch (err) {
      setCaResult({ type: 'error', message: err.message })
    } finally {
      setCaLoading(false)
    }
  }

  async function handleExecute() {
    setExLoading(true)
    setExResult(null)
    try {
      let parameters
      if (exParams.trim()) {
        try {
          parameters = JSON.parse(exParams)
        } catch {
          setExResult({ type: 'error', message: 'Invalid JSON in parameters' })
          setExLoading(false)
          return
        }
      }
      await apiPost('/api/automation/execute', {
        actionName: exAction,
        deviceUdid: exDevice,
        appiumPort: exPort || undefined,
        username: exUsername || undefined,
        parameters,
      })
      setExResult({ type: 'success', message: `Action "${exAction}" accepted` })
    } catch (err) {
      setExResult({ type: 'error', message: err.message })
    } finally {
      setExLoading(false)
    }
  }

  async function handleTrigger() {
    await checkLockStatus()
    if (lockStatus?.locked) return
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      await apiPost('/api/automation/trigger', {})
      setTriggerResult({ type: 'success', message: 'Manual run triggered' })
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
      setTriggerResult({ type: 'success', message: 'Lock released' })
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
        {/* Create Account */}
        <Card title="Create Account" icon={UserPlus}>
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

        {/* Execute Action */}
        <Card title="Execute Action" icon={Play}>
          {actionsLoading ? (
            <p className="text-text-muted text-sm">Loading actions...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Action</label>
                  <select value={exAction} onChange={e => setExAction(e.target.value)} className={inputClass}>
                    {actionsList.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Device</label>
                  <select value={exDevice} onChange={e => setExDevice(e.target.value)} className={inputClass}>
                    {DEVICES.map(d => (
                      <option key={d.udid} value={d.udid}>{d.label} — {d.udid.slice(-8)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Appium Port</label>
                  <input value={exPort} onChange={e => setExPort(e.target.value)} placeholder="4723" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Username (optional)</label>
                  <input value={exUsername} onChange={e => setExUsername(e.target.value)} placeholder="" className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <label className={labelClass}>Parameters JSON (optional)</label>
                <textarea value={exParams} onChange={e => setExParams(e.target.value)}
                  placeholder='{"key": "value"}' rows={3}
                  className={`${inputClass} font-mono`} />
              </div>
              <div className="mt-4">
                <button onClick={handleExecute} disabled={exLoading || !exAction}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {exLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  {exLoading ? 'Executing...' : 'Execute'}
                </button>
              </div>
              <ResultBanner result={exResult} />
            </>
          )}
        </Card>

        {/* Manual Posting Run */}
        <Card title="Manual Posting Run" icon={Rocket}>
          {lockStatus?.locked && (
            <div className="flex items-center justify-between bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertTriangle size={16} />
                Automation is currently locked
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
