import { create } from 'zustand'
import { apiGet } from '@/lib/api'
import { createNotificationState } from './notificationState.js'

export const useNotificationStore = create(createNotificationState(() => apiGet('/api/notifications')))
