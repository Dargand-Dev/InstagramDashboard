import { Card, CardContent } from '@/components/ui/card'
import { Settings as SettingsIcon } from 'lucide-react'
import EmptyState from '@/components/shared/EmptyState'

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Configuration</h1>
      <Card className="bg-[#111111] border-[#1a1a1a]">
        <CardContent className="p-0">
          <EmptyState
            icon={SettingsIcon}
            title="Settings"
            description="Application configuration and preferences. Coming soon."
          />
        </CardContent>
      </Card>
    </div>
  )
}
