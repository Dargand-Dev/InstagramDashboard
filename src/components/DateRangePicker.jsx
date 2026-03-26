import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

function buildMonth(year, month) {
  const firstDay = new Date(year, month, 1)
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const cells = []

  // Previous month trailing days
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrev - i)
    cells.push({ date: d, str: toDateStr(d), outside: true })
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    cells.push({ date: d, str: toDateStr(d), outside: false })
  }

  // Next month leading days
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i)
    cells.push({ date: d, str: toDateStr(d), outside: true })
  }

  return cells
}

export default function DateRangePicker({ startDate, endDate, onChange, onClose }) {
  const ref = useRef(null)
  const today = toDateStr(new Date())

  const [baseMonth, setBaseMonth] = useState(() => {
    if (endDate) {
      const d = new Date(endDate + 'T00:00:00')
      return { year: d.getFullYear(), month: d.getMonth() - 1 }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() - 1 }
  })

  // Hovering state for range preview
  const [hoverDate, setHoverDate] = useState(null)

  // Picking state: null = pick start, 'end' = pick end
  const [picking, setPicking] = useState(startDate && !endDate ? 'end' : null)
  const [tempStart, setTempStart] = useState(startDate)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const prevMonth = () => setBaseMonth(prev => {
    let m = prev.month - 1, y = prev.year
    if (m < 0) { m = 11; y-- }
    return { year: y, month: m }
  })

  const nextMonth = () => setBaseMonth(prev => {
    let m = prev.month + 1, y = prev.year
    if (m > 11) { m = 0; y++ }
    return { year: y, month: m }
  })

  const handleDayClick = (dateStr) => {
    if (picking === 'end' && tempStart) {
      // If clicked before start, reset start
      if (dateStr < tempStart) {
        setTempStart(dateStr)
        return
      }
      onChange(tempStart, dateStr)
      setPicking(null)
      onClose()
    } else {
      setTempStart(dateStr)
      setPicking('end')
    }
  }

  const handleClear = () => {
    setTempStart(null)
    setPicking(null)
    onChange(null, null)
    onClose()
  }

  const isInRange = (dateStr) => {
    const s = tempStart
    const e = picking === 'end' ? hoverDate : endDate
    if (!s || !e) return false
    return dateStr > s && dateStr < e
  }

  const isStart = (dateStr) => dateStr === tempStart
  const isEnd = (dateStr) => {
    if (picking === 'end') return dateStr === hoverDate && hoverDate > tempStart
    return dateStr === endDate
  }

  const month1 = buildMonth(baseMonth.year, baseMonth.month)
  const nextM = baseMonth.month + 1 > 11
    ? { year: baseMonth.year + 1, month: 0 }
    : { year: baseMonth.year, month: baseMonth.month + 1 }
  const month2 = buildMonth(nextM.year, nextM.month)

  const renderMonth = (cells, year, month) => (
    <div className="w-[260px]">
      <div className="text-center text-white text-xs font-semibold mb-2">
        {MONTHS_FR[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0 mb-1">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-[10px] text-[#555] font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {cells.map((cell, i) => {
          const selected = isStart(cell.str) || isEnd(cell.str)
          const inRange = isInRange(cell.str)
          const isToday = cell.str === today

          return (
            <button
              key={i}
              onClick={() => handleDayClick(cell.str)}
              onMouseEnter={() => picking === 'end' && setHoverDate(cell.str)}
              className={`
                h-8 w-full text-[11px] font-medium relative transition-colors
                ${cell.outside ? 'text-[#333]' : 'text-[#888]'}
                ${selected ? 'bg-white/15 text-white rounded-md' : ''}
                ${inRange ? 'bg-white/5' : ''}
                ${!selected && !cell.outside ? 'hover:bg-white/10 hover:text-white rounded-md' : ''}
              `}
            >
              {cell.date.getDate()}
              {isToday && !selected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-2 z-50 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-2xl p-4"
    >
      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded transition-colors">
          <ChevronLeft size={14} className="text-[#555]" />
        </button>
        <span className="text-[10px] text-[#555] font-medium">
          {picking === 'end' ? 'Sélectionnez la fin' : 'Sélectionnez le début'}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded transition-colors">
          <ChevronRight size={14} className="text-[#555]" />
        </button>
      </div>

      {/* Two-month grid */}
      <div className="flex gap-4">
        {renderMonth(month1, baseMonth.year, baseMonth.month)}
        {renderMonth(month2, nextM.year, nextM.month)}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1a1a1a]">
        <div className="text-[10px] text-[#555]">
          {tempStart && (
            <span className="text-[#888]">
              {tempStart.slice(8)}/{tempStart.slice(5, 7)}
              {endDate && !picking ? ` — ${endDate.slice(8)}/${endDate.slice(5, 7)}` : ''}
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-[10px] text-[#555] hover:text-white transition-colors font-medium"
        >
          Effacer
        </button>
      </div>
    </div>
  )
}
