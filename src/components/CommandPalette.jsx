import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Zap,
  ListOrdered,
  Clapperboard,
  Smartphone,
  Users,
  AlertTriangle,
  Bell,
  ScrollText,
  TrendingUp,
  FileText,
  CalendarDays,
  Settings,
  Play,
  UserPlus,
  Upload,
} from 'lucide-react'
import { apiGet } from '@/lib/api'

const PAGES = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Execution Center', path: '/execution-center', icon: Zap },
  { label: 'Queue', path: '/queue', icon: ListOrdered },
  { label: 'Actions', path: '/actions', icon: Clapperboard },
  { label: 'Devices', path: '/devices', icon: Smartphone },
  { label: 'Accounts', path: '/accounts', icon: Users },
  { label: 'Error Center', path: '/error-center', icon: AlertTriangle },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Activity Log', path: '/activity-log', icon: ScrollText },
  { label: 'Growth & Stats', path: '/analytics', icon: TrendingUp },
  { label: 'Posting History', path: '/posting-history', icon: FileText },
  { label: 'Schedule', path: '/schedule', icon: CalendarDays },
  { label: 'Settings', path: '/settings', icon: Settings },
]

const ACTIONS = [
  { label: 'Start Account Creation Run', icon: UserPlus, action: 'create-accounts' },
  { label: 'Start Reel Posting Run', icon: Upload, action: 'post-reels' },
  { label: 'Start Story Posting Run', icon: Play, action: 'post-stories' },
]

const RECENT_KEY = 'cmd_recent_searches'

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])

  // Keyboard shortcut
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [onOpenChange])

  // Fetch accounts for search
  useEffect(() => {
    if (!open) return
    apiGet('/api/accounts')
      .then((res) => setAccounts((res.data || res || []).slice(0, 50)))
      .catch(() => {})
  }, [open])

  const runCommand = useCallback(
    (callback) => {
      onOpenChange(false)
      callback()
    },
    [onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, accounts, actions..." className="text-[#FAFAFA]" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGES.map((page) => (
            <CommandItem
              key={page.path}
              onSelect={() => runCommand(() => navigate(page.path))}
              className="text-[#A1A1AA] data-[selected=true]:text-[#FAFAFA]"
            >
              <page.icon className="mr-2 h-4 w-4" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {ACTIONS.map((action) => (
            <CommandItem
              key={action.action}
              onSelect={() => runCommand(() => navigate('/actions', { state: { action: action.action } }))}
              className="text-[#A1A1AA] data-[selected=true]:text-[#FAFAFA]"
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Accounts">
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  onSelect={() => runCommand(() => navigate(`/accounts`, { state: { accountId: account.id } }))}
                  className="text-[#A1A1AA] data-[selected=true]:text-[#FAFAFA]"
                >
                  <Users className="mr-2 h-4 w-4" />
                  {account.username || account.name || `Account #${account.id}`}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
