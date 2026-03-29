import { Card, CardContent } from '@/components/ui/card'
import { ListOrdered } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function Queue() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Queue</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={ListOrdered}
            title="Task Queue"
            description="View and manage queued automation tasks. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
