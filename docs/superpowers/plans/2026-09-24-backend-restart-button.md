# Backend Restart Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Redémarrer" button in the Settings "System" card that stops the Spring Boot backend on port 8081 and relaunches it with `mvn spring-boot:run`, following the restart live.

**Architecture:** A Vite plugin (`dev/backendRestart.js`, dev server only) exposes `POST /__dev/backend/restart` and `GET /__dev/backend/status`, guarded to local requests. It SIGTERMs the listening PIDs, waits for them to exit, spawns Maven detached, and polls `/actuator/health`. The React side is a hook (`useBackendRestart.js`) plus a component (`BackendRestartControl.jsx`) mounted in `Settings.jsx`.

**Tech Stack:** Node 22 (`child_process`, `fetch`), Vite 8 plugin API, React 19, TanStack Query 5, shadcn/ui (base-nova), sonner.

Spec: `docs/superpowers/specs/2026-09-24-backend-restart-button-design.md`.

---

## File map

| File | Responsibility |
|---|---|
| `dev/backendRestart.js` (create) | Restart state machine + connect middleware + Vite plugin. No React, no browser code. |
| `vite.config.js` (modify) | Register the plugin with env-driven options. |
| `src/hooks/useBackendRestart.js` (create) | React Query hooks over the two dev routes. |
| `src/components/settings/BackendRestartControl.jsx` (create) | Row, confirmation dialog, status/failure display, toasts. |
| `src/pages/Settings.jsx` (modify) | Mount the control in the System card, dev only. |

The dashboard has no test framework; the middleware is verified by a scratch script (not committed) against a fake backend.

---

### Task 1: Restart middleware

**Files:**
- Create: `dev/backendRestart.js`
- Scratch (not committed): `$SCRATCH/fake-backend.mjs`, `$SCRATCH/verify-restart.mjs`

- [ ] **Step 1: Write the fake backend and the verification script** (they fail: the module does not exist yet)

`$SCRATCH/fake-backend.mjs`:

```js
import http from 'node:http'

const port = Number(process.env.PORT)
const readyDelay = Number(process.env.READY_DELAY_MS || 0)
const startedAt = Date.now()
if (process.env.IGNORE_SIGTERM) process.on('SIGTERM', () => console.log('SIGTERM ignored'))

http.createServer((req, res) => {
  const ready = Date.now() - startedAt >= readyDelay
  res.writeHead(req.url === '/actuator/health' && ready ? 200 : 503)
  res.end()
}).listen(port, () => console.log(`fake backend pid=${process.pid} port=${port}`))
```

`$SCRATCH/verify-restart.mjs` (run with `node verify-restart.mjs <worktree>`): builds the middleware on port 18090 with
`port: 18081`, `backendDir: $SCRATCH/backend`, `stopTimeoutMs: 2000`, `startTimeoutMs: 15000`, and
`startCommand: env PORT=18081 node $SCRATCH/fake-backend.mjs`, then asserts, in order:

1. `GET status` → 200, `phase: 'idle'`.
2. `POST restart` with nothing on 18081 → 202 `stopping`; a second POST right away → 409; status reaches `up`; health on 18081 is 200.
3. `POST restart` again → the old PID is gone, a new PID is `up`.
4. A second middleware whose command sets `IGNORE_SIGTERM=1` restarts; then the first one restarts it → `up` after the 2 s stop timeout (SIGKILL path).
5. A middleware whose command is `sh -c 'echo "[ERROR] COMPILATION ERROR"; exit 1'` → `failed`, `logTail` contains `COMPILATION ERROR`, and nothing listens on 18081 any more.
6. A middleware with a missing `backendDir` → `failed` with `Dossier backend introuvable`, and a fake started beforehand is **still alive** (no kill without a way back).
7. `Host: evil.example` → 403; `Origin: http://evil.example` with `Host: localhost:18090` → 403; a request sent to the machine's LAN IP → 403.

Cleanup kills whatever still listens on 18081.

- [ ] **Step 2: Run it, expect failure**

Run: `node $SCRATCH/verify-restart.mjs "$PWD"`
Expected: `ERR_MODULE_NOT_FOUND` for `dev/backendRestart.js`.

