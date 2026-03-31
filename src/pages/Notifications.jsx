import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useNotificationStore } from '@/stores/notificationStore'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import TimeAgo from '@/components/shared/TimeAgo'
import EmptyState from '@/components/shared/EmptyState'
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  User,
  Smartphone,
  Settings,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TYPE_CONFIG = {
  ERROR: { icon: AlertCircle, color: '#EF4444', bg: 'bg-[#EF4444]/10' },
  WARNING: { icon: AlertTriangle, color: '#F59E0B', bg: 'bg-[#F59E0B]/10' },
  SUCCESS: { icon: CheckCircle, color: '#22C55E', bg: 'bg-[#22C55E]/10' },
  INFO: { icon: Info, color: '#3B82F6', bg: 'bg-[#3B82F6]/10' },
}

const CATEGORY_CONFIG = {
  EXECUTION: { icon: Zap, label: 'Execution' },
  ACCOUNT: { icon: User, label: 'Account' },
  DEVICE: { icon: Smartphone, label: 'Device' },
  SYSTEM: { icon: Settings, label: 'System' },
}

const FILTER_TABS = ['All', 'Unread', 'Execution', 'Account', 'Device', 'System']

function NotificationRow({ notification, onMarkRead, onDelete }) {
  const isUnread = !notification.read
  const type = TYPE_CONFIG[notification.type] || TYPE_CONFIG.INFO
  const category = CATEGORY_CONFIG[notification.category] || CATEGORY_CONFIG.SYSTEM
  const TypeIcon = type.icon

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-[#1a1a1a] last:border-0',
        isUnread ? 'bg-[#111111]/50' : 'hover:bg-[#111111]/30'
      )}
      onClick={() => isUnread && onMarkRead(notification.id)}
    >
      {/* Unread dot */}
      <div className="pt-1.5 w-2 shrink-0">
        {isUnread && <span className="block w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />}
      </div>

      {/* Type icon */}
      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5', type.bg)}>
        <TypeIcon className="w-3.5 h-3.5" style={{ color: type.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={cn('text-sm font-medium truncate', isUnread ? 'text-[#FAFAFA]' : 'text-[#A1A1AA]')}>
            {notification.title || 'Notification'}
          </p>
        </div>
        {notification.message && (
          <p className="text-xs text-[#52525B] line-clamp-2 mb-1">{notification.message}</p>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-[#1a1a1a] text-[#52525B] h-4 px-1.5">
            <category.icon className="w-2.5 h-2.5 mr-0.5" />
            {category.label}
          </Badge>
          <TimeAgo date={notification.createdAt || notification.timestamp} className="text-[10px] text-[#52525B]" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[#52525B] hover:text-[#A1A1AA]"
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id) }}
            aria-label="Mark as read"
          >
            <CheckCheck className="w-3 h-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-[#52525B] hover:text-[#EF4444]"
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id) }}
          aria-label="Delete notification"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

export default function Notifications() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('All')
  const { subscribe, isConnected } = useWebSocket()
  const { notifications, unreadCount, addNotification, markRead, markAllRead, fetchNotifications } = useNotificationStore()
  const scrollRef = useRef(null)

  // Fetch on mount
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // WebSocket subscription for real-time notifications
  useEffect(() => {
    if (!isConnected) return
    const unsub = subscribe('/topic/notifications', (notification) => {
      addNotification(notification)
      toast(notification.title || 'New notification', {
        description: notification.message,
      })
    })
    return unsub
  }, [isConnected, subscribe, addNotification])

  const handleMarkRead = (id) => {
    markRead(id)
    apiPut(`/api/notifications/${id}/read`).catch(() => toast.error('Failed to mark as read'))
  }

  const handleMarkAllRead = () => {
    markAllRead()
    apiPut('/api/notifications/read-all').catch(() => toast.error('Action failed'))
  }

  const handleDelete = (id) => {
    useNotificationStore.setState((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: state.notifications.find((n) => n.id === id && !n.read)
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }))
    apiDelete(`/api/notifications/${id}`).catch(() => toast.error('Failed to delete notification'))
  }

  const filtered = useMemo(() => {
    switch (filter) {
      case 'Unread': return notifications.filter((n) => !n.read)
      case 'Execution': return notifications.filter((n) => n.category === 'EXECUTION')
      case 'Account': return notifications.filter((n) => n.category === 'ACCOUNT')
      case 'Device': return notifications.filter((n) => n.category === 'DEVICE')
      case 'System': return notifications.filter((n) => n.category === 'SYSTEM')
      default: return notifications
    }
  }, [notifications, filter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Notifications</h1>
          <p className="text-sm text-[#52525B] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="w-4 h-4 mr-1.5" /> Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const count = tab === 'Unread'
            ? unreadCount
            : tab === 'All'
            ? notifications.length
            : notifications.filter((n) => n.category === tab.toUpperCase()).length

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5',
                filter === tab
                  ? 'bg-[#3B82F6]/10 text-[#3B82F6]'
                  : 'text-[#52525B] hover:text-[#A1A1AA] hover:bg-[#111111]'
              )}
            >
              {tab}
              {count > 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  filter === tab ? 'bg-[#3B82F6]/20 text-[#3B82F6]' : 'bg-[#1a1a1a] text-[#52525B]'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notifications list */}
      <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={filter === 'Unread' ? CheckCheck : BellOff}
            title={filter === 'Unread' ? 'All caught up' : 'No notifications'}
            description={
              filter === 'Unread'
                ? 'You have no unread notifications.'
                : filter !== 'All'
                ? `No ${filter.toLowerCase()} notifications.`
                : 'Notifications will appear here when events occur.'
            }
          />
        ) : (
          <ScrollArea className="max-h-[calc(100vh-16rem)]" ref={scrollRef}>
            {filtered.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
