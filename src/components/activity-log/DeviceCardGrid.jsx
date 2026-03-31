import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { Smartphone } from 'lucide-react'
import DeviceCard from './DeviceCard'

export default function DeviceCardGrid({ devices, isLoading, activeRuns, allRuns, onSelectDevice }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 bg-[#111111] rounded-lg" />
        ))}
      </div>
    )
  }

  if (devices.length === 0) {
    return <EmptyState icon={Smartphone} title="No devices" description="No devices are registered yet." />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {devices.map(device => (
        <DeviceCard
          key={device.id || device.udid}
          device={device}
          activeRun={activeRuns.find(r => (r.deviceUdid || r.device) === device.udid)}
          recentRuns={(allRuns || []).filter(r => (r.deviceUdid || r.device) === device.udid).slice(0, 5)}
          onClick={() => onSelectDevice(device)}
        />
      ))}
    </div>
  )
}
