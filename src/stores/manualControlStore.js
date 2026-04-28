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
  // Flipped to true by ManualControlBootstrapper quand la subscription STOMP au
  // topic /topic/wall/status est confirmée. VncWall l'attend avant le POST /start
  // pour éviter de perdre les events publiés trop tôt par le backend.
  wallTopicSubscribed: false,

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

  setWallTopicSubscribed: (v) => set({ wallTopicSubscribed: v }),

  // Préserve walling pour ne pas perdre les events STARTING/READY/FAILED
  // qui ont pu arriver avant le retour HTTP du POST /start (race STOMP vs REST).
  startWallSession: (sessionId) =>
    set((s) => ({ wallActive: true, wallSessionId: sessionId, walling: s.walling })),

  endWallSession: () =>
    set({ wallActive: false, wallSessionId: null, walling: {} }),
}))

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // Exposé en dev pour debug : window.__manualControlStore.getState()
  window.__manualControlStore = useManualControlStore
}
