import { useState, useEffect } from 'react'

export function useDeviceLogs(udid) {
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!udid) return

    setEvents([])
    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
    const es = new EventSource(`${baseUrl}/api/devices/${encodeURIComponent(udid)}/logs/stream`)

    es.addEventListener('open', () => setConnected(true))

    es.addEventListener('log', (e) => {
      try {
        const event = JSON.parse(e.data)
        setEvents(prev => [...prev, event])
      } catch { /* ignore parse errors */ }
    })

    es.addEventListener('error', () => {
      setConnected(false)
    })

    return () => {
      es.close()
      setConnected(false)
    }
  }, [udid])

  return { events, connected }
}
