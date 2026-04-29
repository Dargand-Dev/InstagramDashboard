# Terminal SSH par device — design

**Date :** 2026-04-29
**Scope :** dashboard `InstagramDashboard` + backend `InstagramAutomation`
**Statut :** spec validé en brainstorming, à implémenter

## Objectif

Sur la page Devices, ajouter un bouton qui ouvre un terminal SSH interactif vers le device sélectionné. L'utilisateur tape des commandes shell directement depuis le navigateur et voit la sortie en temps réel, comme un vrai terminal.

## Contexte

Le backend `InstagramAutomation` parle déjà aux iPhones jailbreakés en SSH (user `mobile`, password `poiu`, port 22) — aujourd'hui en mode one-shot via `Process` + `sshpass` pour redémarrer `mediareceiverd`. Ce spec étend ce capability à un shell interactif persistant pendant le temps d'une session web.

L'IP du device est stockée sur `DeviceConfigDocument.deviceIp` (collection Mongo `deviceConfigs`).

## Décisions de design (questions de cadrage)

| # | Question | Choix |
|---|----------|-------|
| Q1 | Source de l'IP du device | `DeviceConfigDocument.deviceIp` (Mongo) |
| Q2 | Forme UI | Page dédiée `/devices/:udid/terminal` |
| Q3 | Lifecycle session | Une session SSH par onglet, pas de partage ni replay |
| Q4 | Transport WebSocket | STOMP existant (`useWebSocket`) |
| Q5 | Lib SSH backend | JSch (fork `com.github.mwiede:jsch`) |
| Q6 | Sécurité / rôles | Auth JWT existante uniquement, aucun gate de rôle |

## Architecture

```
┌─ Browser : /devices/:udid/terminal ───────────────┐
│  DeviceTerminal.jsx (page React)                  │
│   ├─ POST /api/devices/{udid}/terminal/sessions   │  (1) ouverture
│   │     ← { sessionId, deviceIp }                 │
│   ├─ STOMP subscribe                              │  (2) output
│   │     /topic/devices/terminal/{sid}/output      │
│   ├─ STOMP send /app/.../{sid}/input  ← keystrokes│  (3) input
│   ├─ STOMP send /app/.../{sid}/resize ← cols/rows │  (4) resize
│   ├─ STOMP send /app/.../{sid}/ping   ← 30s       │  (5) heartbeat
│   └─ DELETE /api/devices/terminal/sessions/{sid}  │  (6) fermeture
└───────────────────────────────────────────────────┘
                       │  WebSocket STOMP + REST (JWT)
                       ▼
┌─ InstagramAutomation backend ─────────────────────┐
│  DeviceTerminalController         (REST)          │
│  DeviceTerminalStompController    (STOMP)         │
│  DeviceTerminalSessionManager     (Map<sid, sess>)│
│  DeviceTerminalSession            (1 par session) │
│   ├─ JSch Session + ChannelShell                  │
│   ├─ reader thread : channel.in → STOMP topic     │
│   └─ writer  : input STOMP → channel.out          │
└───────────────────────────────────────────────────┘
                       │  SSH mobile@<deviceIp>
                       ▼
                  iPhone jailbreaké (port 22)
```

## Backend (InstagramAutomation)

### Dépendance Maven

```xml
<dependency>
  <groupId>com.github.mwiede</groupId>
  <artifactId>jsch</artifactId>
  <version>0.2.20</version>
</dependency>
```

Fork moderne de JSch — l'original `com.jcraft` n'est plus maintenu depuis 2018 et ne supporte pas les algos SSH récents. Le fork `mwiede` est drop-in compatible.

### Configuration (`application.yml`)

```yaml
device:
  ssh:
    user: mobile
    password: poiu
    port: 22
    connect-timeout-ms: 10000
    idle-timeout-ms: 120000
    reaper-interval-ms: 30000
```

