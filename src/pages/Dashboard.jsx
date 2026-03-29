import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LayoutDashboard } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Dashboard</h1>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-[#111111] border-[#1a1a1a]">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 bg-[#1a1a1a] mb-2" />
              <Skeleton className="h-8 w-16 bg-[#1a1a1a]" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA]">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 text-[#52525B] text-sm">
              <LayoutDashboard className="w-5 h-5 mr-2" />
              Coming soon
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA]">Live Execution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 text-[#52525B] text-sm">
              Coming soon
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
