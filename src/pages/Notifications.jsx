import { Card, CardContent } from '@/components/ui/card'
import { Bell } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function Notifications() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Notifications</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={Bell}
            title="Notifications"
            description="View system notifications and alerts. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
