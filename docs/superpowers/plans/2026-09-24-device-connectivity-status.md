# Statut réel des téléphones (USB + SSH) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** afficher sur `/activity-log` (et toutes les pages qui lisent `/api/devices/live-status`) l'état réel de chaque téléphone — `IDLE` seulement si `idevice_id` le voit **et** s'il répond en SSH, `DEGRADED` si un seul des deux, `OFFLINE` si aucun.

**Architecture :** une sonde planifiée côté backend (`DeviceConnectivityService`) lance un `idevice_id -l` et un SSH `true` parallèle par téléphone toutes les 20 s, garde le résultat en cache et publie un événement quand il change. `DeviceLiveStatusService` calcule le statut affiché à la lecture en combinant l'état des runs et ce cache. Le dashboard affiche deux pastilles USB/SSH par carte et un bouton « Revérifier ».

**Tech Stack :** Spring Boot 3.4 / Java 17 / JUnit 5 + Mockito + AssertJ (backend `InstagramAutomation`) ; React 19 JSX + React Query + Tailwind 4 (front `InstagramDashboard`).

Spec : `docs/superpowers/specs/2026-09-24-device-connectivity-status-design.md`.

Chemins backend relatifs à la racine du dépôt `InstagramAutomation` (worktree `.claude/worktrees/device-connectivity`). Chemins front relatifs à `InstagramDashboard`.

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/main/java/com/automation/instagram/multidevice/service/DeviceAvailabilityChecker.java` | + `listConnectedUdids()` qui distingue « aucun device » de « commande en échec » |
| `src/main/java/com/automation/instagram/event/DeviceConnectivityChangedEvent.java` (nouveau) | événement « l'état USB/SSH d'un device a changé » |
| `src/main/java/com/automation/instagram/service/DeviceConnectivityService.java` (nouveau) | sonde planifiée + cache + `refreshNow()` |
| `src/main/java/com/automation/instagram/service/DeviceLiveStatusService.java` | `DEGRADED`, champs de connectivité, statut calculé, écoute de l'événement |
| `src/main/java/com/automation/instagram/controller/DeviceLiveStatusController.java` | `POST /api/devices/connectivity/refresh` |
| `src/main/resources/application.yml` | `device.connectivity.*` |
| `src/test/java/com/automation/instagram/service/DeviceConnectivityServiceTest.java` (nouveau) | tests de la sonde |
| `src/test/java/com/automation/instagram/service/DeviceLiveStatusServiceTest.java` (nouveau) | tests du statut calculé |
| `src/components/shared/StatusBadge.jsx` (front) | style `DEGRADED` |
| `src/components/activity-log/ConnectivityPills.jsx` (front, nouveau) | pastilles USB / SSH |
| `src/components/activity-log/DeviceCard.jsx` (front) | pastilles + alerte `DEGRADED` |
| `src/components/activity-log/FleetSummaryBar.jsx` (front) | tuiles Degraded / Offline |
| `src/pages/ActivityLog.jsx` (front) | champs fusionnés + bouton « Revérifier » |
| `src/pages/Devices.jsx` (front) | `DEGRADED` dans pastille, compteurs, tuiles |

---

### Task 1 : `listConnectedUdids()` dans `DeviceAvailabilityChecker`

Méthode qui lance un process externe : pas de test unitaire (on la mocke dans les tests de la sonde). Vérification par compilation.

**Files :**
- Modify : `src/main/java/com/automation/instagram/multidevice/service/DeviceAvailabilityChecker.java`

- [ ] **Step 1 : ajouter l'import et la méthode**

Ajouter `import java.util.Optional;` aux imports, puis, juste après `getConnectedDeviceUdids()` :

```java
    /**
     * Liste les UDID branchés en USB en distinguant « aucun device » de « commande en échec ».
     * Contrairement à {@link #getConnectedDeviceUdids()}, un échec d'idevice_id (binaire absent,
     * timeout, code de sortie non nul) renvoie {@link Optional#empty()} : l'appelant ne doit pas
     * en conclure que tous les devices sont débranchés.
     */
    public Optional<Set<String>> listConnectedUdids() {
        try {
            Process process = new ProcessBuilder("idevice_id", "-l").start();
            if (!process.waitFor(10, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                logger.warn("idevice_id timeout — état USB inconnu");
                return Optional.empty();
            }
            Set<String> udids = new HashSet<>();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String udid = extractUdidFromLine(line);
                    if (udid != null && !udid.isEmpty()) {
                        udids.add(udid);
                    }
                }
            }
            if (process.exitValue() != 0) {
                logger.warn("idevice_id code de sortie {} — état USB inconnu", process.exitValue());
                return Optional.empty();
            }
            return Optional.of(udids);
        } catch (IOException e) {
            logger.warn("idevice_id indisponible — état USB inconnu : {}", e.getMessage());
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }
```

- [ ] **Step 2 : compiler**

Run : `mvn compile -q 2>&1 | tail -20`
Expected : aucune sortie (succès).

- [ ] **Step 3 : commit**

```bash
git add src/main/java/com/automation/instagram/multidevice/service/DeviceAvailabilityChecker.java
git commit -m "feat(devices): idevice_id distingue « aucun device » d'un échec de la commande"
```

---

### Task 2 : `DeviceConnectivityService` (sonde + cache)

**Files :**
- Create : `src/main/java/com/automation/instagram/event/DeviceConnectivityChangedEvent.java`
- Create : `src/main/java/com/automation/instagram/service/DeviceConnectivityService.java`
- Modify : `src/main/resources/application.yml` (bloc `device:`)
- Test : `src/test/java/com/automation/instagram/service/DeviceConnectivityServiceTest.java`

- [ ] **Step 1 : écrire les tests (qui échouent)**

```java
package com.automation.instagram.service;

