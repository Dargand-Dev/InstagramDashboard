import { useState, useEffect, useMemo } from 'react'
import {
  ListOrdered, Play, Pause, X, ArrowUp, ArrowDown, Clock,
  CheckCircle, XCircle, AlertCircle, Loader, Smartphone, ChevronDown, ChevronUp
} from 'lucide-react'
import { useDeviceQueue } from '../hooks/useDeviceQueue'
import { useApi } from '../hooks/useApi'

function formatElapsed(startedAt) {
  if (!startedAt) return ''
  const start = new Date(startedAt)
  const now = new Date()
  const secs = Math.floor((now - start) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${mins}m ${remSecs}s`
}

function formatTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function TaskStatusIcon({ status }) {
  switch (status) {
    case 'RUNNING':
      return <Loader size={16} className="text-blue-400 animate-spin" />
    case 'COMPLETED':
      return <CheckCircle size={16} className="text-emerald-400" />
    case 'FAILED':
      return <XCircle size={16} className="text-red-400" />
    case 'CANCELLED':
      return <AlertCircle size={16} className="text-amber-400" />
    case 'QUEUED':
    default:
      return <Clock size={16} className="text-[#555]" />
  }
}

function statusColor(status) {
  switch (status) {
    case 'RUNNING': return 'text-blue-400'
    case 'COMPLETED': return 'text-emerald-400'
    case 'FAILED': return 'text-red-400'
    case 'CANCELLED': return 'text-amber-400'
    case 'QUEUED': return 'text-[#555]'
    default: return 'text-[#555]'
  }
}

function DeviceCard({ deviceUdid, tasks, paused, onPause, onResume, onCancel, onMoveUp, onMoveDown }) {
  const [showHistory, setShowHistory] = useState(false)
  const [elapsed, setElapsed] = useState({})
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const runningTask = tasks.find(t => t.status === 'RUNNING')
  const queuedTasks = tasks.filter(t => t.status === 'QUEUED')

  // Mettre à jour l'elapsed time toutes les secondes pour les tâches RUNNING
  useEffect(() => {
    if (!runningTask) return
    const interval = setInterval(() => {
      setElapsed(prev => ({ ...prev, [runningTask.id]: formatElapsed(runningTask.startedAt) }))
    }, 1000)
    return () => clearInterval(interval)
  }, [runningTask])

  const loadHistory = async () => {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/queue/${encodeURIComponent(deviceUdid)}`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data.history || [])
      }
    } catch { /* ignore */ }
    finally {
      setHistoryLoading(false)
      setShowHistory(true)
    }
  }

  const deviceLabel = deviceUdid.length > 20 ? deviceUdid.slice(0, 8) + '...' + deviceUdid.slice(-8) : deviceUdid

  return (
    <div className="border border-[#1a1a1a] rounded-lg bg-[#0a0a0a] overflow-hidden">
      {/* Device header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <Smartphone size={18} className="text-[#555]" />
          <span className="text-sm font-semibold text-white">{deviceLabel}</span>
          <div className={`w-2 h-2 rounded-full ${
            paused ? 'bg-amber-400' : runningTask ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'
          }`} />
          <span className="text-xs text-[#555]">
            {paused ? 'En pause' : runningTask ? 'En cours' : 'Libre'}
          </span>
          {queuedTasks.length > 0 && (
            <span className="text-xs bg-white/[0.06] text-[#999] px-2 py-0.5 rounded-full">
              {queuedTasks.length} en attente
            </span>
          )}
        </div>
        <button
          onClick={() => paused ? onResume(deviceUdid) : onPause(deviceUdid)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            paused
              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? 'Reprendre' : 'Pause'}
        </button>
      </div>

      {/* Running task */}
      {runningTask && (
        <div className="px-4 py-3 bg-blue-500/[0.04] border-b border-[#1a1a1a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Loader size={16} className="text-blue-400 animate-spin" />
              <span className="text-sm font-medium text-white">{runningTask.actionName}</span>
              <span className="text-xs text-[#555]">{runningTask.type}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-blue-400 font-mono">
                {elapsed[runningTask.id] || formatElapsed(runningTask.startedAt)}
              </span>
              {runningTask.runId && (
                <span className="text-xs text-[#333] font-mono">{runningTask.runId}</span>
              )}
              <button
                onClick={() => onCancel(runningTask.id)}
                className="p-1 rounded hover:bg-red-500/10 text-[#555] hover:text-red-400 transition-colors"
                title="Arrêter"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {runningTask.parameters?.containerNames && (
            <div className="mt-1.5 text-xs text-[#555]">
              {runningTask.parameters.containerNames.length} containers
            </div>
          )}
        </div>
      )}

      {/* Queued tasks */}
      {queuedTasks.length > 0 ? (
        <div className="divide-y divide-[#141414]">
          {queuedTasks.map((task, idx) => (
            <div key={task.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-[#333] font-mono w-6 text-center">{idx + 1}</span>
                <Clock size={14} className="text-[#555]" />
                <span className="text-sm text-[#999]">{task.actionName}</span>
                <span className="text-xs text-[#333]">{task.type}</span>
                {task.parameters?.containerNames && (
                  <span className="text-xs text-[#555]">
                    ({task.parameters.containerNames.length} containers)
                  </span>
                )}
                <span className="text-xs text-[#333]">P{task.priority}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[#333] mr-2">{formatTime(task.createdAt)}</span>
                <button
                  onClick={() => onMoveUp(task.id, queuedTasks)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-white/[0.06] text-[#555] hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                  title="Monter"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => onMoveDown(task.id, queuedTasks)}
                  disabled={idx === queuedTasks.length - 1}
                  className="p-1 rounded hover:bg-white/[0.06] text-[#555] hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                  title="Descendre"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => onCancel(task.id)}
                  className="p-1 rounded hover:bg-red-500/10 text-[#555] hover:text-red-400 transition-colors"
                  title="Annuler"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !runningTask ? (
        <div className="px-4 py-6 text-center text-xs text-[#333]">
          Aucune tache en attente
        </div>
      ) : null}

      {/* History toggle */}
      <div className="border-t border-[#1a1a1a]">
        <button
          onClick={loadHistory}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-[#555] hover:text-[#999] hover:bg-white/[0.02] transition-colors"
        >
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {historyLoading ? 'Chargement...' : showHistory ? 'Masquer historique' : 'Historique recent'}
        </button>
        {showHistory && history.length > 0 && (
          <div className="divide-y divide-[#141414]">
            {history.map(task => (
              <div key={task.id} className="flex items-center justify-between px-4 py-2 opacity-60">
                <div className="flex items-center gap-2.5">
                  <TaskStatusIcon status={task.status} />
                  <span className="text-xs text-[#999]">{task.actionName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusColor(task.status)}`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-[#333]">{formatTime(task.completedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {showHistory && history.length === 0 && (
          <div className="px-4 py-3 text-center text-xs text-[#333]">Aucun historique</div>
        )}
      </div>
    </div>
  )
}

export default function Queue() {
  const {
    queues, loading, connected,
    cancelTask, pauseDevice, resumeDevice, moveUp, moveDown
  } = useDeviceQueue()

  const { data: devicesData } = useApi('/api/devices')

  // Fusionner les devices connus avec les queues
  const allDevices = useMemo(() => {
    const deviceSet = new Set()

    // Devices depuis la config
    if (devicesData?.devices) {
      for (const d of devicesData.devices) {
        deviceSet.add(d.udid || d.deviceUdid)
      }
    }

    // Devices ayant des tâches en queue
    for (const udid of Object.keys(queues)) {
      deviceSet.add(udid)
    }

    return Array.from(deviceSet)
  }, [devicesData, queues])

  // Déterminer quels devices sont en pause (on le déduit des appels SSE; pour l'instant on fetch)
  const [pausedMap, setPausedMap] = useState({})

  useEffect(() => {
    // Charger l'état de pause pour chaque device ayant une queue
    const loadPauseStates = async () => {
      const map = {}
      for (const udid of allDevices) {
        try {
          const res = await fetch(`/api/queue/${encodeURIComponent(udid)}`)
          if (res.ok) {
            const data = await res.json()
            map[udid] = data.paused || false
          }
        } catch { /* ignore */ }
      }
      setPausedMap(map)
    }
    if (allDevices.length > 0) loadPauseStates()
  }, [allDevices, queues])

  const totalQueued = Object.values(queues).flat().filter(t => t.status === 'QUEUED').length
  const totalRunning = Object.values(queues).flat().filter(t => t.status === 'RUNNING').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <ListOrdered size={22} className="text-primary" />
            <h1 className="text-xl font-bold text-white">File d'attente</h1>
          </div>
          <p className="text-sm text-[#555] mt-1">
            {totalRunning > 0 && <span className="text-blue-400">{totalRunning} en cours</span>}
            {totalRunning > 0 && totalQueued > 0 && <span className="mx-1.5">·</span>}
            {totalQueued > 0 && <span>{totalQueued} en attente</span>}
            {totalRunning === 0 && totalQueued === 0 && 'Aucune tache active'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-xs text-[#555]">{connected ? 'Connecte' : 'Deconnecte'}</span>
        </div>
      </div>

      {/* Device cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size={20} className="text-[#555] animate-spin" />
        </div>
      ) : allDevices.length === 0 ? (
        <div className="border border-[#1a1a1a] rounded-lg bg-[#0a0a0a] px-6 py-16 text-center">
          <Smartphone size={32} className="text-[#333] mx-auto mb-3" />
          <p className="text-sm text-[#555]">Aucun device configure</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {allDevices.map(udid => (
            <DeviceCard
              key={udid}
              deviceUdid={udid}
              tasks={queues[udid] || []}
              paused={pausedMap[udid] || false}
              onPause={async (d) => { await pauseDevice(d); setPausedMap(p => ({...p, [d]: true})) }}
              onResume={async (d) => { await resumeDevice(d); setPausedMap(p => ({...p, [d]: false})) }}
              onCancel={cancelTask}
              onMoveUp={moveUp}
              onMoveDown={moveDown}
            />
          ))}
        </div>
      )}
    </div>
  )
}
