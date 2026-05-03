# Per-account run logs

## Problem

On Activity Log, when a run processes multiple accounts sequentially on a device, all log lines from all accounts are concatenated into one stream (indexed by `runId` only). To debug a specific account's failure, the user has to manually scan a long log to find which lines belong to which account.

## Goal

From the expanded `RunRow` of a past or live run, allow the user to open a modal showing only the log lines that were emitted while processing one specific account — with non-account lines (run setup, cleanup, errors before the loop) shown as dimmed context.

## Constraints

- **Do not modify** `RunLogCaptureAppender.formatLogLine()` or the persisted log format. The current format `TS [thread] [device:run] LEVEL logger - msg` stays as is.
- The persisted log format already exists in MongoDB for past runs — the solution must work on existing data going forward (no retroactive update needed; older runs without sentinels will simply have one big "run" group).

## Approach: textual sentinels emitted at account boundaries

`WorkflowEngine.execute(workflow, context)` is invoked exactly once per account on a device (the `ParallelExecutionOrchestrator` loop calls it sequentially per account). It is the natural unit of account-scoped work.

We emit two log lines at the entry/exit of `WorkflowEngine.execute()`:

- `▶▶ ACCOUNT_BEGIN <username>` — first log line, before any other workflow logic
- `■■ ACCOUNT_END <username>` — last log line in the `finally` block, after `onAfterExecute`

These sentinels:
- Pass through the existing logback pipeline (captured by `RunLogCaptureAppender` like any other line)
- Use double-glyph Unicode prefixes (`▶▶`, `■■`) to be visually distinct from normal logs (which use single `▶`, `❌`, `✅`, etc.) — collision-free regex matching
- Carry the username as the only payload — frontend reads it directly

The frontend parses the log text, walks lines top-to-bottom, and maintains a "current account" state machine: lines between `BEGIN foo` and `END foo` belong to `foo`; lines outside any pair belong to the run context.

## Architecture

```
┌─ Backend (1 file modified) ─────────────────────────────────────┐
│                                                                  │
│  WorkflowEngine.execute(workflow, context):                      │
│    String username = context.getAccount() != null               │
│        ? context.getAccount().getUsername() : "unknown";        │
│    log.info("▶▶ ACCOUNT_BEGIN {}", username);   ← NEW           │
│    try {                                                         │
│       /* existing logic, unchanged */                            │
│    } finally {                                                   │
│       log.info("■■ ACCOUNT_END {}", username);  ← NEW           │
│    }                                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                           │
                           │ persisted MongoDB (logText) / SSE live
                           ▼
┌─ Frontend ──────────────────────────────────────────────────────┐
│                                                                  │
│  src/utils/parseAccountLogs.js  (NEW)                            │
│    splitLogsByAccount(text) → { byAccount: { foo: [...] },       │
│                                  runContext: [...] }             │
│    extractAccountLog(text, username, { includeContext: true })   │
│      → "[run] line\n[run] line\nrunline\n..." with run lines    │
│        prefixed and rendered dimmer                              │
│                                                                  │
│  src/components/activity-log/AccountLogModal.jsx  (NEW)          │
│    Props: runId, username, open, onClose                         │
│    Reuses useRunLogsWithLive(runId) for text + isActive state    │
│    Applies extractAccountLog on text before passing to LogViewer │
│    Title: "Logs — {username} · {runId}"                          │
│    Stop/Kill actions only when isActive (same as RunLogModal).   │
│    No Full Page button — account-scoped logs are small enough    │
│    that the modal viewport suffices; revisit if users ask.       │
│    If filtered output has no account-specific lines (only [run]  │
│    context), show a small banner above LogViewer:                │
│    "Aucun log spécifique à ce compte. Affichage du contexte du   │
│    run uniquement (ce run est antérieur à la fonctionnalité ou   │
│    le compte n'a pas encore démarré)."                           │
│                                                                  │
│  src/components/activity-log/RunRow.jsx  (MODIFIED)              │
│    For each account row in the expanded run, add a small         │
│    Terminal icon button next to Screenshot/DOM that opens        │
│    AccountLogModal with that account's username.                 │
│    Visible always (not hover-only).                              │
│    Skipped if username is null (e.g. account = "Account 1"       │
│    placeholder — no real username to filter on).                 │
│                                                                  │
│  src/components/activity-log/tabs/DeviceRunsTab.jsx  (MODIFIED) │
│    Same icon button on each accountEntry row of an active run.   │
│    Same conditional on real username.                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Frontend log filtering — algorithm

```js
// parseAccountLogs.js
const BEGIN_RE = /▶▶ ACCOUNT_BEGIN (\S+)/;
const END_RE   = /■■ ACCOUNT_END (\S+)/;

