import { create } from 'zustand'

/**
 * Store global pour les sessions de contrôle manuel actives.
 *
 * - `sessions[udid]` contient les détails d'une session (udid, deviceName,
 *   vncUrl, deviceIp, since). Plusieurs sessions peuvent coexister
 *   (multi-prise de main + page VNC Wall).
 * - `walling[udid]` est un état transient pendant qu'une wall démarre :
 *   { status: 'STARTING' | 'READY' | 'FAILED', error? }. Vidé à la fin de la wall.
 * - `wallActive` indique qu'une wall est en cours côté backend (pour
 *   différencier du multi-take-control individuel).
 * - Pas de persist : restauré au mount via GET /api/devices/manual-control/active.
 */
export const useManualControlStore = create((set) => ({
  sessions: {},
  walling: {},
  wallActive: false,
  wallSessionId: null,

  setSession: (udid, session) =>
    set((s) => ({ sessions: { ...s.sessions, [udid]: session } })),

  removeSession: (udid) =>
    set((s) => {
      const { [udid]: _ignored, ...rest } = s.sessions
      return { sessions: rest }
    }),

  clearAll: () => set({ sessions: {}, walling: {}, wallActive: false, wallSessionId: null }),

  setWalling: (udid, status, extras = {}) =>
    set((s) => ({ walling: { ...s.walling, [udid]: { status, ...extras } } })),

  startWallSession: (sessionId) =>
    set({ wallActive: true, wallSessionId: sessionId, walling: {} }),

  endWallSession: () =>
    set({ wallActive: false, wallSessionId: null, walling: {} }),
}))
