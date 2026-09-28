import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTimelineRows } from './timelineData.js'

const NOW = Date.parse('2026-09-28T12:00:00Z')

test('active batch segments preserve done, failed and growing running intervals', () => {
  const run = {
    runId: 'wf-live', workflowName: 'PostReel', deviceName: 'Phone 1',
    status: 'RUNNING', startedAt: '2026-09-28T11:00:00Z',
    accountEntries: [
      { containerName: 'done', status: 'COMPLETED', startedAt: '2026-09-28T11:02:00Z', completedAt: '2026-09-28T11:12:00Z' },
      { containerName: 'failed', status: 'FAILED', startedAt: '2026-09-28T11:15:00Z', completedAt: '2026-09-28T11:25:00Z' },
      { containerName: 'live', status: 'RUNNING', startedAt: '2026-09-28T11:30:00Z' },
      { containerName: 'pending', status: 'PENDING' },
    ],
  }
  const [row] = buildTimelineRows([run], NOW)
  assert.equal(row.name, 'PostReel')
  assert.equal(row.device, 'Phone 1')
  assert.equal(row.duration, 3600000)
  assert.deepEqual(row.segments.map(({ name, status, duration }) => ({ name, status, duration })), [
    { name: 'done', status: 'COMPLETED', duration: 600000 },
    { name: 'failed', status: 'FAILED', duration: 600000 },
    { name: 'live', status: 'RUNNING', duration: 1800000 },
  ])
  const [later] = buildTimelineRows([run], NOW + 60000)
  assert.equal(later.segments[0].duration, 600000)
  assert.equal(later.segments[2].duration, 1860000)
})

test('history uses startTime and endTime with success and failure counts', () => {
  const rows = buildTimelineRows([
    { runId: 'run-ok', workflowRunId: 'wf-ok', workflowType: 'CreateAccount', deviceUdid: 'udid-1', startTime: '2026-09-28T10:00:00Z', endTime: '2026-09-28T10:10:00Z', successCount: 1, failureCount: 0, accountResults: [{ status: 'SUCCESS', durationMs: 120000 }] },
    { runId: 'run-mixed', startTime: '2026-09-28T10:20:00Z', endTime: '2026-09-28T10:30:00Z', successCount: 1, failureCount: 1 },
  ], NOW)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].runId, 'wf-ok')
  assert.equal(rows[0].name, 'CreateAccount')
  assert.equal(rows[0].device, 'udid-1')
  assert.equal(rows[0].status, 'COMPLETED')
  assert.equal(rows[0].duration, 600000)
  assert.equal(rows[0].segments.length, 1)
  assert.equal(rows[0].segments[0].duration, 600000)
  assert.equal(rows[1].status, 'FAILED')
})

test('completed history replaces a stale active copy without moving other active rows', () => {
  const runs = [
    { runId: 'wf-first', startedAt: '2026-09-28T11:00:00Z', status: 'RUNNING' },
    { runId: 'wf-finished', startedAt: '2026-09-28T10:00:00Z', status: 'RUNNING' },
    { runId: 'wf-last', startedAt: '2026-09-28T11:30:00Z', status: 'RUNNING' },
    { runId: 'run-random', workflowRunId: 'wf-finished', startTime: '2026-09-28T10:00:00Z', endTime: '2026-09-28T10:20:00Z', failureCount: 1 },
  ]
  const rows = buildTimelineRows(runs, NOW)
  assert.deepEqual(rows.map(row => row.runId), ['wf-first', 'wf-finished', 'wf-last'])
  assert.equal(rows[1].status, 'FAILED')
  assert.equal(rows[1].duration, 1200000)
  const reversed = buildTimelineRows([...runs].reverse(), NOW)
  assert.equal(reversed.find(row => row.runId === 'wf-finished').status, 'FAILED')
})

test('a running retry ignores its stale completedAt from the previous failed attempt', () => {
  const [row] = buildTimelineRows([{
    runId: 'wf-retry', startedAt: '2026-09-28T11:00:00Z', status: 'RUNNING',
    accountEntries: [{ containerName: 'retry', status: 'running', startedAt: '2026-09-28T11:40:00Z', completedAt: '2026-09-28T11:20:00Z' }],
  }], NOW)
  assert.equal(row.segments[0].name, 'retry')
  assert.equal(row.segments[0].status, 'RUNNING')
  assert.equal(row.segments[0].duration, 1200000)
})

