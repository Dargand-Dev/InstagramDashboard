import assert from 'node:assert/strict'
import test from 'node:test'
import { createStore } from 'zustand/vanilla'
import { createNotificationState } from './notificationState.js'

const notification = (id, overrides = {}) => ({
  id, title: 'Vidéo invalide', read: false, timestamp: '2026-09-27T12:00:00Z',
  contentIssue: { code: 'MISSING_TEMPLATE', driveFileId: 'drive-1', runId: 'run-1', filename: 'reel.mp4', trashed: false },
  ...overrides,
})
const makeStore = (fetchList = async () => []) => createStore(createNotificationState(fetchList))

for (const trashed of [false, true]) {
  test(`missing-template event remains unread without opening a modal (trashed=${trashed})`, () => {
    const store = makeStore()
    const incoming = notification('n1')
    incoming.contentIssue.trashed = trashed
    assert.equal(store.getState().addNotification(incoming), true)
    assert.equal(store.getState().notifications.length, 1)
    assert.equal(store.getState().unreadCount, 1)
    assert.deepEqual(store.getState().contentAlertQueue, [])
  })
}

test('historical missing-template notifications do not open a modal on fetch or reconnect', async () => {
  const store = makeStore(async () => [notification('legacy')])
  await store.getState().fetchNotifications()
  await store.getState().fetchNotifications()
  assert.deepEqual(store.getState().notifications.map((n) => n.id), ['legacy'])
  assert.equal(store.getState().unreadCount, 1)
  assert.deepEqual(store.getState().contentAlertQueue, [])
})

test('replayed events and duplicate run/file events produce one unread item without a modal', () => {
  const store = makeStore()
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(notification('n2'))
  assert.equal(store.getState().notifications.length, 1)
  assert.equal(store.getState().unreadCount, 1)
  assert.deepEqual(store.getState().contentAlertQueue, [])
})

test('late initial fetch retains a live event and its local read state', async () => {
  let finishFetch
  const store = makeStore(() => new Promise((resolve) => { finishFetch = resolve }))
  const fetching = store.getState().fetchNotifications()
  store.getState().addNotification(notification('live'))
  store.getState().markRead('live')
  finishFetch([notification('old', { contentIssue: null }), notification('live')])
  await fetching
  assert.equal(store.getState().notifications.length, 2)
  assert.equal(store.getState().notifications.find((n) => n.id === 'live').read, true)
  assert.equal(store.getState().unreadCount, 1)
})

test('dismissal survives repeated events and fetches, with explicit reopening allowed', async () => {
  const store = makeStore(async () => [notification('n1')])
  await store.getState().fetchNotifications()
  store.getState().openContentIssue('n1')
  const key = store.getState().contentAlertQueue[0]
  assert.equal(key, '["MISSING_TEMPLATE","run-1","drive-1"]')
  store.getState().dismissContentIssue(key)
  store.getState().addNotification(notification('n1'))
  await store.getState().fetchNotifications()
  assert.deepEqual(store.getState().contentAlertQueue, [])
  store.getState().openContentIssue('n1')
  assert.deepEqual(store.getState().contentAlertQueue, [key])
})

test('marking read twice does not decrement another unread notification', () => {
  const store = makeStore()
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(notification('n2', { contentIssue: null }))
  store.getState().markRead('n1')
  store.getState().markRead('n1')
  assert.equal(store.getState().unreadCount, 1)
})

test('trash success updates every run for a file and suppresses queued repeats', () => {
  const store = makeStore()
  const second = notification('n2')
  second.contentIssue.runId = 'run-2'
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(second)
  store.getState().openContentIssue('n2')
  store.getState().openContentIssue('n1')
  const activeKey = store.getState().contentAlertQueue[0]
  store.getState().markDriveFileTrashed('drive-1')
  assert.ok(store.getState().notifications.every((n) => n.contentIssue.trashed))
  assert.deepEqual(store.getState().contentAlertQueue, [activeKey])
  store.getState().dismissContentIssue(activeKey)
  store.getState().addNotification(notification('n1'))
  assert.deepEqual(store.getState().contentAlertQueue, [])
  assert.ok(store.getState().notifications.every((n) => n.contentIssue.trashed))
})

test('read, trashed and ordinary notifications do not auto-open', async () => {
  const trashed = notification('trashed')
  trashed.contentIssue.trashed = true
  trashed.contentIssue.driveFileId = 'other-file'
  const store = makeStore(async () => [notification('read', { read: true }), trashed, notification('normal', { contentIssue: null })])
  await store.getState().fetchNotifications()
  assert.deepEqual(store.getState().contentAlertQueue, [])
})

test('a remote trash event updates the open alert and removes queued alerts for that file', () => {
  const store = makeStore()
  store.getState().addNotification(notification('n1'))
  const anotherRun = notification('n2')
  anotherRun.contentIssue.runId = 'run-2'
  store.getState().addNotification(anotherRun)
  store.getState().openContentIssue('n2')
  store.getState().openContentIssue('n1')
  const activeKey = store.getState().contentAlertQueue[0]
  const trashed = notification('n1')
  trashed.contentIssue.trashed = true
  store.getState().addNotification(trashed)
  assert.deepEqual(store.getState().contentAlertQueue, [activeKey])
  assert.ok(store.getState().notifications.every((n) => n.contentIssue.trashed))
})

test('a fetch started before session reset cannot restore previous notifications', async () => {
  let finishFetch
  const store = makeStore(() => new Promise((resolve) => { finishFetch = resolve }))
  const fetching = store.getState().fetchNotifications()
  store.getState().reset()
  finishFetch([notification('n1')])
  await fetching
  assert.deepEqual(store.getState().notifications, [])
})
