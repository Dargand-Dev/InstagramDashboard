---
date: 2026-04-29
projects: InstagramAutomation, InstagramDashboard
status: approved
---

# Auto-suspend status display

## Problem

When a run skips an account because that account is in `AUTO_SUSPENDED` state, the UI is misleading. The user perceives "FAILED" but in fact the backend reports `SKIPPED` — same gray badge as any other skip (banned, paused, etc.). The auto-suspend case should be visually distinct (violet `AUTO_SUSPEND` badge) on the three pages where these results appear:

- Activity Log (`src/pages/ActivityLog.jsx` → `components/activity-log/RunRow.jsx`)
- Queue (`src/pages/Queue.jsx`)
- Execution Center (`src/pages/ExecutionCenter.jsx`)

## Current behavior (verified)

- `WorkflowResult.Status` enum has no `AUTO_SUSPENDED` value. Auto-suspended accounts are reported as `SKIPPED` with `failureReason = "Compte auto-suspendu"` (or `"Compte auto-suspendu (vues insuffisantes)"`).
- `WorkflowEngine.java:69-80` builds the `WorkflowResult` from `context.get("skipReason")` set in `PostReelWorkflow.java:169-179`.
- `ExecutionRun.AccountRunResult` (lines 56-74) carries `status` + `failureReason` only.
- `BatchAccountEntry` carries `status` (PENDING/RUNNING/COMPLETED/FAILED/SKIPPED/WAITING_RETRY) + `errorMessage`.
- Frontend `StatusBadge` (`src/components/shared/StatusBadge.jsx:12`) already maps `AUTO_SUSPENDED` to the correct violet `#A855F7`. No badge component change needed.

## Approach

Introduce a structured `skipCode` string field that flows from workflow context → result → DTO → frontend. The frontend derives a display status that overrides `SKIPPED` to `AUTO_SUSPENDED` when `skipCode === 'AUTO_SUSPENDED'`. Other skip causes are out of scope and remain gray.

We do **not** extend the `WorkflowResult.Status` enum — `SKIPPED` remains the technical status, `skipCode` is an orthogonal classifier. We do **not** parse the French `failureReason` string on the frontend (fragile to wording changes).

### Why a string, not an enum

The user chose `String skipCode` to keep the type extensible without future enum migrations. Values are documented constants (currently only `"AUTO_SUSPENDED"`).

## Backend changes — `InstagramAutomation`

### 1. `WorkflowResult` (workflow/model/WorkflowResult.java)

Add nullable field:

```java
private String skipCode;  // ex: "AUTO_SUSPENDED" — null when not a structured skip
```

Lombok `@Builder` already in place; no other change.

### 2. `WorkflowEngine.java` (lines 69-80)

In the pre-check skip branch, read both `skipReason` (existing) and `skipCode` (new) from context, populate the result:

```java
String skipReason = context.get("skipReason", String.class);
String skipCode = context.get("skipCode", String.class);
String failureReason = skipReason != null ? skipReason : "Pre-check failed";
WorkflowResult result = WorkflowResult.builder()
        .status(WorkflowResult.Status.SKIPPED)
        // ... existing fields ...
        .failureReason(failureReason)
        .skipCode(skipCode)
        // ... rest ...
        .build();
```

### 3. `PostReelWorkflow.java` (lines 169-179) and other workflows

In the pre-check that handles non-ACTIVE accounts, set the structured code alongside the human-readable reason:

```java
if (current == InstagramAccount.AccountStatus.AUTO_SUSPENDED) {
    context.put("skipReason", "Compte auto-suspendu");
    context.put("skipCode", "AUTO_SUSPENDED");
}
```

Audit all `Workflow` implementations that perform the same `account.getStatus() != ACTIVE` pre-check (likely `PostStoryWorkflow`, possibly others) and apply the same change. Use grep for `AccountStatus.AUTO_SUSPENDED` to find call sites.

### 4. `ExecutionRun.AccountRunResult` (monitoring/model/ExecutionRun.java, lines 56-74)

Add field:

```java
private String skipCode;
```

In the builder block (lines 156-170), populate it:

```java
.skipCode(r.getSkipCode())
```

This automatically flows to the `/api/automation/runs` endpoint and to `/api/automation/workflow/logs/active-runs`.

### 5. `BatchAccountEntry.java`

Add field:

```java
private String skipCode;
```

### 6. `BatchAccountManagerService.markAccountCompleted(...)`

Extend the signature to accept `skipCode`:

```java
markAccountCompleted(taskId, containerName, success, errorMessage, skipCode)
```

Persist it on the entry. Existing call sites that don't have a skipCode pass `null`.

### 7. `BatchExecutionService.java` (lines 264-265)

```java
batchAccountManagerService.markAccountCompleted(
    task.getId(), containerName,
    result.isSuccess(),
    result.isSuccess() ? null : result.getFailureReason(),
    result.getSkipCode()
);
```

## Frontend changes — `InstagramDashboard`

### 1. New helper

`src/utils/status.js` (new file):

```js
export function deriveDisplayStatus(item) {
  if (!item) return undefined
  if (item.skipCode === 'AUTO_SUSPENDED') return 'AUTO_SUSPENDED'
  return item.status
}
```

### 2. `components/activity-log/RunRow.jsx`

- Line 4: import `deriveDisplayStatus` from `@/utils/status`.
- Lines 53-55: compute `autoSuspendCount`:

  ```js
  const autoSuspendCount = results.filter(r => r.skipCode === 'AUTO_SUSPENDED').length
  ```

