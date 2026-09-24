# Settings — restart the Spring Boot backend

## Context

`InstagramAutomation` (port 8081) runs locally through `mvn spring-boot:run`. Nothing supervises it: when it
hangs, crashes or needs to pick up new code, the user has to find the terminal that launched it, kill it and
relaunch Maven. The user wants a button on `/settings` that does this.

Restarting is not free. On `ContextClosedEvent`, `ApplicationShutdownHandler` cancels every RUNNING / PAUSED /
QUEUED task, drops execution checkpoints, releases locks and marks devices IDLE. Auto-creation's global switch
lives in memory and comes back from `auto-creation.global-enabled` in `application.yml` (`false` today).

## Decision

The restart logic lives in the **Vite dev server**, not in Spring. A Spring endpoint cannot help when Spring is
hung or dead, which is precisely when a restart is wanted. The dashboard is dev-only, so `npm run dev` is always
the way it is served.

## Goals

- One button in the Settings "System" card restarts the backend, with a confirmation that states the side effects.
- Works whether the backend is healthy, hung, or already down.
- Relaunching through Maven recompiles, so the button also picks up backend code changes.
- The UI follows the restart (stopping → starting → up) and surfaces Maven failures (compile errors) with the log tail.

## Non-goals

- Blocking the restart while runs are active (the confirmation warns; that is enough).
- Restarting anything other than the process listening on the backend port (Mongo, Appium, Vite itself).
- Serving the button from a production build (`vite build` / `preview`): it is hidden outside `import.meta.env.DEV`.

## Design

### Vite middleware — `dev/backendRestart.js`

`createBackendRestartMiddleware(options)` returns a connect middleware; `backendRestartPlugin(options)` wraps it
in a Vite plugin (`apply: 'serve'`, `configureServer`). Options, wired from env in `vite.config.js`:

| Option | Env | Default |
|---|---|---|
| `backendDir` | `BACKEND_DIR` | `../InstagramAutomation` next to the dashboard |
| `port` | `BACKEND_PORT` | `8081` |
| `startCommand` | `BACKEND_START_CMD` | `mvn spring-boot:run` |
| `stopTimeoutMs` | — | `45000` (Spring graceful phase 30 s + drain 5 s + margin) |
| `startTimeoutMs` | — | `300000` (Maven compile + boot) |

Routes:

- `POST /__dev/backend/restart` → `202 { phase }`, work continues in the background.
  `403` if the request is not local, `409` if a restart is already in progress.
- `GET /__dev/backend/status` → `{ phase, startedAt, finishedAt, pid, error, logTail, logFile }`.

`phase` is `idle` (no restart since Vite started), `stopping`, `starting`, `up` or `failed`.

Restart sequence:

1. **stopping** — `lsof -nP -tiTCP:<port> -sTCP:LISTEN` lists the listening PIDs (Vite's own PID excluded).
   Each gets `SIGTERM`, which runs Spring's graceful shutdown and `ApplicationShutdownHandler`. The middleware waits
   for the **processes to exit** (not only for the port to close: Tomcat stops listening before the shutdown
   handler finishes). After `stopTimeoutMs`, `SIGKILL`, then 5 s more; if a PID is still alive → `failed`.
2. **starting** — `/bin/sh -c "exec <startCommand>"` in `backendDir`, `detached: true`, `unref()`, stdout and
   stderr truncated into `<backendDir>/logs/backend-console.log` (already git-ignored there). The child survives a
   Vite restart. `/actuator/health` (public in `SecurityConfig`) is polled on `127.0.0.1:<port>` every 2 s.
3. **up** when health answers 200. **failed** when the child exits first (compile error, port conflict) or when
   `startTimeoutMs` elapses; `logTail` then carries the last 30 lines of the console log.

A generation counter ties exit/health callbacks to the restart that created them, so the old Maven process
exiting during the next restart cannot flip that restart to `failed`.

Access guard (the route has no JWT, and restarting cancels work):

- socket remote address must be loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) — rejects LAN clients of `--host`;
- `Host` hostname must be `localhost`, `127.0.0.1` or `[::1]` — rejects tunnels forwarding a public host and DNS rebinding;
- if an `Origin` header is present it must equal `http://<Host>` — rejects cross-site form posts from the browser.

### Frontend — `src/components/settings/BackendRestartControl.jsx`

Rendered at the bottom of the Settings "System" card, only when `import.meta.env.DEV`.

- Plain `fetch` on relative URLs (not `apiPost`: no JWT involved, and `VITE_API_URL` must not prefix a dev-server route).
- React Query: `useQuery(['dev-backend-restart'])` for the status, polling every 2 s while `stopping`/`starting`,
  including when the tab is hidden (`refetchIntervalInBackground`: the user often switches to the IDE during the build);
  `useMutation` for the POST.
- Row "Backend Spring Boot" with a phase badge and a **Redémarrer** button (disabled and spinning while in progress).
- Confirmation dialog: the process on port 8081 is stopped and relaunched with `mvn spring-boot:run`
  (recompilation included); running and queued tasks are cancelled; global auto-creation comes back disabled.
- On a `stopping|starting → up` transition: success toast and `queryClient.invalidateQueries()` so the page refetches.
  On `→ failed`: error toast, and the card shows the error, the log file path and the log tail.
- Copy in French, matching recent Settings additions.

## Verification

No test framework in the dashboard. The middleware is exercised by a scratch Node script against a fake backend
(an HTTP server on a spare port answering `/actuator/health`, started through `BACKEND_START_CMD`): restart from
up, from down, a start command that exits (→ `failed` + log tail), a SIGTERM-ignoring process (→ `SIGKILL`),
`409` on double restart, `403` on a non-local `Host`/`Origin`. Then `npm run lint` and `npm run build`, and the UI
checked in the browser against the fake backend. Restarting the real backend cancels live work, so it is only done
with the user's go-ahead.
