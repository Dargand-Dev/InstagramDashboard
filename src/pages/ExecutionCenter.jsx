import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function ExecutionCenter() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Execution Center</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={Zap}
            title="Execution Center"
            description="Monitor and manage active workflow executions. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
