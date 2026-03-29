import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import StatusBadge from '@/components/shared/StatusBadge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import { toast } from 'sonner'
import {
  CalendarDays, Play, Power, PowerOff, Lock, Unlock,
  Clock, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  AlertTriangle, Zap,
} from 'lucide-react'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatHour(h) {
  return `${String(h).padStart(2, '0')}:00`
}

function ScheduleWindowsBar({ windows }) {
  if (!windows || !windows.length) {
    return <p className="text-xs text-[#52525B]">No posting windows configured</p>
  }

  // windows expected as [{start: "09:00", end: "12:00"}, ...] or [{startHour: 9, endHour: 12}]
  const normalizedWindows = windows.map(w => {
    const start = w.startHour ?? parseInt(w.start)
    const end = w.endHour ?? parseInt(w.end)
    return { start, end }
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {HOURS.map(h => {
          const active = normalizedWindows.some(w => h >= w.start && h < w.end)
          return (
            <div
              key={h}
              className="flex-1 h-6 rounded-sm transition-colors relative group"
              style={{ background: active ? '#3B82F620' : '#1a1a1a' }}
            >
              {active && <div className="absolute inset-0 rounded-sm bg-[#3B82F6]/30 border border-[#3B82F6]/40" />}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-[#52525B] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {formatHour(h)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[#52525B] mt-5">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  )
}

function MiniCalendar({ runs }) {
  const [monthOffset, setMonthOffset] = useState(0)

  const today = new Date()
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const year = displayDate.getFullYear()
  const month = displayDate.getMonth()
  const monthName = displayDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const [selectedDay, setSelectedDay] = useState(null)

  // Map runs by date
  const runsByDate = useMemo(() => {
    const map = {}
    if (!Array.isArray(runs)) return map
    runs.forEach(r => {
      const date = (r.startedAt || r.date || r.createdAt || '').slice(0, 10)
      if (!date) return
      if (!map[date]) map[date] = []
      map[date].push(r)
    })
    return map
  }, [runs])

  const getDayStatus = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayRuns = runsByDate[dateStr]
    if (!dayRuns || dayRuns.length === 0) return null
    const allSuccess = dayRuns.every(r => r.status === 'SUCCESS' || r.status === 'COMPLETED')
    const allFailed = dayRuns.every(r => r.status === 'FAILED' || r.status === 'ERROR')
    if (allSuccess) return 'success'
    if (allFailed) return 'failed'
    return 'partial'
  }

  const getDayRuns = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return runsByDate[dateStr] || []
  }

  const statusColors = {
    success: '#22C55E',
    partial: '#F59E0B',
    failed: '#EF4444',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon-xs" className="text-[#52525B] hover:text-[#A1A1AA]" onClick={() => setMonthOffset(p => p - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-[#FAFAFA]">{monthName}</span>
        <Button variant="ghost" size="icon-xs" className="text-[#52525B] hover:text-[#A1A1AA]" onClick={() => setMonthOffset(p => p + 1)} disabled={monthOffset >= 0}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-[#52525B] font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const status = getDayStatus(day)
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const isSelected = selectedDay === day

          return (
            <button
              key={day}
              className={`aspect-square rounded-md flex items-center justify-center text-xs transition-colors relative ${
                isToday ? 'ring-1 ring-[#3B82F6]' : ''
              } ${isSelected ? 'bg-[#1a1a1a]' : 'hover:bg-[#161616]'}`}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
            >
              <span className={`${status ? 'text-[#FAFAFA]' : 'text-[#52525B]'}`}>{day}</span>
              {status && (
                <div
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: statusColors[status] }}
                />
              )}
            </button>
          )
        })}
      </div>

      {selectedDay && getDayRuns(selectedDay).length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-[#1a1a1a] pt-3">
          <p className="text-xs text-[#52525B] mb-2">
            Runs on {year}-{String(month + 1).padStart(2, '0')}-{String(selectedDay).padStart(2, '0')}
          </p>
          {getDayRuns(selectedDay).map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1">
              <span className="text-[#A1A1AA]">{r.workflowName || r.trigger || 'Run'}</span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  const queryClient = useQueryClient()

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => apiGet('/api/automation/schedule'),
  })

  const { data: lockData, isLoading: lockLoading } = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => apiGet('/api/automation/lock-status'),
    refetchInterval: 10000,
  })

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['runs-calendar'],
    queryFn: () => apiGet('/api/automation/runs?limit=100'),
  })

  const schedule = scheduleData?.data || scheduleData || {}
  const lock = lockData?.data || lockData || {}
  const runs = useMemo(() => {
    const raw = runsData?.data || runsData || []
    return Array.isArray(raw) ? raw : []
  }, [runsData])

  const isLocked = lock.locked || lock.status === 'LOCKED' || lock.status === 'RUNNING'
  const isEnabled = schedule.enabled !== false
  const windows = schedule.windows || schedule.postingWindows || schedule.timeWindows || []
  const nextRun = schedule.nextRun || schedule.nextRunTime

  // Trigger mutation
  const triggerMutation = useMutation({
    mutationFn: () => apiPost('/api/automation/trigger'),
    onSuccess: (data) => {
      if (data?.locked) {
        toast.error('System is locked — another workflow is running')
      } else {
        toast.success('Workflow triggered successfully')
        queryClient.invalidateQueries({ queryKey: ['lock-status'] })
        queryClient.invalidateQueries({ queryKey: ['runs-calendar'] })
      }
    },
  })

  // Force unlock mutation
  const unlockMutation = useMutation({
    mutationFn: () => apiPost('/api/automation/force-unlock'),
    onSuccess: () => {
      toast.success('Lock released')
      queryClient.invalidateQueries({ queryKey: ['lock-status'] })
    },
  })

  // Recent runs summary
  const runsSummary = useMemo(() => {
    const recent = runs.slice(0, 10)
    const success = recent.filter(r => r.status === 'SUCCESS' || r.status === 'COMPLETED').length
    const failed = recent.filter(r => r.status === 'FAILED' || r.status === 'ERROR').length
    return { total: recent.length, success, failed }
  }, [runs])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Schedule</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Schedule Status */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#3B82F6]" />
                Schedule Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full bg-[#1a1a1a]" />
                  <Skeleton className="h-8 w-48 bg-[#1a1a1a]" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                    <div className="flex items-center gap-3">
                      {isEnabled ? (
                        <Power className="w-4 h-4 text-[#22C55E]" />
                      ) : (
                        <PowerOff className="w-4 h-4 text-[#EF4444]" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#FAFAFA]">
                          Scheduler {isEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                        {nextRun && (
                          <p className="text-xs text-[#52525B] mt-0.5">
                            Next run: <TimeAgo date={nextRun} className="text-[#A1A1AA]" />
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={isEnabled
                        ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20'
                        : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                      }
                    >
                      {isEnabled ? 'ACTIVE' : 'OFF'}
                    </Badge>
                  </div>

                  {/* Lock status */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                    <div className="flex items-center gap-3">
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-[#F59E0B]" />
                      ) : (
                        <Unlock className="w-4 h-4 text-[#52525B]" />
                      )}
                      <div>
                        <p className="text-sm text-[#FAFAFA]">
                          {isLocked ? 'System Locked' : 'System Idle'}
                        </p>
                        {isLocked && (lock.currentAction || lock.workflow) && (
                          <p className="text-xs text-[#52525B] mt-0.5">{lock.currentAction || lock.workflow}</p>
                        )}
                      </div>
                    </div>
                    {isLocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
                        onClick={() => unlockMutation.mutate()}
                        disabled={unlockMutation.isPending}
                      >
                        <Unlock className="w-3 h-3 mr-1" />
                        Force Unlock
                      </Button>
                    )}
                  </div>

                  {/* Last runs summary */}
                  <div className="flex items-center gap-6 p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#3B82F6]" />
                      <span className="text-xs text-[#52525B]">Last {runsSummary.total} runs:</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-[#22C55E]">
                        <CheckCircle className="w-3 h-3" />{runsSummary.success} success
                      </span>
                      <span className="flex items-center gap-1 text-[#EF4444]">
                        <XCircle className="w-3 h-3" />{runsSummary.failed} failed
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Posting Windows */}
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#8B5CF6]" />
                Posting Windows
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <Skeleton className="h-16 w-full bg-[#1a1a1a]" />
              ) : (
                <ScheduleWindowsBar windows={windows} />
              )}
            </CardContent>
          </Card>

          {/* Manual Trigger */}
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
                <Play className="w-4 h-4 text-[#22C55E]" />
                Manual Trigger
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                  onClick={() => triggerMutation.mutate()}
                  disabled={isLocked || triggerMutation.isPending}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {triggerMutation.isPending ? 'Triggering...' : 'Trigger Workflow'}
                </Button>
                {isLocked && (
                  <div className="flex items-center gap-2 text-xs text-[#F59E0B]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    System is locked — unlock first or wait for current run
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mini Calendar */}
        <div>
          <Card className="bg-[#111111] border-[#1a1a1a]">
            <CardHeader>
              <CardTitle className="text-sm text-[#A1A1AA]">Run Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <Skeleton className="h-64 w-full bg-[#1a1a1a] rounded-lg" />
              ) : (
                <MiniCalendar runs={runs} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
