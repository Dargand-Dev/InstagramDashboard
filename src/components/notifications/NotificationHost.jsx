import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { contentIssueKey } from '@/stores/notificationState'
import ContentIssueDialog from './ContentIssueDialog'

export default function NotificationHost({ subscribe, isConnected }) {
  const token = useAuthStore((state) => state.token)
  const { addNotification, fetchNotifications, reset } = useNotificationStore()

  useEffect(() => {
    if (!token) return
    fetchNotifications()
    return reset
  }, [token, fetchNotifications, reset])

  useEffect(() => {
    if (!token) return
    return subscribe('/topic/notifications', (notification) => {
      const isNew = addNotification(notification)
      if (isNew && !contentIssueKey(notification)) {
        toast(notification.title || 'Nouvelle notification', { description: notification.message })
      }
    })
  }, [token, subscribe, addNotification])

  useEffect(() => {
    if (isConnected) fetchNotifications()
  }, [isConnected, fetchNotifications])

  return <ContentIssueDialog />
}
