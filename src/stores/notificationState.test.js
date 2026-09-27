import assert from 'node:assert/strict'
import test from 'node:test'
import { createStore } from 'zustand/vanilla'
import { blockingContentIssues, createNotificationState } from './notificationState.js'

const notification = (id, overrides = {}) => ({
  id, title: 'Vidéo invalide', read: false, timestamp: '2026-09-27T12:00:00Z',
  contentIssue: { code: 'MISSING_TEMPLATE', driveFileId: 'drive-1', runId: 'run-1', filename: 'reel.mp4', trashed: false },
  ...overrides,
})
const makeStore = (fetchList = async () => []) => createStore(createNotificationState(fetchList))

test('blocking banner survives reading and dismissing the popup', () => {
  const store = makeStore()
  store.getState().addNotification(notification('n1'))
  const key = store.getState().contentAlertQueue[0]
  store.getState().dismissContentIssue(key)
  store.getState().markAllRead()
  const issues = blockingContentIssues(store.getState().notifications)
  assert.deepEqual(issues.map((n) => n.id), ['n1'])
})

test('blocking banner groups the same video across runs but keeps distinct files', () => {
  const first = notification('n1')
  const nextRun = notification('n2')
  nextRun.contentIssue.runId = 'run-2'
  const anotherFile = notification('n3')
  anotherFile.contentIssue.driveFileId = 'drive-2'
  assert.deepEqual(blockingContentIssues([nextRun, first, anotherFile])
    .map((n) => n.id), ['n2', 'n3'])
})

test('blocking banner removes a trashed file and ignores ordinary notifications', () => {
  const store = makeStore()
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(notification('normal', { contentIssue: null }))
  const trashed = notification('n1')
  trashed.contentIssue.trashed = true
  store.getState().addNotification(trashed)
  assert.deepEqual(blockingContentIssues(store.getState().notifications), [])
})

test('replayed events and duplicate run/file events produce one alert and one unread item', () => {
  const store = makeStore()
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(notification('n1'))
  store.getState().addNotification(notification('n2'))
  assert.equal(store.getState().notifications.length, 1)
  assert.equal(store.getState().unreadCount, 1)
  assert.equal(store.getState().contentAlertQueue.length, 1)
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
  const key = store.getState().contentAlertQueue[0]
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
