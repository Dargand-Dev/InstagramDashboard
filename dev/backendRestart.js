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
