import { Rocket, Layers } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi } from '@/hooks/useApi'
import LockStatusBadge from '@/components/actions/LockStatusBadge'
import QuickActionsDropdown from '@/components/actions/QuickActionsDropdown'
import PostingRunTab from '@/components/actions/PostingRunTab'
import AccountCreationTab from '@/components/actions/AccountCreationTab'

export default function Actions() {
  const { data: accounts } = useApi('/api/accounts')
  const { data: devicesData } = useApi('/api/devices')
  const { data: actionsData } = useApi('/api/automation/actions')
  const { data: lockStatus, refetch: refreshLock } = useApi('/api/automation/lock-status', {
    initialData: null,
  })

  const devices = Array.isArray(devicesData) ? devicesData : []
  const accountList = accounts || []
  const actionsList = actionsData?.actions || []

  // Normalize lock status
  const normalizedLock = lockStatus ? {
    locked: lockStatus.locked || false,
    devices: lockStatus.devices || (lockStatus.currentExecution ? { [lockStatus.currentExecution.deviceId]: lockStatus.currentExecution } : {}),
    totalLocked: lockStatus.totalLocked || (lockStatus.locked ? 1 : 0),
    ...lockStatus,
  } : null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Actions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Execute automation actions and workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <LockStatusBadge lockStatus={normalizedLock} onRefresh={refreshLock} />
          <QuickActionsDropdown devices={devices} accounts={accountList} actionsList={actionsList} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posting" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="posting" className="gap-1.5 text-xs">
            <Rocket size={14} />
            Posting Run
          </TabsTrigger>
          <TabsTrigger value="creation" className="gap-1.5 text-xs">
            <Layers size={14} />
            Account Creation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posting">
          <PostingRunTab
            devices={devices}
            accounts={accountList}
            lockStatus={normalizedLock}
            onRefreshLock={refreshLock}
          />
        </TabsContent>

        <TabsContent value="creation">
          <AccountCreationTab devices={devices} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