import com.automation.instagram.event.DeviceConnectivityChangedEvent;
import com.automation.instagram.model.DeviceConfigDocument;
import com.automation.instagram.multidevice.service.DeviceAvailabilityChecker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceConnectivityServiceTest {

    private static final SshClient.Result SSH_OK = new SshClient.Result(0, "", "", false, null);
    private static final SshClient.Result SSH_TIMEOUT = new SshClient.Result(255, "",
            "ssh: connect to host 10.0.0.2 port 22: Operation timed out", false, null);

    @Mock private DeviceConfigService deviceConfigService;
    @Mock private DeviceAvailabilityChecker availabilityChecker;
    @Mock private SshClient sshClient;
    @Mock private ApplicationEventPublisher eventPublisher;

    private DeviceConnectivityService service;

    @BeforeEach
    void setUp() {
        service = new DeviceConnectivityService(deviceConfigService, availabilityChecker, sshClient, eventPublisher);
    }

    @AfterEach
    void tearDown() {
        service.shutdown();
    }

    private static DeviceConfigDocument device(String udid, String ip) {
        return DeviceConfigDocument.builder().udid(udid).name("iPhone-" + udid).deviceIp(ip).build();
    }

    @Test
    void refreshNow_recordsUsbAndSshPerDevice() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device("A", "10.0.0.1"), device("B", "10.0.0.2")));
        when(availabilityChecker.listConnectedUdids()).thenReturn(Optional.of(Set.of("A")));
        when(sshClient.run("10.0.0.1", "true", 12)).thenReturn(SSH_OK);
        when(sshClient.run("10.0.0.2", "true", 12)).thenReturn(SSH_TIMEOUT);

        service.refreshNow();

        assertThat(service.get("A")).hasValueSatisfying(c -> {
            assertThat(c.usb()).isTrue();
            assertThat(c.ssh()).isTrue();
            assertThat(c.sshError()).isNull();
            assertThat(c.checkedAt()).isNotNull();
        });
        assertThat(service.get("B")).hasValueSatisfying(c -> {
            assertThat(c.usb()).isFalse();
            assertThat(c.ssh()).isFalse();
            assertThat(c.sshError()).isEqualTo("timeout");
        });
    }

    @Test
    void refreshNow_leavesUsbUnknown_whenIdeviceIdFails() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device("A", "10.0.0.1")));
        when(availabilityChecker.listConnectedUdids()).thenReturn(Optional.empty());
        when(sshClient.run("10.0.0.1", "true", 12)).thenReturn(SSH_OK);

        service.refreshNow();

        assertThat(service.get("A")).hasValueSatisfying(c -> assertThat(c.usb()).isNull());
    }

    @Test
    void refreshNow_reportsMissingIp_withoutCallingSsh() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device("A", null)));
        when(availabilityChecker.listConnectedUdids()).thenReturn(Optional.of(Set.of("A")));

        service.refreshNow();

        assertThat(service.get("A")).hasValueSatisfying(c -> {
            assertThat(c.ssh()).isFalse();
            assertThat(c.sshError()).isEqualTo("IP non configurée");
        });
        verifyNoInteractions(sshClient);
    }

    @Test
    void refreshNow_publishesEvent_onFirstProbeAndOnChange_only() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device("A", "10.0.0.1")));
        when(availabilityChecker.listConnectedUdids()).thenReturn(
                Optional.of(Set.of("A")), Optional.of(Set.of("A")), Optional.of(Set.of()));
        when(sshClient.run("10.0.0.1", "true", 12)).thenReturn(SSH_OK);

        service.refreshNow(); // premier test : publié
        service.refreshNow(); // rien ne change : pas publié
        service.refreshNow(); // câble débranché : publié

        verify(eventPublisher, times(2)).publishEvent(new DeviceConnectivityChangedEvent("A"));
    }

    @Test
    void refreshNow_dropsDevicesRemovedFromConfig() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device("A", "10.0.0.1")), List.of());
        when(availabilityChecker.listConnectedUdids()).thenReturn(Optional.of(Set.of("A")));
        when(sshClient.run("10.0.0.1", "true", 12)).thenReturn(SSH_OK);

        service.refreshNow();
        service.refreshNow();

        assertThat(service.get("A")).isEmpty();
    }

    @Test
    void describeSshFailure_givesReadableReasons() {
        assertThat(DeviceConnectivityService.describeSshFailure(new SshClient.Result(-1, "", "", true, null)))
                .isEqualTo("timeout");
        assertThat(DeviceConnectivityService.describeSshFailure(SSH_TIMEOUT))
                .isEqualTo("timeout");
        assertThat(DeviceConnectivityService.describeSshFailure(new SshClient.Result(255, "",
                "ssh: connect to host 10.0.0.2 port 22: Connection refused", false, null)))
                .isEqualTo("connexion refusée (sshd arrêté ?)");
        assertThat(DeviceConnectivityService.describeSshFailure(new SshClient.Result(255, "",
                "ssh: connect to host 10.0.0.2 port 22: No route to host", false, null)))
                .isEqualTo("hôte injoignable");
        assertThat(DeviceConnectivityService.describeSshFailure(new SshClient.Result(5, "", "", false, null)))
                .isEqualTo("mot de passe refusé");
        assertThat(DeviceConnectivityService.describeSshFailure(new SshClient.Result(-1, "", "", false, "sshpass introuvable")))
                .isEqualTo("sshpass introuvable");
        assertThat(DeviceConnectivityService.describeSshFailure(new SshClient.Result(1, "", "", false, null)))
                .isEqualTo("exit=1");
    }
}
```

- [ ] **Step 2 : lancer les tests, vérifier l'échec**

Run : `mvn test -q -Dtest=DeviceConnectivityServiceTest 2>&1 | tail -20`
Expected : échec de compilation (`DeviceConnectivityService` / `DeviceConnectivityChangedEvent` introuvables).

- [ ] **Step 3 : créer l'événement**

`src/main/java/com/automation/instagram/event/DeviceConnectivityChangedEvent.java` :

```java
package com.automation.instagram.event;

