import { useState, useEffect, useCallback, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { useAuthStore } from '@/stores/authStore'

const WS_URL = import.meta.env.VITE_WS_URL || '/ws'

const CONNECTION_STATUS = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
}

export function useWebSocket() {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED)
  const clientRef = useRef(null)
  const subscriptionsRef = useRef(new Map())
  const reconnectDelayRef = useRef(1000)

  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0, // we handle reconnect manually
      onConnect: () => {
        setStatus(CONNECTION_STATUS.CONNECTED)
        reconnectDelayRef.current = 1000
        // Re-subscribe existing subscriptions
        subscriptionsRef.current.forEach((cb, topic) => {
          client.subscribe(topic, (message) => {
            try {
              cb(JSON.parse(message.body))
            } catch {
              cb(message.body)
            }
          })
        })
      },
      onDisconnect: () => {
        setStatus(CONNECTION_STATUS.DISCONNECTED)
      },
      onStompError: () => {
        setStatus(CONNECTION_STATUS.DISCONNECTED)
        // Exponential backoff reconnect
        setTimeout(() => {
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
      client.deactivate()
      clientRef.current = null
      setStatus(CONNECTION_STATUS.DISCONNECTED)
    }
  }, [token])

  const subscribe = useCallback((topic, callback) => {
    subscriptionsRef.current.set(topic, callback)

    const client = clientRef.current
    let sub = null
    if (client?.connected) {
      sub = client.subscribe(topic, (message) => {
        try {
          callback(JSON.parse(message.body))
        } catch {
          callback(message.body)
        }
      })
    }

    return () => {
      subscriptionsRef.current.delete(topic)
      if (sub) sub.unsubscribe()
    }
  }, [])

  return { status, subscribe, isConnected: status === CONNECTION_STATUS.CONNECTED }
}
