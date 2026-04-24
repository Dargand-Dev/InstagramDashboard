# Activity Log — Live Logs in `RunLogModal` — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire en sorte que le bouton `Logs` de la page Activity Log affiche les logs **en direct** quand un run est encore en cours (même format que la vue post-mortem : lignes Spring Boot brutes + filtres ERROR/WARN/INFO), avec bascule propre sur la vue persistée quand le run se termine — y compris en cas de `Stop Gracefully` ou `Kill` déclenchés directement depuis la modale.

**Architecture:** Un nouveau service `RunLogLiveService` expose un SSE `GET /api/automation/runs/{runId}/logs/live` qui envoie (a) un event `snapshot` avec le contenu actuel du buffer de `RunLogCaptureAppender`, (b) des events `line` à chaque ligne future capturée par l'appender via un mécanisme de listeners, (c) un event `complete` quand le run termine. La terminaison synchronise `flushRunLogs` (persistance Mongo) et `completeStream` via un flag `hasBufferBeenClearedFor` sur l'appender : si le buffer n'a pas encore été vidé au moment où `completeStream` est appelé (cas IMMEDIATE kill depuis `ExecutionManagementController` L111 / `DeviceQueueService#cancelTask` L210), la complétion SSE est *différée* jusqu'à ce que `onFlushCompleted` fire depuis `RunLogPersistenceService`, avec un timeout 25s en fallback. Côté frontend, deux nouveaux hooks (`useLiveRunLogs`, `useRunLogsWithLive`) orchestrent la bascule, et `RunLogModal` gagne un badge Live/Completed + boutons Stop/Kill conditionnels.

**Tech Stack:** Spring Boot 3.4 + Java 17 + Logback + SSE + Lombok (backend Automation), React 19 + JSX + React Query + Sonner + @melloware/react-logviewer (frontend Dashboard).

**Spec de référence:** `docs/superpowers/specs/2026-04-24-activity-log-live-logs-design.md`

**Répertoires de travail:**
- Automation (backend) : `/Users/samyhne/IG-bot/InstagramAutomation/`
- Dashboard (frontend) : `/Users/samyhne/IG-bot/InstagramDashboard/`

**Conventions rappel (cf. CLAUDE.md racine + sous-projets):**
- Code en anglais, **commentaires + logs en français**.
- Backend : `./mvnw test -Dtest=ClassName[#methodName]`.
- Frontend : pas de framework de test — test = `npm run lint` + `npm run build` + smoke test manuel via `npm run dev`.
- Backends sur 8081 (Automation), 8082 (Scraper). Frontend sur 5173 (proxy `/api → 8081`).
- Ne PAS toucher : `ExecutionCenter`, `DeviceLogsTab`, `useWorkflowLogs`, `useDeviceLogs`, `SecurityConfig`.

---

## Chunk 1 : Backend — extend `RunLogCaptureAppender` (listener registry + atomicity helpers)

### Task 1.1 — Étendre l'appender avec registre de listeners + flag `cleared` + helper `withBufferLock`

**Context:** L'appender Logback actuel (`RunLogCaptureAppender`) bufferise les lignes par `runId` via MDC. On ajoute : (a) un registre `Consumer<String>` par runId dont les éléments sont notifiés **à l'intérieur** du `synchronized (lines)` de `append()` pour rendre l'invariant "snapshot + subscribe atomique" possible depuis `RunLogLiveService.registerEmitter`, (b) un flag `clearedFlags` mis à TRUE par `getAndClearLogs()` et utilisé par le service live pour décider entre complétion synchrone / différée, (c) un helper `withBufferLock(runId, Supplier<T>)` qui sérialise le snapshot-read + addListener sous le même moniteur que `append()`.

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/logging/RunLogCaptureAppender.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/logging/RunLogCaptureAppenderTest.java` (nouveau — pas de test existant pour l'appender)

> **Note JDK cruciale** (cf. spec §Backend item 1 lignes 94-95) : le buffer doit rester créé via `Collections.synchronizedList(new ArrayList<>())` *sans* mutex explicite — la forme par défaut utilise `this` (le wrapper) comme moniteur interne, donc `synchronized (bufferList)` et `bufferList.add(...)` partagent le même verrou. La forme à deux arguments briserait silencieusement l'atomicité.

- [ ] **Step 1 : Lire l'appender actuel pour connaître l'état de départ**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
cat src/main/java/com/automation/instagram/logging/RunLogCaptureAppender.java
```
Expected: confirmer les champs `buffers`, `byteCounts`, la méthode `append(ILoggingEvent)` ligne 45, la méthode `getAndClearLogs(String)` ligne 65, la méthode `getLogs(String)` ligne 77. Repérer qu'il n'existe pas de test.

- [ ] **Step 2 : Créer le test `RunLogCaptureAppenderTest` — listener reçoit les lignes, snapshot-atomique, flag cleared**

Créer `InstagramAutomation/src/test/java/com/automation/instagram/logging/RunLogCaptureAppenderTest.java` :

```java
package com.automation.instagram.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class RunLogCaptureAppenderTest {

    private RunLogCaptureAppender appender;
    private Logger testLogger;

    @BeforeEach
    void setUp() {
        LoggerContext lc = (LoggerContext) LoggerFactory.getILoggerFactory();
        appender = new RunLogCaptureAppender();
        appender.setContext(lc);
        appender.start();

        testLogger = lc.getLogger("test.run-log-capture");
        testLogger.addAppender(appender);
        testLogger.setLevel(Level.ALL);
        testLogger.setAdditive(false);
    }

    @AfterEach
    void tearDown() {
        testLogger.detachAppender(appender);
        appender.stop();
        MDC.clear();
    }

    @Test
    void listenerReceivesLinesForMatchingRunId() {
        List<String> received = new CopyOnWriteArrayList<>();
        Runnable unsubscribe = appender.addListener("run-A", received::add);

        MDC.put("runId", "run-A");
        testLogger.info("hello A");
        MDC.put("runId", "run-B");
        testLogger.info("hello B");

        assertEquals(1, received.size(), "listener de run-A ne doit recevoir que les lignes de run-A");
        assertTrue(received.get(0).contains("hello A"));

        unsubscribe.run();
        MDC.put("runId", "run-A");
        testLogger.info("after unsubscribe");
        assertEquals(1, received.size(), "après désabonnement, pas de nouvelles lignes");
    }

    @Test
    void withBufferLockProvidesAtomicSnapshotAndSubscribe() throws Exception {
        // Pré-remplir le buffer
        MDC.put("runId", "run-X");
        testLogger.info("line-1");
        testLogger.info("line-2");

        // Thread concurrent qui logge en boucle
        AtomicInteger concurrentLogs = new AtomicInteger(0);
        Thread t = new Thread(() -> {
            MDC.put("runId", "run-X");
            try {
                for (int i = 0; i < 100 && !Thread.currentThread().isInterrupted(); i++) {
                    testLogger.info("concurrent-" + i);
                    concurrentLogs.incrementAndGet();
                }
            } finally {
                MDC.clear();
            }
        });
        t.start();

        // Snapshot + subscribe sous le même verrou : aucune ligne ne peut être manquée
        List<String> listenerLines = new CopyOnWriteArrayList<>();
        List<String> snapshot = new ArrayList<>();
        appender.withBufferLock("run-X", () -> {
            snapshot.addAll(appender.getLogs("run-X"));
            appender.addListener("run-X", listenerLines::add);
            return null;
        });

        t.join(5000);

        // Union snapshot + listener doit couvrir toutes les lignes produites
        // (pas besoin d'égalité exacte — on tolère duplicata nul car le snapshot est sous verrou
        // et les premières notifications au listener arrivent après sortie du verrou)
        int totalCaptured = snapshot.size() + listenerLines.size();
        int expected = 2 + concurrentLogs.get();
        assertTrue(totalCaptured >= expected,
                "snapshot(" + snapshot.size() + ") + listener(" + listenerLines.size()
                        + ") = " + totalCaptured + " doit couvrir au moins " + expected);
    }

    @Test
    void getAndClearLogsSetsClearedFlagAndRemovesListeners() {
        MDC.put("runId", "run-Y");
        testLogger.info("line");
        assertFalse(appender.hasBufferBeenClearedFor("run-Y"));

        List<String> received = new CopyOnWriteArrayList<>();
        appender.addListener("run-Y", received::add);

        appender.getAndClearLogs("run-Y");
        assertTrue(appender.hasBufferBeenClearedFor("run-Y"), "flag cleared doit passer à TRUE");

        // Après getAndClearLogs, les listeners sont retirés → pas de nouveaux appels
        testLogger.info("after clear");
        assertEquals(0, received.size(), "listener retiré après getAndClearLogs");
    }

    @Test
    void resetClearedAllowsFreshCycle() {
        MDC.put("runId", "run-Z");
        testLogger.info("line");
        appender.getAndClearLogs("run-Z");
        assertTrue(appender.hasBufferBeenClearedFor("run-Z"));

        appender.resetCleared("run-Z");
        assertFalse(appender.hasBufferBeenClearedFor("run-Z"));
    }
}
```