/**
 * Publié par {@code DeviceConnectivityService} quand l'état USB ou SSH d'un device change
 * (y compris au tout premier test). Écouté par {@code DeviceLiveStatusService} pour pousser
 * le statut recalculé au dashboard.
 */
public record DeviceConnectivityChangedEvent(String deviceUdid) {
}
```

- [ ] **Step 4 : créer le service**

`src/main/java/com/automation/instagram/service/DeviceConnectivityService.java` :

```java
package com.automation.instagram.service;

import com.automation.instagram.event.DeviceConnectivityChangedEvent;
import com.automation.instagram.model.DeviceConfigDocument;
import com.automation.instagram.multidevice.service.DeviceAvailabilityChecker;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Sonde la connectivité réelle de chaque téléphone configuré : présence USB via
 * {@code idevice_id -l} et accès SSH via une commande {@code true}.
 *
 * <p>Le résultat est gardé en cache et lu par {@link DeviceLiveStatusService} pour calculer le
 * statut affiché : sans cette sonde, un device jamais utilisé depuis le démarrage restait
 * {@code IDLE} même débranché. Les SSH partent en parallèle car un téléphone éteint met
 * {@code ConnectTimeout} (10 s) à échouer.
 */
@Slf4j
@Service
public class DeviceConnectivityService {

    /** Commande la plus légère possible : on teste l'accès SSH, pas le téléphone. */
    static final String PROBE_COMMAND = "true";
    /** Au-delà du ConnectTimeout de {@link SshClient} (10 s) pour laisser ssh conclure lui-même. */
    static final int SSH_TIMEOUT_SECONDS = 12;
    private static final int PROBE_THREADS = 8;

    private final DeviceConfigService deviceConfigService;
    private final DeviceAvailabilityChecker availabilityChecker;
    private final SshClient sshClient;
    private final ApplicationEventPublisher eventPublisher;

    private final ConcurrentHashMap<String, Connectivity> cache = new ConcurrentHashMap<>();
    /** Un seul test à la fois : la tâche planifiée et le bouton « Revérifier » ne se chevauchent pas. */
    private final ReentrantLock probeLock = new ReentrantLock();
    private final ExecutorService sshPool;

