import { Button } from '@/components/ui/button'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No data',
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div className="w-12 h-12 rounded-xl bg-[#111111] border border-[#1a1a1a] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-[#52525B]" />
      </div>
      <h3 className="text-sm font-medium text-[#FAFAFA] mb-1">{title}</h3>
      {description && <p className="text-xs text-[#52525B] max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