- [ ] **Step 3 : Lancer le test — il doit échouer (méthodes absentes)**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw test -Dtest=RunLogCaptureAppenderTest
```
Expected: **FAIL** — compilation error `cannot find symbol: method addListener`, `withBufferLock`, `hasBufferBeenClearedFor`, `resetCleared`.

- [ ] **Step 4 : Implémenter les extensions dans `RunLogCaptureAppender`**

Modifier `RunLogCaptureAppender.java`. Après le champ `byteCounts`, ajouter :

```java
    // Registre des listeners notifiés à chaque nouvelle ligne (sous moniteur du buffer list)
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<java.util.function.Consumer<String>>> listeners =
            new ConcurrentHashMap<>();
    // Flag runId → TRUE lorsque getAndClearLogs a vidé le buffer (utilisé par RunLogLiveService)
    private final ConcurrentHashMap<String, Boolean> clearedFlags = new ConcurrentHashMap<>();
```

Ajouter les imports nécessaires en haut :
```java
import java.util.function.Consumer;
import java.util.function.Supplier;
```

Modifier `append(ILoggingEvent event)` — la notification des listeners doit se faire **à l'intérieur** du verrou intrinsèque de `lines` (le wrapper `synchronizedList`). Remplacer :
```java
        if (lines.size() >= MAX_LINES_PER_RUN || bytes.get() >= MAX_BYTES_PER_RUN) return;

        String formatted = formatLogLine(event);
        lines.add(formatted);
        bytes.addAndGet(formatted.length());
```
par :
```java
        if (lines.size() >= MAX_LINES_PER_RUN || bytes.get() >= MAX_BYTES_PER_RUN) return;

        String formatted = formatLogLine(event);
        // Sous le même moniteur que lines (synchronizedList → mutex = wrapper lui-même)
        // pour que snapshot + subscribe de RunLogLiveService soit atomique relativement à append()
        synchronized (lines) {
            lines.add(formatted);
            bytes.addAndGet(formatted.length());
            CopyOnWriteArrayList<Consumer<String>> ls = listeners.get(runId);
            if (ls != null && !ls.isEmpty()) {
                for (Consumer<String> l : ls) {
                    try {
                        l.accept(formatted);
                    } catch (Exception ignored) {
                        // Un listener défaillant ne doit jamais casser le pipeline Logback
                    }
                }
            }
        }
```

Modifier `getAndClearLogs(String runId)` — poser le flag cleared + retirer les listeners orphelins :
```java
    public List<String> getAndClearLogs(String runId) {
        List<String> lines = buffers.remove(runId);
        byteCounts.remove(runId);
        clearedFlags.put(runId, Boolean.TRUE);
        listeners.remove(runId);
        if (lines == null) return Collections.emptyList();
        synchronized (lines) {
            return new ArrayList<>(lines);
        }
    }
```

Ajouter les 4 nouvelles méthodes publiques en bas du fichier (avant la dernière accolade) :

```java
    /**
     * Ajoute un listener notifié à chaque nouvelle ligne capturée pour ce runId.
     * Retourne un Runnable de désabonnement.
     */
    public Runnable addListener(String runId, Consumer<String> listener) {
        listeners.computeIfAbsent(runId, k -> new CopyOnWriteArrayList<>()).add(listener);
        return () -> {
            CopyOnWriteArrayList<Consumer<String>> ls = listeners.get(runId);
            if (ls != null) ls.remove(listener);
        };
    }

    /**
     * Exécute {@code fn} sous le moniteur du buffer pour ce runId — utilisé par
     * RunLogLiveService pour rendre atomique snapshot + addListener.
     */
    public <T> T withBufferLock(String runId, Supplier<T> fn) {
        List<String> buf = buffers.computeIfAbsent(
                runId, k -> Collections.synchronizedList(new ArrayList<>()));
        synchronized (buf) {
            return fn.get();
        }
    }

    /**
     * Indique si le buffer a déjà été vidé (= flushRunLogs a run).
     * Utilisé par RunLogLiveService.completeForRun pour choisir sync vs différé.
     */
    public boolean hasBufferBeenClearedFor(String runId) {
        return Boolean.TRUE.equals(clearedFlags.get(runId));
    }

    /**
     * Retire le flag cleared pour ce runId (appelé par RunLogLiveService après drain
     * pour éviter une croissance non-bornée de la map).
     */
    public void resetCleared(String runId) {
        clearedFlags.remove(runId);
    }
```

- [ ] **Step 5 : Lancer le test — il doit passer**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw test -Dtest=RunLogCaptureAppenderTest
```
Expected: `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Step 6 : Commit**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/logging/RunLogCaptureAppender.java src/test/java/com/automation/instagram/logging/RunLogCaptureAppenderTest.java
git commit -m "feat(logging): add listener registry + cleared flag to RunLogCaptureAppender

Prepares the appender for real-time consumption by RunLogLiveService:
- addListener/withBufferLock expose atomic snapshot+subscribe to clients
- clearedFlags tracks whether getAndClearLogs has already run, so
  RunLogLiveService can distinguish sync vs deferred completion paths
- Listener notifications are inside the synchronized block so the
  snapshot-race invariant holds."
```

---

## Chunk 2 : Backend — `RunLogLiveService` + controller SSE

### Task 2.1 — Créer `RunLogLiveService` (état + registerEmitter + completeForRun + onFlushCompleted + drain)

**Context:** Ce service gère le cycle complet d'un SSE emitter par runId : enregistrement avec snapshot + subscribe atomique, complétion synchrone ou différée selon `hasBufferBeenClearedFor`, timeout 25s de fallback, drain idempotent. Chaque emitter reçoit un **listener non-bloquant** (enqueue + executor daemon) pour éviter qu'un client lent ne stalle le pipeline Logback.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveService.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/workflow/streaming/RunLogLiveServiceTest.java`

- [ ] **Step 1 : Regarder le pattern du service existant pour rester cohérent**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
cat src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java
```
Expected: voir `@Slf4j @Service @RequiredArgsConstructor`, `SimpMessagingTemplate`, `SseEmitter(0L)`, `ObjectMapper`, `ScheduledExecutorService` nommé via `new Thread(r, "…")`, `@PostConstruct`/`@PreDestroy`. Le nouveau service suivra exactement ces conventions (noms de thread, `@Slf4j`, `@RequiredArgsConstructor`, daemon threads).

- [ ] **Step 2 : Écrire le test `RunLogLiveServiceTest` qui couvre les cas critiques (E2, sync drain, deferred drain via onFlushCompleted, timeout, idempotence)**