    public DeviceConnectivityService(DeviceConfigService deviceConfigService,
                                     DeviceAvailabilityChecker availabilityChecker,
                                     SshClient sshClient,
                                     ApplicationEventPublisher eventPublisher) {
        this.deviceConfigService = deviceConfigService;
        this.availabilityChecker = availabilityChecker;
        this.sshClient = sshClient;
        this.eventPublisher = eventPublisher;
        AtomicInteger threadCount = new AtomicInteger();
        this.sshPool = Executors.newFixedThreadPool(PROBE_THREADS, r -> {
            Thread t = new Thread(r, "device-connectivity-" + threadCount.incrementAndGet());
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * Résultat du dernier test d'un device.
     *
     * @param usb       {@code true}/{@code false}, ou {@code null} si idevice_id a échoué (inconnu)
     * @param ssh       {@code true} si {@code ssh <ip> true} a réussi
     * @param sshError  raison lisible de l'échec SSH, {@code null} si SSH OK
     * @param checkedAt fin du test
     */
    public record Connectivity(Boolean usb, boolean ssh, String sshError, Instant checkedAt) {

        /** Même état USB et SSH : la raison et l'heure ne comptent pas comme un changement. */
        boolean sameLinks(Connectivity other) {
            return other != null && Objects.equals(usb, other.usb) && ssh == other.ssh;
        }
    }

    @Scheduled(fixedDelayString = "${device.connectivity.interval-ms:20000}",
            initialDelayString = "${device.connectivity.initial-delay-ms:5000}")
    public void scheduledProbe() {
        if (!probeLock.tryLock()) {
            log.debug("Sonde de connectivité déjà en cours — tour sauté");
            return;
        }
        try {
            probeAll();
        } catch (Exception e) {
            log.warn("Sonde de connectivité en échec : {}", e.getMessage());
        } finally {
            probeLock.unlock();
        }
    }

    /**
     * Relance un test complet tout de suite (bouton « Revérifier »). Attend la fin d'un test en
     * cours plutôt que de réutiliser son résultat, qui peut dater d'avant un branchement.
     */
    public void refreshNow() {
        probeLock.lock();
        try {
            probeAll();
        } finally {
            probeLock.unlock();
        }
    }

    public Optional<Connectivity> get(String udid) {
        return Optional.ofNullable(cache.get(udid));
    }

    private void probeAll() {
        List<DeviceConfigDocument> devices = deviceConfigService.getAllDevices().stream()
                .filter(d -> d.getUdid() != null && !d.getUdid().isBlank())
                .toList();
        Optional<Set<String>> usbUdids = availabilityChecker.listConnectedUdids();

        Map<String, CompletableFuture<SshClient.Result>> sshResults = new LinkedHashMap<>();
        for (DeviceConfigDocument device : devices) {
            String ip = device.getDeviceIp();
            if (ip != null && !ip.isBlank()) {
                sshResults.put(device.getUdid(), CompletableFuture.supplyAsync(
                        () -> sshClient.run(ip.trim(), PROBE_COMMAND, SSH_TIMEOUT_SECONDS), sshPool));
            }
        }

        Instant now = Instant.now();
        Set<String> seen = new HashSet<>();
        for (DeviceConfigDocument device : devices) {
            String udid = device.getUdid();
            seen.add(udid);
            Boolean usb = usbUdids.map(set -> set.contains(udid.trim())).orElse(null);

            boolean ssh;
            String sshError;
            CompletableFuture<SshClient.Result> pending = sshResults.get(udid);
            if (pending == null) {
                ssh = false;
                sshError = "IP non configurée";
            } else {
                // SshClient.run ne jette jamais : join() ne peut pas échouer ici
                SshClient.Result result = pending.join();
                ssh = result.isSuccess();
                sshError = ssh ? null : describeSshFailure(result);
            }

            Connectivity next = new Connectivity(usb, ssh, sshError, now);
            Connectivity previous = cache.put(udid, next);
            if (!next.sameLinks(previous)) {
                log.info("Connectivité {} ({}) : USB {} / SSH {}", device.getName(), udid,
                        usb == null ? "inconnu" : usb ? "OK" : "KO",
                        ssh ? "OK" : "KO (" + sshError + ")");
                eventPublisher.publishEvent(new DeviceConnectivityChangedEvent(udid));
            }
        }
        cache.keySet().retainAll(seen);
    }

    /** Traduit l'échec d'un {@code ssh ... true} en raison lisible pour le dashboard. */
    static String describeSshFailure(SshClient.Result result) {
        String stderr = result.stderr() == null ? "" : result.stderr().toLowerCase(Locale.ROOT);
        if (result.timedOut() || stderr.contains("timed out")) return "timeout";
        if (stderr.contains("connection refused")) return "connexion refusée (sshd arrêté ?)";
        if (stderr.contains("no route to host") || stderr.contains("host is down")) return "hôte injoignable";
        if (result.exception() != null) return result.exception();
        if (result.exitCode() == 5) return "mot de passe refusé"; // code sshpass : mauvais mot de passe
        return "exit=" + result.exitCode();
    }

    @PreDestroy
    void shutdown() {
        sshPool.shutdownNow();
    }
}
```

- [ ] **Step 5 : configuration**

Dans `src/main/resources/application.yml`, dans le bloc `device:` (après le sous-bloc `ssh:`), ajouter :

```yaml
  # Sonde USB (idevice_id) + SSH de chaque téléphone, lue par /api/devices/live-status
  connectivity:
    interval-ms: 20000
    initial-delay-ms: 5000
```

- [ ] **Step 6 : lancer les tests, vérifier le succès**

Run : `mvn test -q -Dtest=DeviceConnectivityServiceTest 2>&1 | tail -20`
Expected : `Tests run: 6, Failures: 0, Errors: 0`.

- [ ] **Step 7 : commit**

```bash
git add src/main/java/com/automation/instagram/event/DeviceConnectivityChangedEvent.java \
        src/main/java/com/automation/instagram/service/DeviceConnectivityService.java \
        src/main/resources/application.yml \
        src/test/java/com/automation/instagram/service/DeviceConnectivityServiceTest.java
git commit -m "feat(devices): sonde USB + SSH planifiée de chaque téléphone"
```

---

### Task 3 : statut calculé dans `DeviceLiveStatusService` + endpoint

**Files :**
- Modify : `src/main/java/com/automation/instagram/service/DeviceLiveStatusService.java`
- Modify : `src/main/java/com/automation/instagram/controller/DeviceLiveStatusController.java`
- Test : `src/test/java/com/automation/instagram/service/DeviceLiveStatusServiceTest.java`

- [ ] **Step 1 : écrire les tests (qui échouent)**

```java
package com.automation.instagram.service;

import com.automation.instagram.event.DeviceConnectivityChangedEvent;
import com.automation.instagram.model.DeviceConfigDocument;
import com.automation.instagram.service.DeviceConnectivityService.Connectivity;
import com.automation.instagram.service.DeviceLiveStatusService.DeviceStatus;
import com.automation.instagram.service.DeviceLiveStatusService.DeviceStatus.Status;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceLiveStatusServiceTest {

    private static final String UDID = "00008030-TEST-DEVICE";
    private static final Instant CHECKED_AT = Instant.parse("2026-09-24T17:00:00Z");

    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private DeviceConfigService deviceConfigService;
    @Mock private ManualControlService manualControlService;
    @Mock private DeviceConnectivityService connectivityService;

    private DeviceLiveStatusService service;

    @BeforeEach
    void setUp() {
        service = new DeviceLiveStatusService(messagingTemplate, deviceConfigService, manualControlService, connectivityService);
    }

    private static Connectivity conn(Boolean usb, boolean ssh) {
        return new Connectivity(usb, ssh, ssh ? null : "timeout", CHECKED_AT);
    }

    private static DeviceConfigDocument device() {
        return DeviceConfigDocument.builder().udid(UDID).name("iPhoneII").build();
    }

    @Test
    void effectiveStatus_idle_whenUsbAndSshOk() {
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, conn(true, true))).isEqualTo(Status.IDLE);
    }

    @Test
    void effectiveStatus_offline_whenUsbAndSshKo() {
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, conn(false, false))).isEqualTo(Status.OFFLINE);
    }

    @Test
    void effectiveStatus_degraded_whenOnlyOneLinkIsKo() {
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, conn(true, false))).isEqualTo(Status.DEGRADED);
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, conn(false, true))).isEqualTo(Status.DEGRADED);
    }

    @Test
    void effectiveStatus_unknownUsb_isNotAFailure() {
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, conn(null, true))).isEqualTo(Status.IDLE);
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, conn(null, false))).isEqualTo(Status.DEGRADED);
    }

    @Test
    void effectiveStatus_staysIdle_beforeFirstProbe() {
        assertThat(DeviceLiveStatusService.effectiveStatus(Status.IDLE, null)).isEqualTo(Status.IDLE);
    }

    @ParameterizedTest
    @EnumSource(value = Status.class, names = {"RUNNING", "PAUSED", "DISCONNECTED", "ERROR"})
    void effectiveStatus_keepsRunDrivenStates(Status runState) {
        assertThat(DeviceLiveStatusService.effectiveStatus(runState, conn(false, false))).isEqualTo(runState);
    }

    @Test
    void getAllStatuses_exposesConnectivityAndComputedStatus() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device()));
        when(connectivityService.get(UDID)).thenReturn(Optional.of(conn(true, false)));

        List<DeviceStatus> all = service.getAllStatuses();

        assertThat(all).singleElement().satisfies(s -> {
            assertThat(s.getStatus()).isEqualTo(Status.DEGRADED);
            assertThat(s.getUsbConnected()).isTrue();
            assertThat(s.getSshReachable()).isFalse();
            assertThat(s.getSshError()).isEqualTo("timeout");
            assertThat(s.getConnectivityCheckedAt()).isEqualTo(CHECKED_AT);
        });
    }

    @Test
    void getAllStatuses_keepsRunning_evenWhenUnplugged() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device()));
        when(deviceConfigService.findByUdid(UDID)).thenReturn(Optional.of(device()));
        when(connectivityService.get(UDID)).thenReturn(Optional.of(conn(false, false)));
        service.markRunning(UDID, "run-1", "PostReel", "alice");

        List<DeviceStatus> all = service.getAllStatuses();

        assertThat(all).singleElement().satisfies(s -> {
            assertThat(s.getStatus()).isEqualTo(Status.RUNNING);
            assertThat(s.getUsbConnected()).isFalse();
        });
    }

    @Test
    void onConnectivityChanged_broadcastsComputedStatus() {
        when(deviceConfigService.getAllDevices()).thenReturn(List.of(device()));
        when(connectivityService.get(UDID)).thenReturn(Optional.of(conn(false, false)));
        service.getAllStatuses(); // le device apparaît dans la map

        service.onConnectivityChanged(new DeviceConnectivityChangedEvent(UDID));

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/devices/status"), payload.capture());
        assertThat(payload.getValue()).isInstanceOfSatisfying(DeviceStatus.class,
                s -> assertThat(s.getStatus()).isEqualTo(Status.OFFLINE));
    }

    @Test
    void onConnectivityChanged_ignoresDeviceNotYetListed() {
        service.onConnectivityChanged(new DeviceConnectivityChangedEvent(UDID));

        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }
}
```

- [ ] **Step 2 : lancer les tests, vérifier l'échec**

Run : `mvn test -q -Dtest=DeviceLiveStatusServiceTest 2>&1 | tail -20`
Expected : échec de compilation (constructeur à 4 arguments, `effectiveStatus`, `DEGRADED`, `getUsbConnected`… absents).

- [ ] **Step 3 : modifier `DeviceLiveStatusService`**

1. Imports : ajouter `import com.automation.instagram.event.DeviceConnectivityChangedEvent;` et `import org.springframework.context.event.EventListener;`.
2. Champ + constructeur : ajouter `private final DeviceConnectivityService connectivityService;` et un 4e paramètre `DeviceConnectivityService connectivityService` au constructeur (`this.connectivityService = connectivityService;`).
3. Dans `DeviceStatus`, après `manualMode`, ajouter :

```java
        /** Présence USB (idevice_id) au dernier test ; null = inconnu ou pas encore testé. */
        private Boolean usbConnected;
        /** Accès SSH au dernier test ; null = pas encore testé. */
        private Boolean sshReachable;
        private String sshError;
        private Instant connectivityCheckedAt;
