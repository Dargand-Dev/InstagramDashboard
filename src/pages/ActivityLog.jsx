import { Card, CardContent } from '@/components/ui/card'
import { ScrollText } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function ActivityLog() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Activity Log</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={ScrollText}
            title="Activity Log"
            description="Browse complete execution history. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
