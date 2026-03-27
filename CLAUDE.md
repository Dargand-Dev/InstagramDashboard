# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Instagram automation dashboard — a React frontend for monitoring and managing Instagram account automation workflows. Displays real-time status of account creation, reel posting, and story posting runs. Connects to a backend API at `localhost:8081` (proxied via Vite dev server).

**Backend**: `/Users/samyhne/Documents/trading automatisé/InstagramAutomation`

## Commands

```bash
npm run dev      # Start dev server (port 5173, proxies /api → localhost:8081)
npm run build    # Production build to /dist
npm run lint     # ESLint
npm run preview  # Preview production build
```

No test framework is configured.

## Tech Stack

- React 19 + JSX (no TypeScript)
- Vite 8 (build + HMR + dev proxy)
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin, theme in `src/index.css`)
- React Router 7 (client-side routing in `src/App.jsx`)
- Recharts (charts/visualization)
- Lucide React (icons)
- Native Fetch API (no axios, no React Query)

## Architecture

### Data Fetching Pattern

All API calls go through three utilities in `src/hooks/useApi.js`:
- `useApi(url, options)` — custom hook for GET requests with loading/error/refetch state
- `apiPost`, `apiPut`, `apiDelete` — standalone functions for mutations
- Components call these directly; there is no service layer

Two specialized hooks for real-time data:
- `useActiveRuns` (`src/hooks/useActiveRuns.js`) — polls `/api/automation/workflow/logs/active-runs` every 4 seconds, uses JSON diff to avoid unnecessary re-renders
- `useWorkflowLogs` (`src/hooks/useWorkflowLogs.js`) — EventSource (SSE) stream for live execution logs

### State Management

- **No external state library** — uses React Context and local useState
- `IncognitoContext` (`src/contexts/`) — global toggle to blur sensitive data (usernames, identities), persisted to localStorage
- `PasswordGate` component (`src/components/`) — client-side session auth using localStorage token

### Routing

Routes defined in `src/App.jsx`. All pages render inside `Layout` which provides the sidebar:

| Path | Page | Purpose |
|------|------|---------|
| `/` | Dashboard | Overview metrics, recent runs, live execution panel |
| `/accounts` | Accounts | Account list with detail editor, inline field editing |
| `/actions` | Actions | Manual trigger of automation actions with device/account selection |
| `/activity` | Activity | Execution history with expandable run details |
| `/posting-runs` | PostingRuns | Reel posting run management |
| `/creation-runs` | CreationRuns | Account creation run management |
| `/posting-history` | PostingHistory | Historical posting records |
| `/analytics` | Analytics | Account performance metrics, sortable table, charts |

### Styling

Dark-mode only. Custom theme defined via `@theme` in `src/index.css`:
- Background: `#000000` (black), surfaces: `#0a0a0a`
- Borders: `#1a1a1a`
- Primary: blue `#3b82f6`
- All styling is inline Tailwind classes — no separate CSS files per component

### API Contract

The backend returns responses wrapped in an object with a `data` field. The frontend destructures this (e.g., `response.data`). HTTP 423 is handled specially to detect distributed lock conflicts.

Key API prefixes:
- `/api/accounts` — account CRUD + status/scheduling updates
- `/api/automation/*` — workflow triggers, run history, content status, scheduling
- `/api/stats/*` — account performance snapshots
- `/api/devices` — device listing
