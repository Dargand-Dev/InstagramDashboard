import { useState, useEffect, useRef } from 'react'

export function useActiveRuns(pollInterval = 4000) {
  const [activeRuns, setActiveRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const prevJsonRef = useRef('[]')

  useEffect(() => {
    const controller = new AbortController()

    async function poll() {
      try {
        const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
        const res = await fetch(`${baseUrl}/api/automation/runs/active`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          const json = JSON.stringify(data)
          if (json !== prevJsonRef.current) {
            prevJsonRef.current = json
            setActiveRuns(data)
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return
      } finally {
        setLoading(false)
      }
    }

    poll()
    const interval = setInterval(poll, pollInterval)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [pollInterval])

  return { activeRuns, hasActiveRuns: activeRuns.length > 0, loading }
}
