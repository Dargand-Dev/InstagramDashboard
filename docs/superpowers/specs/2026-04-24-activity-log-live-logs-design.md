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
- Changing the authentication posture of SSE endpoints. `SecurityConfig` currently uses `anyRequest().permitAll()`; this feature matches that posture (same as `useWorkflowLogs`/`useDeviceLogs`). Rationale: browser `EventSource` cannot attach custom `Authorization` headers, so the existing SSE endpoints rely on `permitAll` today. If the project later tightens auth, all SSE endpoints (existing + new) will need a coordinated fix (query-string token, cookie auth, or SSE polyfill with fetch) — out of scope for this feature.

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
   - New: `ConcurrentHashMap<String, Boolean> clearedFlags` — set to `TRUE` when `getAndClearLogs(runId)` runs. Queried by `RunLogLiveService.completeForRun` to choose sync vs deferred path. Cleared (removed) only on explicit `resetCleared(runId)` call from `RunLogLiveService` after the completion drains — so that a follow-up second register/complete on the same runId (should not happen but defensive) starts fresh.
   - New: `addListener(String runId, Consumer<String> listener) → Runnable` — returns the un-registration function. Adds to `listeners.get(runId)`; the returned runnable removes from the list.
   - New: `hasBufferBeenClearedFor(String runId) → boolean` — `Boolean.TRUE.equals(clearedFlags.get(runId))`.
   - New: `withBufferLock(String runId, Supplier<T> fn) → T` — synchronizes on the per-runId buffer list (creating it if absent) for the duration of `fn.get()`. Used by `RunLogLiveService.registerEmitter` for atomic snapshot+subscribe.
   - `append()` modification: after `lines.add(formatted)` (which already executes under the list's intrinsic lock via the `synchronizedList` wrapper), iterate `listeners.get(runId)` and call each consumer inside a `try/catch`. **Listeners must be non-blocking** (a slow consumer must not stall the logging pipeline). `RunLogLiveService`'s listener enqueues the line into a bounded per-emitter queue and returns; a small daemon executor drains the queue onto `SseEmitter.send`. This keeps the snapshot+subscribe atomicity intact (the enqueue is O(1) and non-blocking) while isolating slow SSE clients from the appender lock. The notification happens INSIDE the synchronized block so that `registerEmitter`'s atomic read+subscribe is observed.
   - **JDK dependency note**: the buffer list MUST be created via `Collections.synchronizedList(new ArrayList<>())` (no explicit external mutex). `synchronizedList` defaults its internal `mutex` to the wrapper instance itself, so `synchronized (bufferList)` and `bufferList.add(...)` share the same monitor. The two-argument form (`synchronizedList(list, mutex)`) would silently break the atomicity invariant.
   - `getAndClearLogs()` modification: after clearing the buffer, set `clearedFlags.put(runId, Boolean.TRUE)` and call `listeners.remove(runId)` so orphan listeners are freed if no emitter un-registered them.

2. **New: `RunLogLiveService`** (`.../workflow/streaming/RunLogLiveService.java`)
   - Singleton Spring `@Service`. Dependencies: `RunLogCaptureAppender` (via `getInstance()`), `WorkflowLogService` (to consult `getActiveRuns()`), `ObjectMapper`.

   **State**:
   ```java
   ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> emitters;     // by runId
   ConcurrentHashMap<SseEmitter, Runnable> listenerUnsubscribers;           // one per emitter
   ConcurrentHashMap<String, PendingCompletion> pendingCompletions;          // by runId, at most one
   ScheduledExecutorService timeoutExecutor;                                 // single thread, daemon

   record PendingCompletion(String runId, String status, ScheduledFuture<?> timeoutTask) {}
   ```
   `PendingCompletion` is per-runId (not per-emitter). A runId has at most one in flight at a time — if a second `completeForRun` arrives, step-by-step idempotency (see `completeForRun` below) handles it.

   **Concurrency model for `registerEmitter` (the snapshot/listener race)**:
   The appender's per-runId buffer is a `Collections.synchronizedList(new ArrayList<>())`. To register the listener atomically with reading the snapshot, we acquire the buffer's intrinsic monitor (`synchronized (bufferList) { ... }`) for the duration of (snapshot-read + listener-registration). Inside that block, `append()` cannot add new lines (it also synchronizes on the same list via `lines.add(formatted)` which is called on the synchronized wrapper — the wrapper's `add` grabs the same monitor). Outside that block, any subsequent `append()` will see the listener already registered.

   This gives strict ordering: every line in the snapshot was already in the buffer at read time; every line delivered via the listener was added after read time; no line is lost, no line is duplicated, no "pre-subscription queue" is needed. **The earlier draft's pre-subscription queue is dropped in favor of this simpler invariant.**

   **`registerEmitter(String runId)`** — executed by the HTTP request thread:
   ```
   1.  emitter = new SseEmitter(0L);
   2.  Acquire the appender's per-runId buffer monitor (via appender helper — see below).
   3.    snapshot = list(buffer)        // copy while holding monitor
   4.    listener = line -> sendLine(emitter, line)
   5.    unsubscribe = appender.addListener(runId, listener)  // visible to append() immediately
   6.  Release monitor.
   7.  If (snapshot.isEmpty && !workflowLogService.isActive(runId)):
   8.    // Edge E2 — run never existed here or ended before we arrived
   9.    unsubscribe.run()
   10.   sendComplete(emitter, runId, "UNKNOWN")
   11.   emitter.complete()
   12.   return emitter
   13. sendSnapshot(emitter, snapshot)
   14. listenerUnsubscribers.put(emitter, unsubscribe)
   15. emitters.computeIfAbsent(runId, _ -> new COWList()).add(emitter)
   16. emitter.onCompletion(cleanup); emitter.onError(_ -> cleanup()); emitter.onTimeout(cleanup)
   17. return emitter
   ```
   where `cleanup()` = `{ unsubscribe.run(); listenerUnsubscribers.remove(emitter); emitters.get(runId).remove(emitter); }`

   To expose the buffer monitor atomically, extend `RunLogCaptureAppender` with a helper:
   ```java
   public <T> T withBufferLock(String runId, Supplier<T> fn) {
       List<String> buf = buffers.computeIfAbsent(runId, k -> Collections.synchronizedList(new ArrayList<>()));
       synchronized (buf) { return fn.get(); }
   }
   ```
   and use `buf` as the monitor in `append()` by doing `synchronized (lines) { lines.add(formatted); notifyListeners(runId, formatted); }`. This collapses the existing implicit lock around `add()` with explicit listener notification under the same monitor.

   **`completeForRun(String runId, String status)`** — called from `WorkflowLogService.completeStream` at the end:
   ```
   1.  If pendingCompletions.containsKey(runId):
   2.    return    // idempotent — a pending completion is already scheduled, second call is a no-op
   3.  isDeferred = workflowLogService.isActive(runId)
         // Interpretation: after completeStream() removes runId from activeRuns, isActive returns false.
         // But `completeStream` calls `runLogLiveService.completeForRun` BEFORE or AFTER its own
         // activeRuns.remove(runId)? We place the call BEFORE, so activeRuns still contains runId
         // here for the GRACEFUL/COMPLETED path (flush-first) AND for the IMMEDIATE path
         // (flush-later). Detection axis is not kill-vs-graceful but "has flush already run?".
         // We expose a new flag on the appender: `appender.hasBufferBeenClearedFor(runId)` which
         // returns true iff `getAndClearLogs` was called and cleared the buffer. If true → sync
         // path; else → deferred path.
   4.  If !appender.hasBufferBeenClearedFor(runId):
   5.    // Deferred: buffer still present → flushRunLogs hasn't run → we must wait for it
   6.    timeoutTask = timeoutExecutor.schedule(() -> drainPending(runId, "TIMEOUT"), 25, SECONDS)
   7.    pendingCompletions.put(runId, new PendingCompletion(runId, status, timeoutTask))
   8.    return
   9.  // Synchronous: buffer has been cleared → persisted doc exists → safe to close
   10. drainImmediately(runId, status)
   ```

   **`onFlushCompleted(String runId)`** — called by `RunLogPersistenceService.flushRunLogs` after the Mongo save. Also called in non-kill flush paths (no-op when no pending exists).
   ```
   1.  pending = pendingCompletions.remove(runId)
   2.  If pending == null: return   // no-op: kill case where nothing was pending, or graceful flow
   3.  pending.timeoutTask.cancel(false)   // cancel the 25s fallback
   4.  drainImmediately(runId, pending.status)
   ```

   **`drainImmediately(runId, status)`** — single-path completion that closes all emitters:
   ```
   1.  list = emitters.remove(runId)   // atomic claim
   2.  appender.resetCleared(runId)    // free the clearedFlags entry to avoid unbounded growth
   3.  If list == null: return
   4.  For each emitter: sendComplete(emitter, runId, status); emitter.complete()
   5.  (cleanup callbacks then fire onCompletion → unsubscribe listeners, remove from listenerUnsubscribers)
   ```
   This is also the path invoked by the timeout (step 6 of `completeForRun`) and by `drainPending(runId, "TIMEOUT")`, which additionally removes the stale pending entry and logs at WARN level with a metric (operational signal: a timeout firing means `flushRunLogs` silently failed or was never called).

   **Idempotence properties**:
   - Double `completeForRun(runId, …)`: second call early-returns because `pendingCompletions.containsKey(runId)` or `emitters.remove(runId)` returned null.
   - `onFlushCompleted(runId)` with no pending entry: no-op (normal flush-first paths).
   - Emitter disconnect while pending: the emitter's cleanup handler removes it from the list; when `onFlushCompleted` fires, `drainImmediately` finds an empty list and does nothing. Pending entry is still removed. No leak.
   - Timeout fires then `onFlushCompleted` arrives: `pendingCompletions.remove(runId)` in `onFlushCompleted` returns null → no-op. No double `complete`.
   - `onFlushCompleted` fires then timeout task executes: timeout task re-reads `pendingCompletions.remove(runId)` → null → no-op. No double `complete`.

   **`@PreDestroy`**:
   ```
   1.  cancel all pending timeouts
   2.  for each (runId, emitterList) in emitters:
   3.    for each emitter: try { sendComplete(emitter, runId, "SHUTDOWN"); emitter.complete() }
   4.  timeoutExecutor.shutdownNow()
   5.  clear all maps
   ```
   Spring destroys singletons in reverse-dependency order. `WorkflowLogService` depends on `RunLogLiveService` (constructor injection), so Spring destroys `WorkflowLogService` first — meaning any in-flight `completeStream()` during shutdown may fail to reach `runLogLiveService.completeForRun` if the latter is already destroyed. The `@PreDestroy` handler above independently closes all emitters with `SHUTDOWN` so clients unblock regardless. No `@DependsOn` annotation is required.

3. **`WorkflowLogService.completeStream()`** (`.../workflow/streaming/WorkflowLogService.java`)
   - Inject `RunLogLiveService` (constructor injection, matching Lombok `@RequiredArgsConstructor` style used here).
   - At the end of `completeStream(...)`, after the existing `WebSocket broadcast` and `emitters.remove(runId)` logic, call `runLogLiveService.completeForRun(runId, finalStatus)`. The service internally detects whether to complete synchronously or defer (see service contract above).
   - Add `public boolean isActive(String runId) { return activeRuns.containsKey(runId); }` — used by `RunLogLiveService.registerEmitter` step 7 (the existence check for edge case E2).
   - `RunLogPersistenceService.flushRunLogs()` is modified to call `runLogLiveService.onFlushCompleted(runId)` in a `finally` block at the bottom of the method (wrapped in a try/catch that logs-and-swallows). The call fires regardless of whether `runLogRepository.save(...)` succeeded — if Mongo persistence fails, the emitters still drain (via the live buffer they already received) and the frontend's refetch will get a 404, which the retry policy handles gracefully. Without this `finally` placement, a Mongo blip would stall emitters until the 25s timeout.

4. **New: `RunLogLiveController`** (`.../workflow/streaming/RunLogLiveController.java`)
   - `@RestController @RequestMapping("/api/automation/runs")`
   - `@GetMapping(value = "/{runId}/logs/live", produces = MediaType.TEXT_EVENT_STREAM_VALUE) SseEmitter streamLive(@PathVariable String runId) → runLogLiveService.registerEmitter(runId)`.
   - Two controllers now share the `/api/automation/runs` base (this one and `ExecutionManagementController`). Spring MVC PathPattern matching is exact, so `/{runId}/logs` and `/{runId}/logs/live` resolve to distinct handlers (different path segments, no ambiguity). No reordering or `@Order` annotation required. Both controllers are unit-discoverable and don't share state.

#### Order guarantees (flush vs complete)

The ideal contract is: `RunLogPersistenceService.flushRunLogs(runId, udid)` runs **before** `WorkflowLogService.completeStream(runId, ...)` at every call site — so that when the SSE `complete` event is sent, `getAndClearLogs` has already happened and the persisted document exists.

Inspection of the current code shows the ordering is respected in the five call sites inside `DeviceQueueService` (L430, L478, L488, L714, L732) and three in `BatchExecutionService` (L119, L434, L579) that run in the worker thread's `finally` block.

**However, two sites explicitly invert this order by design — both on the IMMEDIATE-kill path:**
- `ExecutionManagementController#stopRun` L111 calls `workflowLogService.completeStream(runId, null, 0, "CANCELLED")` directly from the HTTP request thread, **without** a preceding flush, then returns `202 Accepted`. The worker thread later runs its `finally` block (which calls `flushRunLogs` then `completeStream` again — but at that point the second `completeStream` is a no-op because `activeRuns.remove(runId)` happened the first time).
- `DeviceQueueService#cancelTask` L210 does the same (synchronous completeStream from the cancel call), then `scheduleForceCleanupIfNeeded` kicks in if the worker doesn't finalize within 20 s.

This pattern exists to make the run disappear from `activeRuns` immediately on IMMEDIATE kill, even before the worker thread wakes up from the interrupt. Reordering those sites to flush-first would require the HTTP request thread to wait for the worker — not acceptable.

**Consequence for this feature**: on IMMEDIATE kill, the SSE `complete` event fires *before* the persisted document exists. `GET /api/automation/runs/{runId}/logs` returns 404 until the worker thread runs `flushRunLogs` (usually within 1-3 seconds, bounded by the 20 s `scheduleForceCleanupIfNeeded` fallback).

**Resolution** — two layers:
1. **Backend**: `RunLogLiveService.completeForRun(runId, status)` does NOT close the SSE emitter immediately on IMMEDIATE kill. Instead, it marks the emitter with a `pendingCompletion` flag and waits for the subsequent `flushRunLogs` callback to trigger the actual `complete` event + close. `RunLogPersistenceService.flushRunLogs` is extended to notify `runLogLiveService.onFlushCompleted(runId)` at the end. This guarantees that by the time the frontend receives `complete`, the persisted document has been written.
   - For non-kill paths (`COMPLETED`, graceful `FAILED`), `flushRunLogs` runs before `completeStream` as today, so `onFlushCompleted` fires first and `completeForRun` can proceed synchronously.
   - To handle the edge where `completeForRun` is called but `flushRunLogs` never happens (app shutdown mid-kill), a 25 s timeout in `RunLogLiveService` forces `complete` + close regardless (slightly longer than `scheduleForceCleanupIfNeeded`).
2. **Frontend fallback**: `useRunLogsWithLive` uses `retry: 5, retryDelay: 500ms*(n+1)` on the `useRunLogs` query while `completed && !data`, and keeps the last live `text` visible during the retry window. This is defence-in-depth in case the backend coordination races.

The build plan audit step (Step 3) focuses on confirming these two IMMEDIATE-kill sites are the only exceptions to the flush-first rule and that all other sites (existing + any new) respect it.

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
   - On `live.completed === true`, invalidates `['run-logs', runId]` and polls it briefly with a short retry policy: the `useRunLogs` query gets `retry: 5, retryDelay: (attempt) => 500 * (attempt + 1)` while `completed && !data`. Rationale: on IMMEDIATE kill, `completeStream` fires **before** the worker thread's `finally` block runs `flushRunLogs` — `GET /api/automation/runs/{runId}/logs` may briefly return 404. The retry loop covers that window (the worker thread finalizes within a few seconds).
   - Also keeps the last live `text` visible until the persisted fetch resolves, so the modal never flickers to "No logs available" between `complete` and the first successful refetch.
   - Returns `{ text, isLoading, isError, isActive, showingLive, liveConnected, refresh }`.
   - `isActive` derivation: `activeRuns.some(r => (r.runId || r.id) === runId)`. For the full-page `RunLogs.jsx` opened directly by URL, `useActiveRuns` is polled every 4s — before the first poll resolves, `activeRuns` is `[]` and `isActive` is `false`, so the page initially shows "persisted" mode (possibly empty). This is acceptable (page transiently matches the old behavior for up to 4s), and once the first poll resolves the state is correct.

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
   - In the active-run banner block (lines ~92-161), add a **Logs** button next to the existing **Stop** button (blue `#3B82F6`, `Terminal` icon from `lucide-react`).
   - Local state `logsModalOpen`, renders `<RunLogModal runId={deviceActiveRun.runId} open={logsModalOpen} onClose={...} />`.
   - Note: the banner's existing **Stop** button (L100-109) and the new Stop/Kill buttons inside `RunLogModal` both call `apiPost('/api/automation/runs/{runId}/stop', ...)`. They intentionally coexist — they provide the same action from two surfaces. Each surface manages its own local `stopping`/`killing` state; the active-runs invalidation on success keeps both in sync visually within 4s. No consolidation is needed.

No changes to `ActivityLog.jsx`, `DeviceDetailSheet.jsx`, `DeviceCardGrid.jsx`, `DeviceCard.jsx`, `RunRow.jsx`, or any `ExecutionCenter` code. **Design rationale** for keeping two live-log streams on the same `runId`: `ExecutionCenter` and `DeviceLogsTab` use the structured `WorkflowLogEvent` stream (per-step progress, account names, status icons), which is semantically different from raw Spring Boot lines. Activity Log's `RunLogModal` needs the raw format for parity with the post-mortem view. The two streams serve different UIs and carry different payloads; they coexist on the same backend run but via distinct endpoints and code paths.

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

Backend run termination — SYNCHRONOUS path (COMPLETED, GRACEFUL-stop observed by worker, FAILED):
  [worker thread finally block]
  runLogPersistenceService.flushRunLogs(runId, udid)
    → appender.getAndClearLogs(runId): buffer drained, clearedFlags[runId]=TRUE, listeners.remove(runId)
    → runLogRepository.save(RunLogEntity {logText, lineCount, ...})
    → runLogLiveService.onFlushCompleted(runId)  // no-op (no pending entry yet)
  workflowLogService.completeStream(runId, ...)
    → broadcast /topic/executions/status, close WS emitters, activeRuns.remove(runId)
    → runLogLiveService.completeForRun(runId, finalStatus)
        → appender.hasBufferBeenClearedFor(runId) == TRUE → drainImmediately
        → for each open SseEmitter: send "complete", emitter.complete(), un-subscribe listener
        → emitters.remove(runId)

Backend run termination — DEFERRED path (IMMEDIATE kill):
  [HTTP request thread — ExecutionManagementController#stopRun L111 or DeviceQueueService#cancelTask L210]
  workflowLogService.completeStream(runId, null, 0, "CANCELLED")
    → broadcast, close WS emitters, activeRuns.remove(runId)
    → runLogLiveService.completeForRun(runId, "CANCELLED")
        → appender.hasBufferBeenClearedFor(runId) == FALSE → DEFER
        → pendingCompletions[runId] = PendingCompletion(runId, "CANCELLED", timeoutTask(25s))
        → [return — emitters still open, still receiving late lines from worker cleanup]

  [worker thread finally block — runs shortly after, up to a few seconds later]
  runLogPersistenceService.flushRunLogs(runId, udid)
    → appender.getAndClearLogs(runId): buffer drained, clearedFlags[runId]=TRUE
    → runLogRepository.save(RunLogEntity)
    → runLogLiveService.onFlushCompleted(runId)
        → pending = pendingCompletions.remove(runId)  // not null
        → pending.timeoutTask.cancel()
        → drainImmediately(runId, pending.status)
            → send "complete" to emitters, close
  workflowLogService.completeStream(runId, ...) // second call, no-op internally (activeRuns.remove already happened)
    → runLogLiveService.completeForRun(runId, ...) // second call, idempotent no-op (pendingCompletions empty, emitters.remove returns null)

Backend run termination — DEFERRED TIMEOUT (flushRunLogs never fires, e.g. JVM crash):
  After 25s, timeoutTask runs:
    → pendingCompletions.remove(runId) → drainImmediately(runId, "TIMEOUT")
    → log WARN + increment a metric (operational signal)

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
| E3a | Graceful Stop from modal (`mode=GRACEFUL`)                                                     | `ExecutionManagementController#stopRun` calls `cancellationService.requestStop(...)` and returns 202. It does NOT call `completeStream`. The worker thread observes the cancel signal, runs its `finally` block → `flushRunLogs` → `completeStream` → `completeForRun` → `appender.hasBufferBeenClearedFor(runId)` is `true` → sync drain path. All cleanup lines visible to SSE clients; frontend refetches persisted doc and bascules. |
| E3b | Kill (IMMEDIATE) from modal (`mode=IMMEDIATE`)                                                 | `ExecutionManagementController#stopRun` L111 (and/or `DeviceQueueService#cancelTask` L210) calls `completeStream` synchronously from the HTTP thread, BEFORE the worker thread's `finally` runs. `completeForRun` → `appender.hasBufferBeenClearedFor(runId)` is `false` → DEFER: pending entry created with 25s timeout. SSE emitter stays open, new lines (from the interrupted worker's cleanup) keep streaming. Worker `finally` runs `flushRunLogs` → `onFlushCompleted` drains the pending entry → SSE `complete` → frontend refetches persisted doc (now exists) and bascules. If `flushRunLogs` never fires (app crash mid-kill), the 25s timeout force-completes the emitters with status `TIMEOUT`. |
| E4  | Client disconnects SSE (wifi loss, tab hidden)                                                 | `EventSource` auto-reconnects; server re-sends `snapshot` (may cause brief duplication). Accepted as graceful degradation.                                                      |
| E5  | Multiple clients open the same runId                                                           | `CopyOnWriteArrayList<SseEmitter>` per runId, each emitter keeps its own appender listener. No contention.                                                                       |
| E6  | App shutdown during an active run                                                              | `RunLogLiveService.@PreDestroy` closes all emitters with `status=SHUTDOWN`. Frontend receives `complete` and bascules on persisted (may be empty if `flushRunLogs` didn't run). |
| E7  | Very high log rate (thousands of lines/s)                                                      | `useLiveRunLogs` batches `line` events via `requestAnimationFrame` before calling `setText`. One re-render per frame max.                                                       |
| E8  | Snapshot size up to 12 MB (10 000 lines × avg size)                                            | One-shot transmission, same volume as the current post-mortem `GET /logs`. Acceptable; if it becomes a problem, incremental `snapshot` chunks can be added later.               |
| E9  | Frontend unmounts modal before `complete`                                                      | Cleanup calls `es.close()` → `onCompletion` → un-subscribe listener → emitter removed from map. No leaks.                                                                        |
| E10 | Kill signal takes time for thread to actually stop                                             | Logs continue streaming until `flushRunLogs` + `completeStream` run in `finally`. User sees every last line in live.                                                             |
| E11 | Second `completeForRun` arrives after the first already drained (or is pending)                | `completeForRun` early-returns if `pendingCompletions.containsKey(runId)` OR if `emitters.remove(runId)` returns null (already drained). Idempotent — no double `complete` event, no crash. Practical case: IMMEDIATE kill path → `completeStream` from HTTP thread fires once; worker `finally` calls `completeStream` a second time (usually a no-op inside `WorkflowLogService` because `activeRuns.remove` happened the first time, but we don't rely on that assumption). |

## Build plan

**Step 1 — Extend the appender.** Add listener registry + notification in `append()` + cleanup in `getAndClearLogs()`. Unit test: log event with MDC triggers listener; un-subscribe prevents further calls.

**Step 2 — `RunLogLiveService` + `RunLogLiveController`.** New service handles snapshot + streaming + completion (sync + deferred paths); new controller exposes the SSE route. Wire `WorkflowLogService.completeStream()` to call `runLogLiveService.completeForRun()`, and `RunLogPersistenceService.flushRunLogs()` to call `onFlushCompleted()`. `MockMvc` integration tests cover: route returns `text/event-stream`; a log event with the matching MDC reaches the subscriber; E2 case (run not active and no buffer) returns `complete` immediately; deferred case (completeForRun called before onFlushCompleted) keeps emitter open until flush fires.

**Step 3 — Audit `completeStream` call sites; wire `onFlushCompleted`.**
- The classification axis is **not** "kill vs graceful" — it's "has `flushRunLogs` for this runId run by the time `completeStream` is called?". The `appender.hasBufferBeenClearedFor(runId)` flag is the runtime decision; the audit's job is to make sure every call site falls into one of the two categories handled by `RunLogLiveService.completeForRun`:
  - **Flush-first sites** (sync path): `DeviceQueueService` L430/L478/L488/L714/L732, `BatchExecutionService` L119/L434/L579. All in worker-thread `finally` blocks, after `flushRunLogs(runId, ...)`.
  - **Flush-later sites** (deferred path): `ExecutionManagementController#stopRun` L111 (IMMEDIATE only — GRACEFUL does not call `completeStream` from the HTTP thread), `DeviceQueueService#cancelTask` L210 (IMMEDIATE only).
- Grep exhaustively for `completeStream(` across the module. Any new/unknown call site is safe to leave as-is because `RunLogLiveService.completeForRun` handles both cases at runtime — but the audit documents intent so reviewers can sanity-check ordering choices in PRs.
- Modify `RunLogPersistenceService.flushRunLogs` to call `runLogLiveService.onFlushCompleted(runId)` **in a `finally` block** so it fires whether or not `runLogRepository.save(...)` succeeded, wrapped in an inner try/catch that logs-and-swallows (failures to notify must never break `flushRunLogs`). This call happens unconditionally; it is a no-op when no pending completion exists.

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
- `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java` (call `completeForRun` at the end of `completeStream`)
- `InstagramAutomation/src/main/java/com/automation/instagram/monitoring/service/RunLogPersistenceService.java` (call `onFlushCompleted` at the end of `flushRunLogs`)
- `ExecutionManagementController.java` and `DeviceQueueService#cancelTask` L210 are NOT reordered — the deferred-completion mechanism in `RunLogLiveService` absorbs the existing IMMEDIATE-kill pattern. No code changes expected in `DeviceQueueService` / `BatchExecutionService` beyond whatever Step 3 audit might surface; the existing flush-first ordering already aligns with the sync path.

**Created (frontend)**:
- `InstagramDashboard/src/hooks/useLiveRunLogs.js`
- `InstagramDashboard/src/hooks/useRunLogsWithLive.js`

**Modified (frontend)**:
- `InstagramDashboard/src/components/activity-log/RunLogModal.jsx`
- `InstagramDashboard/src/components/activity-log/tabs/DeviceRunsTab.jsx`
- `InstagramDashboard/src/pages/RunLogs.jsx`

Not modified: `ExecutionCenter.jsx`, `DeviceLogsTab.jsx`, any WebSocket infrastructure, `useWorkflowLogs.js`, `useDeviceLogs.js`, security config.
