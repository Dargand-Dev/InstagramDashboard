import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useActiveRuns } from '@/hooks/useActiveRuns'
import FleetSummaryBar from '@/components/activity-log/FleetSummaryBar'
import DeviceCardGrid from '@/components/activity-log/DeviceCardGrid'
import DeviceDetailSheet from '@/components/activity-log/DeviceDetailSheet'

export default function ActivityLog() {
  const queryClient = useQueryClient()
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { subscribe, isConnected } = useWebSocket()
  const { activeRuns } = useActiveRuns()

  // Static device config
  const { data: staticDevices = [], isLoading: loadingStatic } = useQuery({
    queryKey: ['devices-config'],
    queryFn: () => apiGet('/api/devices'),
    select: res => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
    staleTime: 300000,
  })

  // Live device status
  const { data: liveStatuses = [], isLoading: loadingLive } = useQuery({
    queryKey: ['devices-live'],
    queryFn: () => apiGet('/api/devices/live-status'),
    select: res => {
      const raw = res.data || res || []
      return Array.isArray(raw) ? raw : []
    },
    refetchInterval: 10000,
  })

  // All runs (for fleet summary)
  const { data: allRuns = [] } = useQuery({
    queryKey: ['runs'],
    queryFn: () => apiGet('/api/automation/runs?limit=100'),
    select: res => {
      const raw = res.data || res || {}
      if (Array.isArray(raw)) return raw
      return raw.runs || []
    },
    refetchInterval: 30000,
  })

  // Merge static + live (same pattern as Devices.jsx)
  const devices = useMemo(() => {
    const liveMap = {}
    liveStatuses.forEach(ls => {
      liveMap[ls.deviceUdid || ls.udid] = ls
    })
    return staticDevices.map(d => {
      const live = liveMap[d.udid] || {}
      return {
        ...d,
        name: d.name || live.deviceName,
        status: live.status || 'OFFLINE',
        currentAction: live.currentAction,
        currentAccount: live.currentAccount,
        currentRunId: live.currentRunId,
        currentWorkflow: live.currentWorkflow,
        lastActivityAt: live.lastActivityAt,
        lastError: live.lastError,
        elapsedTime: live.elapsedTime,
        port: d.ports?.appium || d.port,
      }
    })
  }, [staticDevices, liveStatuses])

  // WebSocket invalidation for live status
  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/devices/status', () => {
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
    })
    return unsub
  }, [isConnected, subscribe, queryClient])

  // Keep selected device in sync with live data
  useEffect(() => {
    if (!sheetOpen) return
    setSelectedDevice(prev => {
      if (!prev) return prev
      const updated = devices.find(d => d.udid === prev.udid)
      return updated || prev
    })
  }, [devices, sheetOpen])

  const isLoading = loadingStatic || loadingLive

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Activity Log</h1>

      <FleetSummaryBar devices={devices} runs={allRuns} />

      <DeviceCardGrid
        devices={devices}
        isLoading={isLoading}
        activeRuns={activeRuns}
        allRuns={allRuns}
        onSelectDevice={(device) => {
          setSelectedDevice(device)
          setSheetOpen(true)
        }}
      />

      <DeviceDetailSheet
        device={selectedDevice}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
