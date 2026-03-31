import { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiDelete } from './useApi'

export function useDeviceQueue() {
  const [queues, setQueues] = useState({})
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const esRef = useRef(null)

  // Charger l'état initial
  const fetchQueues = useCallback(async () => {
    try {
      const res = await fetch('/api/queue')
      if (res.ok) {
        const data = await res.json()
        setQueues(data.queues || {})
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  // Connexion SSE pour les mises à jour en temps réel
  useEffect(() => {
    fetchQueues()

    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
    const es = new EventSource(`${baseUrl}/api/queue/stream`)
    esRef.current = es

    es.addEventListener('connected', () => setConnected(true))

    es.addEventListener('queue', (e) => {
      try {
        const { eventType, data } = JSON.parse(e.data)
        handleQueueEvent(eventType, data)
      } catch { /* ignore parse errors */ }
    })

    es.addEventListener('error', () => setConnected(false))
    es.addEventListener('open', () => setConnected(true))

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
    }
  }, [fetchQueues])

  const handleQueueEvent = useCallback((eventType, data) => {
    switch (eventType) {
      case 'TASK_QUEUED':
      case 'TASK_STARTED':
      case 'TASK_COMPLETED':
      case 'TASK_FAILED':
      case 'TASK_CANCELLED':
      case 'QUEUE_REORDERED':
      case 'DEVICE_PAUSED':
      case 'DEVICE_RESUMED':
        // Recharger l'état complet pour simplicité et fiabilité
        fetchQueues()
        break
    }
  }, [fetchQueues])

  const cancelTask = useCallback(async (taskId) => {
    try {
      await apiDelete(`/api/queue/tasks/${taskId}`)
    } catch (err) {
      console.error('Failed to cancel task:', err)
    }
  }, [])

  const updatePriority = useCallback(async (taskId, priority) => {
    try {
      const res = await fetch(`/api/queue/tasks/${taskId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
    } catch (err) {
      console.error('Failed to update priority:', err)
    }
  }, [])

  const pauseDevice = useCallback(async (deviceUdid) => {
    try {
      await apiPost(`/api/queue/${encodeURIComponent(deviceUdid)}/pause`)
    } catch (err) {
      console.error('Failed to pause device:', err)
    }
  }, [])

  const resumeDevice = useCallback(async (deviceUdid) => {
    try {
      await apiPost(`/api/queue/${encodeURIComponent(deviceUdid)}/resume`)
    } catch (err) {
      console.error('Failed to resume device:', err)
    }
  }, [])

  const moveUp = useCallback(async (taskId, tasks) => {
    const idx = tasks.findIndex(t => t.id === taskId)
    if (idx <= 0) return
    const prevPriority = tasks[idx - 1].priority
    await updatePriority(taskId, prevPriority - 1)
  }, [updatePriority])

  const moveDown = useCallback(async (taskId, tasks) => {
    const idx = tasks.findIndex(t => t.id === taskId)
    if (idx < 0 || idx >= tasks.length - 1) return
    const nextPriority = tasks[idx + 1].priority
    await updatePriority(taskId, nextPriority + 1)
  }, [updatePriority])

  return {
    queues,
    loading,
    connected,
    cancelTask,
    updatePriority,
    pauseDevice,
    resumeDevice,
    moveUp,
    moveDown,
    refetch: fetchQueues,
  }
}
