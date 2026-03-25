import { useState, useEffect, useCallback } from 'react'

export function useActiveRuns(pollInterval = 4000) {
  const [activeRuns, setActiveRuns] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchActiveRuns = useCallback(async () => {
    try {
      const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
      const res = await fetch(`${baseUrl}/api/automation/workflow/logs/active-runs`)
      if (res.ok) {
        const data = await res.json()
        setActiveRuns(data)
      }
    } catch { /* ignore network errors */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let mounted = true

    const poll = async () => {
      if (!mounted) return
      await fetchActiveRuns()
    }

    poll()
    const interval = setInterval(poll, pollInterval)
    return () => { mounted = false; clearInterval(interval) }
  }, [pollInterval, fetchActiveRuns])

  return { activeRuns, hasActiveRuns: activeRuns.length > 0, loading }
}
