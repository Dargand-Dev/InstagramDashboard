# Activity Log — Live Logs in `RunLogModal`

## Context

Today, the **Activity Log** page (`src/pages/ActivityLog.jsx`) surfaces per-device sheets (`DeviceDetailSheet`) with a **Runs** tab (`DeviceRunsTab`). Each row (`RunRow`) exposes a **Logs** button that opens `RunLogModal`, backed by `useRunLogs(runId)` which calls `GET /api/automation/runs/{runId}/logs` — a post-mortem endpoint that returns the Spring Boot logs persisted by `RunLogPersistenceService.flushRunLogs()` **at the end of the run**.

During an active run, this modal therefore shows either empty or stale content, because the persisted document does not exist yet. Live logs today only exist in:

- `ExecutionCenter` (per-card toggle, WebSocket topic `/topic/executions/{runId}/logs` with SSE fallback `/api/automation/workflow/logs/stream` — using a **structured `WorkflowLogEvent` format**, not the raw Spring Boot format).
- `DeviceDetailSheet` > **Logs** tab (`DeviceLogsTab`, using the same structured stream per device).

The user wants the **exact same experience as the post-mortem view** (same format, same `LogViewer`, same filters) to be available while a run is active, directly inside the Activity Log entry points. The feature must also hold when a run is stopped gracefully or killed — logs that were captured up to that point must remain visible, and the transition must be seamless.

## Goals

- Inside Activity Log, clicking **Logs** shows the **raw Spring Boot log format** (same as the post-mortem view) whether the run is active or terminated.
- When the run is active: the modal displays the full buffered history from the beginning of the run, then streams new lines in real time.
- When the run terminates (including `COMPLETED`, `FAILED`, `CANCELLED`): the modal transitions cleanly to the persisted view to guarantee that no late lines are lost.
- The user can **Stop Gracefully** or **Kill** an active run directly from the modal header.
- The Activity Log active-run block (the blue banner at the top of `DeviceRunsTab`) gains a **Logs** entry point so live logs are reachable even before the run appears in the persisted runs list.
- `ExecutionCenter` is **not** modified.

## Non-goals

- Filtering logs per individual account inside a run. The MDC is already `runId`-scoped (not `username`-scoped), and YAGNI — users can `Ctrl+F` in the viewer.
- Introducing per-line sequence numbers / resume-from-offset on SSE reconnect. Acceptable degradation: reconnect re-runs `snapshot` and may show brief duplication.
- Changing the existing `WorkflowLogEvent` stream used by `DeviceLogsTab` and `ExecutionCenter`.
- Changing the authentication posture of SSE endpoints. `SecurityConfig` currently uses `anyRequest().permitAll()`; this feature matches that posture (same as `useWorkflowLogs`/`useDeviceLogs`).

## User-visible behavior

### Entry points (Activity Log only)

1. **Terminated run in the runs list** — `RunRow` shows the existing **Logs** button when `run.workflowRunId` is present. Clicking opens `RunLogModal` in **persisted** mode (unchanged behavior).
2. **Active run banner** (at the top of `DeviceRunsTab` when `deviceActiveRun` is set) — a new **Logs** button is added next to the **Stop** button. Clicking opens `RunLogModal` in **live** mode.

