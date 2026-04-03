import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import LogViewer from '@/components/shared/LogViewer'
import { useRunLogs } from '@/hooks/useRunLogs'
import { Skeleton } from '@/components/ui/skeleton'
import { Terminal } from 'lucide-react'

export default function RunLogModal({ runId, open, onClose }) {
  const { data: logText, isLoading, isError } = useRunLogs(open ? runId : null)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#0A0A0A] border border-[#1a1a1a] sm:max-w-5xl w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden"
        showCloseButton
      >
        <DialogHeader className="border-b border-[#1a1a1a] pb-3">
          <DialogTitle className="text-[#FAFAFA] flex items-center gap-2 text-sm">
            <Terminal className="w-4 h-4 text-[#A1A1AA]" />
            Logs — {runId}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 pt-3">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
              ))}
            </div>
          ) : isError || !logText ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-[#52525B]">Pas de logs disponibles pour ce run.</p>
            </div>
          ) : (
            <LogViewer text={logText} follow={false} height={Math.min(600, window.innerHeight * 0.65)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