Créer `InstagramAutomation/src/test/java/com/automation/instagram/workflow/streaming/RunLogLiveServiceTest.java` :

```java
package com.automation.instagram.workflow.streaming;

import com.automation.instagram.logging.RunLogCaptureAppender;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RunLogLiveServiceTest {

    private RunLogCaptureAppender appender;
    private Logger testLogger;
    private WorkflowLogService workflowLogService;
    private RunLogLiveService service;

    @BeforeEach
    void setUp() {
        LoggerContext lc = (LoggerContext) LoggerFactory.getILoggerFactory();
        appender = new RunLogCaptureAppender();
        appender.setContext(lc);
        appender.start();
        // Exposer l'instance statique attendue par le service
        RunLogCaptureAppender.setInstanceForTest(appender);

        testLogger = lc.getLogger("test.run-log-live");
        testLogger.addAppender(appender);
        testLogger.setLevel(ch.qos.logback.classic.Level.ALL);
        testLogger.setAdditive(false);

        workflowLogService = mock(WorkflowLogService.class);
        service = new RunLogLiveService(workflowLogService);
        service.initExecutor();
    }

    @AfterEach
    void tearDown() {
        testLogger.detachAppender(appender);
        appender.stop();
        service.shutdown();
        MDC.clear();
    }

    @Test
    void registerEmitter_unknownRun_completesImmediately() {
        when(workflowLogService.isActive("ghost")).thenReturn(false);
        SseEmitter emitter = service.registerEmitter("ghost");
        assertNotNull(emitter);
        // Pas d'exception — l'emitter est déjà complété
    }

    @Test
    void registerEmitter_activeRun_receivesSnapshotAndLiveLines() throws Exception {
        MDC.put("runId", "run-1");
        testLogger.info("pre-line-1");
        testLogger.info("pre-line-2");

        when(workflowLogService.isActive("run-1")).thenReturn(true);
        SseEmitter emitter = service.registerEmitter("run-1");
        assertNotNull(emitter);
        // (L'assertion que le snapshot/lignes sont envoyés côté réseau nécessite un
        // test d'intégration MockMvc — couvert en 2.3. Ici on se contente de vérifier
        // que l'emitter est enregistré dans la map interne.)
        assertEquals(1, service.openEmitterCountForTest("run-1"));
    }

    @Test
    void completeForRun_whenBufferCleared_drainsSynchronously() {
        MDC.put("runId", "run-sync");
        testLogger.info("line");
        when(workflowLogService.isActive("run-sync")).thenReturn(true);
        SseEmitter e = service.registerEmitter("run-sync");
        assertEquals(1, service.openEmitterCountForTest("run-sync"));

        // Simule flush worker thread
        appender.getAndClearLogs("run-sync");
        assertTrue(appender.hasBufferBeenClearedFor("run-sync"));

        service.completeForRun("run-sync", "SUCCESS");

        assertEquals(0, service.openEmitterCountForTest("run-sync"));
        assertFalse(service.hasPendingForTest("run-sync"));
        assertFalse(appender.hasBufferBeenClearedFor("run-sync"), "resetCleared appelé");
    }

    @Test
    void completeForRun_whenBufferNotCleared_defersUntilOnFlushCompleted() {
        MDC.put("runId", "run-kill");
        testLogger.info("line-before-kill");
        when(workflowLogService.isActive("run-kill")).thenReturn(true);
        service.registerEmitter("run-kill");

        // IMMEDIATE kill path : completeStream fires avant flush
        service.completeForRun("run-kill", "CANCELLED");
        assertTrue(service.hasPendingForTest("run-kill"));
        assertEquals(1, service.openEmitterCountForTest("run-kill"),
                "emitter reste ouvert pendant que la complétion est pending");

        // Worker thread finit ensuite → flush → onFlushCompleted
        appender.getAndClearLogs("run-kill");
        service.onFlushCompleted("run-kill");

        assertFalse(service.hasPendingForTest("run-kill"));
        assertEquals(0, service.openEmitterCountForTest("run-kill"));
    }

    @Test
    void completeForRun_secondCall_isIdempotent() {
        MDC.put("runId", "run-dup");
        testLogger.info("line");
        when(workflowLogService.isActive("run-dup")).thenReturn(true);
        service.registerEmitter("run-dup");

        service.completeForRun("run-dup", "CANCELLED"); // deferred
        service.completeForRun("run-dup", "CANCELLED"); // idempotent no-op

        assertTrue(service.hasPendingForTest("run-dup"), "un seul pending malgré deux appels");
    }

    @Test
    void onFlushCompleted_withoutPending_isNoOp() {
        service.onFlushCompleted("non-existent");
        // Pas d'exception
    }

    @Test
    void deferredTimeout_forcesCompletionAfterGracePeriod() throws Exception {
        MDC.put("runId", "run-timeout");
        testLogger.info("line");
        when(workflowLogService.isActive("run-timeout")).thenReturn(true);
        service.registerEmitter("run-timeout");

        // Override le timeout pour le test (via setter de test)
        service.setPendingTimeoutMsForTest(200);

        service.completeForRun("run-timeout", "CANCELLED");
        assertTrue(service.hasPendingForTest("run-timeout"));

        // Attendre que le timeout fire
        Thread.sleep(500);
        assertFalse(service.hasPendingForTest("run-timeout"),
                "timeout doit avoir drainé le pending");
        assertEquals(0, service.openEmitterCountForTest("run-timeout"));
    }
}
```

> **Note** : ce test nécessite un hook `RunLogCaptureAppender.setInstanceForTest(...)` et quelques accesseurs de test (`openEmitterCountForTest`, `hasPendingForTest`, `setPendingTimeoutMsForTest`, `initExecutor` public). On les ajoutera dans l'implémentation plutôt que d'utiliser la réflexion — ça reste simple et aligné avec les conventions du projet.

- [ ] **Step 3 : Lancer le test — il doit échouer (classes absentes)**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw test -Dtest=RunLogLiveServiceTest
```
Expected: **FAIL** — `cannot find symbol: class RunLogLiveService`, `setInstanceForTest` inconnu.

- [ ] **Step 4 : Ajouter le hook `setInstanceForTest` à l'appender**

Modifier `RunLogCaptureAppender.java`. Juste après la méthode `getInstance()` existante :

```java
    /** Test-only : forcer l'instance statique pour les tests unitaires. */
    static void setInstanceForTest(RunLogCaptureAppender appenderForTest) {
        instance = appenderForTest;
    }
```

- [ ] **Step 5 : Créer `RunLogLiveService`**

Créer `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveService.java` :

```java
package com.automation.instagram.workflow.streaming;

import com.automation.instagram.logging.RunLogCaptureAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.function.Consumer;