```

   et l'enum devient `IDLE, RUNNING, ERROR, OFFLINE, DISCONNECTED, PAUSED, DEGRADED`.

4. Dans `updateStatus`, remplacer le bloc `try { messagingTemplate.convertAndSend(...) } catch ...` par `broadcast(newStatus);` et ajouter :

```java
    private void broadcast(DeviceStatus status) {
        try {
            messagingTemplate.convertAndSend("/topic/devices/status", status);
        } catch (Exception e) {
            log.debug("Failed to broadcast device status for {}: {}", status.getDeviceUdid(), e.getMessage());
        }
    }
```

5. Remplacer la fin de `getAllStatuses()` (le `return deviceStatuses.values().stream().map(s -> DeviceStatus.builder()...)`) par `return deviceStatuses.values().stream().map(this::snapshot).collect(java.util.stream.Collectors.toList());`, et le corps de `getStatus()` par :

```java
        DeviceStatus s = deviceStatuses.get(deviceUdid);
        return s == null ? null : snapshot(s);
```

6. Ajouter :

```java
    /**
     * Copie enrichie d'une entrée (sans muter le cache) : flag manualMode, résultat de la sonde de
     * connectivité et statut calculé.
     */
    private DeviceStatus snapshot(DeviceStatus s) {
        DeviceConnectivityService.Connectivity c = connectivityService.get(s.getDeviceUdid()).orElse(null);
        return DeviceStatus.builder()
                .deviceUdid(s.getDeviceUdid())
                .deviceName(s.getDeviceName())
                .status(effectiveStatus(s.getStatus(), c))
                .currentRunId(s.getCurrentRunId())
                .currentAction(s.getCurrentAction())
                .currentAccount(s.getCurrentAccount())
                .lastActivityAt(s.getLastActivityAt())
                .manualMode(manualControlService.isManualMode(s.getDeviceUdid()))
                .usbConnected(c != null ? c.usb() : null)
                .sshReachable(c != null ? c.ssh() : null)
                .sshError(c != null ? c.sshError() : null)
                .connectivityCheckedAt(c != null ? c.checkedAt() : null)
                .build();
    }

    /**
     * Statut affiché. Les états posés par un run (RUNNING, PAUSED, DISCONNECTED, ERROR) priment :
     * le run sait mieux que la sonde. Au repos, IDLE n'est vrai que si le téléphone est vu en USB
     * et répond en SSH ; un USB inconnu (idevice_id en échec) ne compte pas comme un échec.
     */
    static DeviceStatus.Status effectiveStatus(DeviceStatus.Status stored,
                                               DeviceConnectivityService.Connectivity c) {
        if (stored != DeviceStatus.Status.IDLE || c == null) {
            return stored;
        }
        boolean usbKo = Boolean.FALSE.equals(c.usb());
        boolean sshKo = !c.ssh();
        if (usbKo && sshKo) return DeviceStatus.Status.OFFLINE;
        if (usbKo || sshKo) return DeviceStatus.Status.DEGRADED;
        return DeviceStatus.Status.IDLE;
    }

    /** Pousse le statut recalculé quand l'USB ou le SSH d'un device change. */
    @EventListener
    public void onConnectivityChanged(DeviceConnectivityChangedEvent event) {
        DeviceStatus status = getStatus(event.deviceUdid());
        if (status == null) {
            return; // pas encore listé : la prochaine lecture calculera le statut
        }
        broadcast(status);
    }