- Lines 92-98: extend the inline counter:

  ```jsx
  {(successCount > 0 || failCount > 0 || autoSuspendCount > 0) && (
    <div className="flex items-center gap-2 text-xs">
      {successCount > 0 && <span className="text-[#22C55E]">{successCount} ok</span>}
      {failCount > 0 && <span className="text-[#EF4444]">{failCount} fail</span>}
      {autoSuspendCount > 0 && <span className="text-[#A855F7]">{autoSuspendCount} auto-suspend</span>}
    </div>
  )}
  ```

- Line 164: replace the `StatusBadge` call:

  ```jsx
  <StatusBadge status={deriveDisplayStatus(r) || (r.success ? 'SUCCESS' : 'FAILED')} />
  ```

  Run-level badge (line 86) stays unchanged — `skipCode` is per-account, not per-run.

### 3. `pages/Queue.jsx`

- Top: import `PauseCircle` from `lucide-react` (alongside existing icons).
- Lines 253-265 (entry rendering): add the auto-suspend branch and adjust text color.

  ```jsx
  {entry.skipCode === 'AUTO_SUSPENDED' && <PauseCircle className="w-3 h-3 text-[#A855F7] shrink-0" />}
  {entry.status === 'COMPLETED' && entry.skipCode !== 'AUTO_SUSPENDED' && <CheckCircle2 className="w-3 h-3 text-[#22C55E] shrink-0" />}
  {entry.status === 'FAILED' && <AlertCircle className="w-3 h-3 text-[#EF4444] shrink-0" />}
  {entry.status === 'RUNNING' && <Loader2 className="w-3 h-3 text-[#3B82F6] animate-spin shrink-0" />}
  {entry.status === 'PENDING' && <Clock className="w-3 h-3 text-[#52525B] shrink-0" />}
  {entry.status === 'SKIPPED' && entry.skipCode !== 'AUTO_SUSPENDED' && <XCircle className="w-3 h-3 text-[#52525B] shrink-0" />}
  <span className={`truncate ${
    entry.skipCode === 'AUTO_SUSPENDED' ? 'text-[#A855F7]' :
    entry.status === 'RUNNING' ? 'text-[#3B82F6]' :
    entry.status === 'COMPLETED' ? 'text-[#22C55E]' :
    entry.status === 'FAILED' ? 'text-[#EF4444]' :
    'text-[#A1A1AA]'
  }`}>
  ```

  Note: an auto-suspended account can be `status === 'SKIPPED'` (run skipped pre-check) OR `status === 'COMPLETED'` (batch marked complete with skipCode). The branches above neutralize both cases by gating on `entry.skipCode !== 'AUTO_SUSPENDED'`.

### 4. `pages/ExecutionCenter.jsx`

- Top: import `deriveDisplayStatus` from `@/utils/status`.
- Lines 75-83 — extend `STATUS_COLORS`:

  ```js
  const STATUS_COLORS = {
    RUNNING: '#3B82F6',
    COMPLETED: '#22C55E',
    SUCCESS: '#22C55E',
    FAILED: '#EF4444',
    ERROR: '#EF4444',
    QUEUED: '#8B5CF6',
    DISCONNECTED: '#F59E0B',
    AUTO_SUSPENDED: '#A855F7',
  }
  ```

- Line 106 (rawData mapping): replace `status: run.status || 'RUNNING'` with `status: deriveDisplayStatus(run) || 'RUNNING'`. Note: `run.skipCode` is per-account, not per-run, so this only matters if the timeline ever surfaces account-level rows. If runs themselves don't carry skipCode, this is a no-op — safe.
- Line 285: `<StatusBadge status={deriveDisplayStatus(run) || 'RUNNING'} />`.
- Line 360: `<StatusBadge status={deriveDisplayStatus(account) || 'PENDING'} />`.

## Data flow

```
PostReelWorkflow (sets skipCode in context)
  → WorkflowEngine (reads context, builds WorkflowResult with skipCode)
    ├─ ExecutionRun.AccountRunResult (run history) → /api/automation/runs
    └─ BatchExecutionService → BatchAccountManagerService.markAccountCompleted
        → BatchAccountEntry (queue) → /api/queue
            → Frontend deriveDisplayStatus → StatusBadge (violet)
```

## Migration / rollout

- Pre-deploy entries and run results have no `skipCode` → null → frontend falls back to `status` → existing gray SKIPPED behavior. No backfill required.
- Backend can ship before frontend (skipCode field unused but harmless).
- Frontend can ship before backend (deriveDisplayStatus returns existing status when skipCode is undefined).

## Out of scope

- Adding other `skipCode` values (BANNED, INACTIVE, ERROR) — possible later, additive.
- Backfilling historical runs / queue entries.
- Changing the `WorkflowResult.Status` enum.
- Showing the auto-suspend reason text alongside the badge (already covered by existing `failureReason` rendering at RunRow.jsx:161).
- The dedicated `AutoSuspended.jsx` page — already correct, untouched.

## Testing

- Manual: trigger a run on a device whose account is in `AUTO_SUSPENDED` state → verify Activity Log row shows violet "AUTO_SUSPEND" badge, counter shows "X auto-suspend" in violet, Queue entry shows violet PauseCircle, ExecutionCenter shows violet badge in account list.
- Manual regression: a banned/suspended account still shows gray SKIPPED (skipCode is null for those).
- No automated tests — repo has no test framework.
