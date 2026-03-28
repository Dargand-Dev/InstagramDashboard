import { useState } from 'react'
import { Lock, LockOpen, Unlock, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { apiPost } from '@/hooks/useApi'

export default function LockStatusBadge({ lockStatus, onRefresh }) {
  const [unlockLoading, setUnlockLoading] = useState(false)

  const totalLocked = lockStatus?.totalLocked || 0
  const isLocked = lockStatus?.locked || totalLocked > 0
  const devices = lockStatus?.devices || {}

  async function handleUnlock(deviceUdid) {
    setUnlockLoading(true)
    try {
      await apiPost('/api/automation/force-unlock', deviceUdid ? { deviceUdid } : {})
      onRefresh?.()
    } catch { /* ignore */ }
    finally { setUnlockLoading(false) }
  }

  if (!lockStatus) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card hover:bg-accent transition-colors text-xs font-medium">
          <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {isLocked ? (
            <span className="text-amber-400 flex items-center gap-1">
              <Lock size={12} />
              {totalLocked} locked
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1">
              <LockOpen size={12} />
              Unlocked
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Lock Status</span>
            {isLocked && (
              <Button
                size="sm"
                variant="destructive"
                className="h-6 text-[10px] px-2"
                disabled={unlockLoading}
                onClick={() => handleUnlock()}
              >
                {unlockLoading ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />}
                Unlock All
              </Button>
            )}
          </div>
        </div>
        <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
          {Object.keys(devices).length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-2">No active locks</p>
          ) : (
            Object.entries(devices).map(([deviceId, info]) => (
              <div key={deviceId} className="flex items-center justify-between rounded-md bg-accent/50 px-2.5 py-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-foreground font-mono">
                    ...{deviceId.slice(-8)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {info.action} &middot; {info.elapsedSeconds}s
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[10px] text-destructive hover:text-destructive px-1.5"
                  disabled={unlockLoading}
                  onClick={() => handleUnlock(deviceId)}
                >
                  Unlock
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