Pour ne pas commiter le password en clair, supporter aussi `${DEVICE_SSH_PASSWORD:poiu}` (override par variable d'env).

### `DeviceTerminalController` (REST, `/api/devices`)

| Méthode | Path | Body | Réponse | Erreurs |
|---|---|---|---|---|
| `POST` | `/{udid}/terminal/sessions` | `{}` | `{ sessionId, deviceIp, cols, rows }` | 404 device inconnu, 422 IP manquante, 503 SSH refus/timeout, 500 |
| `DELETE` | `/terminal/sessions/{sessionId}` | — | `204` | idempotent (204 même si session expirée) |

Le `POST` est synchrone : il ouvre vraiment la connexion SSH avant de répondre, ce qui permet de retourner les erreurs réseau/auth en HTTP plutôt que de les pousser asynchronement sur le topic.

### `DeviceTerminalStompController`

Trois `@MessageMapping` :

| Destination client | Payload | Action |
|---|---|---|
| `/app/devices/terminal/{sid}/input` | `{ data: string }` | `session.write(data)` + bump `lastActivityAt` |
| `/app/devices/terminal/{sid}/resize` | `{ cols: int, rows: int }` | `session.resize(cols, rows)` + bump |
| `/app/devices/terminal/{sid}/ping` | `{}` | bump `lastActivityAt` uniquement |

Si `sid` inconnu : log warn + `convertAndSend("/topic/devices/terminal/{sid}/output", { type: "closed", reason: "expired" })` pour que le client ferme l'UI proprement.

### `DeviceTerminalSessionManager` (`@Service`)

```java
private final ConcurrentHashMap<String, DeviceTerminalSession> sessions;

DeviceTerminalSession open(String udid, Principal user) // throws DeviceNotFound, IpMissing, SshUnreachable
Optional<DeviceTerminalSession> get(String sessionId);
void close(String sessionId);
void closeAll();

@Scheduled(fixedDelayString = "${device.ssh.reaper-interval-ms}")
void reapStale();   // ferme les sessions où now - lastActivityAt > idleTimeoutMs

@PreDestroy
void onShutdown() { closeAll(); }
```

`open()` lit `DeviceConfigDocument.deviceIp` via `DeviceConfigService.findByUdid(udid)`, instancie `DeviceTerminalSession`, démarre son reader thread, retourne le wrapper.

### `DeviceTerminalSession` (POJO, 1 instance par session)

Champs :
- `String sessionId` — UUID
- `String udid`, `String deviceIp`, `String userName`
- `JSch.Session sshSession`, `ChannelShell channel`
- `OutputStream channelInput`, `InputStream channelOutput`
- `Thread reader`
- `volatile Instant lastActivityAt`
- `volatile boolean closed` (CAS via `AtomicBoolean`)

**Construction** :
```java
JSch jsch = new JSch();
sshSession = jsch.getSession(user, deviceIp, port);
sshSession.setPassword(password);
Properties config = new Properties();
config.put("StrictHostKeyChecking", "no");
sshSession.setConfig(config);
sshSession.connect(connectTimeoutMs);

channel = (ChannelShell) sshSession.openChannel("shell");
channel.setPtyType("xterm-256color");
channel.setPtySize(80, 24, 80*8, 24*16);  // valeurs par défaut, le client resize ensuite
channelInput = channel.getOutputStream();
channelOutput = channel.getInputStream();
channel.connect();
```

**Reader thread** :
```java
byte[] buf = new byte[4096];
while (!closed) {
  int n = channelOutput.read(buf);
  if (n < 0) { close("eof"); break; }
  String chunk = new String(buf, 0, n, UTF_8);
  messagingTemplate.convertAndSend(
    "/topic/devices/terminal/" + sessionId + "/output",
    Map.of("type", "data", "data", chunk)
  );
}
```

**Format des messages topic** (sérialisés en JSON par Spring) :
- Sortie shell : `{ "type": "data", "data": "<chunk utf-8>" }`
- Fermeture : `{ "type": "closed", "reason": "eof" | "expired" | "error" }`

Le client matche sur `msg.type` puis utilise `msg.data` pour `term.write` ou `msg.reason` pour le toast.

**`write(String data)`** :
```java
channelInput.write(data.getBytes(UTF_8));
channelInput.flush();
lastActivityAt = Instant.now();
```

**`resize(int cols, int rows)`** :
```java
channel.setPtySize(cols, rows, cols * 8, rows * 16);
```

**`close(String reason)`** : idempotent (`AtomicBoolean.compareAndSet`), interrupt reader, `channel.disconnect()`, `sshSession.disconnect()`, broadcast `{ type: "closed", reason }` sur le topic output.

### Tests backend

- `DeviceTerminalSessionManagerTest` :
  - `open` puis `close` retire l'entrée de la map.
  - `close` deux fois est idempotent (pas d'exception).
  - `reapStale` ferme une session avec `lastActivityAt` ancien.
  - `closeAll` ferme tout au shutdown.
- `DeviceTerminalControllerTest` (MockMvc) :
  - `POST` device inconnu → 404.
  - `POST` device sans `deviceIp` → 422.
  - `POST` mock JSch throw `JSchException` → 503.
  - `POST` happy path → 200 + body contient `sessionId`.
  - `DELETE` session inconnu → 204.
- `DeviceTerminalSessionTest` :
  - `write` bump `lastActivityAt`.
  - `resize` propage à `channel.setPtySize` (mock).
  - reader catch `IOException` → ferme la session avec reason `"error"`.

Pas de test STOMP end-to-end (lourd, peu de valeur). Le scénario interactif est vérifié manuellement.

## Frontend (InstagramDashboard)

### Dépendances npm

```
@xterm/xterm
@xterm/addon-fit
@xterm/addon-web-links
```

### Page `src/pages/DeviceTerminal.jsx`

Route : `/devices/:udid/terminal`, lazy-loaded dans `App.jsx`.

Comportement :
- `useParams` pour récupérer `udid`.
- `useQuery(['device-by-udid', udid], () => apiGet(\`/api/devices/udid/${udid}\`))` pour afficher nom + IP dans le header (endpoint existant, retourne le `DeviceConfigDocument`).
- `useMutation` `POST /api/devices/{udid}/terminal/sessions` au mount, store `{ sessionId, deviceIp }` en state local.
- En cas d'erreur de la mutation : `EmptyState` avec message contextualisé selon le code (422 → "IP non configurée", 503 → "SSH injoignable", autre → "Erreur"), bouton "Réessayer".
- Une fois `sessionId` reçu, monte `<TerminalView sessionId={...} onClosed={...} />`.
- À l'unmount du composant : `apiDelete(\`/api/devices/terminal/sessions/${sessionId}\`)` (fire-and-forget).

Header :
- Nom du device + IP en monospace.
- Badge de statut connexion STOMP (réutilise pattern existant).
- Bouton "Reconnect" (re-POST) si la session a été closed.
- Bouton "Back to Devices" qui navigate vers `/devices`.

### Composant `src/components/devices/TerminalView.jsx`

Réutilisable, props : `sessionId`, `onClosed(reason)`.

Implémentation :
- Au mount : crée `new Terminal({ ... })` + `FitAddon` + `WebLinksAddon`, attache à un `<div ref>`.
- `useWebSocket()` :
  - `subscribe(\`/topic/devices/terminal/${sessionId}/output\`, msg => ...)` : si `msg.type === "data"` → `term.write(msg.data)` ; si `msg.type === "closed"` → `onClosed(msg.reason)`.
- `term.onData(data => publish(\`/app/devices/terminal/${sessionId}/input\`, { data }))`.
- `ResizeObserver` sur le conteneur → `fitAddon.fit()` → publish `/resize` `{ cols, rows }`, debounce 100ms.
- `setInterval(30s)` : publish `/ping` `{}`.
- Cleanup unmount : `term.dispose()`, clear interval, unsubscribe.

Style :
- Fond `#0A0A0A`, bordure `#1a1a1a`, font monospace.
- Theme xterm aligné avec `index.css` (couleurs surface, primary).
- Hauteur calc `100vh - <hauteur header>`.

### Modification de `Devices.jsx`

Sur `DeviceCard`, ajouter un bouton "Terminal" entre "Take Control" et le `Switch` :
- Icône `Terminal` de `lucide-react`.
- `onClick={(e) => { e.stopPropagation(); navigate(\`/devices/${device.udid}/terminal\`) }}`.
- `disabled={!device.deviceIp}` avec tooltip "IP non configurée".

Le `useMemo` qui construit `devices` dans `Devices.jsx` doit propager `deviceIp` : ajouter `deviceIp: d.deviceIp` dans l'objet retourné (aujourd'hui le champ n'est pas extrait du `DeviceConfigDocument` lors du merge avec `liveStatuses`).

Aucune modif sur `DeviceDetailSheet`.

### Modification de `App.jsx`

Ajouter la route lazy-loaded :
```jsx
<Route path="/devices/:udid/terminal" element={<DeviceTerminal />} />
```

## Data flow

### Happy path

1. User clique "Terminal" sur la carte device → `navigate("/devices/<udid>/terminal")`.
2. `DeviceTerminal` mount → `POST` → backend ouvre JSch (synchrone, ~200ms à 2s selon réseau) → retourne `{ sessionId }`.
3. `TerminalView` mount → subscribe au topic, attache `onData` et `ResizeObserver`, démarre le ping.
4. User tape → STOMP input → `channel.out`. Shell répond → reader → STOMP topic → `term.write`.
5. User ferme l'onglet → cleanup `apiDelete`. Si le DELETE ne passe pas (ex. fermeture brutale), le reaper tue la session après ≤120s + ≤30s (intervalle reaper).

### Erreurs

| Cas | Détection | UX |
|---|---|---|
| Device inconnu | REST POST → 404 | EmptyState "Device introuvable" + bouton Back |
| `deviceIp` vide | REST POST → 422 | EmptyState "Aucune IP configurée. Édite-le sur Devices." + bouton Back |
| SSH timeout / refus | REST POST → 503 | EmptyState "SSH injoignable (timeout/auth)" + bouton Réessayer |
| Auth STOMP failed | `useWebSocket` | déjà géré (auto-logout 401) |
| STOMP déconnecté en cours | `useWebSocket` status | Banner orange "Connexion perdue, reconnexion…" |
| Session expirée (120s idle) | message `{type:closed, reason:"expired"}` | Toast info + bouton Reconnect (re-POST) |
| Reader EOF (shell tué) | `{type:closed, reason:"eof"}` | Toast info + bouton Reconnect |
| Erreur JSch en cours | `{type:closed, reason:"error"}` | Toast.error + bouton Reconnect |

### Concurrence

Deux onglets sur le même device : Q3 → sessions indépendantes. La `Map` indexée par UUID isole les sessions. `sshd` côté device accepte plusieurs sessions concurrentes (`MaxSessions 10` par défaut).

## Test plan manuel

Golden path :
1. Device online, IP configurée → ouvrir terminal → `whoami` retourne `mobile`.
2. Resize de la fenêtre → `stty size` reflète les nouvelles dimensions.
3. `ls --color=always /var/jb` → couleurs ANSI rendues.
4. `cat /var/log/install.log` → long output sans freeze.
5. `Ctrl+C` interrompt une commande longue.

Edge cases :
6. Fermer l'onglet → vérifier dans les logs backend que la session est fermée (par DELETE puis fallback reaper).
7. Device sans `deviceIp` → 422 + message clair, le bouton est désactivé sur la carte avec tooltip.
8. Device offline (SSH timeout) → 503 + message clair, bouton Réessayer fonctionne.
9. Deux onglets sur le même device → sessions indépendantes, frappes ne se mélangent pas.
10. Pas d'activité 120s → session reaped → toast "Session expirée" + Reconnect possible.

## Risques

- **Mot de passe SSH dans config** : pas pire que l'existant (constantes en dur dans `CreateAccountWorkflow`). Mitigation : supporter `${DEVICE_SSH_PASSWORD}` via env. Ne pas committer le `application.yml` avec le password réel — ou laisser `poiu` qui est déjà dans le repo de toute façon.
- **`StrictHostKeyChecking=no`** : vulnérable au MITM si le LAN est compromis. Mêmes garanties que le `ssh` existant. Acceptable sur réseau local maîtrisé.
- **Heartbeat client requis** : si l'utilisateur lance une commande longue sans frapper de touches pendant 120s, la session sera reaped. Mitigation : ping toutes les 30s qui bumpe `lastActivityAt`.
- **Bundle size xterm.js (~250 KB)** : acceptable car page lazy-loaded ; le reste de l'app n'est pas impacté.
- **Sessions zombies au crash backend** : au shutdown propre, `@PreDestroy closeAll()`. Au crash, le device fermera ses connexions côté SSH par timeout TCP. Pas d'action.
