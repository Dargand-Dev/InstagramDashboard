import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function ErrorCenter() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Error Center</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={AlertTriangle}
            title="Error Center"
            description="Track and investigate automation errors. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
