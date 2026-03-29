import { Card, CardContent } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function PostingHistory() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Posting History</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={FileText}
            title="Posting History"
            description="Browse historical posting records. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