- [ ] **Step 3: Implement `dev/backendRestart.js`**

```js
import { execFile, spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Redémarrage du backend Spring Boot depuis le serveur de dev Vite.
 *
 * Vit ici et pas dans Spring : un endpoint Spring ne sert à rien quand le backend est planté ou
 * figé, précisément quand on veut le relancer. La route n'a pas de JWT, d'où isLocalRequest.
 */

export const RESTART_ROUTE = '/__dev/backend/restart'
export const STATUS_ROUTE = '/__dev/backend/status'

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const EXIT_POLL_MS = 500
const HEALTH_POLL_MS = 2000
const SIGKILL_GRACE_MS = 5000
const LOG_TAIL_BYTES = 64 * 1024
const LOG_TAIL_LINES = 30

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** PIDs en écoute sur le port. lsof sort en code 1 quand il n'y en a aucun : ce n'est pas une erreur. */
function listeningPids(port) {
  return new Promise((resolve, reject) => {
    execFile('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN'], (err, stdout) => {
      if (err && err.code !== 1) return reject(err)
      const pids = String(stdout).split('\n').map(Number).filter((pid) => pid > 0 && pid !== process.pid)
      resolve([...new Set(pids)])
    })
  })
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM : le processus existe mais appartient à un autre utilisateur
    return err.code === 'EPERM'
  }
}

async function waitForExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (pids.some(isAlive)) {
    if (Date.now() >= deadline) return false
    await sleep(EXIT_POLL_MS)
  }
  return true
}

function sendSignal(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    } catch {
      // déjà arrêté entre-temps
    }
  }
}

async function isHealthy(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/actuator/health`, {
      signal: AbortSignal.timeout(HEALTH_POLL_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Dernières lignes du log console, lues en fin de fichier seulement : il peut peser lourd en DEBUG. */
function readLogTail(logFile) {
  try {
    const { size } = fs.statSync(logFile)
    const length = Math.min(size, LOG_TAIL_BYTES)
    const buffer = Buffer.alloc(length)
    const fd = fs.openSync(logFile, 'r')
    try {
      fs.readSync(fd, buffer, 0, length, size - length)
    } finally {
      fs.closeSync(fd)
    }
    return buffer.toString('utf8').trimEnd().split('\n').slice(-LOG_TAIL_LINES).join('\n')
  } catch {
    return null
  }
}

/**
 * Pas de JWT sur ces routes : on n'accepte que le navigateur de cette machine.
 * - adresse loopback : écarte les clients du réseau local (Vite peut tourner avec --host) ;
 * - Host local : écarte un tunnel qui transmet un nom public, et le DNS rebinding ;
 * - Origin (si présent) identique au Host : écarte un formulaire posté depuis un autre site.
 */
function isLocalRequest(req) {
  if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress)) return false
  const host = req.headers.host
  if (!host) return false
  try {
    if (!LOCAL_HOSTNAMES.has(new URL(`http://${host}`).hostname)) return false
    return !req.headers.origin || new URL(req.headers.origin).host === host
  } catch {
    return false
  }
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function createBackendRestartMiddleware({
  backendDir,
  port = 8081,
  startCommand = 'mvn spring-boot:run',
  stopTimeoutMs = 45000,
  startTimeoutMs = 300000,
}) {
  const logFile = path.join(backendDir, 'logs', 'backend-console.log')
  let generation = 0
  let state = { phase: 'idle', startedAt: null, finishedAt: null, pid: null, error: null, logTail: null }

  const snapshot = () => ({ ...state, logFile, port, startCommand })

  // Un callback d'un redémarrage précédent (l'ancien mvn qui sort, par exemple) ne touche pas au courant
  const update = (gen, patch) => {
    if (gen === generation) state = { ...state, ...patch }
  }
  const finish = (gen, patch) => update(gen, { ...patch, finishedAt: new Date().toISOString() })
  const fail = (gen, error) => finish(gen, { phase: 'failed', error, logTail: readLogTail(logFile) })

  /** SIGTERM (arrêt gracieux Spring + ApplicationShutdownHandler), puis SIGKILL si ça traîne. */
  async function stopBackend() {
    const pids = await listeningPids(port)
    if (pids.length === 0) return
    sendSignal(pids, 'SIGTERM')
    // On attend la fin des processus, pas seulement du port : Tomcat ferme le port avant la fin du nettoyage
    if (await waitForExit(pids, stopTimeoutMs)) return
    sendSignal(pids, 'SIGKILL')
    if (!(await waitForExit(pids, SIGKILL_GRACE_MS))) {
      throw new Error(`Le processus ${pids.join(', ')} ne s'arrête pas, même après SIGKILL`)
    }
  }

  /** Détaché et unref : le backend survit à un redémarrage de Vite. */
  function startBackend(gen) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    const out = fs.openSync(logFile, 'w')
    let child
    try {
      child = spawn('/bin/sh', ['-c', `exec ${startCommand}`], {
        cwd: backendDir,
        detached: true,
        stdio: ['ignore', out, out],
      })
    } finally {
      fs.closeSync(out)
    }
    child.unref()
    child.on('error', (err) => fail(gen, `Lancement impossible : ${err.message}`))
    child.on('exit', (code, signal) => {
      if (state.phase === 'starting') {
        fail(gen, `« ${startCommand} » s'est arrêté avant d'être prêt (${signal || `code ${code}`})`)
      }
    })
    update(gen, { pid: child.pid })
  }

  async function waitUntilUp(gen) {
    const deadline = Date.now() + startTimeoutMs
    while (gen === generation && state.phase === 'starting') {
      const healthy = await isHealthy(port)
      if (gen !== generation || state.phase !== 'starting') return
      if (healthy) return finish(gen, { phase: 'up' })
      if (Date.now() >= deadline) {
        return fail(gen, `Pas de réponse 200 sur /actuator/health après ${Math.round(startTimeoutMs / 1000)} s`)
      }
      await sleep(HEALTH_POLL_MS)
    }
  }

  async function restart(gen) {
    try {
      // Vérifié avant l'arrêt : on ne coupe pas le backend si on ne sait pas le relancer
      if (!fs.statSync(backendDir, { throwIfNoEntry: false })?.isDirectory()) {
        throw new Error(`Dossier backend introuvable : ${backendDir}`)
      }
      await stopBackend()
      update(gen, { phase: 'starting' })
      startBackend(gen)
      await waitUntilUp(gen)
    } catch (err) {
      // Avant le lancement, le log console est celui de l'exécution précédente : on ne l'affiche pas
      if (state.phase === 'starting') fail(gen, err.message)
      else finish(gen, { phase: 'failed', error: err.message })
    }
  }

  return function backendRestartMiddleware(req, res, next) {
    const route = req.url.split('?')[0]
    if (route !== RESTART_ROUTE && route !== STATUS_ROUTE) return next()
    if (!isLocalRequest(req)) {
      return sendJson(res, 403, { error: 'Route réservée au navigateur de cette machine (localhost)' })
    }

    if (route === STATUS_ROUTE) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'GET attendu' })
      return sendJson(res, 200, snapshot())
    }

    if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST attendu' })
    if (state.phase === 'stopping' || state.phase === 'starting') {
      return sendJson(res, 409, { ...snapshot(), error: 'Un redémarrage est déjà en cours' })
    }
    generation += 1
    state = {
      phase: 'stopping', startedAt: new Date().toISOString(), finishedAt: null, pid: null, error: null, logTail: null,
    }
    restart(generation)
    return sendJson(res, 202, snapshot())
  }
}