The page `src/pages/RunLogs.jsx` (full-page variant of the modal, reachable via the modal's **Full Page** button) gets the same live-aware behavior.

### Modal states

| State             | Condition                                                | Source                                    | Badge       | Stop/Kill buttons |
| ----------------- | -------------------------------------------------------- | ----------------------------------------- | ----------- | ----------------- |
| Loading (live)    | `isActive`, `!snapshotReceived`                          | waiting for SSE                           | `Live` (dim)| visible           |
| Live              | `isActive`, `!completed`                                 | SSE `snapshot` + `line`                   | `Live` 🟢   | visible           |
| Transition        | `live.completed === true`                                | invalidates `['run-logs', runId]`, switch | `Completed` | hidden            |
| Persisted         | `!isActive` (or after transition)                        | `GET /api/automation/runs/{runId}/logs`   | `Completed` | hidden            |
| Empty (edge E2)   | run just ended between `useActiveRuns` read and register | SSE sends `complete` immediately, switch  | `Completed` | hidden            |

`isActive` is derived from `useActiveRuns()` (existing hook, polls `/api/automation/workflow/logs/active-runs` every 4 s with JSON diff).

`LogViewer` props:
- `text` — full concatenated log
- `follow={showingLive}` — auto-scroll only while live
- `height` — same computation as today

### Header

- Title: `Logs — {runId}` (unchanged)
- Badge: `Live` (green pulsing dot `#22C55E`) or `Completed` (dim)
- Buttons (only when `isActive`):
  - **Stop Gracefully** — orange `#F59E0B`
  - **Kill** — red `#EF4444`, opens a confirmation dialog (same copy as `ExecutionCenter`: "This will immediately terminate the execution. Any in-progress actions may leave accounts in an inconsistent state.")
- **Full Page** button: unchanged.

### Stop / Kill behavior

- `Stop Gracefully` → `POST /api/automation/runs/{runId}/stop` with `{ mode: "GRACEFUL" }`.
- `Kill` → `POST /api/automation/runs/{runId}/stop` with `{ mode: "IMMEDIATE" }` after confirmation.
- On success, invalidate `['active-runs']` and show a toast. The modal **stays open** and follows the run's lifecycle — the stream keeps flowing (cleanup lines from the `finally` block are visible), then receives `complete`, then switches to the persisted view.

## Architecture

### Backend

#### New event stream: `GET /api/automation/runs/{runId}/logs/live`

SSE endpoint producing raw Spring Boot formatted lines (same format as `RunLogCaptureAppender.formatLogLine`).

Events:
- `snapshot` — `{ "lines": [string] }` — sent once on connection, contains the current in-memory buffer (may be empty).
- `line` — `{ "line": string }` — sent for every new log line captured with MDC `runId`.
- `complete` — `{ "runId": string, "status": string }` — sent when the run terminates (any terminal status). After this event, the emitter is closed.

No authentication required (matches current posture).

#### Component changes

1. **`RunLogCaptureAppender`** (`.../logging/RunLogCaptureAppender.java`)
   - New: `ConcurrentHashMap<String, CopyOnWriteArrayList<Consumer<String>>> listeners`.
   - New: `addListener(String runId, Consumer<String> listener) → Runnable` — returns the un-registration function.
   - In `append()`, after the `lines.add(formatted)` call, iterate `listeners.get(runId)` and call each consumer inside `try/catch` (per listener — a listener failure must never bubble up into the logging pipeline).
   - In `getAndClearLogs()`, after clearing the buffer, call `listeners.remove(runId)` so orphan listeners are freed if no emitter un-registered them.

2. **New: `RunLogLiveService`** (`.../workflow/streaming/RunLogLiveService.java`)
   - Singleton Spring `@Service`, dependencies: `RunLogCaptureAppender` (via `getInstance()`), `WorkflowLogService` (to consult `getActiveRuns()`), `ObjectMapper`.
   - State: `ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> emitters`, `ConcurrentHashMap<SseEmitter, Runnable> listenerUnsubscribers` (so each emitter releases its appender listener on close).
   - `registerEmitter(String runId)`:
     1. Create `SseEmitter(0L)`.
     2. Check if the run is in `WorkflowLogService.getActiveRuns()` or if the appender still has a buffer for it (`RunLogCaptureAppender.getLogs(runId)` non-empty). If neither → send `complete` with status `"UNKNOWN"` and return the emitter closed. This is the **edge case E2** fallback.
     3. Send `snapshot` event with the current buffer content.
     4. Register an appender listener; on each new line, send `line` event. Store the returned `Runnable` in `listenerUnsubscribers`.
     5. Add emitter to `emitters.get(runId)`.
     6. Wire `onCompletion` / `onError` / `onTimeout` to invoke the listener's un-subscribe Runnable and remove the emitter from the map.
   - `completeForRun(String runId, String status)`:
     1. Look up emitters for `runId`.
     2. For each: send `complete` event, call `emitter.complete()`, invoke the un-subscribe Runnable.
     3. Remove the `runId` entry from `emitters`.
   - `@PreDestroy`: close all emitters with status `"SHUTDOWN"`.

3. **`WorkflowLogService.completeStream()`** (`.../workflow/streaming/WorkflowLogService.java`)
   - Inject `RunLogLiveService` (constructor injection, matching Lombok `@RequiredArgsConstructor` style used here).
   - At the end of `completeStream(...)`, after the existing `WebSocket broadcast` and `emitters.remove(runId)` logic, call `runLogLiveService.completeForRun(runId, finalStatus)`.

4. **New: `RunLogLiveController`** (`.../workflow/streaming/RunLogLiveController.java`)
   - `@RestController @RequestMapping("/api/automation/runs")`
   - `@GetMapping(value = "/{runId}/logs/live", produces = MediaType.TEXT_EVENT_STREAM_VALUE) SseEmitter streamLive(@PathVariable String runId) → runLogLiveService.registerEmitter(runId)`.
   - This path does **not** conflict with the existing `@GetMapping("/{runId}/logs")` in `ExecutionManagementController` — the Spring MVC router picks the most specific match.

#### Order guarantees (flush vs complete)

The contract is: `RunLogPersistenceService.flushRunLogs(runId, udid)` must run **before** `WorkflowLogService.completeStream(runId, ...)` at every call site. This ensures:

- When the SSE `complete` event is sent, `getAndClearLogs` has already happened → the buffer is drained.
- When the frontend immediately refetches `GET /api/automation/runs/{runId}/logs`, the persisted document exists and contains every line that was streamed.
- No log line exists in a limbo state (neither in the buffer nor in the persisted doc).

Inspection of the current code (as of this spec) shows the ordering is respected at all five call sites examined in `DeviceQueueService` (L430, L478, L488, L714, L732) and `BatchExecutionService` (L119, L434, L579). Implementation **must include an audit step** (see build plan step 3) to verify exhaustively and fix any out-of-order site discovered.

### Frontend

#### New hooks

1. **`useLiveRunLogs(runId, { enabled })`** — `InstagramDashboard/src/hooks/useLiveRunLogs.js`
   - Opens an `EventSource` against `/api/automation/runs/{runId}/logs/live` when `enabled && runId`.
   - Resets internal state (`text`, `completed`) on `runId` change.
   - Handles `snapshot`, `line`, `complete`, `error`, `open` events.
   - Uses a `requestAnimationFrame`-based batch to coalesce multiple `line` events into a single `setText` call (mitigates re-render storms, **edge case E7**).
   - Returns `{ text, completed, connected }`.
   - Cleans up on unmount: `es.close()`, cancels any pending rAF.

2. **`useRunLogsWithLive(runId, { enabled })`** — `InstagramDashboard/src/hooks/useRunLogsWithLive.js`
   - Uses `useActiveRuns()` to derive `isActive`.
   - Calls `useLiveRunLogs(runId, { enabled: enabled && isActive })`.
   - Calls `useRunLogs(runId)` with `enabled = enabled && (!isActive || live.completed)` — so persisted data loads only when relevant.
   - On `live.completed === true`, invalidates `['run-logs', runId]` once to force the persisted view to refetch fresh data.
   - Returns `{ text, isLoading, isError, isActive, showingLive, liveConnected, refresh }`.

#### Component changes

1. **`RunLogModal`** (`InstagramDashboard/src/components/activity-log/RunLogModal.jsx`)
   - Replace `useRunLogs(runId)` with `useRunLogsWithLive(runId, { enabled: open })`.
   - Update the header: `Live` / `Completed` badge, conditional Stop/Kill buttons with the existing dialog pattern (reuse the one from `ExecutionCenter.ExecutionCard` for the Kill confirmation).
   - Pass `follow={showingLive}` to `LogViewer`.
   - Wire `Stop Gracefully` and `Kill` mutations via `@tanstack/react-query` (`apiPost('/api/automation/runs/{runId}/stop', { mode })`), invalidating `['active-runs']` on success with a Sonner toast.

2. **`RunLogs.jsx`** (`InstagramDashboard/src/pages/RunLogs.jsx`)
   - Apply the same pattern: `useRunLogsWithLive`, live badge in the header, Stop/Kill buttons when active.
   - Keeps the existing Copy button, back button, and dynamic height measurement.

3. **`DeviceRunsTab.jsx`** (`InstagramDashboard/src/components/activity-log/tabs/DeviceRunsTab.jsx`)
   - In the active-run banner block (lines ~92-161), add a **Logs** button next to **Stop** (blue `#3B82F6`, `Terminal` icon from `lucide-react`).
   - Local state `logsModalOpen`, renders `<RunLogModal runId={deviceActiveRun.runId} open={logsModalOpen} onClose={...} />`.

No changes to `ActivityLog.jsx`, `DeviceDetailSheet.jsx`, `DeviceCardGrid.jsx`, `DeviceCard.jsx`, `RunRow.jsx`, or any `ExecutionCenter` code.

## Data flow

```
Backend per log event:
  ILoggingEvent (MDC runId) → RunLogCaptureAppender.append()
    ├─ buffers.get(runId).add(line)
    └─ listeners.get(runId).forEach(l -> l.accept(line))
                                        ↓
                              RunLogLiveService listener
                                        ↓
                              SseEmitter.send("line", {line})
                                        ↓
                              EventSource "line" → useLiveRunLogs setText

Backend run termination (DeviceQueueService finally block):
  runLogPersistenceService.flushRunLogs(runId, udid)
    → appender.getAndClearLogs(runId): buffer drained, listeners.remove(runId)
    → runLogRepository.save(RunLogEntity {logText, lineCount, ...})
  workflowLogService.completeStream(runId, workflowName, duration, finalStatus)
    → (existing) broadcast /topic/executions/status, close WS emitters
    → runLogLiveService.completeForRun(runId, finalStatus)
        → for each open SseEmitter: send "complete", emitter.complete(), un-subscribe listener
        → emitters.remove(runId)

Frontend transition on "complete":
  useLiveRunLogs: completed=true, connected=false, EventSource closed
  useRunLogsWithLive: useEffect detects live.completed → queryClient.invalidateQueries(['run-logs', runId])
  useRunLogs: refetches, returns fresh logText
  RunLogModal: showingLive switches to false, text source = persisted, badge → Completed, Stop/Kill hidden
```

## Error handling and edge cases

| ID  | Case                                                                                           | Resolution                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Run just registered, no lines yet                                                               | `snapshot` is empty, listener attached, future lines flow naturally.                                                                                                             |
| E2  | Run just ended between `useActiveRuns` read and SSE register                                   | `registerEmitter` checks `getActiveRuns()` / `getLogs(runId)`; if neither → send `complete` immediately and close. Frontend bascules on persisted.                              |
| E3  | Stop/Kill from modal                                                                           | `DeviceQueueService` finally → `flushRunLogs` → `completeStream` → `completeForRun` → SSE `complete` → frontend bascules. User sees all cleanup lines until termination.        |
| E4  | Client disconnects SSE (wifi loss, tab hidden)                                                 | `EventSource` auto-reconnects; server re-sends `snapshot` (may cause brief duplication). Accepted as graceful degradation.                                                      |
| E5  | Multiple clients open the same runId                                                           | `CopyOnWriteArrayList<SseEmitter>` per runId, each emitter keeps its own appender listener. No contention.                                                                       |
| E6  | App shutdown during an active run                                                              | `RunLogLiveService.@PreDestroy` closes all emitters with `status=SHUTDOWN`. Frontend receives `complete` and bascules on persisted (may be empty if `flushRunLogs` didn't run). |
| E7  | Very high log rate (thousands of lines/s)                                                      | `useLiveRunLogs` batches `line` events via `requestAnimationFrame` before calling `setText`. One re-render per frame max.                                                       |
| E8  | Snapshot size up to 12 MB (10 000 lines × avg size)                                            | One-shot transmission, same volume as the current post-mortem `GET /logs`. Acceptable; if it becomes a problem, incremental `snapshot` chunks can be added later.               |
| E9  | Frontend unmounts modal before `complete`                                                      | Cleanup calls `es.close()` → `onCompletion` → un-subscribe listener → emitter removed from map. No leaks.                                                                        |
| E10 | Kill signal takes time for thread to actually stop                                             | Logs continue streaming until `flushRunLogs` + `completeStream` run in `finally`. User sees every last line in live.                                                             |

## Build plan

**Step 1 — Extend the appender.** Add listener registry + notification in `append()` + cleanup in `getAndClearLogs()`. Unit test: log event with MDC triggers listener; un-subscribe prevents further calls.

**Step 2 — `RunLogLiveService` + `RunLogLiveController`.** New service handles snapshot + streaming + completion; new controller exposes the SSE route. Wire `WorkflowLogService.completeStream()` to call `runLogLiveService.completeForRun()`. `MockMvc` integration test: route returns `text/event-stream`; a log event with the matching MDC reaches the subscriber.

**Step 3 — Audit flush/complete ordering.** Walk every call site where both `flushRunLogs` and `completeStream` are invoked (sites currently known: `DeviceQueueService` L430/L478/L488/L714/L732, `BatchExecutionService` L119/L434/L579). Verify `flushRunLogs` precedes `completeStream`. Patch any inverted site.

**Step 4 — `useLiveRunLogs` hook.** New file, `EventSource`-based, with rAF batching.

**Step 5 — `useRunLogsWithLive` hook.** Orchestrate `useActiveRuns` + `useLiveRunLogs` + `useRunLogs`, handle the `live.completed` → cache invalidation transition.

**Step 6 — `RunLogModal` refactor.** Swap to composite hook, add badge + Stop/Kill header buttons with confirmation dialog.

**Step 7 — `RunLogs.jsx` page refactor.** Same treatment for the full-page view.

**Step 8 — `DeviceRunsTab` active-run Logs button.** Add the entry point in the active-run banner.

**Step 9 — Smoke test.** Trigger a long-running workflow, verify: snapshot + live lines, transitions on stop/kill, post-termination refetch identity with existing post-mortem view, no regression for terminated-run flow.

**Ordering and parallelism**: Step 1 → 2 (backend); Step 3 can run in parallel with 2. Step 4 → 5 → { 6, 7, 8 } (frontend). Backend and frontend can proceed in parallel once the SSE contract in Step 2 is agreed.

## Files touched

**Created (backend)**:
- `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveService.java`
- `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveController.java`

**Modified (backend)**:
- `InstagramAutomation/src/main/java/com/automation/instagram/logging/RunLogCaptureAppender.java` (listener registry)
- `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java` (hook `completeForRun` at the end of `completeStream`)
- Potentially `InstagramAutomation/src/main/java/com/automation/instagram/service/DeviceQueueService.java` / `BatchExecutionService.java` if the audit reveals any inverted flush/complete order.

**Created (frontend)**:
- `InstagramDashboard/src/hooks/useLiveRunLogs.js`
- `InstagramDashboard/src/hooks/useRunLogsWithLive.js`

**Modified (frontend)**:
- `InstagramDashboard/src/components/activity-log/RunLogModal.jsx`
- `InstagramDashboard/src/components/activity-log/tabs/DeviceRunsTab.jsx`
- `InstagramDashboard/src/pages/RunLogs.jsx`

Not modified: `ExecutionCenter.jsx`, `DeviceLogsTab.jsx`, any WebSocket infrastructure, `useWorkflowLogs.js`, `useDeviceLogs.js`, security config.
