export function contentIssueKey(notification) {
  const issue = notification?.contentIssue
  if (issue?.code !== 'MISSING_TEMPLATE' || !issue.driveFileId) return null
  return JSON.stringify([issue.code, issue.runId || notification.id, issue.driveFileId])
}

function withNotifications(state, notifications) {
  const byIssueKey = new Map(notifications.map((notification) => [contentIssueKey(notification), notification]))
  const contentAlertQueue = state.contentAlertQueue.filter((key, index) => {
    const notification = byIssueKey.get(key)
    return notification && (index === 0 || (!notification.read && !notification.contentIssue.trashed))
  })
  for (const notification of notifications) {
    const key = contentIssueKey(notification)
    if (key && !notification.read && !notification.contentIssue.trashed
      && !state.dismissedIssueKeys.includes(key) && !contentAlertQueue.includes(key)) {
      contentAlertQueue.push(key)
    }
  }
  return { notifications, unreadCount: notifications.filter((n) => !n.read).length, contentAlertQueue }
}

function mergeNotifications(state, incoming, preferExisting = false) {
  const notifications = []
  // Un fetch initial tardif ne doit pas écraser un événement ou une action locale.
  const ordered = preferExisting
    ? [...incoming, ...state.notifications]
    : [...state.notifications, ...incoming]
  const trashedFiles = new Set(ordered.filter((n) => n?.contentIssue?.trashed).map((n) => n.contentIssue.driveFileId))
  for (const notification of ordered) {
    if (!notification?.id || state.deletedIds.includes(notification.id)) continue
    const key = contentIssueKey(notification)
    const index = notifications.findIndex((n) => n.id === notification.id || (key && contentIssueKey(n) === key))
    const previous = notifications[index]
    const merged = { ...previous, ...notification, read: Boolean(previous?.read || notification.read) }
    if (notification.contentIssue) {
      merged.contentIssue = { ...previous?.contentIssue, ...notification.contentIssue, trashed: trashedFiles.has(notification.contentIssue.driveFileId) }
    }
    if (index === -1) notifications.push(merged)
    else notifications[index] = merged
  }
  notifications.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
  return withNotifications(state, notifications.slice(0, 100))
}

const initialState = () => ({
  notifications: [], unreadCount: 0, contentAlertQueue: [], dismissedIssueKeys: [], deletedIds: [],
})

export function createNotificationState(fetchList) {
  let sessionGeneration = 0
  return (set, get) => ({
    ...initialState(),

    addNotification: (notification) => {
      const key = contentIssueKey(notification)
      const isNew = !get().notifications.some((n) => n.id === notification?.id || (key && contentIssueKey(n) === key))
      set((state) => mergeNotifications(state, [notification]))
      return isNew
    },

    markRead: (id) => set((state) => withNotifications(state,
      state.notifications.map((n) => n.id === id ? { ...n, read: true } : n))),

    markAllRead: () => set((state) => withNotifications(state,
      state.notifications.map((n) => ({ ...n, read: true })))),

    removeNotification: (id) => set((state) => ({
      ...withNotifications(state, state.notifications.filter((n) => n.id !== id)),
      deletedIds: [...state.deletedIds, id],
    })),

    dismissContentIssue: (key) => set((state) => ({
      contentAlertQueue: state.contentAlertQueue.filter((item) => item !== key),
      dismissedIssueKeys: [...new Set([...state.dismissedIssueKeys, key])],
    })),

    openContentIssue: (id) => set((state) => {
      const key = contentIssueKey(state.notifications.find((n) => n.id === id))
      return key ? { contentAlertQueue: [key, ...state.contentAlertQueue.filter((item) => item !== key)] } : {}
    }),

    markDriveFileTrashed: (driveFileId) => set((state) => {
      const affectedKeys = state.notifications.filter((n) => n.contentIssue?.driveFileId === driveFileId).map(contentIssueKey)
      const notifications = state.notifications.map((n) => n.contentIssue?.driveFileId === driveFileId
        ? { ...n, contentIssue: { ...n.contentIssue, trashed: true } } : n)
      return {
        notifications,
        // La modale active reste ouverte pour afficher le résultat de l'action.
        contentAlertQueue: state.contentAlertQueue.filter((key, index) => index === 0 || !affectedKeys.includes(key)),
        dismissedIssueKeys: [...new Set([...state.dismissedIssueKeys, ...affectedKeys])],
      }
    }),

    fetchNotifications: async () => {
      const generation = sessionGeneration
      try {
        const response = await fetchList()
        const list = response?.data || response || []
        if (generation === sessionGeneration && Array.isArray(list)) {
          set((state) => mergeNotifications(state, list, true))
        }
      } catch {
        // La prochaine connexion WebSocket relance la synchronisation.
      }
    },

    reset: () => {
      sessionGeneration += 1
      set(initialState())
    },
  })
}
