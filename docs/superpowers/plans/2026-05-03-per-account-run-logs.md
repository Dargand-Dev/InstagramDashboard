# Per-account run logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the expanded Activity Log run row, allow opening a modal showing only log lines for one specific account, with run-context lines kept as dimmed background — both for past and live runs.

**Architecture:** Backend emits two textual sentinels (`▶▶ ACCOUNT_BEGIN <username>` / `■■ ACCOUNT_END <username>`) at the entry/exit of `WorkflowEngine.execute()`. Frontend parses log text top-to-bottom with a state machine to extract per-account lines and prefix run-scope lines with `[run] `. Reuses the existing `useRunLogsWithLive` hook, no new endpoint.

**Tech Stack:** Spring Boot 3.4 / Java 17 (backend, 1 file), React 19 / Vite (frontend: 1 utility, 1 modal component, 2 component modifications). No new dependencies.

---

## File Structure

**Backend:**
- `InstagramAutomation/src/main/java/com/automation/instagram/workflow/engine/WorkflowEngine.java` — modify: wrap method body with sentinel `log.info()` calls in `try/finally`

**Frontend:**
- `InstagramDashboard/src/utils/parseAccountLogs.js` — create: pure parser, exports `extractAccountLog(text, username, opts)` and `hasAccountSentinels(text)`
- `InstagramDashboard/src/components/activity-log/AccountLogModal.jsx` — create: modal that filters logs for one account; reuses `useRunLogsWithLive`
- `InstagramDashboard/src/components/activity-log/RunRow.jsx` — modify: add per-account Terminal icon button in expanded view
- `InstagramDashboard/src/components/activity-log/tabs/DeviceRunsTab.jsx` — modify: same per-account button on live run's `accountEntries`

No tests added — repo has no test framework configured (per `InstagramDashboard/CLAUDE.md`). Verification is manual; the parser is small and unit-testable later if Vitest/Jest is added.

---

## Task 1: Backend — emit account boundary sentinels

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/workflow/engine/WorkflowEngine.java`

**Context for the engineer:** `WorkflowEngine.execute(workflow, context)` is invoked once per (account, workflow) pair. The `ParallelExecutionOrchestrator` calls it sequentially in a loop over accounts on a device. The whole method must be wrapped in `try/finally` so the END sentinel always fires, even on exceptions or `IMMEDIATE` kill.

The current method (≈ 200 lines) has many `return` statements scattered through it (early returns on skip, GeoIp failure, cancellation). All must end up emitting the END sentinel — moving them into a `finally` block is the cleanest fix.

**Strategy:** introduce a `try { ... } finally { ... }` around the entire body. The BEGIN log line goes immediately before the existing `▶ Starting workflow` line. The END log line goes in `finally`.

- [ ] **Step 1: Read the full current method**

Run: `wc -l /Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/workflow/engine/WorkflowEngine.java`
Then read the file in full (it's ~200 lines past the `execute()` signature). Locate the method's closing `}` to know where the `finally` block ends.

- [ ] **Step 2: Add BEGIN sentinel and wrap body in try/finally**

In `WorkflowEngine.java`, at the start of `execute()`, after the existing local variable declarations (`workflowName`, `accountUsername`, `identityId`, `startTimeMs`, `runId`, `totalSteps`) and **before** the existing `log.info("▶ Starting workflow ...")` line, add:

```java
        log.info("▶▶ ACCOUNT_BEGIN {}", accountUsername);
        try {
```

Then at the very end of the method body (before the final closing `}` of `execute()`), add:

```java
        } finally {
            log.info("■■ ACCOUNT_END {}", accountUsername);
        }
```

The body of the method is now indented one level deeper inside the `try`. Two ways to apply this:

1. Edit the file twice with the Edit tool: once near the start (insert BEGIN + `try {`), once near the end (insert `} finally { ... }` before the closing `}`). Java compiler verifies the brace match.
2. Don't reformat the inner body's indentation — Java doesn't care, and reformatting the whole method risks accidental edits. Leave the inner code at its current indent level.

- [ ] **Step 3: Compile the backend**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw compile -q`
Expected: BUILD SUCCESS, no errors.

If compile fails because of brace mismatch, re-read the method end to verify the `finally` is placed before the right `}`.

- [ ] **Step 4: Manual smoke test**

Start the backend (`./mvnw spring-boot:run` if not already running). Trigger any run (manual or via the dashboard). Watch the console output: should see `▶▶ ACCOUNT_BEGIN <username>` early in the workflow log and `■■ ACCOUNT_END <username>` at the end.

