import { useState, useEffect, useCallback } from 'react'

export function useApi(url, options = {}) {
  const { autoFetch = true, initialData = null } = options
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async (fetchOptions = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, fetchOptions)
      if (!res.ok) {
        if (res.status === 423) {
          const body = await res.json().catch(() => ({}))
          setData({ locked: true, ...body })
          return { locked: true, ...body }
        }
        throw new Error(`${res.status} ${res.statusText}`)
      }
      const json = await res.json()
      setData(json)
      return json
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (autoFetch) fetchData()
  }, [autoFetch, fetchData])

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
