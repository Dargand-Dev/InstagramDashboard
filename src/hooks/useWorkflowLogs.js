import { useState, useEffect } from 'react'

export function useWorkflowLogs(runId) {
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!runId) return

    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
    const es = new EventSource(`${baseUrl}/api/automation/workflow/logs/stream?runId=${encodeURIComponent(runId)}`)

    es.addEventListener('open', () => setConnected(true))

    es.addEventListener('log', (e) => {
      try {
        const event = JSON.parse(e.data)
        setEvents(prev => [...prev, event])
        if (event.status === 'COMPLETE') {
          setCompleted(true)
          es.close()
          setConnected(false)
        }
      } catch { /* ignore parse errors */ }
    })

    es.addEventListener('error', () => {
      setConnected(false)
    })

    return () => {
      es.close()
      setConnected(false)
    }
  }, [runId])

  return { events, connected, completed }
}