Quick verification via Mongo (the `run_logs` collection) — query the latest run:
```bash
# Adjust mongo URL/db if needed; just confirm the strings exist
mongosh instagram_automation --quiet --eval 'db.run_logs.findOne({}, { logText: 1 }).logText.split("\n").filter(l => l.includes("ACCOUNT_BEGIN") || l.includes("ACCOUNT_END"))'
```
Expected: at least one BEGIN and one END for each account that ran in the last completed run.

- [ ] **Step 5: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
# Repo root has no git, but if it does at the parent:
cd /Users/samyhne/IG-bot && git status
# If InstagramAutomation isn't tracked here either, skip the commit step — the user will handle backend versioning manually.
```

If the file is in a tracked repo: commit with message `feat(workflow-engine): emit ACCOUNT_BEGIN/END sentinels per account`. Otherwise note in the handoff that backend changes are uncommitted.

---

## Task 2: Frontend — log parser utility

**Files:**
- Create: `InstagramDashboard/src/utils/parseAccountLogs.js`

- [ ] **Step 1: Create the parser file**

Path: `/Users/samyhne/IG-bot/InstagramDashboard/src/utils/parseAccountLogs.js`

```js
const BEGIN_RE = /▶▶ ACCOUNT_BEGIN (\S+)/
const END_RE = /■■ ACCOUNT_END (\S+)/

/**
 * Filtre les lignes de log d'un run pour ne garder que celles d'un compte donné,
 * en préfixant les lignes hors-compte avec "[run] " comme contexte.
 *
 * @param {string} text - Texte complet des logs du run (lignes séparées par \n)
 * @param {string} targetUsername - Username du compte à isoler
 * @param {{ includeContext?: boolean }} [opts]
 * @returns {string} Texte filtré
 */
export function extractAccountLog(text, targetUsername, { includeContext = true } = {}) {
  if (!text) return ''
  const lines = text.split('\n')
  const out = []
  let currentAccount = null

  for (const line of lines) {
    const beginMatch = line.match(BEGIN_RE)
    if (beginMatch) {
      currentAccount = beginMatch[1]
      if (currentAccount === targetUsername) out.push(line)
      continue
    }

    const endMatch = line.match(END_RE)
    if (endMatch) {
      if (endMatch[1] === targetUsername) out.push(line)
      currentAccount = null
      continue
    }

    if (currentAccount === targetUsername) {
      out.push(line)
    } else if (currentAccount === null && includeContext) {
      out.push(`[run] ${line}`)
    }
  }

  return out.join('\n')
}

