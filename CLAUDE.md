# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Instagram automation dashboard — a React frontend for monitoring and managing Instagram account automation workflows. Displays real-time status of account creation, reel posting, and story posting runs. Connects to a backend API at `localhost:8081` (proxied via Vite dev server).

**Backend**: `/Users/samyhne/IG-bot/InstagramAutomation`

## Commands

```bash
npm run dev      # Start dev server (port 5173, proxies /api → localhost:8081, /ws → ws://localhost:8081)
npm run build    # Production build to /dist
npm run lint     # ESLint
npm run preview  # Preview production build
```

No test framework is configured.

## Tech Stack

- React 19 + JSX (no TypeScript)
- Vite 8 (build + HMR + dev proxy)
- Tailwind CSS 4 via `@tailwindcss/vite` plugin, theme tokens in `src/index.css` `@theme` block
- shadcn/ui (base-nova style, JSX not TSX) — components in `src/components/ui/`
- React Router 7 (client-side routing in `src/App.jsx`)
- TanStack React Query (server state) + Zustand (client state)
- STOMP over SockJS for WebSocket connections
- Recharts (charts), Lucide React (icons), Sonner (toasts)
- Path alias: `@/` → `src/`

## Architecture

### Two Data Fetching Systems (coexist)

The codebase has two API layers — use the right one depending on context:

1. **React Query + `src/lib/api.js`** (preferred for new code): `apiGet`/`apiPost`/`apiPut`/`apiDelete` functions that include JWT auth headers from `authStore` and handle 401 auto-logout. Used with `useQuery`/`useMutation` from React Query via `queryClient` in `src/lib/queryClient.js`.

2. **Legacy `src/hooks/useApi.js`**: Standalone `useApi(url, options)` hook with built-in polling, JSON diff optimization, and loading/error state. Also exports `apiPost`/`apiPut`/`apiDelete` (without auth headers). Some components still use this — don't mix the two in the same component.

### Real-Time Data

- **`useActiveRuns`** — polls `/api/automation/workflow/logs/active-runs` every 4s with JSON diff to avoid re-renders
- **`useWorkflowLogs(runId)`** — EventSource (SSE) stream for live execution logs
- **`useDeviceLogs(udid)`** — SSE stream for per-device log events
- **`useDeviceQueue`** — SSE stream for queue state changes, with mutation helpers (cancel, pause, resume, reorder)
- **`useWebSocket`** — STOMP/SockJS client with auto-reconnect (exponential backoff), subscription management, and JWT auth

### State Management

- **Zustand stores** (`src/stores/`):
  - `authStore` — JWT token + user, persisted to localStorage (`ig_auth_token`, `ig_auth_user`), auto-logout on 401
  - `notificationStore` — in-memory notification list with unread count
- **React Context**: `IncognitoContext` — global toggle to blur sensitive data, persisted to localStorage. Exports `useIncognito()` hook and `<Blur>` wrapper component.

### Routing

All routes defined in `src/App.jsx`. Pages load lazily via `React.lazy()` with `<PageSkeleton />` fallback. All protected routes render inside `AppLayout` which provides the sidebar. Login page is unprotected.

### Styling

Dark-mode only. Theme tokens defined via `@theme` in `src/index.css` (surface colors, border, primary/success/error/warning, text hierarchy). All styling uses inline Tailwind classes. shadcn/ui components use `cn()` from `src/lib/utils.js` for class merging.

### API Contract

- Backend wraps responses in `{ data: ... }` — destructure accordingly
- HTTP 423 indicates distributed lock conflict — handled specially in both API layers (returns `{ locked: true, ...body }`)
- Key API prefixes: `/api/accounts`, `/api/automation/*`, `/api/stats/*`, `/api/devices`, `/api/queue`, `/api/notifications`, `/api/auth`

### Container backends (doritos / crane+ghost)

Each device runs one of two container toolings. The backend resolves it as *manual override >
detection > `DORITOS` default* and ships the result as a computed `effectiveBackend` field on every
device — **don't reimplement that fallback in the UI**. `containerBackend` is the manual choice
(null = auto), `detectedBackend` / `backendProbe` / `backendDetectedAt` are written by the SSH probe
only. Edited from `ContainerBackendCard` in the device detail sheet via `useDeviceBackend.js`, which
owns its own endpoints (`PUT /api/devices/{id}/container-backend`,
`POST /api/devices/{id}/detect-backend`) — outside the sheet's global Edit mode. Ghost presets are
shown only for `CRANE_GHOST` devices and saved through the generic partial `PUT /api/devices/{id}`.
`/backend-comparison` compares both stacks from `GET /api/stats/backend-comparison`.

### Component Organization

- `src/components/ui/` — shadcn/ui primitives (don't edit manually, use `npx shadcn@latest add`)
- `src/components/shared/` — reusable app components (DataTable, StatusBadge, EmptyState, LogViewer, ErrorBoundary, etc.)
- `src/components/layout/` — AppLayout (sidebar + outlet)
- `src/components/auth/` — ProtectedRoute
- `src/components/actions/`, `activity-log/`, `charts/` — domain-specific components
- `src/pages/` — one file per route, lightweight wrappers composing shared/domain components