```

- [ ] **Step 4 : endpoint**

`DeviceLiveStatusController` devient :

```java
package com.automation.instagram.controller;

import com.automation.instagram.service.DeviceConnectivityService;
import com.automation.instagram.service.DeviceLiveStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceLiveStatusController {

    private final DeviceLiveStatusService deviceLiveStatusService;
    private final DeviceConnectivityService deviceConnectivityService;

    @GetMapping("/live-status")
    public List<DeviceLiveStatusService.DeviceStatus> getLiveStatus() {
        return deviceLiveStatusService.getAllStatuses();
    }

    /** Relance tout de suite la sonde USB + SSH (bouton « Revérifier ») et renvoie les statuts à jour. */
    @PostMapping("/connectivity/refresh")
    public List<DeviceLiveStatusService.DeviceStatus> refreshConnectivity() {
        deviceConnectivityService.refreshNow();
        return deviceLiveStatusService.getAllStatuses();
    }
}
```

- [ ] **Step 5 : lancer les tests, vérifier le succès**

Run : `mvn test -q -Dtest='DeviceLiveStatusServiceTest,DeviceConnectivityServiceTest' 2>&1 | tail -20`
Expected : tous verts.

- [ ] **Step 6 : suite complète**

Run : `mvn test -q 2>&1 | tail -30`
Expected : aucun nouvel échec par rapport à `master` (comparer avec la même commande sur la base si des échecs apparaissent).

- [ ] **Step 7 : commit**

```bash
git add src/main/java/com/automation/instagram/service/DeviceLiveStatusService.java \
        src/main/java/com/automation/instagram/controller/DeviceLiveStatusController.java \
        src/test/java/com/automation/instagram/service/DeviceLiveStatusServiceTest.java
