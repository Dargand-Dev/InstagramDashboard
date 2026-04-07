import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_STYLES = {
  SUCCESS: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  COMPLETED: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  ACTIVE: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  FAILED: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  ERROR: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  BANNED: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  RUNNING: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 animate-subtle-pulse',
  IN_PROGRESS: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 animate-subtle-pulse',
  PARTIAL: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  WARNING: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  PENDING: 'bg-[#A1A1AA]/10 text-[#A1A1AA] border-[#A1A1AA]/20',
  QUEUED: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20',
  IDLE: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
  DISABLED: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
  DISCONNECTED: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 animate-subtle-pulse',
  SKIPPED: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
  CREATING: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 animate-subtle-pulse',
  PAUSED_FOR_SCHEDULE: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  ALL_DONE: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  GLOBAL_DISABLED: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
  NOT_CONFIGURED: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
}

export default function StatusBadge({ status, className }) {
  const normalized = (status || 'UNKNOWN').toUpperCase().replace(/[\s-]/g, '_')
  const style = STATUS_STYLES[normalized] || 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20'

  return (
    <Badge variant="outline" className={cn('text-xs font-medium border', style, className)}>
      {status}
    </Badge>
  )
}