/** Plugin Vite : serveur de dev uniquement, absent du build de prod. */
export function backendRestartPlugin(options) {
  return {
    name: 'backend-restart',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(createBackendRestartMiddleware(options))
    },
  }
}
```

- [ ] **Step 4: Run the verification script, expect every scenario to pass**

Run: `node $SCRATCH/verify-restart.mjs "$PWD"`
Expected: 7 scenario lines `OK`, exit code 0.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint dev/backendRestart.js
git add dev/backendRestart.js
git commit -m "feat(dev): route Vite de redémarrage du backend Spring Boot"
```

### Task 2: Register the plugin

**Files:**
- Modify: `vite.config.js` (imports, `plugins` array)

- [ ] **Step 1: Add the import and the plugin**

```js
import { backendRestartPlugin } from './dev/backendRestart.js'
```

```js
    plugins: [
      react(),
      tailwindcss(),
      // Bouton « Redémarrer » de /settings (serveur de dev uniquement)
      backendRestartPlugin({
        backendDir: env.BACKEND_DIR || path.resolve(__dirname, '../InstagramAutomation'),
        port: Number(env.BACKEND_PORT) || 8081,
        startCommand: env.BACKEND_START_CMD || 'mvn spring-boot:run',
      }),
    ],
```

- [ ] **Step 2: Check the route is served**