/**
 * Indique si le texte contient au moins une paire de sentinelles (= run récent
 * avec sentinelles posées). Utilisé par AccountLogModal pour afficher un banner
 * d'avertissement sur les runs antérieurs à la fonctionnalité.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasAccountSentinels(text) {
  if (!text) return false
  return BEGIN_RE.test(text)
}
```

- [ ] **Step 2: Quick sanity check via Node REPL (optional)**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
node -e '
const { extractAccountLog, hasAccountSentinels } = await import("./src/utils/parseAccountLogs.js")
const sample = [
  "2026-05-03 10:00:00 INFO setup",
  "▶▶ ACCOUNT_BEGIN foo",
  "2026-05-03 10:00:01 INFO foo step 1",
  "2026-05-03 10:00:02 INFO foo step 2",
  "■■ ACCOUNT_END foo",
  "2026-05-03 10:00:03 INFO between accounts",
  "▶▶ ACCOUNT_BEGIN bar",
  "2026-05-03 10:00:04 INFO bar step 1",
  "■■ ACCOUNT_END bar",
].join("\n")
console.log("has sentinels:", hasAccountSentinels(sample))
console.log("---")
console.log(extractAccountLog(sample, "foo"))
'
```

Expected output:
```
has sentinels: true
---
[run] 2026-05-03 10:00:00 INFO setup
▶▶ ACCOUNT_BEGIN foo
2026-05-03 10:00:01 INFO foo step 1
2026-05-03 10:00:02 INFO foo step 2
■■ ACCOUNT_END foo
[run] 2026-05-03 10:00:03 INFO between accounts
```

If the import path fails (Vite-only ESM), skip this step — the linter will validate the file shape and the next task uses it from React.

- [ ] **Step 3: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/utils/parseAccountLogs.js
git commit -m "feat(activity-log): parser to extract per-account log lines"
```

---

## Task 3: Frontend — AccountLogModal component

**Files:**
- Create: `InstagramDashboard/src/components/activity-log/AccountLogModal.jsx`

**Reference** (don't copy literally, but understand the shape): `RunLogModal.jsx` — same dialog skeleton, same `useRunLogsWithLive` hook, same Stop/Kill buttons. The new modal differs in: it accepts `username`, applies `extractAccountLog` on the text, shows a banner when no sentinels are found, no "Full Page" button.

- [ ] **Step 1: Create the file**

Path: `/Users/samyhne/IG-bot/InstagramDashboard/src/components/activity-log/AccountLogModal.jsx`

```jsx
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import LogViewer from '@/components/shared/LogViewer'
import { useRunLogsWithLive } from '@/hooks/useRunLogsWithLive'
import { extractAccountLog, hasAccountSentinels } from '@/utils/parseAccountLogs'
import { Terminal, Square, SkullIcon, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function AccountLogModal({ runId, username, open, onClose }) {
  const queryClient = useQueryClient()
  const { text, isLoading, isError, isActive, showingLive, liveConnected } =
    useRunLogsWithLive(runId, { enabled: open })

  const [killDialogOpen, setKillDialogOpen] = useState(false)

  const filteredText = useMemo(
    () => extractAccountLog(text, username, { includeContext: true }),
    [text, username],
  )

  // Run pré-fonctionnalité : pas de sentinelles posées, on ne peut pas filtrer
  const noSentinels = !!text && !hasAccountSentinels(text)

  const stopGraceful = useMutation({
    mutationFn: () => apiPost(`/api/automation/runs/${encodeURIComponent(runId)}/stop`, { mode: 'GRACEFUL' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-runs'] })
      toast.success('Arrêt demandé — la run se terminera après les étapes en cours')
    },
    onError: (err) => toast.error(err.message || 'Échec de l\'arrêt'),
  })

  const killImmediate = useMutation({
    mutationFn: () => apiPost(`/api/automation/runs/${encodeURIComponent(runId)}/stop`, { mode: 'IMMEDIATE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-runs'] })
      toast.success('Run killed')
      setKillDialogOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || 'Kill a échoué')
      setKillDialogOpen(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-[#0A0A0A] border border-[#1a1a1a] sm:max-w-5xl w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden"
        showCloseButton
      >
        <DialogHeader className="border-b border-[#1a1a1a] pb-3">
          <div className="flex items-center justify-between pr-8 gap-3 flex-wrap">
            <DialogTitle className="text-[#FAFAFA] flex items-center gap-2 text-sm">
              <Terminal className="w-4 h-4 text-[#A1A1AA]" />
              Logs — <span className="text-[#3B82F6]">{username}</span>
              <span className="text-[#52525B] text-xs font-mono">· {runId}</span>
              {showingLive ? (
                <Badge variant="outline" className="bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20 text-[10px] gap-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full bg-[#22C55E] ${liveConnected ? 'animate-pulse' : 'opacity-50'}`} />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-[#52525B]/10 text-[#A1A1AA] border-[#52525B]/20 text-[10px]">
                  Completed
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isActive && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    onClick={() => stopGraceful.mutate()}
                    disabled={stopGraceful.isPending}
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Stop Gracefully
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                    onClick={() => setKillDialogOpen(true)}
                  >
                    <SkullIcon className="w-3 h-3 mr-1" />
                    Kill
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {noSentinels && (
          <div className="flex items-start gap-2 px-4 py-2 mt-3 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-xs text-[#F59E0B]">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Aucun marqueur de compte trouvé — ce run est antérieur à la fonctionnalité.
              Les lignes affichées correspondent au contexte global du run uniquement.
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 pt-3">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
              ))}
            </div>
          ) : isError || !filteredText ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-[#52525B]">
                {showingLive ? 'En attente des premières lignes…' : 'Pas de logs disponibles pour ce compte.'}
              </p>
            </div>
          ) : (
            <LogViewer
              text={filteredText}
              follow={showingLive}
              height={Math.min(600, window.innerHeight * 0.65)}
            />
          )}
        </div>

        <Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
          <DialogContent className="bg-[#111111] border-[#1a1a1a] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#FAFAFA]">Kill Execution?</DialogTitle>
              <DialogDescription className="text-[#52525B]">
                This will immediately terminate the execution. Any in-progress actions may leave accounts in an inconsistent state.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" className="text-[#A1A1AA]" />}>
                Cancel
              </DialogClose>
              <Button
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
                onClick={() => killImmediate.mutate()}
                disabled={killImmediate.isPending}
              >
                Kill Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify the import paths exist**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
ls src/hooks/useRunLogsWithLive.js src/utils/parseAccountLogs.js src/components/shared/LogViewer.jsx src/lib/api.js
```
Expected: all four files exist.

- [ ] **Step 3: Run the linter**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 src/components/activity-log/AccountLogModal.jsx src/utils/parseAccountLogs.js
```
Expected: no errors. If ESLint complains about unused imports or warnings, fix them inline before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/activity-log/AccountLogModal.jsx
git commit -m "feat(activity-log): AccountLogModal showing per-account filtered logs"
```

---

## Task 4: Frontend — wire button into RunRow

**Files:**
- Modify: `InstagramDashboard/src/components/activity-log/RunRow.jsx`

**Context for the engineer:** `RunRow` renders one past run. When expanded, it lists each account result row with: status icon, name, duration, screenshot/DOM/error buttons, status badge. We add a Terminal-icon button next to Screenshot/DOM, only when the account has a real username (`getRealUsername(r)` returns non-null) — placeholder names like "Account 1" can't be filtered.

- [ ] **Step 1: Add state and import**

In `RunRow.jsx`, near the top (alongside `useState` import), import the new modal. Locate this line:
```js
import RunLogModal from './RunLogModal'
```
and add right after:
```js
import AccountLogModal from './AccountLogModal'
```

In the `RunRow` function body, locate this line:
```js
const [showLogs, setShowLogs] = useState(false)
```
and add right after:
```js
const [accountLogsFor, setAccountLogsFor] = useState(null) // username | null
```

- [ ] **Step 2: Add the per-account button in the expanded view**

In the same file, find the per-account result row (inside the `{expanded && results.length > 0 && (...)}` block). The current structure of the inner `<div className="flex items-center gap-3">` (right side of the row) contains: durationMs span, screenshot button, DOM link, failureReason span, StatusBadge.

Insert a new button element right after the DOM link (`{r.errorDomPath && (...)})`) and before `{r.failureReason && (...)`. The button should only render when `getRealUsername(r)` is non-null:

```jsx
                    {getRealUsername(r) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAccountLogsFor(getRealUsername(r)) }}
                        className="text-[#3B82F6] hover:text-[#60A5FA] inline-flex items-center gap-1"
                        title="Logs de ce compte uniquement"
                      >
                        <Terminal className="w-3 h-3" />
                      </button>
                    )}
```

`Terminal` is already imported at the top of the file (verify line 7-9 of the existing imports). If not, add it to the lucide-react import list.

- [ ] **Step 3: Render the modal at the bottom of the component**

Find the existing `{showLogs && (<RunLogModal ... />)}` block at the end of `RunRow` (just before the final closing `</div>`). Add right after it:

```jsx
      {accountLogsFor && (
        <AccountLogModal
          runId={run.workflowRunId || runId}
          username={accountLogsFor}
          open={!!accountLogsFor}
          onClose={() => setAccountLogsFor(null)}
        />
      )}
```

Note the same `runId` resolution as `RunLogModal` — `run.workflowRunId || runId` — to handle the fact that legacy run rows may use either field.

- [ ] **Step 4: Run the linter and dev server**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 src/components/activity-log/RunRow.jsx
```

If lint passes, fire up the dev server:
```bash
npm run dev
```

Open `http://localhost:5173/activity-log`, expand a past run with multiple accounts, click on one account's Terminal icon. Expect the AccountLogModal to open showing only that account's lines plus dimmed `[run] ` context.

- [ ] **Step 5: Commit**

```bash
git add src/components/activity-log/RunRow.jsx
git commit -m "feat(activity-log): per-account logs button on RunRow expansion"
```

---

## Task 5: Frontend — wire button into DeviceRunsTab live run

**Files:**
- Modify: `InstagramDashboard/src/components/activity-log/tabs/DeviceRunsTab.jsx`

**Context:** `DeviceRunsTab` shows the currently active run on a device with per-account progress rows (`deviceActiveRun.accountEntries`). We add the same Terminal icon there for live runs.

- [ ] **Step 1: Add state and import**

In `DeviceRunsTab.jsx`, locate:
```js
import RunLogModal from '../RunLogModal'
```
Add after:
```js
import AccountLogModal from '../AccountLogModal'
```

In the function body, locate:
```js
const [logsModalOpen, setLogsModalOpen] = useState(false)
```
Add right after:
```js
const [accountLogsFor, setAccountLogsFor] = useState(null)
```

- [ ] **Step 2: Add the per-account button in the active run's accountEntries loop**

Find the section rendering `deviceActiveRun.accountEntries.map((entry, i) => { ... })`. Inside the row, locate the right-side `<div className="flex items-center gap-3">` containing the duration, errorMessage, and StatusBadge.

Just before the StatusBadge, insert (only when `realUsername` is non-null — the variable is already computed in the existing code):

```jsx
                        {realUsername && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAccountLogsFor(realUsername) }}
                            className="text-[#3B82F6] hover:text-[#60A5FA] inline-flex items-center"
                            title="Logs de ce compte uniquement"
                          >
                            <Terminal className="w-3 h-3" />
                          </button>
                        )}
```

The `Terminal` icon is already imported at line 14-15 of the file. Verify by searching for `Terminal` in the existing import list — if missing, add it.

- [ ] **Step 3: Render the modal at the end of the component**

Find the existing `{logsModalOpen && deviceActiveRun?.runId && (<RunLogModal ... />)}` block at the end of the return. Add right after:

```jsx
      {accountLogsFor && deviceActiveRun?.runId && (
        <AccountLogModal
          runId={deviceActiveRun.runId}
          username={accountLogsFor}
          open={!!accountLogsFor}
          onClose={() => setAccountLogsFor(null)}
        />
      )}
```

- [ ] **Step 4: Run the linter and verify in browser**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 src/components/activity-log/tabs/DeviceRunsTab.jsx
```

In the browser, navigate to Activity Log → click a device with an active run → in the Runs tab, click the Terminal icon next to one of the accountEntries → expect the AccountLogModal to open with live-streaming logs filtered for that account.

- [ ] **Step 5: Commit**

```bash
git add src/components/activity-log/tabs/DeviceRunsTab.jsx
git commit -m "feat(activity-log): per-account live logs button in DeviceRunsTab"
```

---

## Task 6: End-to-end smoke test

- [ ] **Step 1: Trigger a multi-account run**

With backend running and recompiled (Task 1 deployed), trigger a workflow that processes 2+ accounts on one device.

- [ ] **Step 2: Verify live mode**

While the run is in progress:
1. Open Activity Log → click on the active device
2. In the Runs tab, find the active run with multiple accounts
3. Click Terminal icon on the account currently being processed
4. Modal opens, "Live" badge visible, lines stream in
5. Confirm only lines for that account + `[run] ` prefixed context lines appear (no other account's lines)
6. Switch to a finished account in the same run — its modal should show its closed block of logs

- [ ] **Step 3: Verify persisted mode**

After the run completes:
1. Find the completed run in past runs list
2. Expand it
3. Click Terminal icon on each account row
4. Each modal shows only that account's lines + run context

- [ ] **Step 4: Verify legacy run fallback**

1. Find a run from BEFORE Task 1 was deployed
2. Click any account's Terminal icon
3. Expect the warning banner: "Aucun marqueur de compte trouvé — ce run est antérieur à la fonctionnalité"
4. Below the banner, all log lines appear with `[run] ` prefix

- [ ] **Step 5: Verify "no real username" case**

Some runs (account creation flow) may have placeholder names like "Account 1". Confirm the Terminal icon is **not** rendered for these rows.

---

## Self-Review

**Spec coverage check:**

- ✅ Backend sentinels emitted at `WorkflowEngine.execute()` boundary → Task 1
- ✅ Parser utility extracting per-account lines + run context with `[run] ` prefix → Task 2
- ✅ AccountLogModal reusing `useRunLogsWithLive` → Task 3
- ✅ Stop/Kill in modal when isActive, no Full Page → Task 3
- ✅ Banner when no sentinels found → Task 3 (`noSentinels` block)
- ✅ Terminal icon button in RunRow expanded view, only when real username → Task 4
- ✅ Terminal icon in DeviceRunsTab accountEntries loop → Task 5
- ✅ Live + persisted both work via shared `useRunLogsWithLive` → Tasks 3, 6
- ✅ Edge cases (kill mid-account → implicit close): Task 2 parser handles via unconditional overwrite of `currentAccount` on new BEGIN

**Type/name consistency check:**

- Function names: `extractAccountLog`, `hasAccountSentinels` — used identically in Tasks 2, 3
- Component name: `AccountLogModal` — imported as default in Tasks 3 (own file), 4, 5
- Prop names: `runId`, `username`, `open`, `onClose` — same shape as `RunLogModal` for consistency
- State variable: `accountLogsFor` — same in Tasks 4 and 5

**Placeholder scan:** all steps contain executable commands or full code blocks. No "TODO" / "TBD" / "implement later" patterns.

---

## Out of scope (do not implement)

- Cross-run search by username
- Server-side filtering endpoint
- Visual separators between account blocks in the global `RunLogModal`
- Backfilling sentinels into existing `run_logs` documents