test('pending and unstarted skipped accounts do not acquire fabricated intervals', () => {
  const [row] = buildTimelineRows([{
    runId: 'wf-wait', startedAt: '2026-09-28T11:00:00Z', status: 'RUNNING',
    accountEntries: [
      { containerName: 'done', status: 'COMPLETED', startedAt: '2026-09-28T11:05:00Z', completedAt: '2026-09-28T11:10:00Z' },
      { containerName: 'pending', status: 'PENDING', startedAt: '2026-09-28T11:12:00Z' },
      { containerName: 'skip', status: 'SKIPPED', startedAt: null, completedAt: '2026-09-28T11:15:00Z' },
      { containerName: 'waiting', status: 'WAITING_RETRY', startedAt: '2026-09-28T11:20:00Z', completedAt: '2026-09-28T11:25:00Z' },
    ],
  }], NOW)
  assert.deepEqual(row.segments.map(segment => segment.name), ['done', 'waiting'])
  assert.equal(row.segments[1].status, 'WAITING_RETRY')
  assert.equal(row.segments[1].duration, 300000)
})

test('invalid run and account dates are omitted and valid segments clip to run bounds', () => {
  const rows = buildTimelineRows([
    { runId: 'invalid', startedAt: 'invalid' },
    { runId: 'future', startedAt: '2026-09-28T13:00:00Z' },
    { runId: 'backward', startTime: '2026-09-28T11:00:00Z', endTime: '2026-09-28T10:00:00Z' },
    { runId: 'bad-end', startTime: '2026-09-28T11:00:00Z', endTime: 'bad' },
    { runId: 'clipped', startedAt: '2026-09-28T11:00:00Z', completedAt: '2026-09-28T11:50:00Z', status: 'COMPLETED', accountEntries: [
      { containerName: 'invalid', status: 'FAILED', startedAt: 'bad', completedAt: '2026-09-28T11:10:00Z' },
      { containerName: 'backward', status: 'FAILED', startedAt: '2026-09-28T11:20:00Z', completedAt: '2026-09-28T11:10:00Z' },
      { containerName: 'valid', status: 'COMPLETED', startedAt: '2026-09-28T10:50:00Z', completedAt: '2026-09-28T12:05:00Z' },
    ] },
  ], NOW)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].segments.length, 1)
  assert.equal(rows[0].segments[0].name, 'valid')
  assert.equal(rows[0].segments[0].start, Date.parse('2026-09-28T11:00:00Z'))
  assert.equal(rows[0].segments[0].end, Date.parse('2026-09-28T11:50:00Z'))
})

test('history containing only skipped results is gray despite the backend failure count', () => {
  const [row] = buildTimelineRows([{
    runId: 'run-skipped', startTime: '2026-09-28T11:00:00Z', endTime: '2026-09-28T11:01:00Z',
    successCount: 0, failureCount: 2, accountResults: [{ status: 'SKIPPED' }, { status: 'SKIPPED' }],
  }], NOW)
  assert.equal(row.status, 'SKIPPED')
})

test('skipped accounts do not turn a successful history red or conceal actual failures', () => {
  const history = {
    runId: 'run-mixed', startTime: '2026-09-28T11:00:00Z', endTime: '2026-09-28T11:10:00Z',
    totalAccounts: 2, successCount: 1, failureCount: 1,
    accountResults: [{ status: 'SUCCESS' }, { status: 'SKIPPED' }],
  }
  assert.equal(buildTimelineRows([history], NOW)[0].status, 'COMPLETED')
  assert.equal(buildTimelineRows([{ ...history, totalAccounts: 3, failureCount: 2,
    accountResults: [...history.accountResults, { status: 'ABORTED' }],
  }], NOW)[0].status, 'FAILED')
  assert.equal(buildTimelineRows([{ ...history, totalAccounts: 3, failureCount: 2 }], NOW)[0].status, 'FAILED')
})

test('empty or malformed collections are safe and unrelated runs without ids remain separate', () => {
  assert.deepEqual(buildTimelineRows(null, NOW), [])
  assert.deepEqual(buildTimelineRows({}, NOW), [])
  const rows = buildTimelineRows([null, {},
    { startedAt: '2026-09-28T11:00:00Z', accountEntries: {} },
    { startedAt: '2026-09-28T11:30:00Z' },
  ], NOW)
  assert.equal(rows.length, 2)
  assert.notEqual(rows[0].runId, rows[1].runId)
  assert.equal(rows[0].segments.length, 1)
  assert.equal(rows[0].status, 'RUNNING')
})