git commit -m "feat(devices): statut live calculé depuis USB + SSH (IDLE / DEGRADED / OFFLINE)"
```

---

### Task 4 : dashboard — badge, pastilles, carte

**Files :**
- Modify : `src/components/shared/StatusBadge.jsx`
- Create : `src/components/activity-log/ConnectivityPills.jsx`
- Modify : `src/components/activity-log/DeviceCard.jsx`

- [ ] **Step 1 : `StatusBadge`** — dans `STATUS_STYLES`, après `DISCONNECTED` :

```js
  DEGRADED: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
```

- [ ] **Step 2 : `ConnectivityPills.jsx`**

```jsx
import { Check, X, CircleHelp } from 'lucide-react'

const STATE_STYLE = {
  ok: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  ko: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  unknown: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
}

const STATE_ICON = { ok: Check, ko: X, unknown: CircleHelp }

function stateOf(value) {
  if (value === true) return 'ok'
  if (value === false) return 'ko'
  return 'unknown'
}

function Pill({ label, value, title }) {
  const state = stateOf(value)
  const Icon = STATE_ICON[state]
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${STATE_STYLE[state]}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

// Pastilles USB / SSH issues de la sonde backend (idevice_id -l + ssh true, toutes les 20 s)
export default function ConnectivityPills({ device }) {
  const checkedAt = device.connectivityCheckedAt
    ? `Dernier test : ${new Date(device.connectivityCheckedAt).toLocaleTimeString('fr-FR')}`
    : 'Pas encore testé'

  const usbTitle = device.usbConnected === true
    ? 'Vu par idevice_id'
    : device.usbConnected === false
      ? 'Absent de idevice_id -l (câble débranché ?)'
      : 'État USB inconnu'

  const sshTitle = device.sshReachable === true
    ? 'SSH accessible'
    : device.sshReachable === false
      ? `SSH injoignable : ${device.sshError || 'erreur inconnue'}`
      : 'État SSH inconnu'

  return (
    <div className="flex items-center gap-1.5">
      <Pill label="USB" value={device.usbConnected} title={`${usbTitle}\n${checkedAt}`} />
      <Pill label="SSH" value={device.sshReachable} title={`${sshTitle}\n${checkedAt}`} />
    </div>
  )
}
```

- [ ] **Step 3 : `DeviceCard.jsx`**

1. Import : `import ConnectivityPills from './ConnectivityPills'`.
2. `STATUS_DOT` : ajouter `DEGRADED: 'bg-[#F97316]',`.
3. Après `const isDisconnected = ...` : `const isDegraded = device.status === 'DEGRADED'`.
4. Ajouter au-dessus du composant :

```js
// Cause affichée pour un téléphone DEGRADED (un seul des deux tests a échoué)
function degradedReason(device) {
  if (device.usbConnected === false) return 'Câble USB non détecté'
  if (device.sshReachable === false) return `SSH injoignable${device.sshError ? ` (${device.sshError})` : ''}`
  return 'Connectivité partielle'
}
```

5. Classe de bordure : `isError ? 'border-[#EF4444]/30' : isDisconnected ? 'border-[#F59E0B]/30' : isDegraded ? 'border-[#F97316]/30' : 'border-[#1a1a1a]'`.
6. Juste après le bloc `{/* Header */}` (avant `{/* Mini-stats */}`) :

```jsx
      {/* Connectivité USB / SSH */}
      <div className="mb-3">
        <ConnectivityPills device={device} />
      </div>
```

7. Après le bloc `{/* Disconnected */}` :

```jsx
      {/* Degraded */}
      {isDegraded && (
        <div className="mb-3 p-2 rounded-md bg-[#F97316]/5 border border-[#F97316]/10">
          <div className="flex items-center gap-1.5 text-xs text-[#F97316]">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{degradedReason(device)}</span>
          </div>
        </div>
      )}
```

- [ ] **Step 4 : lint** — Run : `npm run lint 2>&1 | tail -20` → aucune nouvelle erreur sur ces fichiers.

- [ ] **Step 5 : commit**

```bash
git add src/components/shared/StatusBadge.jsx src/components/activity-log/ConnectivityPills.jsx src/components/activity-log/DeviceCard.jsx
git commit -m "feat(activity-log): pastilles USB / SSH et état DEGRADED sur les cartes"
```

---

### Task 5 : dashboard — page, résumé, bouton « Revérifier », page Devices

**Files :**
- Modify : `src/pages/ActivityLog.jsx`
- Modify : `src/components/activity-log/FleetSummaryBar.jsx`
- Modify : `src/pages/Devices.jsx`

- [ ] **Step 1 : `ActivityLog.jsx`**

1. Imports : `useMutation` en plus (`import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'`), `apiPost` (`import { apiGet, apiPost } from '@/lib/api'`), `import { toast } from 'sonner'`, `import { RefreshCw } from 'lucide-react'`, `import { Button } from '@/components/ui/button'`.
2. Dans le `useMemo` de fusion, après `port: ...` :

```js
        usbConnected: live.usbConnected,
        sshReachable: live.sshReachable,
        sshError: live.sshError,
        connectivityCheckedAt: live.connectivityCheckedAt,
```

3. Après l'effet WebSocket :

```js
  // Force un test USB + SSH immédiat ; la réponse contient déjà les statuts à jour
  const refreshConnectivity = useMutation({
    mutationFn: () => apiPost('/api/devices/connectivity/refresh'),
    onSuccess: (res) => queryClient.setQueryData(['devices-live'], res),
    onError: (err) => toast.error(`Revérification impossible : ${err.message}`),
  })
```

4. Remplacer le `<h1>` par :

```jsx
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Activity Log</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refreshConnectivity.mutate()}
          disabled={refreshConnectivity.isPending}
          title="Relance idevice_id et un test SSH sur chaque téléphone"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshConnectivity.isPending ? 'animate-spin' : ''}`} />
          Revérifier
        </Button>
      </div>