export function extractAccountLog(text, targetUsername, { includeContext = true } = {}) {
  if (!text) return '';
  const lines = text.split('\n');
  const out = [];
  let currentAccount = null;
  for (const line of lines) {
    const beginMatch = line.match(BEGIN_RE);
    const endMatch = line.match(END_RE);

    if (beginMatch) {
      currentAccount = beginMatch[1];
      // The BEGIN line itself belongs to this account
      if (currentAccount === targetUsername) out.push(line);
      continue;
    }
    if (endMatch) {
      // The END line belongs to the closing account
      if (endMatch[1] === targetUsername) out.push(line);
      currentAccount = null;
      continue;
    }

    if (currentAccount === targetUsername) {
      out.push(line);
    } else if (currentAccount === null && includeContext) {
      // Run-context line: dim it via a marker the LogViewer can style,
      // OR prefix with [run] for visual distinction. We choose the prefix
      // approach to stay LogViewer-agnostic (no styling protocol needed).
      out.push(`[run] ${line}`);
    }
  }
  return out.join('\n');
}
```

The `[run]` prefix on context lines is deliberately textual — `LogViewer` is a generic xterm-like component and we don't want to introduce a styling channel for one feature. Visual distinction comes from the prefix itself; future work could colorize lines starting with `[run] ` if needed.

## Live mode

`useRunLogsWithLive(runId)` already returns a continuously-growing `text` string fed by the SSE stream. The filtering is a pure function applied on every render — for live runs, as new lines arrive, the filtered output recomputes. Performance: the run text rarely exceeds a few thousand lines (10k cap in the appender); filtering is O(n) per render, acceptable.

If the target account is the one currently being processed, the user sees lines stream in live. If the account already finished earlier in the run, they see its closed block plus run-context lines that arrive after.

## Edge cases

- **Account with no real username (placeholder "Account N")**: no log button rendered. The user filters by container name elsewhere or uses the full run log.
- **Username collision within a run**: not possible — `WorkflowEngine.execute()` is called once per account per run, and account identities are unique.
- **Runs older than this feature**: no sentinels in their persisted log. Opening AccountLogModal on such a run would show only `[run]`-prefixed lines (everything is "context" because no BEGIN was ever emitted). Acceptable degradation; no migration.
- **Workflow throws before BEGIN is emitted**: if `WorkflowEngine.execute()` is interrupted before its first line, the account has no logs. The modal shows only run-context lines from before. Fine — the failure cause is in those context lines anyway.
- **Workflow killed (IMMEDIATE) mid-account**: the `finally` runs because we're inside the worker thread until the kill handler completes the join — END is emitted before flush. If join times out, END may be missing; the next BEGIN (next account) closes the previous one implicitly. The parser handles this naturally: the `if (beginMatch)` branch unconditionally overwrites `currentAccount` with the new username, so an unclosed previous account is silently dropped. No explicit warning needed — the user sees their target account either has lines or doesn't, no broken state.
- **Context lines emitted between two account blocks** (cleanup of account N, before BEGIN of N+1): correctly classified as `[run]` since `currentAccount` is null after the END.

## Components & files

**Backend (1 file modified):**
- `WorkflowEngine.java` — wrap `execute()` body with `▶▶ ACCOUNT_BEGIN` / `■■ ACCOUNT_END` log lines. The BEGIN goes right after the existing `▶ Starting workflow` line; the END goes in a new `finally` block that wraps the entire current method body.

**Frontend (1 utility, 1 component, 2 modifications):**
- `src/utils/parseAccountLogs.js` (NEW) — pure functions `extractAccountLog`, `splitLogsByAccount`
- `src/components/activity-log/AccountLogModal.jsx` (NEW) — modeled after `RunLogModal`, accepts `username` prop, applies filter
- `src/components/activity-log/RunRow.jsx` (MODIFIED) — add Terminal icon button per account row in the expanded view, conditional on `getRealUsername(r)` being non-null
- `src/components/activity-log/tabs/DeviceRunsTab.jsx` (MODIFIED) — same per-account button on the live run's `accountEntries` rows

## Testing

- Manual: trigger a multi-account run, expand the row, click Logs on one account, confirm only that account's lines + dimmed `[run]` context appear.
- Manual: same on a live run — lines should stream in for the current account.
- Manual: open Logs on an account from an old run (pre-feature) — should show "no per-account logs available" banner since no sentinels were emitted (text will be all `[run]` lines).
- Unit (optional, no framework currently): `extractAccountLog` is pure — could add a vitest test if a framework gets introduced.

## Out of scope

- Cross-run search ("show me all `foo_user` logs across all runs")
- Server-side filtering (frontend filtering is sufficient given the 10k-line cap)
- Updating the `RunLogModal` to show account boundaries visually (vertical separators between account blocks) — could be a follow-up
- Retroactively backfilling sentinels into older `run_logs` documents
