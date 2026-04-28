import { useState, useEffect, useCallback, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/stores/authStore'

// Reconnaît les rejets backend pour token absent/invalide/expiré.
// Quand on les voit → logout, sinon le client retry indéfiniment et l'UI
// reste bloquée sans feedback (ex: tiles wall coincées sur "Démarrage...").
function isAuthFailure(frame) {
  const message = frame?.headers?.message || frame?.body || ''
  const lower = String(message).toLowerCase()
  return (
    lower.includes('authorization') ||
    lower.includes('invalid or expired jwt') ||
    lower.includes('jwt')
  )
}

const WS_URL = import.meta.env.VITE_WS_URL || '/ws'

const CONNECTION_STATUS = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
}

export function useWebSocket() {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED)
  const clientRef = useRef(null)
  // topic -> { sub: StompSubscription | null, callbacks: Set<fn> }
  const subscriptionsRef = useRef(new Map())
  const reconnectDelayRef = useRef(1000)
  const reconnectTimeoutRef = useRef(null)

  const token = useAuthStore((s) => s.token)

  // Dispatch un message reçu vers tous les callbacks abonnés au topic.
  const dispatch = useCallback((topic, message) => {
    const entry = subscriptionsRef.current.get(topic)
    if (!entry) return
    let payload
    try {
      payload = JSON.parse(message.body)
    } catch {
      payload = message.body
    }
    entry.callbacks.forEach((cb) => {
      try {
        cb(payload)
      } catch {
        // un callback qui throw ne doit pas casser les autres
      }
    })
  }, [])

  useEffect(() => {
    if (!token) return

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0, // we handle reconnect manually
      onConnect: () => {
        setStatus(CONNECTION_STATUS.CONNECTED)
        reconnectDelayRef.current = 1000
        // Re-subscribe existing subscriptions (1 STOMP subscribe par topic)
        subscriptionsRef.current.forEach((entry, topic) => {
          entry.sub = client.subscribe(topic, (message) => dispatch(topic, message))
        })
      },
      onDisconnect: () => {
        setStatus(CONNECTION_STATUS.DISCONNECTED)
      },
      onStompError: (frame) => {
        setStatus(CONNECTION_STATUS.DISCONNECTED)
        // Backend a rejeté le CONNECT (typiquement JWT expiré/invalide).
        // On force un logout au lieu de retry indéfiniment — sinon UI silencieusement KO.
        if (isAuthFailure(frame)) {
          // eslint-disable-next-line no-console
          console.warn('[ws] STOMP auth failure, forcing logout:', frame?.headers?.message || frame?.body)
          useAuthStore.getState().logout()
          return
        }
        // Exponential backoff reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          if (clientRef.current) {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000)
            clientRef.current.activate()
          }
        }, reconnectDelayRef.current)
      },
    })

    clientRef.current = client
    setStatus(CONNECTION_STATUS.CONNECTING)
    client.activate()

    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      client.deactivate()
      clientRef.current = null
      setStatus(CONNECTION_STATUS.DISCONNECTED)
    }
  }, [token, dispatch])

  const subscribe = useCallback((topic, callback) => {
    let entry = subscriptionsRef.current.get(topic)
    if (!entry) {
      entry = { sub: null, callbacks: new Set() }
      subscriptionsRef.current.set(topic, entry)
    }
    entry.callbacks.add(callback)

    const client = clientRef.current
    if (client?.connected && !entry.sub) {
      entry.sub = client.subscribe(topic, (message) => dispatch(topic, message))
    }

    return () => {
      const e = subscriptionsRef.current.get(topic)
      if (!e) return
      e.callbacks.delete(callback)
      // Plus aucun subscriber → on libère le STOMP subscribe
      if (e.callbacks.size === 0) {
        if (e.sub) e.sub.unsubscribe()
        subscriptionsRef.current.delete(topic)
      }
    }
  }, [dispatch])

  return { status, subscribe, isConnected: status === CONNECTION_STATUS.CONNECTED }
}