```

- [ ] **Step 2 : `FleetSummaryBar.jsx`**

```jsx
import { Smartphone, Play, AlertTriangle, ScrollText, Unplug, WifiOff } from 'lucide-react'

const STATS = [
  { key: 'total', label: 'Total Devices', icon: Smartphone, color: '#A1A1AA' },
  { key: 'running', label: 'Running', icon: Play, color: '#3B82F6' },
  { key: 'degraded', label: 'Degraded', icon: Unplug, color: '#F97316' },
  { key: 'offline', label: 'Offline', icon: WifiOff, color: '#52525B' },
  { key: 'error', label: 'Error', icon: AlertTriangle, color: '#EF4444' },
  { key: 'runsToday', label: 'Runs Today', icon: ScrollText, color: '#22C55E' },
]
```

Dans le composant : `const degraded = devices.filter(d => d.status === 'DEGRADED').length`, `const offline = devices.filter(d => d.status === 'OFFLINE').length`, `values = { total: devices.length, running, degraded, offline, error, runsToday }`, et la grille devient `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`.

- [ ] **Step 3 : `Devices.jsx`**

1. `STATUS_DOT` : ajouter `DEGRADED: 'bg-[#F97316]',`.
2. `statusCounts` : `const counts = { IDLE: 0, RUNNING: 0, ERROR: 0, OFFLINE: 0, DISCONNECTED: 0, DEGRADED: 0 }`.
3. Tuiles : grille `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`, et après la tuile `Disconnected` :

```js
          { label: 'Degraded', count: statusCounts.DEGRADED, color: '#F97316', dot: 'bg-[#F97316]' },
```

- [ ] **Step 4 : lint + build** — Run : `npm run lint 2>&1 | tail -20` puis `npm run build 2>&1 | tail -15` → build OK.

- [ ] **Step 5 : commit**

```bash
git add src/pages/ActivityLog.jsx src/components/activity-log/FleetSummaryBar.jsx src/pages/Devices.jsx
git commit -m "feat(activity-log): bouton Revérifier et compteurs Degraded / Offline"
```

---

### Task 6 : vérification de bout en bout

- [ ] Backend redémarré sur le code fusionné (bouton de `/settings`, ou `mvn spring-boot:run`).
- [ ] `curl -s localhost:8081/api/devices/live-status` : ~5 s après le démarrage, chaque device porte `usbConnected` / `sshReachable`, et les statuts collent à `idevice_id -l` + un SSH manuel.
- [ ] `curl -s -X POST localhost:8081/api/devices/connectivity/refresh` renvoie la liste à jour en ≤ ~12 s.
- [ ] `/activity-log` : pastilles, cartes `DEGRADED`/`OFFLINE`, compteurs, bouton « Revérifier » qui tourne puis met à jour.
