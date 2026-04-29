import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useWebSocket } from '@/hooks/useWebSocket'

const PING_INTERVAL_MS = 30_000
const RESIZE_DEBOUNCE_MS = 100

const THEME = {
  background: '#0A0A0A',
  foreground: '#FAFAFA',
  cursor: '#FAFAFA',
  cursorAccent: '#0A0A0A',
  selectionBackground: '#3B82F640',
  black: '#0A0A0A',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#F59E0B',
  blue: '#3B82F6',
  magenta: '#A855F7',
  cyan: '#06B6D4',
  white: '#FAFAFA',
  brightBlack: '#52525B',
  brightRed: '#EF4444',
  brightGreen: '#22C55E',
  brightYellow: '#F59E0B',
  brightBlue: '#3B82F6',
  brightMagenta: '#A855F7',
  brightCyan: '#06B6D4',
  brightWhite: '#FAFAFA',
}

export default function TerminalView({ sessionId, onClosed }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitAddonRef = useRef(null)
  const { subscribe, publish, isConnected } = useWebSocket()

  // Mount/unmount du terminal xterm.js
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: THEME,
      scrollback: 5000,
      allowProposedApi: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitAddonRef.current = fit

    return () => {
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // Câblage STOMP (depend de sessionId + connecté)
  useEffect(() => {
    if (!sessionId || !isConnected || !termRef.current) return
    const term = termRef.current

    const unsub = subscribe(`/topic/devices/terminal/${sessionId}/output`, (msg) => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'data' && typeof msg.data === 'string') {
        term.write(msg.data)
      } else if (msg.type === 'closed') {
        onClosed?.(msg.reason || 'unknown')
      }
    })

    const onDataDisp = term.onData((data) => {
      publish(`/app/devices/terminal/${sessionId}/input`, { data })
    })

    let resizeTimer = null
    const sendResize = () => {
      const fit = fitAddonRef.current
      if (!fit || !termRef.current) return
      fit.fit()
      const { cols, rows } = termRef.current
      publish(`/app/devices/terminal/${sessionId}/resize`, { cols, rows })
    }
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(sendResize, RESIZE_DEBOUNCE_MS)
    })
    ro.observe(containerRef.current)
    sendResize()

    const pingId = setInterval(() => {
      publish(`/app/devices/terminal/${sessionId}/ping`, {})
    }, PING_INTERVAL_MS)

    term.focus()

    return () => {
      unsub()
      onDataDisp.dispose()
      ro.disconnect()
      clearTimeout(resizeTimer)
      clearInterval(pingId)
    }
  }, [sessionId, isConnected, subscribe, publish, onClosed])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#0A0A0A] border border-[#1a1a1a] rounded-md overflow-hidden"
    />
  )
}
