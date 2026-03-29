import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function Accounts() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Accounts</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={Users}
            title="Account Management"
            description="View and manage Instagram accounts. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
