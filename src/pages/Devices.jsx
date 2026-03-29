import { Card, CardContent } from '@/components/ui/card'
import { Smartphone } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function Devices() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Devices</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={Smartphone}
            title="Device Fleet"
            description="Manage and monitor connected devices. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