/**
 * Gère le streaming SSE temps réel des logs bruts Spring Boot par runId.
 * Branché sur RunLogCaptureAppender (via listeners) et coordonné avec
 * RunLogPersistenceService.flushRunLogs via onFlushCompleted pour assurer
 * que la fin du stream arrive après l'écriture Mongo, même en cas d'IMMEDIATE kill.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RunLogLiveService {

    /** Durée par défaut après laquelle une complétion différée est forcée (ms). */
    private static final long DEFAULT_PENDING_TIMEOUT_MS = 25_000L;

    private final WorkflowLogService workflowLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // État interne
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<SseEmitter, Runnable> listenerUnsubscribers = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, PendingCompletion> pendingCompletions = new ConcurrentHashMap<>();
    // Queue + executor par emitter pour garantir un listener non-bloquant
    private final ConcurrentHashMap<SseEmitter, BlockingQueue<String>> emitterQueues = new ConcurrentHashMap<>();

    private ScheduledExecutorService timeoutExecutor;
    private ExecutorService sendExecutor;
    private volatile long pendingTimeoutMs = DEFAULT_PENDING_TIMEOUT_MS;

    private record PendingCompletion(String runId, String status, ScheduledFuture<?> timeoutTask) {}

    @PostConstruct
    public void initExecutor() {
        if (timeoutExecutor != null) return; // idempotent (appelé aussi depuis les tests)
        timeoutExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "run-log-live-timeout");
            t.setDaemon(true);
            return t;
        });
        sendExecutor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "run-log-live-send");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Enregistre un nouvel emitter SSE pour un runId donné.
     * Atomicité snapshot + subscribe garantie par withBufferLock sur l'appender.
     */
    public SseEmitter registerEmitter(String runId) {
        SseEmitter emitter = new SseEmitter(0L);
        RunLogCaptureAppender appender = RunLogCaptureAppender.getInstance();
        if (appender == null) {
            sendComplete(emitter, runId, "UNAVAILABLE");
            emitter.complete();
            return emitter;
        }

        // Queue + worker non-bloquant pour ce emitter
        BlockingQueue<String> queue = new LinkedBlockingQueue<>(1024);
        emitterQueues.put(emitter, queue);
        sendExecutor.submit(() -> drainQueue(emitter, queue));

        // Snapshot + addListener sous le moniteur du buffer
        final Runnable[] unsubscribeHolder = new Runnable[1];
        final List<String>[] snapshotHolder = new List[1];
        appender.withBufferLock(runId, () -> {
            snapshotHolder[0] = appender.getLogs(runId);
            unsubscribeHolder[0] = appender.addListener(runId, queue::offer);
            return null;
        });
        List<String> snapshot = snapshotHolder[0];
        Runnable unsubscribe = unsubscribeHolder[0];

        // Edge E2 : run inconnu ET snapshot vide → complete immédiat
        if (snapshot.isEmpty() && !workflowLogService.isActive(runId)) {
            unsubscribe.run();
            sendComplete(emitter, runId, "UNKNOWN");
            try { emitter.complete(); } catch (Exception ignored) {}
            cleanupEmitter(emitter, runId);
            return emitter;
        }

        // Envoyer le snapshot
        sendSnapshot(emitter, snapshot);

        // Enregistrer l'emitter
        listenerUnsubscribers.put(emitter, unsubscribe);
        emitters.computeIfAbsent(runId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        Runnable cleanup = () -> cleanupEmitter(emitter, runId);
        emitter.onCompletion(cleanup);
        emitter.onError(e -> cleanup.run());
        emitter.onTimeout(cleanup);

        return emitter;
    }

    /**
     * Appelé en fin de run par WorkflowLogService.completeStream.
     * Si le buffer n'a pas encore été vidé → différé ; sinon → drain synchrone.
     */
    public void completeForRun(String runId, String status) {
        if (pendingCompletions.containsKey(runId)) {
            // Idempotent : un pending existe déjà
            return;
        }
        RunLogCaptureAppender appender = RunLogCaptureAppender.getInstance();
        if (appender != null && !appender.hasBufferBeenClearedFor(runId)) {
            // Différé : on attend onFlushCompleted
            ScheduledFuture<?> timeoutTask = timeoutExecutor.schedule(
                    () -> drainPending(runId, "TIMEOUT"),
                    pendingTimeoutMs, TimeUnit.MILLISECONDS);
            pendingCompletions.put(runId, new PendingCompletion(runId, status, timeoutTask));
            return;
        }
        drainImmediately(runId, status);
    }

    /**
     * Appelé par RunLogPersistenceService.flushRunLogs une fois le save Mongo terminé.
     * Si un pending existe pour ce runId, on le draine ; sinon no-op.
     */
    public void onFlushCompleted(String runId) {
        PendingCompletion pending = pendingCompletions.remove(runId);
        if (pending == null) return;
        pending.timeoutTask().cancel(false);
        drainImmediately(runId, pending.status());
    }

    private void drainPending(String runId, String status) {
        PendingCompletion pending = pendingCompletions.remove(runId);
        if (pending == null) return; // déjà drainé par onFlushCompleted
        log.warn("Timeout de {} ms sur la complétion différée du run {} — force complete (flushRunLogs n'a pas fire)",
                pendingTimeoutMs, runId);
        drainImmediately(runId, status);
    }

    private void drainImmediately(String runId, String status) {
        CopyOnWriteArrayList<SseEmitter> list = emitters.remove(runId);
        RunLogCaptureAppender appender = RunLogCaptureAppender.getInstance();
        if (appender != null) appender.resetCleared(runId);
        if (list == null) return;
        for (SseEmitter emitter : list) {
            sendComplete(emitter, runId, status);
            try { emitter.complete(); } catch (Exception ignored) {}
        }
    }

    private void cleanupEmitter(SseEmitter emitter, String runId) {
        Runnable unsubscribe = listenerUnsubscribers.remove(emitter);
        if (unsubscribe != null) unsubscribe.run();
        BlockingQueue<String> q = emitterQueues.remove(emitter);
        if (q != null) q.offer(POISON_PILL);
        CopyOnWriteArrayList<SseEmitter> list = emitters.get(runId);
        if (list != null) list.remove(emitter);
    }

    private static final String POISON_PILL = "__RUN_LOG_LIVE_POISON_PILL__";

    private void drainQueue(SseEmitter emitter, BlockingQueue<String> queue) {
        try {
            while (true) {
                String line = queue.take();
                if (line == POISON_PILL) return;
                try {
                    emitter.send(SseEmitter.event()
                            .name("line")
                            .data(objectMapper.writeValueAsString(Map.of("line", line))));
                } catch (Exception e) {
                    // Connexion fermée côté client — on arrête la boucle
                    return;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void sendSnapshot(SseEmitter emitter, List<String> lines) {
        try {
            emitter.send(SseEmitter.event()
                    .name("snapshot")
                    .data(objectMapper.writeValueAsString(Map.of("lines", lines))));
        } catch (Exception e) {
            log.debug("Échec envoi snapshot: {}", e.getMessage());
        }
    }

    private void sendComplete(SseEmitter emitter, String runId, String status) {
        try {
            emitter.send(SseEmitter.event()
                    .name("complete")
                    .data(objectMapper.writeValueAsString(Map.of(
                            "runId", runId, "status", status))));
        } catch (Exception e) {
            log.debug("Échec envoi complete pour runId={}: {}", runId, e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        // Cancel timeouts
        pendingCompletions.values().forEach(p -> p.timeoutTask().cancel(false));
        pendingCompletions.clear();
        // Close emitters
        emitters.forEach((runId, list) -> {
            for (SseEmitter e : list) {
                sendComplete(e, runId, "SHUTDOWN");
                try { e.complete(); } catch (Exception ignored) {}
            }
        });
        emitters.clear();
        // Poison queues to unblock drainQueue workers
        emitterQueues.values().forEach(q -> q.offer(POISON_PILL));
        emitterQueues.clear();
        listenerUnsubscribers.clear();
        if (timeoutExecutor != null) timeoutExecutor.shutdownNow();
        if (sendExecutor != null) sendExecutor.shutdownNow();
    }

    // --- Accesseurs de test ---

    int openEmitterCountForTest(String runId) {
        CopyOnWriteArrayList<SseEmitter> list = emitters.get(runId);
        return list == null ? 0 : list.size();
    }

    boolean hasPendingForTest(String runId) {
        return pendingCompletions.containsKey(runId);
    }

    void setPendingTimeoutMsForTest(long ms) {
        this.pendingTimeoutMs = ms;
    }
}
```

- [ ] **Step 6 : Ajouter `isActive(String)` à `WorkflowLogService`**

Modifier `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java`. Ajouter juste après la méthode `getActiveRuns()` (ligne ~78) :

```java
    /**
     * Indique si le runId est actuellement enregistré comme actif.
     * Utilisé par RunLogLiveService pour les checks d'existence.
     */
    public boolean isActive(String runId) {
        return runId != null && activeRuns.containsKey(runId);
    }
```

- [ ] **Step 7 : Lancer le test `RunLogLiveServiceTest` — il doit passer**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw test -Dtest=RunLogLiveServiceTest
```
Expected: `Tests run: 7, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Step 8 : Commit**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveService.java \
        src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java \
        src/main/java/com/automation/instagram/logging/RunLogCaptureAppender.java \
        src/test/java/com/automation/instagram/workflow/streaming/RunLogLiveServiceTest.java
git commit -m "feat(streaming): add RunLogLiveService with deferred completion

Coordinates live SSE emission of raw Spring Boot log lines with
RunLogPersistenceService.flushRunLogs:
- sync path when buffer is already cleared
- deferred path with 25s timeout when completeStream runs before flush
  (covers IMMEDIATE-kill sites ExecutionManagementController L111 and
  DeviceQueueService#cancelTask L210)
- non-blocking per-emitter send queue so a slow SSE client doesn't
  stall the Logback pipeline.
- WorkflowLogService.isActive(runId) added as existence helper."
```

### Task 2.2 — Créer le controller SSE

**Context:** Controller mince qui délègue au service. Spring MVC PathPattern matche exactement les segments, donc `GET /api/automation/runs/{runId}/logs/live` coexiste sans conflit avec le `GET /api/automation/runs/{runId}/logs` existant de `ExecutionManagementController`.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveController.java`

- [ ] **Step 1 : Créer le controller**

```java
package com.automation.instagram.workflow.streaming;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/automation/runs")
@RequiredArgsConstructor
public class RunLogLiveController {

    private final RunLogLiveService runLogLiveService;

    /**
     * GET /api/automation/runs/{runId}/logs/live
     * SSE — events : "snapshot" {lines:[]}, "line" {line}, "complete" {runId, status}.
     */
    @GetMapping(value = "/{runId}/logs/live", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamLive(@PathVariable String runId) {
        return runLogLiveService.registerEmitter(runId);
    }
}
```

- [ ] **Step 2 : Vérifier que le backend compile**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw compile -q
```
Expected: pas d'erreur.

- [ ] **Step 3 : Commit**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/workflow/streaming/RunLogLiveController.java
git commit -m "feat(streaming): expose GET /api/automation/runs/{runId}/logs/live SSE endpoint"
```

---

## Chunk 3 : Backend — wiring de `completeForRun` et `onFlushCompleted`

### Task 3.1 — Brancher `RunLogLiveService.completeForRun` à la fin de `WorkflowLogService.completeStream`

**Context:** À chaque fin de run (COMPLETE / FAILED / CANCELLED / SHUTDOWN), `completeStream()` doit signaler `RunLogLiveService`. Le service décide seul sync vs différé.

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java`

- [ ] **Step 1 : Identifier la fin de `completeStream`**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
grep -n "Clean up replay buffer after 5 minutes" src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java
```
Expected: repérer le bloc de nettoyage final (lignes ~266-270 dans la version actuelle).

- [ ] **Step 2 : Injecter `RunLogLiveService` dans `WorkflowLogService`**

Modifier `WorkflowLogService.java`. Ajouter le champ après `SimpMessagingTemplate` existant :

```java
    private final RunLogLiveService runLogLiveService;
```

(grâce à `@RequiredArgsConstructor`, Lombok injecte automatiquement ce champ `final`.)

- [ ] **Step 3 : Appeler `completeForRun` à la fin de `completeStream`**

Dans `completeStream(runId, workflowName, totalExecutionTimeMs, finalStatus)`, juste **avant** le `cleanupExecutor.schedule(...)` final (qui nettoie les replay buffers 5min plus tard), ajouter :

```java
        // Notifier RunLogLiveService pour drainer / différer la complétion du stream live raw
        try {
            runLogLiveService.completeForRun(runId, finalStatus);
        } catch (Exception e) {
            log.debug("Erreur completeForRun pour runId={}: {}", runId, e.getMessage());
        }
```

- [ ] **Step 4 : Vérifier la compilation**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw compile -q
```
Expected: pas d'erreur. Il peut y avoir une dépendance circulaire si `RunLogLiveService` injecte `WorkflowLogService` ET vice-versa — on la résout en Step 5 si besoin.

- [ ] **Step 5 : Si dépendance circulaire détectée, utiliser `@Lazy`**

Si Spring refuse de démarrer à cause d'un cycle (`RunLogLiveService` → `WorkflowLogService` → `RunLogLiveService`), marquer l'injection comme `@Lazy` dans `WorkflowLogService` :

```java
    @org.springframework.context.annotation.Lazy
    private final RunLogLiveService runLogLiveService;
```

(Note : avec `@RequiredArgsConstructor`, Lombok peut ne pas propager `@Lazy` au paramètre constructeur — dans ce cas, retirer `@RequiredArgsConstructor` et écrire le constructeur à la main avec `@Lazy` sur le paramètre.)

Run une fois corrigé :
```bash
./mvnw -q -DskipTests package
```
Expected: build OK. Lancer aussi les tests existants : `./mvnw test -q -Dtest='RunLogLiveServiceTest,RunLogCaptureAppenderTest,WorkflowEngineTest'`.

- [ ] **Step 6 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/workflow/streaming/WorkflowLogService.java
git commit -m "feat(streaming): call RunLogLiveService.completeForRun in completeStream"
```

### Task 3.2 — Appeler `onFlushCompleted` depuis `RunLogPersistenceService.flushRunLogs`

**Context:** L'appel doit être dans un `finally` pour fire même en cas d'exception Mongo (sinon un blip Mongo bloquerait les emitters 25s).

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/monitoring/service/RunLogPersistenceService.java`

- [ ] **Step 1 : Injecter `RunLogLiveService` dans `RunLogPersistenceService`**

Modifier la classe. Ajouter le champ après `runLogRepository` :

```java
    private final com.automation.instagram.workflow.streaming.RunLogLiveService runLogLiveService;
```

(injecté via `@RequiredArgsConstructor`.)

- [ ] **Step 2 : Restructurer `flushRunLogs` avec un `try/finally` pour l'appel `onFlushCompleted`**

Remplacer le corps actuel de `flushRunLogs(String runId, String deviceUdid)` par :

```java
    public void flushRunLogs(String runId, String deviceUdid) {
        if (runId == null) return;

        try {
            RunLogCaptureAppender appender = RunLogCaptureAppender.getInstance();
            if (appender == null) {
                log.debug("RunLogCaptureAppender non disponible, skip flush pour runId={}", runId);
                return;
            }

            List<String> lines = appender.getAndClearLogs(runId);
            if (lines.isEmpty()) {
                log.debug("Aucun log capturé pour runId={}", runId);
                return;
            }

            String logText = String.join("\n", lines);

            RunLogEntity entity = RunLogEntity.builder()
                    .runId(runId)
                    .deviceUdid(deviceUdid)
                    .createdAt(Instant.now())
                    .lineCount(lines.size())
                    .logText(logText)
                    .build();

            try {
                runLogRepository.save(entity);
                log.info("Logs persistés pour runId={} — {} lignes", runId, lines.size());
            } catch (Exception e) {
                log.warn("Erreur lors de la persistance des logs pour runId={}: {}", runId, e.getMessage());
            }
        } finally {
            // Fire toujours, même si getAndClearLogs/save ont échoué, sinon un blip Mongo
            // laisserait les emitters SSE bloqués jusqu'au timeout 25s.
            try {
                runLogLiveService.onFlushCompleted(runId);
            } catch (Exception e) {
                log.debug("Erreur onFlushCompleted pour runId={}: {}", runId, e.getMessage());
            }
        }
    }
```

- [ ] **Step 3 : Vérifier la compilation et les tests existants**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw test -q -Dtest='RunLogLiveServiceTest,RunLogCaptureAppenderTest'
```
Expected: tous verts.

- [ ] **Step 4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/monitoring/service/RunLogPersistenceService.java
git commit -m "feat(persistence): notify RunLogLiveService.onFlushCompleted in flushRunLogs finally

Closes the coordination gap on IMMEDIATE-kill path: when completeStream fires
from the HTTP thread before the worker thread flushes, the deferred completion
is drained here as soon as the Mongo save completes (or fails — finally ensures
notify always fires so emitters don't stall 25s on a Mongo blip)."
```

### Task 3.3 — Audit des sites `completeStream` (documentaire, pas de modif attendue)

**Context:** Le spec §Build plan Step 3 demande un audit exhaustif. Les sites sont déjà cartographiés dans le spec ; cette tâche les *revérifie* sur le code actuel pour s'assurer qu'aucun nouveau site n'a été ajouté entre l'écriture du spec et l'implémentation.

**Files:** aucun (audit lecture seule).

- [ ] **Step 1 : Grep exhaustif**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
grep -rn "completeStream(" src/main/java --include="*.java"
```
Expected: apparaître dans `WorkflowLogService.java` (définition + appel shutdown), `ExecutionManagementController.java:111`, `DeviceQueueService.java:210`, `DeviceQueueService.java:431/479/489/715/733`, `BatchExecutionService.java:120/435/580`. Si un nouveau site apparaît :
- Site dans un `finally` worker après `flushRunLogs` → catégorie **flush-first** (sync path) → OK.
- Site dans un thread HTTP sans flush préalable → catégorie **deferred** (le service détecte via `hasBufferBeenClearedFor`) → OK.
- Cas bizarre (flush-first mais oublie d'updater `activeRuns`) → à documenter mais rare et non-bloquant car `hasBufferBeenClearedFor` est la vraie clé de décision.

- [ ] **Step 2 : Aucun commit nécessaire si le grep correspond à l'attendu**

Si l'audit révèle un site non-documenté, ajouter un commentaire dans le spec (pas bloquant pour l'implémentation car le mécanisme runtime est robuste).

---

## Chunk 4 : Frontend — `useLiveRunLogs` + `useRunLogsWithLive`

### Task 4.1 — Créer `useLiveRunLogs` (hook EventSource avec batching rAF)

**Context:** EventSource côté client vers `/api/automation/runs/{runId}/logs/live`, gère les events `snapshot`/`line`/`complete`, batch les `line` via `requestAnimationFrame` pour éviter le re-render à chaque ligne sous haut volume.

**Files:**
- Create: `InstagramDashboard/src/hooks/useLiveRunLogs.js`

- [ ] **Step 1 : Regarder le pattern `useWorkflowLogs` existant pour rester cohérent**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
cat src/hooks/useWorkflowLogs.js
```
Expected: confirmer la forme (baseUrl via `VITE_API_URL`, `EventSource`, `addEventListener('log'|'open'|'error')`, cleanup dans `return` de `useEffect`).

- [ ] **Step 2 : Créer le hook**

Créer `InstagramDashboard/src/hooks/useLiveRunLogs.js` :

```js
import { useState, useEffect, useRef } from 'react'

/**
 * Stream SSE des logs bruts d'un run en cours.
 * Gère snapshot + lignes live + complete, avec batching rAF pour les hauts volumes.
 *
 * @param {string|null} runId
 * @param {{ enabled?: boolean }} options
 * @returns {{ text: string, completed: boolean, connected: boolean }}
 */
export function useLiveRunLogs(runId, { enabled = true } = {}) {
  const [text, setText] = useState('')
  const [completed, setCompleted] = useState(false)
  const [connected, setConnected] = useState(false)

  // Références persistantes pour le batching
  const pendingLinesRef = useRef([])
  const rafRef = useRef(null)

  useEffect(() => {
    if (!enabled || !runId) return

    // Reset state pour un nouveau run
    setText('')
    setCompleted(false)
    pendingLinesRef.current = []
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')
    const es = new EventSource(`${baseUrl}/api/automation/runs/${encodeURIComponent(runId)}/logs/live`)

    const flushPending = () => {
      if (pendingLinesRef.current.length === 0) {
        rafRef.current = null
        return
      }
      const toAppend = pendingLinesRef.current.join('\n') + '\n'
      pendingLinesRef.current = []
      rafRef.current = null
      setText(prev => prev + toAppend)
    }

    const scheduleFlush = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushPending)
      }
    }

    es.addEventListener('open', () => setConnected(true))

    es.addEventListener('snapshot', (e) => {
      try {
        const { lines } = JSON.parse(e.data)
        if (Array.isArray(lines) && lines.length > 0) {
          setText(lines.join('\n') + '\n')
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('line', (e) => {
      try {
        const { line } = JSON.parse(e.data)
        if (typeof line === 'string') {
          pendingLinesRef.current.push(line)
          scheduleFlush()
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('complete', () => {
      // Flush tout pending avant de marquer completed
      flushPending()
      setCompleted(true)
      setConnected(false)
      es.close()
    })

    es.addEventListener('error', () => setConnected(false))

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      es.close()
      setConnected(false)
    }
  }, [runId, enabled])

  return { text, completed, connected }
}
```

- [ ] **Step 3 : Vérifier lint**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0
```
Expected: pas d'erreur (warnings tolérés selon config actuelle du repo).

- [ ] **Step 4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/hooks/useLiveRunLogs.js
git commit -m "feat(hooks): add useLiveRunLogs for SSE live log streaming

Consumes GET /api/automation/runs/:runId/logs/live, handles snapshot
+ line + complete events, batches line events via requestAnimationFrame
to avoid re-render storms under high log volume."
```

### Task 4.2 — Créer `useRunLogsWithLive` (hook composite)

**Context:** Orchestre `useActiveRuns` + `useLiveRunLogs` + `useRunLogs` avec la bascule à `live.completed`, la retry sur 404 post-kill, et expose une API stable aux composants.

**Files:**
- Create: `InstagramDashboard/src/hooks/useRunLogsWithLive.js`

- [ ] **Step 1 : Lire les hooks existants pour comprendre les shapes**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
cat src/hooks/useActiveRuns.js
cat src/hooks/useRunLogs.js
```
Expected: confirmer `{ activeRuns }` et `useQuery` retournant `{ data, isLoading, isError }` avec `select: data => data.logText || ''`.

- [ ] **Step 2 : Créer le hook**

Créer `InstagramDashboard/src/hooks/useRunLogsWithLive.js` :

```js
import { useMemo, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { useActiveRuns } from './useActiveRuns'
import { useLiveRunLogs } from './useLiveRunLogs'

/**
 * Hook composite : affiche les logs en live pendant un run actif, bascule sur
 * la vue persistée à la fin (avec retry pour couvrir le gap IMMEDIATE-kill).
 *
 * @param {string|null} runId
 * @param {{ enabled?: boolean }} options
 * @returns {{ text, isLoading, isError, isActive, showingLive, liveConnected, refresh }}
 */
export function useRunLogsWithLive(runId, { enabled = true } = {}) {
  const queryClient = useQueryClient()
  const { activeRuns } = useActiveRuns()

  const isActive = useMemo(
    () => activeRuns.some(r => (r.runId || r.id) === runId),
    [activeRuns, runId],
  )

  // Live stream : actif uniquement quand le run est actif
  const live = useLiveRunLogs(runId, { enabled: enabled && isActive })

  // Persisté : chargé quand le run n'est pas actif, ou quand live a reporté "complete"
  const persistedEnabled = !!(runId && enabled && (!isActive || live.completed))
  const persisted = useQuery({
    queryKey: ['run-logs', runId],
    queryFn: () => apiGet(`/api/automation/runs/${encodeURIComponent(runId)}/logs`),
    enabled: persistedEnabled,
    staleTime: Infinity,
    select: (data) => data?.logText || '',
    // Gap IMMEDIATE-kill : completeStream fire avant flushRunLogs, le GET renvoie 404
    // le temps que le worker thread finalise. On retry activement.
    retry: (failureCount, error) => {
      if (failureCount >= 5) return false
      const status = error?.status || error?.response?.status
      // Retry si 404 uniquement (pas de bruit sur 401/500)
      return status === 404
    },
    retryDelay: (attempt) => 500 * (attempt + 1),
  })

  // Quand live.completed passe à true, invalider le cache persisté pour refetch frais
  const didInvalidateRef = useRef(false)
  useEffect(() => {
    if (live.completed && !didInvalidateRef.current) {
      didInvalidateRef.current = true
      queryClient.invalidateQueries({ queryKey: ['run-logs', runId] })
    }
    if (!live.completed) {
      didInvalidateRef.current = false
    }
  }, [live.completed, runId, queryClient])

  // Reset l'invalidation flag quand runId change
  useEffect(() => {
    didInvalidateRef.current = false
  }, [runId])

  // Showing live : en direct tant que le run est actif ET que live n'a pas confirmé complete
  // (ou que persisted n'a pas encore des données fraîches).
  const persistedHasData = !!persisted.data
  const showingLive = isActive && !(live.completed && persistedHasData)

  const text = showingLive ? live.text : (persisted.data || '')
  const isLoading = showingLive
    ? (!live.connected && !live.text)
    : persisted.isLoading
  const isError = !showingLive && persisted.isError && !live.text

  return {
    text,
    isLoading,
    isError,
    isActive,
    showingLive,
    liveConnected: live.connected,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['run-logs', runId] }),
  }
}
```

- [ ] **Step 3 : Vérifier lint + build**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 && npm run build
```
Expected: build OK.

- [ ] **Step 4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/hooks/useRunLogsWithLive.js
git commit -m "feat(hooks): add useRunLogsWithLive composite

Orchestrates active-runs detection + useLiveRunLogs + useRunLogs so the
RunLogModal can transparently switch between live streaming and
post-mortem views. Includes retry on 404 for the IMMEDIATE-kill flush gap."
```

---

## Chunk 5 : Frontend — refonte `RunLogModal`

### Task 5.1 — Refondre `RunLogModal` avec badge Live/Completed + boutons Stop/Kill

**Context:** La modale passe du simple `useRunLogs` au hook composite, gagne un badge d'état et des boutons Stop Gracefully / Kill conditionnels. Le Kill ouvre un dialog de confirmation (pattern existant dans `ExecutionCenter`).

**Files:**
- Modify: `InstagramDashboard/src/components/activity-log/RunLogModal.jsx`

- [ ] **Step 1 : Relire la modale actuelle**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
cat src/components/activity-log/RunLogModal.jsx
```
Expected: confirmer les imports, le `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`, le `LogViewer`, le `useRunLogs`.

- [ ] **Step 2 : Remplacer le contenu du fichier**

Remplacer **tout** le contenu de `RunLogModal.jsx` par :

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import LogViewer from '@/components/shared/LogViewer'
import { useRunLogsWithLive } from '@/hooks/useRunLogsWithLive'
import { Terminal, Maximize2, Square, SkullIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function RunLogModal({ runId, open, onClose }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { text, isLoading, isError, isActive, showingLive, liveConnected } =
    useRunLogsWithLive(runId, { enabled: open })

  const [killDialogOpen, setKillDialogOpen] = useState(false)

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

  const openFullPage = () => {
    onClose()
    navigate(`/activity-log/run/${encodeURIComponent(runId)}/logs`)
  }

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
              Logs — {runId}
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] px-2 text-[#52525B] hover:text-[#FAFAFA]"
                onClick={openFullPage}
              >
                <Maximize2 className="w-3 h-3 mr-1" />
                Full Page
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 pt-3">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
              ))}
            </div>
          ) : isError || !text ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-[#52525B]">
                {showingLive ? 'En attente des premières lignes…' : 'Pas de logs disponibles pour ce run.'}
              </p>
            </div>
          ) : (
            <LogViewer
              text={text}
              follow={showingLive}
              height={Math.min(600, window.innerHeight * 0.65)}
            />
          )}
        </div>

        {/* Dialog de confirmation Kill */}
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

- [ ] **Step 3 : Vérifier lint + build**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 && npm run build
```
Expected: build OK.

- [ ] **Step 4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/components/activity-log/RunLogModal.jsx
git commit -m "feat(activity-log): RunLogModal — live stream + Stop/Kill in-modal controls

Switch from useRunLogs (post-mortem only) to useRunLogsWithLive. Adds Live/Completed
badge and conditional Stop Gracefully / Kill buttons with confirmation dialog while
the run is active. Falls back to persisted view after termination."
```

---

## Chunk 6 : Frontend — `DeviceRunsTab` banner entry + `RunLogs.jsx` full page

### Task 6.1 — Ajouter le bouton Logs dans le bloc actif de `DeviceRunsTab`

**Context:** Aujourd'hui le bloc "Active run" (banner bleu en haut de la liste des runs d'un device) n'a qu'un bouton Stop. On ajoute un bouton Logs qui ouvre `RunLogModal` en mode live.

**Files:**
- Modify: `InstagramDashboard/src/components/activity-log/tabs/DeviceRunsTab.jsx`

- [ ] **Step 1 : Repérer précisément le bloc actif**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
grep -n "deviceActiveRun\|StopCircle\|Stop" src/components/activity-log/tabs/DeviceRunsTab.jsx
```
Expected: le bouton Stop est aux lignes ~100-109 dans le `<div>` du bloc actif.

- [ ] **Step 2 : Ajouter les imports manquants**

Modifier le bloc d'imports en haut de `DeviceRunsTab.jsx`. Ajouter `Terminal` à l'import `lucide-react` :

```jsx
import {
  ScrollText, Loader2, StopCircle, User, CheckCircle, XCircle, Clock,
  ChevronLeft, ChevronRight, Terminal,
} from 'lucide-react'
```

Ajouter l'import de la modale en-dessous des imports UI (après l'import de `RunRow`) :

```jsx
import RunLogModal from '../RunLogModal'
```

- [ ] **Step 3 : Ajouter l'état local `logsModalOpen`**

Dans le composant, juste après les autres `useState` existants (après `const [stopping, setStopping] = useState(false)`) :

```jsx
  const [logsModalOpen, setLogsModalOpen] = useState(false)
```

- [ ] **Step 4 : Ajouter le bouton Logs dans le header du bloc actif**

Trouver le `<div className="flex items-center gap-2">` qui contient le `Loader2` + le nom + `StatusBadge` (autour de la ligne 94), puis son sibling qui contient le bouton Stop. Remplacer le `Button` Stop existant par ce bloc pour avoir Logs + Stop côte à côte :

```jsx
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                onClick={() => setLogsModalOpen(true)}
              >
                <Terminal className="w-3 h-3 mr-1" />
                Logs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                onClick={handleStop}
                disabled={stopping}
              >
                <StopCircle className="w-3 h-3 mr-1" />
                {stopping ? 'Stopping...' : 'Stop'}
              </Button>
            </div>
```

(L'ancien bouton Stop était seul dans un `<Button variant="ghost"...>` direct — on l'enveloppe maintenant dans un `<div className="flex items-center gap-2">`.)

- [ ] **Step 5 : Rendre la modale conditionnellement**

En bas du composant, **juste avant** le `</div>` fermant la `div` racine (après le bloc de pagination), ajouter :

```jsx
      {logsModalOpen && deviceActiveRun?.runId && (
        <RunLogModal
          runId={deviceActiveRun.runId}
          open={logsModalOpen}
          onClose={() => setLogsModalOpen(false)}
        />
      )}
```

- [ ] **Step 6 : Vérifier lint + build**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 && npm run build
```
Expected: build OK.

- [ ] **Step 7 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/components/activity-log/tabs/DeviceRunsTab.jsx
git commit -m "feat(activity-log): add Logs button to active-run banner in DeviceRunsTab

Gives users a direct entry point to live logs while a run is active, without
having to wait for the run to appear in the persisted runs list."
```

### Task 6.2 — Migrer `RunLogs.jsx` (full page) vers `useRunLogsWithLive`

**Context:** La page plein écran doit avoir le même comportement : live quand le run est actif, persisté sinon. Mêmes boutons Stop/Kill. Le bouton Copy existant reste.

**Files:**
- Modify: `InstagramDashboard/src/pages/RunLogs.jsx`

- [ ] **Step 1 : Relire la page actuelle**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
cat src/pages/RunLogs.jsx
```

- [ ] **Step 2 : Remplacer le contenu du fichier**

Remplacer **tout** le contenu de `RunLogs.jsx` par :

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { useRunLogsWithLive } from '@/hooks/useRunLogsWithLive'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import LogViewer from '@/components/shared/LogViewer'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { ArrowLeft, Terminal, Copy, Check, Square, SkullIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function RunLogs() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { text, isLoading, isError, isActive, showingLive, liveConnected } =
    useRunLogsWithLive(runId, { enabled: true })

  const containerRef = useRef(null)
  const [viewerHeight, setViewerHeight] = useState(600)
  const [copied, setCopied] = useState(false)
  const [killDialogOpen, setKillDialogOpen] = useState(false)

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

  const handleCopyLogs = () => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setViewerHeight(containerRef.current.clientHeight)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[#A1A1AA] hover:text-[#FAFAFA]"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#A1A1AA]" />
          <h1 className="text-lg font-semibold text-[#FAFAFA]">Logs</h1>
          <span className="text-xs text-[#52525B] font-mono">{runId}</span>
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
        </div>
        {isActive && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#F59E0B] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10"
              onClick={() => stopGraceful.mutate()}
              disabled={stopGraceful.isPending}
            >
              <Square className="w-3 h-3 mr-1" />
              Stop Gracefully
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => setKillDialogOpen(true)}
            >
              <SkullIcon className="w-3 h-3 mr-1" />
              Kill
            </Button>
          </>
        )}
        {text && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-[#A1A1AA] hover:text-[#FAFAFA] gap-1.5 ml-auto"
            onClick={handleCopyLogs}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copié' : 'Copier les logs'}
          </Button>
        )}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full bg-[#111111]" />
            ))}
          </div>
        ) : isError || !text ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-xs text-[#52525B]">
              {showingLive ? 'En attente des premières lignes…' : 'Pas de logs disponibles pour ce run.'}
            </p>
          </div>
        ) : (
          <LogViewer text={text} follow={showingLive} height={viewerHeight} />
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
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier lint + build**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint -- --max-warnings=0 && npm run build
```
Expected: build OK.

- [ ] **Step 4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/pages/RunLogs.jsx
git commit -m "feat(activity-log): RunLogs full-page uses useRunLogsWithLive

Matches the RunLogModal upgrade: live streaming + in-page Stop/Kill
when the run is active, persisted fallback after termination."
```

---

## Chunk 7 : Smoke test manuel

### Task 7.1 — Scénarios de validation end-to-end

**Context:** Pas de framework de test côté frontend, donc on valide manuellement les 5 parcours critiques. Les backends doivent être démarrés en local.

**Files:** aucun — test manuel.

- [ ] **Step 1 : Démarrer les backends en local**

Dans deux terminaux séparés :
```bash
# Terminal 1 : Automation
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw spring-boot:run

# Terminal 2 : Dashboard
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run dev
```

Attendre : Automation prêt sur 8081 (log `Started InstagramAutomationApplication`), Dashboard prêt sur 5173.

- [ ] **Step 2 : Déclencher un workflow long (ex: PostReelWorkflow ou CreateAccount) depuis la page Actions**

Ouvrir `http://localhost:5173/actions`, se logger si besoin, et démarrer un workflow sur un device disponible. Noter le `runId` dans les logs backend.

- [ ] **Step 3 : Scénario A — Live depuis le banner actif d'Activity Log**

1. Ouvrir `http://localhost:5173/activity-log`.
2. Cliquer sur la card du device en RUNNING → le sheet s'ouvre, onglet Runs par défaut.
3. Dans le banner bleu "Active run", cliquer **Logs**.
4. **Attendu** : modale s'ouvre avec badge `Live` (dot vert pulsant), logs Spring Boot défilent en direct, auto-follow activé, boutons `Stop Gracefully` + `Kill` visibles.

- [ ] **Step 4 : Scénario B — Stop Gracefully depuis la modale**

Dans la modale ouverte à l'étape précédente, cliquer **Stop Gracefully**.
**Attendu** :
- Toast "Arrêt demandé…".
- Les logs continuent à défiler (étapes de cleanup).
- Au bout de quelques secondes, le badge passe de `Live` à `Completed`, les boutons Stop/Kill disparaissent.
- Recharger la modale (fermer + rouvrir depuis `RunRow` du run terminé) → contenu identique à ce qui vient d'être vu.

- [ ] **Step 5 : Scénario C — Kill depuis la modale**

Redéclencher un nouveau workflow. Rouvrir les logs en live depuis le banner. Cliquer **Kill** → dialog de confirmation → **Kill Now**.
**Attendu** :
- Dialog se ferme, toast "Run killed".
- Les logs continuent à défiler brièvement (cleanup thread).
- Au bout de 1-3 s, badge passe à `Completed`, boutons disparaissent.
- Les logs visibles sont identiques à ceux persistés (fermer + rouvrir la modale via `RunRow` du run killed doit montrer exactement le même texte).

- [ ] **Step 6 : Scénario D — Run terminé (régression test)**

Sur un run DÉJÀ terminé (dans la liste paginée de `DeviceRunsTab`), cliquer sur le bouton **Logs** d'un `RunRow`.
**Attendu** :
- Modale s'ouvre avec badge `Completed` immédiatement.
- Pas de boutons Stop/Kill.
- Les logs sont chargés via `useRunLogs` (post-mortem) comme aujourd'hui — comportement identique à avant.

- [ ] **Step 7 : Scénario E — Full Page**

Depuis la modale en live (scénario A), cliquer **Full Page**.
**Attendu** : navigation vers `/activity-log/run/{runId}/logs`, la page plein écran prend le relais en live (badge Live, boutons Stop/Kill présents, bouton Copy disponible).

- [ ] **Step 8 : Scénario F — Edge E2, run terminé juste avant ouverture**

Ouvrir rapidement la modale d'un run qui vient de se terminer (race entre le polling `useActiveRuns` 4s et l'état réel). La modale peut brièvement tenter le live, mais doit basculer propre sur le persisté sans rester coincée en "Loading".
**Attendu** : soit elle affiche directement le persisté, soit elle montre `En attente des premières lignes…` 1-2s puis bascule sur le persisté.

- [ ] **Step 9 : Commit (message uniquement, pas de fichier)**

Si tous les scénarios passent, créer un commit de trace :

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git commit --allow-empty -m "chore(activity-log): smoke test passed — live logs feature complete

Tested scenarios A-F (live banner entry, Stop Gracefully, Kill with confirmation,
terminated-run regression, Full Page navigation, edge E2 race)."
```

---

## Récapitulatif de vérification finale

Après le Chunk 7, tourner une vérification globale :

```bash
# Backend tests
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw test -q

# Frontend lint + build
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run lint && npm run build
```

Expected :
- Tous les tests unitaires Automation verts.
- Lint Dashboard propre.
- Build Dashboard OK, pas d'erreur de compilation.

Si tout est vert + les scénarios manuels passent, la feature est prête.
