import { useState, useEffect, useCallback, useRef } from 'react'

export function useApi(url, options = {}) {
  const { autoFetch = true, initialData = null, pollInterval = null } = options
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState(null)
  const prevJsonRef = useRef(null)

  const fetchData = useCallback(async (fetchOptions = {}) => {
    const { _poll, ...rest } = fetchOptions
    if (!_poll) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(url, rest)
      if (!res.ok) {
        if (res.status === 423) {
          const body = await res.json().catch(() => ({}))
          setData({ locked: true, ...body })
          return { locked: true, ...body }
        }
        throw new Error(`${res.status} ${res.statusText}`)
      }
      const json = await res.json()
      if (_poll) {
        const jsonStr = JSON.stringify(json)
        if (jsonStr !== prevJsonRef.current) {
          prevJsonRef.current = jsonStr
          setData(json)
        }
      } else {
        prevJsonRef.current = JSON.stringify(json)
        setData(json)
      }
      return json
    } catch (err) {
      if (err.name === 'AbortError') return null
      if (!_poll) setError(err.message)
      return null
    } finally {
      if (!_poll) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    prevJsonRef.current = null
  }, [url])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    if (autoFetch) fetchData({ signal: controller.signal })

    let interval
    if (pollInterval && autoFetch) {
      interval = setInterval(() => {
        if (!cancelled) fetchData({ _poll: true, signal: controller.signal })
      }, pollInterval)
    }

    return () => {
      cancelled = true
      controller.abort()
      if (interval) clearInterval(interval)
    }
  }, [autoFetch, fetchData, pollInterval])

  return { data, loading, error, refetch: fetchData }
}

export async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json().catch(() => ({}))
}

export async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json().catch(() => ({}))
}

export async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json().catch(() => ({}))
}