Run: `npx vite --port 5174 --strictPort` in the background with `BACKEND_DIR=$SCRATCH/backend BACKEND_PORT=18081`, then
`curl -s localhost:5174/__dev/backend/status`.
Expected: JSON with `"phase":"idle"`, `"port":18081`.

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "feat(dev): branche la route de redémarrage dans vite.config.js"
```

### Task 3: Hook and Settings control

**Files:**
- Create: `src/hooks/useBackendRestart.js`
- Create: `src/components/settings/BackendRestartControl.jsx`
- Modify: `src/pages/Settings.jsx` (import + System card)

- [ ] **Step 1: Hook `src/hooks/useBackendRestart.js`**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * Redémarrage du backend Spring Boot, piloté par le serveur de dev Vite (dev/backendRestart.js).
 *
 * Pas d'apiGet/apiPost ici : ces routes ne sont pas celles du backend (pas de JWT), et
 * VITE_API_URL ne doit pas préfixer une route servie par Vite lui-même.
 */
const STATUS_URL = '/__dev/backend/status'
const RESTART_URL = '/__dev/backend/restart'
const STATUS_KEY = ['dev-backend-restart']

export const RESTART_IN_PROGRESS = new Set(['stopping', 'starting'])

/** Le serveur n'accepte que localhost : inutile d'interroger la route depuis une autre machine. */
export const isLocalBrowser = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

async function devFetch(url, options) {
  const res = await fetch(url, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.error || `${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }
  return body
}

export function useBackendRestartStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => devFetch(STATUS_URL),
    enabled: isLocalBrowser,
    refetchInterval: (query) => (RESTART_IN_PROGRESS.has(query.state.data?.phase) ? 2000 : false),
  })
}

export function useRestartBackend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => devFetch(RESTART_URL, { method: 'POST' }),
    // Succès comme 409 (redémarrage déjà lancé) : le statut relu déclenche le suivi
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}
```

- [ ] **Step 2: Component `src/components/settings/BackendRestartControl.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Power, RotateCw } from 'lucide-react'
import {
  useBackendRestartStatus, useRestartBackend, RESTART_IN_PROGRESS, isLocalBrowser,
} from '@/hooks/useBackendRestart'

