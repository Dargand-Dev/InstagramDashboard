import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import StatusBadge from '@/components/shared/StatusBadge'
import DeviceRunsTab from './tabs/DeviceRunsTab'
import DeviceLogsTab from './tabs/DeviceLogsTab'
import DeviceStatsTab from './tabs/DeviceStatsTab'
import DeviceQueueTab from './tabs/DeviceQueueTab'
import { Smartphone, ScrollText, Terminal, BarChart3, ListOrdered } from 'lucide-react'

export default function DeviceDetailSheet({ device, open, onOpenChange }) {
  if (!device) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0A0A0A] border border-[#1a1a1a] sm:max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col overflow-hidden"
        showCloseButton
      >
        <DialogHeader className="border-b border-[#1a1a1a] pb-4 pr-8">
          <DialogTitle className="text-[#FAFAFA] flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#A1A1AA]" />
            {device.name || device.label || 'Device'}
            <StatusBadge status={device.status || 'OFFLINE'} />
          </DialogTitle>
          <DialogDescription className="text-[#52525B] font-mono text-xs">
            {device.udid || 'No UDID'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Tabs defaultValue="runs">
            <TabsList variant="line" className="w-full justify-start mb-4 sticky top-0 bg-[#0A0A0A] z-10">
              <TabsTrigger value="runs" className="text-xs">
                <ScrollText className="w-3 h-3 mr-1" />
                Runs
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs">
                <Terminal className="w-3 h-3 mr-1" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs">
                <BarChart3 className="w-3 h-3 mr-1" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="queue" className="text-xs">
                <ListOrdered className="w-3 h-3 mr-1" />
                Queue
              </TabsTrigger>
            </TabsList>

            <TabsContent value="runs">
              <DeviceRunsTab device={device} />
            </TabsContent>
            <TabsContent value="logs">
              <DeviceLogsTab device={device} currentRunId={device.currentRunId} />
            </TabsContent>
            <TabsContent value="stats">
              <DeviceStatsTab device={device} />
            </TabsContent>
            <TabsContent value="queue">
              <DeviceQueueTab device={device} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
