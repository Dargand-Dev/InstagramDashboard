import { create } from 'zustand'
import { apiGet } from '@/lib/api'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    }))
  },

  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  fetchNotifications: async () => {
    try {
      const res = await apiGet('/api/notifications')
      const list = res.data || res || []
      set({
        notifications: list,
        unreadCount: list.filter((n) => !n.read).length,
      })
    } catch {
      // silent fail on notification fetch
    }
  },
}))