const PHASE_BADGES = {
  stopping: { label: 'Arrêt…', className: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' },
  starting: { label: 'Démarrage…', className: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20' },
  up: { label: 'Relancé', className: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20' },
  failed: { label: 'Échec', className: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' },
}

function formatTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('fr-FR') : ''
}

function describe(status) {
  switch (status.phase) {
    case 'stopping': return `Arrêt du processus sur le port ${status.port}…`
    case 'starting': return `${status.startCommand} : compilation puis démarrage…`
    case 'up': return `Relancé à ${formatTime(status.finishedAt)}`
    case 'failed': return `Échec à ${formatTime(status.finishedAt)}`
    default: return `Port ${status.port} · ${status.startCommand}`
  }
}

/** Ligne « Backend Spring Boot » de la carte System : redémarrage via le serveur de dev Vite. */
export default function BackendRestartControl() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data: status, error } = useBackendRestartStatus()
  const restart = useRestartBackend()
  const phase = status?.phase ?? 'idle'
  const inProgress = RESTART_IN_PROGRESS.has(phase)
  const badge = PHASE_BADGES[phase]

  // Toast sur une fin de redémarrage suivie depuis la page, pas sur l'état trouvé au montage
  const previousPhase = useRef(phase)
  useEffect(() => {
    const previous = previousPhase.current
    previousPhase.current = phase
    if (!RESTART_IN_PROGRESS.has(previous)) return
    if (phase === 'up') {
      toast.success('Backend redémarré')
      // Relance les requêtes tombées pendant la coupure
      queryClient.invalidateQueries()
    } else if (phase === 'failed') {
      toast.error('Échec du redémarrage du backend', { description: status?.error })
    }
  }, [phase, status?.error, queryClient])

  if (!isLocalBrowser || error) {
    return (
      <p className="text-xs text-[#52525B]">
        Redémarrage du backend indisponible : {error?.message || 'ouvrez le dashboard sur localhost'}.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Power className="w-3.5 h-3.5 text-[#52525B]" />
            <span className="text-xs text-[#A1A1AA]">Backend Spring Boot</span>
            {badge && (
              <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
            )}
          </div>
          {status && <p className="text-xs text-[#52525B] mt-1 truncate">{describe(status)}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-[#27272A] text-[#FAFAFA] hover:bg-[#1a1a1a]"
          disabled={!status || inProgress || restart.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <RotateCw className={`w-3 h-3 mr-1 ${inProgress ? 'animate-spin' : ''}`} />
          Redémarrer
        </Button>
      </div>

      {phase === 'failed' && (
        <div className="rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/5 p-3 space-y-2">
          <p className="text-xs text-[#EF4444]">{status.error}</p>
          {status.logTail && (
            <pre className="max-h-48 overflow-auto rounded bg-[#0A0A0A] p-2 text-[10px] leading-4 text-[#A1A1AA] font-mono whitespace-pre-wrap break-all">
              {status.logTail}
            </pre>
          )}
          <p className="text-[10px] text-[#52525B] font-mono break-all">{status.logFile}</p>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Redémarrer le backend ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-[#A1A1AA]">
            <p>
              Le processus qui écoute sur le port {status?.port} sera arrêté, puis relancé avec{' '}
              <code className="font-mono text-xs text-[#FAFAFA]">{status?.startCommand}</code> (le code est recompilé).
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Les tâches en cours et en file d'attente seront annulées.</li>
              <li>
                L'auto-création globale reprendra sa valeur de démarrage
                (<code className="font-mono">auto-creation.global-enabled</code>).
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)} className="text-[#A1A1AA]">
              Annuler
            </Button>
            <Button
              size="sm"
              className="bg-[#F59E0B] hover:bg-[#D97706] text-black"
              disabled={restart.isPending}
              onClick={() => restart.mutate(undefined, { onSettled: () => setConfirmOpen(false) })}
            >
              {restart.isPending ? 'Envoi…' : 'Redémarrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Mount it in `src/pages/Settings.jsx`**

Import next to `SmsProvidersCard`:

```jsx
import BackendRestartControl from '@/components/settings/BackendRestartControl'
```

In the System card, after the rows `.map(...)` inside `<div className="space-y-3">`:

```jsx
              {import.meta.env.DEV && <BackendRestartControl />}
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint` then `npm run build`
Expected: no new lint error in the touched files; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBackendRestart.js src/components/settings/BackendRestartControl.jsx src/pages/Settings.jsx
git commit -m "feat(settings): bouton de redémarrage du backend Spring Boot"
```

### Task 4: Browser check against the fake backend

- [ ] **Step 1:** Worktree Vite on 5174 with `BACKEND_DIR=$SCRATCH/backend BACKEND_PORT=18081 BACKEND_START_CMD="env PORT=18081 READY_DELAY_MS=4000 node $SCRATCH/fake-backend.mjs"` (the API proxy still targets the real backend on 8081, so login works).
- [ ] **Step 2:** Open `http://localhost:5174/settings`, copy the session from the 5173 origin if needed, click **Redémarrer**, confirm; check the badge goes Arrêt… → Démarrage… → Relancé and the success toast shows.
- [ ] **Step 3:** Restart Vite with a failing `BACKEND_START_CMD`, restart from the UI, check the red block with the error, log tail and log path.
- [ ] **Step 4:** Stop the 5174 Vite and the fake backend.
