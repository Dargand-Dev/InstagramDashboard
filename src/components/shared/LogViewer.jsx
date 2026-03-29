import { useState, useRef, useEffect, useMemo } from 'react'
import { LazyLog } from '@melloware/react-logviewer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowDown, Search, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOG_LEVELS = ['ALL', 'ERROR', 'WARN', 'INFO']

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function LogViewer({
  text = '',
  url,
  follow: initialFollow = true,
  height = 400,
  className,
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [follow, setFollow] = useState(initialFollow)
  const containerRef = useRef(null)
  const debouncedSearch = useDebounced(search, 300)

  const filteredText = useMemo(() => {
    if (filter === 'ALL') return text
    return text
      .split('\n')
      .filter((line) => line.toUpperCase().includes(filter))
      .join('\n')
  }, [text, filter])

  const displayText = useMemo(() => {
    if (!debouncedSearch) return filteredText
    return filteredText
      .split('\n')
      .filter((line) => line.toLowerCase().includes(debouncedSearch.toLowerCase()))
      .join('\n')
  }, [filteredText, debouncedSearch])

  return (
    <div className={cn('rounded-lg border border-[#1a1a1a] overflow-hidden bg-[#0A0A0A]', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] bg-[#0A0A0A]">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] placeholder:text-[#52525B]"
          />
        </div>
        <div className="flex items-center gap-1">
          {LOG_LEVELS.map((level) => (
            <Button
              key={level}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2 text-xs',
                filter === level
                  ? 'bg-[#1a1a1a] text-[#FAFAFA]'
                  : 'text-[#52525B] hover:text-[#A1A1AA]'
              )}
              onClick={() => setFilter(level)}
            >
              {level}
            </Button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', follow ? 'text-[#3B82F6]' : 'text-[#52525B]')}
          onClick={() => setFollow(!follow)}
          aria-label={follow ? 'Disable auto-follow' : 'Follow logs'}
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Log content */}
      <div ref={containerRef} style={{ height }}>
        <LazyLog
          text={displayText || 'No logs available.'}
          url={url}
          follow={follow}
          enableSearch={false}
          extraLines={1}
          caseInsensitive
          selectableLines
          style={{
            background: '#0A0A0A',
            color: '#A1A1AA',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            fontSize: '12px',
          }}
        />
      </div>
    </div>
  )
}
