import { useState, useEffect, useRef, useMemo } from 'react'
import { useDeviceLogs } from '@/hooks/useDeviceLogs'
import { useWorkflowLogs } from '@/hooks/useWorkflowLogs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/shared/EmptyState'
import LogEventRow from '../LogEventRow'
import {
  ScrollText, Search, ArrowDownToLine, Wifi, WifiOff,
} from 'lucide-react'

const LEVELS = ['ALL', 'ERROR', 'WARN', 'INFO']

export default function DeviceLogsTab({ device, currentRunId }) {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [autoFollow, setAutoFollow] = useState(true)
  const scrollRef = useRef(null)

  // Try per-device SSE first, fallback to per-run SSE
  const deviceLogs = useDeviceLogs(device.udid)
  const runLogs = useWorkflowLogs(deviceLogs.connected ? null : currentRunId)

  const events = deviceLogs.connected ? deviceLogs.events : runLogs.events
  const connected = deviceLogs.connected || runLogs.connected

  const filtered = useMemo(() => {
    let items = events
    if (levelFilter !== 'ALL') {
      items = items.filter(e => {
        if (levelFilter === 'ERROR') return e.status === 'FAILED' || e.errorMessage
        if (levelFilter === 'WARN') return e.status === 'SKIPPED' || e.status === 'FAILED' || e.errorMessage
        return true
      })
    }
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(e =>
        (e.stepName || '').toLowerCase().includes(q) ||
        (e.message || '').toLowerCase().includes(q) ||
        (e.containerName || '').toLowerCase().includes(q) ||
        (e.errorMessage || '').toLowerCase().includes(q)
      )
    }
    return items
  }, [events, levelFilter, search])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoFollow && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [filtered.length, autoFollow])

  return (
    <div className="flex flex-col h-full pb-4">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B]"
          />
        </div>
        <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-[#1a1a1a] p-0.5">
          {LEVELS.map(l => (
            <button
              key={l}
              className={`px-2 py-0.5 text-[10px] rounded-md transition-colors ${levelFilter === l ? 'bg-[#1a1a1a] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'}`}
              onClick={() => setLevelFilter(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 text-[10px] px-2 ${autoFollow ? 'text-[#3B82F6]' : 'text-[#52525B]'}`}
          onClick={() => setAutoFollow(!autoFollow)}
        >
          <ArrowDownToLine className="w-3 h-3 mr-1" />
          {autoFollow ? 'Following' : 'Follow'}
        </Button>
        <div className="flex items-center gap-1">
          {connected
            ? <Wifi className="w-3 h-3 text-[#22C55E]" />
            : <WifiOff className="w-3 h-3 text-[#52525B]" />
          }
          <span className="text-[10px] text-[#52525B]">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Log events */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-[#1a1a1a] bg-[#0A0A0A]"
      >
        {filtered.length > 0 ? (
          <div className="divide-y divide-[#1a1a1a]/50">
            {filtered.map((event, i) => (
              <LogEventRow key={`${event.timestamp}-${i}`} event={event} />
            ))}
          </div>
        ) : events.length > 0 ? (
          <EmptyState icon={Search} title="No matches" description="Try adjusting your search or filter." className="py-8" />
        ) : (
          <EmptyState
            icon={ScrollText}
            title={connected ? 'Waiting for events...' : 'No logs'}
            description={connected ? 'Log events will appear here in real-time.' : 'Start a workflow to see live logs.'}
            className="py-8"
          />
        )}
      </div>
    </div>
  )
}
