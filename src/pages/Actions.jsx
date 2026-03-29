import { Card, CardContent } from '@/components/ui/card'
import { Clapperboard } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function Actions() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Actions</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={Clapperboard}
            title="Automation Actions"
            description="Trigger and configure automation workflows. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
