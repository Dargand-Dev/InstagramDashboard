# Device SSH Terminal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-device SSH terminal accessible from a dedicated route `/devices/:udid/terminal`, using JSch on the backend and xterm.js on the frontend, streamed over the existing STOMP transport.

**Architecture:** REST `POST /api/devices/{udid}/terminal/sessions` opens a JSch shell channel and registers a `DeviceTerminalSession` in a manager map. STOMP topics carry shell output; STOMP `@MessageMapping` endpoints carry input/resize/ping. A `@Scheduled` reaper closes sessions idle for 120s. Frontend renders xterm.js inside a new page, with a button on each `DeviceCard` to open it.

**Tech Stack:** Spring Boot 3.4 / Java 17 / JSch (mwiede 0.2.20) / WebSocket-STOMP / React 19 / xterm.js (`@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`) / SockJS / @stomp/stompjs.

**Spec:** `docs/superpowers/specs/2026-04-29-device-ssh-terminal-design.md`

**Two repos involved:**
- Backend: `/Users/samyhne/IG-bot/InstagramAutomation` (Maven, port 8081)
- Frontend: `/Users/samyhne/IG-bot/InstagramDashboard` (Vite, port 5173)

---

## File map

### Backend (InstagramAutomation)
- Create: `src/main/java/com/automation/instagram/config/DeviceSshProperties.java` — `@ConfigurationProperties` for `device.ssh.*`
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalSession.java` — POJO encapsulating one JSch shell session
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalSessionManager.java` — `@Service` map + reaper
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalController.java` — REST controller
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalStompController.java` — STOMP @MessageMapping
- Create: `src/main/java/com/automation/instagram/terminal/dto/OpenSessionResponse.java`
- Create: `src/main/java/com/automation/instagram/terminal/exception/DeviceNotFoundException.java`
- Create: `src/main/java/com/automation/instagram/terminal/exception/DeviceIpMissingException.java`
- Create: `src/main/java/com/automation/instagram/terminal/exception/SshUnreachableException.java`
- Create: `src/test/java/com/automation/instagram/terminal/DeviceTerminalSessionManagerTest.java`
- Create: `src/test/java/com/automation/instagram/terminal/DeviceTerminalControllerTest.java`
- Modify: `pom.xml` — add JSch dependency
- Modify: `src/main/resources/application.yml` — add `device.ssh.*` block
- Modify: `src/main/java/com/automation/instagram/InstagramAutomationApplication.java` — add `@EnableScheduling` if missing

### Frontend (InstagramDashboard)
- Modify: `package.json` — add xterm deps
- Modify: `src/hooks/useWebSocket.js` — expose `publish(destination, body)`
- Create: `src/components/devices/TerminalView.jsx` — xterm.js wrapper
- Create: `src/pages/DeviceTerminal.jsx` — page composing the view
- Modify: `src/pages/Devices.jsx` — propagate `deviceIp`, add Terminal button on cards
- Modify: `src/App.jsx` — register `/devices/:udid/terminal` route
- Modify: `src/index.css` — small import to load xterm.css (or import directly in TerminalView)

---

## Backend — Tasks 1-9

### Task 1: Add JSch dependency and SSH config properties

**Files:**
- Modify: `/Users/samyhne/IG-bot/InstagramAutomation/pom.xml`
- Create: `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/config/DeviceSshProperties.java`
- Modify: `/Users/samyhne/IG-bot/InstagramAutomation/src/main/resources/application.yml`

- [ ] **Step 1: Add JSch (mwiede fork) to pom.xml**

In the `<dependencies>` block of `/Users/samyhne/IG-bot/InstagramAutomation/pom.xml`, add:

```xml
<!-- SSH client (interactive shell to jailbroken iOS devices) -->
<dependency>
    <groupId>com.github.mwiede</groupId>
    <artifactId>jsch</artifactId>
    <version>0.2.20</version>
</dependency>
```

- [ ] **Step 2: Verify Maven resolves the new dependency**

Run from `/Users/samyhne/IG-bot/InstagramAutomation`:
```bash
./mvnw dependency:resolve -q 2>&1 | tail -20
```
Expected: no errors. If the project uses plain `mvn` and not the wrapper, run `mvn dependency:resolve -q` instead.

- [ ] **Step 3: Create DeviceSshProperties**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/config/DeviceSshProperties.java`:

```java
package com.automation.instagram.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Paramètres de connexion SSH vers les iPhones jailbreakés.
 *
 * <p>Le mot de passe peut être surchargé via la variable d'environnement
 * {@code DEVICE_SSH_PASSWORD} (cf. application.yml).
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "device.ssh")
public class DeviceSshProperties {

    private String user = "mobile";
    private String password = "poiu";
    private int port = 22;
    private int connectTimeoutMs = 10_000;
    private int idleTimeoutMs = 120_000;
    private int reaperIntervalMs = 30_000;
}
```

- [ ] **Step 4: Append device.ssh block to application.yml**

Append to `/Users/samyhne/IG-bot/InstagramAutomation/src/main/resources/application.yml` (top-level, not nested in another block):

```yaml
device:
  ssh:
    user: mobile
    password: ${DEVICE_SSH_PASSWORD:poiu}
    port: 22
    connect-timeout-ms: 10000
    idle-timeout-ms: 120000
    reaper-interval-ms: 30000
```

If a `device:` block already exists, merge the `ssh:` sub-block under it instead of duplicating the top-level key.

- [ ] **Step 5: Build the backend to validate config binding**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q -DskipTests compile 2>&1 | tail -10
```
Expected: BUILD SUCCESS, no compilation errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add pom.xml src/main/java/com/automation/instagram/config/DeviceSshProperties.java src/main/resources/application.yml
git commit -m "feat(terminal): add JSch dep and device.ssh config"
```

---

### Task 2: Define exception types

**Files:**
- Create: `src/main/java/com/automation/instagram/terminal/exception/DeviceNotFoundException.java`
- Create: `src/main/java/com/automation/instagram/terminal/exception/DeviceIpMissingException.java`
- Create: `src/main/java/com/automation/instagram/terminal/exception/SshUnreachableException.java`

(All paths under `/Users/samyhne/IG-bot/InstagramAutomation/`.)

- [ ] **Step 1: Create DeviceNotFoundException**

```java
package com.automation.instagram.terminal.exception;

public class DeviceNotFoundException extends RuntimeException {
    public DeviceNotFoundException(String udid) {
        super("Device introuvable : " + udid);
    }
}
```

- [ ] **Step 2: Create DeviceIpMissingException**

```java
package com.automation.instagram.terminal.exception;

public class DeviceIpMissingException extends RuntimeException {
    public DeviceIpMissingException(String udid) {
        super("Aucune IP configurée pour le device " + udid);
    }
}
```

- [ ] **Step 3: Create SshUnreachableException**

```java
package com.automation.instagram.terminal.exception;

public class SshUnreachableException extends RuntimeException {
    public SshUnreachableException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: Compile to verify**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q -DskipTests compile 2>&1 | tail -10
```
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/terminal/exception/
git commit -m "feat(terminal): add session opening exception types"
```

---

### Task 3: Implement DeviceTerminalSession (no tests yet — instance not directly testable without real SSH)

**Files:**
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalSession.java`

- [ ] **Step 1: Write the class**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/DeviceTerminalSession.java`:

```java
package com.automation.instagram.terminal;

import com.automation.instagram.config.DeviceSshProperties;
import com.automation.instagram.terminal.exception.SshUnreachableException;
import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Une session SSH interactive avec un device jailbreaké.
 *
 * <p>Encapsule {@link JSch} + {@link ChannelShell} et démarre un thread reader qui
 * pousse la sortie du shell vers un topic STOMP. La session reste vivante jusqu'à
 * fermeture explicite, EOF du shell, ou reap par inactivité.
 */
@Slf4j
public class DeviceTerminalSession {

    private static final int READ_BUFFER_BYTES = 4096;
    private static final int DEFAULT_COLS = 80;
    private static final int DEFAULT_ROWS = 24;

    @Getter private final String sessionId;
    @Getter private final String udid;
    @Getter private final String deviceIp;
    @Getter private final String userName;

    private final SimpMessagingTemplate messagingTemplate;
    private final Session sshSession;
    private final ChannelShell channel;
    private final OutputStream channelInput;
    private final InputStream channelOutput;
    private final Thread readerThread;
    private final AtomicBoolean closed = new AtomicBoolean(false);

    @Getter private volatile Instant lastActivityAt = Instant.now();

    /**
     * Ouvre la session SSH de manière synchrone. À l'issue du constructeur,
     * le canal est connecté et le reader thread est démarré.
     *
     * @throws SshUnreachableException si la connexion SSH échoue (timeout/auth)
     */
    public DeviceTerminalSession(
            String sessionId,
            String udid,
            String deviceIp,
            String userName,
            DeviceSshProperties sshProps,
            SimpMessagingTemplate messagingTemplate) {
        this.sessionId = sessionId;
        this.udid = udid;
        this.deviceIp = deviceIp;
        this.userName = userName;
        this.messagingTemplate = messagingTemplate;

        try {
            JSch jsch = new JSch();
            this.sshSession = jsch.getSession(sshProps.getUser(), deviceIp, sshProps.getPort());
            this.sshSession.setPassword(sshProps.getPassword());

            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "no");
            this.sshSession.setConfig(config);
            this.sshSession.connect(sshProps.getConnectTimeoutMs());

            this.channel = (ChannelShell) sshSession.openChannel("shell");
            this.channel.setPtyType("xterm-256color");
            this.channel.setPtySize(DEFAULT_COLS, DEFAULT_ROWS, DEFAULT_COLS * 8, DEFAULT_ROWS * 16);
            this.channelInput = this.channel.getOutputStream();
            this.channelOutput = this.channel.getInputStream();
            this.channel.connect();
        } catch (JSchException | IOException e) {
            throw new SshUnreachableException(
                    "Échec d'ouverture du canal SSH vers " + deviceIp + " : " + e.getMessage(), e);
        }

        this.readerThread = new Thread(this::readLoop, "ssh-reader-" + sessionId);
        this.readerThread.setDaemon(true);
        this.readerThread.start();
    }

    /** Écrit des bytes (UTF-8) dans le shell. Met à jour l'activité. */
    public void write(String data) {
        if (closed.get()) return;
        try {
            channelInput.write(data.getBytes(StandardCharsets.UTF_8));
            channelInput.flush();
            lastActivityAt = Instant.now();
        } catch (IOException e) {
            log.warn("[{}] Erreur écriture SSH : {}", sessionId, e.getMessage());
            close("error");
        }
    }

    /** Redimensionne le PTY. Met à jour l'activité. */
    public void resize(int cols, int rows) {
        if (closed.get()) return;
        if (cols <= 0 || rows <= 0) return;
        channel.setPtySize(cols, rows, cols * 8, rows * 16);
        lastActivityAt = Instant.now();
    }

    /** Met à jour l'activité (appelé par le ping). */
    public void touch() {
        lastActivityAt = Instant.now();
    }

    /** Idempotent : ferme la session, broadcast `closed` sur le topic. */
    public void close(String reason) {
        if (!closed.compareAndSet(false, true)) return;
        try {
            messagingTemplate.convertAndSend(
                    "/topic/devices/terminal/" + sessionId + "/output",
                    Map.of("type", "closed", "reason", reason));
        } catch (Exception e) {
            log.warn("[{}] Erreur broadcast closed : {}", sessionId, e.getMessage());
        }
        try { if (channel != null && channel.isConnected()) channel.disconnect(); } catch (Exception ignored) {}
        try { if (sshSession != null && sshSession.isConnected()) sshSession.disconnect(); } catch (Exception ignored) {}
        if (readerThread != null) readerThread.interrupt();
    }

    public boolean isClosed() {
        return closed.get();
    }

    private void readLoop() {
        byte[] buf = new byte[READ_BUFFER_BYTES];
        try {
            while (!closed.get()) {
                int n = channelOutput.read(buf);
                if (n < 0) {
                    close("eof");
                    return;
                }
                if (n == 0) continue;
                String chunk = new String(buf, 0, n, StandardCharsets.UTF_8);
                messagingTemplate.convertAndSend(
                        "/topic/devices/terminal/" + sessionId + "/output",
                        Map.of("type", "data", "data", chunk));
            }
        } catch (IOException e) {
            if (!closed.get()) {
                log.warn("[{}] Erreur lecture SSH : {}", sessionId, e.getMessage());
                close("error");
            }
        }
    }
}
```

- [ ] **Step 2: Compile to verify**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q -DskipTests compile 2>&1 | tail -10
```
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/terminal/DeviceTerminalSession.java
git commit -m "feat(terminal): implement DeviceTerminalSession with JSch shell channel"
```

---

### Task 4: Write DeviceTerminalSessionManager test (red)

The manager has fields the tests can drive directly: `open`, `get`, `close`, `closeAll`, and `reapStale`. We mock JSch indirectly by overriding session creation in the manager via a protected factory method.

**Files:**
- Create: `src/test/java/com/automation/instagram/terminal/DeviceTerminalSessionManagerTest.java`

- [ ] **Step 1: Write the failing test**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/test/java/com/automation/instagram/terminal/DeviceTerminalSessionManagerTest.java`:

```java
package com.automation.instagram.terminal;

import com.automation.instagram.config.DeviceSshProperties;
import com.automation.instagram.model.DeviceConfigDocument;
import com.automation.instagram.service.DeviceConfigService;
import com.automation.instagram.terminal.exception.DeviceIpMissingException;
import com.automation.instagram.terminal.exception.DeviceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DeviceTerminalSessionManagerTest {

    private DeviceConfigService deviceConfigService;
    private SimpMessagingTemplate messagingTemplate;
    private DeviceSshProperties sshProps;
    private TestableSessionManager manager;

    @BeforeEach
    void setUp() {
        deviceConfigService = mock(DeviceConfigService.class);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        sshProps = new DeviceSshProperties();
        sshProps.setIdleTimeoutMs(120_000);
        manager = new TestableSessionManager(deviceConfigService, messagingTemplate, sshProps);
    }

    @Test
    void open_unknownDevice_throwsDeviceNotFound() {
        when(deviceConfigService.findByUdid("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> manager.open("ghost", "alice"))
                .isInstanceOf(DeviceNotFoundException.class);
    }

    @Test
    void open_deviceWithoutIp_throwsDeviceIpMissing() {
        DeviceConfigDocument doc = DeviceConfigDocument.builder().udid("u1").deviceIp(null).build();
        when(deviceConfigService.findByUdid("u1")).thenReturn(Optional.of(doc));

        assertThatThrownBy(() -> manager.open("u1", "alice"))
                .isInstanceOf(DeviceIpMissingException.class);
    }

    @Test
    void open_validDevice_registersSessionAndCanBeRetrieved() {
        DeviceConfigDocument doc = DeviceConfigDocument.builder()
                .udid("u1").deviceIp("10.0.0.1").build();
        when(deviceConfigService.findByUdid("u1")).thenReturn(Optional.of(doc));

        DeviceTerminalSession session = manager.open("u1", "alice");

        assertThat(session.getSessionId()).isNotBlank();
        assertThat(manager.get(session.getSessionId())).hasValue(session);
    }

    @Test
    void close_removesSessionFromMap() {
        DeviceConfigDocument doc = DeviceConfigDocument.builder()
                .udid("u1").deviceIp("10.0.0.1").build();
        when(deviceConfigService.findByUdid("u1")).thenReturn(Optional.of(doc));
        DeviceTerminalSession session = manager.open("u1", "alice");

        manager.close(session.getSessionId());

        assertThat(manager.get(session.getSessionId())).isEmpty();
    }

    @Test
    void close_unknownSession_isIdempotent() {
        // No exception, no error
        manager.close("missing-id");
        assertThat(manager.get("missing-id")).isEmpty();
    }

    @Test
    void reapStale_closesSessionsOlderThanIdleTimeout() {
        DeviceConfigDocument doc = DeviceConfigDocument.builder()
                .udid("u1").deviceIp("10.0.0.1").build();
        when(deviceConfigService.findByUdid("u1")).thenReturn(Optional.of(doc));
        DeviceTerminalSession session = manager.open("u1", "alice");

        // Force lastActivityAt to be old
        manager.fakeAge(session, 200_000);

        manager.reapStale();

        assertThat(manager.get(session.getSessionId())).isEmpty();
    }

    @Test
    void closeAll_closesAllRegisteredSessions() {
        DeviceConfigDocument doc = DeviceConfigDocument.builder()
                .udid("u1").deviceIp("10.0.0.1").build();
        when(deviceConfigService.findByUdid("u1")).thenReturn(Optional.of(doc));
        manager.open("u1", "alice");
        manager.open("u1", "bob");

        manager.closeAll();

        // After closeAll, the map is empty
        assertThat(manager.activeSessionCount()).isZero();
    }

    /**
     * Subclass overriding the SSH-opening factory to return a fake session
     * (avoids needing a real SSH server during unit tests).
     */
    private static class TestableSessionManager extends DeviceTerminalSessionManager {

        private final AtomicInteger created = new AtomicInteger();

        TestableSessionManager(DeviceConfigService svc, SimpMessagingTemplate t, DeviceSshProperties p) {
            super(svc, t, p);
        }

        @Override
        protected DeviceTerminalSession createSession(
                String sessionId, String udid, String deviceIp, String userName) {
            return new FakeSession(sessionId, udid, deviceIp, userName);
        }

        /** Forces a session's lastActivityAt to be `ageMs` in the past. */
        void fakeAge(DeviceTerminalSession s, long ageMs) {
            ((FakeSession) s).lastActivity = Instant.now().minusMillis(ageMs);
        }

        int activeSessionCount() {
            return sessionCount();
        }
    }

    /** Minimal stand-in implementing the public surface used by the manager. */
    private static class FakeSession extends DeviceTerminalSession {
        Instant lastActivity = Instant.now();
        final AtomicBoolean closed = new AtomicBoolean(false);

        FakeSession(String sessionId, String udid, String deviceIp, String userName) {
            super(sessionId, udid, deviceIp, userName);
        }

        @Override public Instant getLastActivityAt() { return lastActivity; }
        @Override public void close(String reason) { closed.set(true); }
        @Override public boolean isClosed() { return closed.get(); }
    }
}
```

This test references a constructor on `DeviceTerminalSession` that doesn't yet exist (no-args / test-friendly) and a `protected createSession` method on the manager. Both are introduced in Task 5.

- [ ] **Step 2: Add a test-only constructor on DeviceTerminalSession**

Modify `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/DeviceTerminalSession.java` — add this constructor right after the existing one (production constructor):

```java
    /**
     * Constructeur "vide" pour les tests/sous-classes : n'ouvre aucun socket.
     * À ne pas utiliser depuis le code de production.
     */
    protected DeviceTerminalSession(String sessionId, String udid, String deviceIp, String userName) {
        this.sessionId = sessionId;
        this.udid = udid;
        this.deviceIp = deviceIp;
        this.userName = userName;
        this.messagingTemplate = null;
        this.sshSession = null;
        this.channel = null;
        this.channelInput = null;
        this.channelOutput = null;
        this.readerThread = null;
    }
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q test -Dtest=DeviceTerminalSessionManagerTest 2>&1 | tail -30
```
Expected: FAIL — `DeviceTerminalSessionManager` class doesn't exist yet.

- [ ] **Step 4: Commit (red)**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/test/java/com/automation/instagram/terminal/ src/main/java/com/automation/instagram/terminal/DeviceTerminalSession.java
git commit -m "test(terminal): failing tests for session manager"
```

---

### Task 5: Implement DeviceTerminalSessionManager (green)

**Files:**
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalSessionManager.java`

- [ ] **Step 1: Write the manager**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/DeviceTerminalSessionManager.java`:

```java
package com.automation.instagram.terminal;

import com.automation.instagram.config.DeviceSshProperties;
import com.automation.instagram.model.DeviceConfigDocument;
import com.automation.instagram.service.DeviceConfigService;
import com.automation.instagram.terminal.exception.DeviceIpMissingException;
import com.automation.instagram.terminal.exception.DeviceNotFoundException;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Gère le cycle de vie des sessions SSH terminal par device.
 *
 * <p>Indexe les sessions par UUID, ferme automatiquement celles inactives au-delà
 * du timeout configuré, et libère toutes les sessions au shutdown.
 */
@Slf4j
@Service
public class DeviceTerminalSessionManager {

    private final DeviceConfigService deviceConfigService;
    private final SimpMessagingTemplate messagingTemplate;
    private final DeviceSshProperties sshProps;
    private final ConcurrentHashMap<String, DeviceTerminalSession> sessions = new ConcurrentHashMap<>();

    public DeviceTerminalSessionManager(
            DeviceConfigService deviceConfigService,
            SimpMessagingTemplate messagingTemplate,
            DeviceSshProperties sshProps) {
        this.deviceConfigService = deviceConfigService;
        this.messagingTemplate = messagingTemplate;
        this.sshProps = sshProps;
    }

    /**
     * Ouvre une session SSH pour le device {@code udid}, au nom de l'utilisateur
     * {@code userName}. Synchronously blocks until the channel is connected.
     *
     * @throws DeviceNotFoundException si l'udid est inconnu
     * @throws DeviceIpMissingException si {@code deviceIp} est null/blank
     * @throws com.automation.instagram.terminal.exception.SshUnreachableException si la connexion échoue
     */
    public DeviceTerminalSession open(String udid, String userName) {
        DeviceConfigDocument device = deviceConfigService.findByUdid(udid)
                .orElseThrow(() -> new DeviceNotFoundException(udid));

        String ip = device.getDeviceIp();
        if (ip == null || ip.isBlank()) {
            throw new DeviceIpMissingException(udid);
        }

        String sessionId = UUID.randomUUID().toString();
        DeviceTerminalSession session = createSession(sessionId, udid, ip, userName);
        sessions.put(sessionId, session);
        log.info("[{}] Session SSH ouverte (udid={}, ip={}, user={})", sessionId, udid, ip, userName);
        return session;
    }

    /** Hook factory for tests to override (avoids real SSH calls). */
    protected DeviceTerminalSession createSession(
            String sessionId, String udid, String deviceIp, String userName) {
        return new DeviceTerminalSession(
                sessionId, udid, deviceIp, userName, sshProps, messagingTemplate);
    }

    public Optional<DeviceTerminalSession> get(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    /** Idempotent : ferme et retire la session du map (no-op si inconnue). */
    public void close(String sessionId) {
        DeviceTerminalSession s = sessions.remove(sessionId);
        if (s != null) {
            s.close("client");
            log.info("[{}] Session SSH fermée (client)", sessionId);
        }
    }

    @Scheduled(fixedDelayString = "${device.ssh.reaper-interval-ms:30000}")
    public void reapStale() {
        Instant cutoff = Instant.now().minus(Duration.ofMillis(sshProps.getIdleTimeoutMs()));
        List<String> toReap = sessions.entrySet().stream()
                .filter(e -> e.getValue().getLastActivityAt().isBefore(cutoff))
                .map(java.util.Map.Entry::getKey)
                .toList();
        for (String sid : toReap) {
            DeviceTerminalSession s = sessions.remove(sid);
            if (s != null) {
                s.close("expired");
                log.info("[{}] Session SSH reaped (idle > {} ms)", sid, sshProps.getIdleTimeoutMs());
            }
        }
    }

    @PreDestroy
    public void closeAll() {
        sessions.values().forEach(s -> s.close("shutdown"));
        sessions.clear();
    }

    /** For tests. */
    int sessionCount() {
        return sessions.size();
    }
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q test -Dtest=DeviceTerminalSessionManagerTest 2>&1 | tail -30
```
Expected: PASS — all 7 tests green.

- [ ] **Step 3: Ensure @EnableScheduling is present**

Read `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/InstagramAutomationApplication.java`. If it doesn't already have `@EnableScheduling`, add it:

```java
import org.springframework.scheduling.annotation.EnableScheduling;
// ...
@SpringBootApplication
@EnableScheduling
public class InstagramAutomationApplication { ... }
```

If it's already there (search for `@EnableScheduling` first), skip this step.

- [ ] **Step 4: Compile to verify**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q -DskipTests compile 2>&1 | tail -10
```
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit (green)**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/terminal/DeviceTerminalSessionManager.java src/main/java/com/automation/instagram/InstagramAutomationApplication.java
git commit -m "feat(terminal): implement DeviceTerminalSessionManager with idle reaper"
```

---

### Task 6: Define OpenSessionResponse DTO

**Files:**
- Create: `src/main/java/com/automation/instagram/terminal/dto/OpenSessionResponse.java`

- [ ] **Step 1: Write the DTO**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/dto/OpenSessionResponse.java`:

```java
package com.automation.instagram.terminal.dto;

/**
 * Réponse à {@code POST /api/devices/{udid}/terminal/sessions}.
 *
 * @param sessionId UUID identifiant la session côté serveur
 * @param deviceIp  IP utilisée pour la connexion (utile pour debug UI)
 * @param cols      colonnes initiales du PTY
 * @param rows      lignes initiales du PTY
 */
public record OpenSessionResponse(String sessionId, String deviceIp, int cols, int rows) {}
```

- [ ] **Step 2: Compile**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q -DskipTests compile 2>&1 | tail -10
```
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/terminal/dto/OpenSessionResponse.java
git commit -m "feat(terminal): add OpenSessionResponse DTO"
```

---

### Task 7: Write controller test (red)

**Files:**
- Create: `src/test/java/com/automation/instagram/terminal/DeviceTerminalControllerTest.java`

- [ ] **Step 1: Write the failing test**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/test/java/com/automation/instagram/terminal/DeviceTerminalControllerTest.java`:

```java
package com.automation.instagram.terminal;

import com.automation.instagram.terminal.exception.DeviceIpMissingException;
import com.automation.instagram.terminal.exception.DeviceNotFoundException;
import com.automation.instagram.terminal.exception.SshUnreachableException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.security.Principal;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DeviceTerminalControllerTest {

    @Mock private DeviceTerminalSessionManager sessionManager;
    @InjectMocks private DeviceTerminalController controller;

    private MockMvc mockMvc;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new DeviceTerminalExceptionHandler())
                .build();
    }

    @Test
    void post_unknownDevice_returns404() throws Exception {
        when(sessionManager.open(eq("ghost"), eq("anonymous")))
                .thenThrow(new DeviceNotFoundException("ghost"));

        mockMvc.perform(post("/api/devices/ghost/terminal/sessions")
                        .with(req -> { req.setUserPrincipal(() -> "anonymous"); return req; })
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void post_deviceWithoutIp_returns422() throws Exception {
        when(sessionManager.open(eq("u1"), eq("anonymous")))
                .thenThrow(new DeviceIpMissingException("u1"));

        mockMvc.perform(post("/api/devices/u1/terminal/sessions")
                        .with(req -> { req.setUserPrincipal(() -> "anonymous"); return req; })
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void post_sshUnreachable_returns503() throws Exception {
        when(sessionManager.open(eq("u1"), eq("anonymous")))
                .thenThrow(new SshUnreachableException("timeout", new RuntimeException()));

        mockMvc.perform(post("/api/devices/u1/terminal/sessions")
                        .with(req -> { req.setUserPrincipal(() -> "anonymous"); return req; })
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void post_happyPath_returnsSessionPayload() throws Exception {
        DeviceTerminalSession session = new DeviceTerminalSession("sid-1", "u1", "10.0.0.1", "anonymous") {};
        when(sessionManager.open(eq("u1"), eq("anonymous"))).thenReturn(session);

        mockMvc.perform(post("/api/devices/u1/terminal/sessions")
                        .with(req -> { req.setUserPrincipal(() -> "anonymous"); return req; })
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("sid-1"))
                .andExpect(jsonPath("$.deviceIp").value("10.0.0.1"));
    }

    @Test
    void delete_idempotent_returns204_evenForUnknownSession() throws Exception {
        // No throwing — manager.close is no-op for missing IDs
        mockMvc.perform(delete("/api/devices/terminal/sessions/missing"))
                .andExpect(status().isNoContent());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q test -Dtest=DeviceTerminalControllerTest 2>&1 | tail -30
```
Expected: FAIL — `DeviceTerminalController` and `DeviceTerminalExceptionHandler` don't exist.

- [ ] **Step 3: Commit (red)**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/test/java/com/automation/instagram/terminal/DeviceTerminalControllerTest.java
git commit -m "test(terminal): failing tests for REST controller"
```

---

### Task 8: Implement controller + exception handler (green)

**Files:**
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalController.java`
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalExceptionHandler.java`

- [ ] **Step 1: Write the controller**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/DeviceTerminalController.java`:

```java
package com.automation.instagram.terminal;

import com.automation.instagram.terminal.dto.OpenSessionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * REST endpoints pour ouvrir/fermer une session SSH terminal vers un device.
 *
 * <p>L'écriture (input/resize/ping) et la lecture (output) passent par STOMP — voir
 * {@link DeviceTerminalStompController}.
 */
@Slf4j
@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceTerminalController {

    private final DeviceTerminalSessionManager sessionManager;

    @PostMapping("/{udid}/terminal/sessions")
    public OpenSessionResponse open(@PathVariable String udid, Principal principal) {
        String userName = principal != null ? principal.getName() : "anonymous";
        DeviceTerminalSession session = sessionManager.open(udid, userName);
        return new OpenSessionResponse(
                session.getSessionId(),
                session.getDeviceIp(),
                80,
                24);
    }

    @DeleteMapping("/terminal/sessions/{sessionId}")
    public ResponseEntity<Void> close(@PathVariable String sessionId) {
        sessionManager.close(sessionId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Write the exception handler**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/DeviceTerminalExceptionHandler.java`:

```java
package com.automation.instagram.terminal;

import com.automation.instagram.terminal.exception.DeviceIpMissingException;
import com.automation.instagram.terminal.exception.DeviceNotFoundException;
import com.automation.instagram.terminal.exception.SshUnreachableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@Slf4j
@RestControllerAdvice(basePackageClasses = DeviceTerminalController.class)
public class DeviceTerminalExceptionHandler {

    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(DeviceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DeviceIpMissingException.class)
    public ResponseEntity<Map<String, String>> handleIpMissing(DeviceIpMissingException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(SshUnreachableException.class)
    public ResponseEntity<Map<String, String>> handleSshUnreachable(SshUnreachableException e) {
        log.warn("SSH unreachable: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", e.getMessage()));
    }
}
```

- [ ] **Step 3: Run controller tests to verify pass**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q test -Dtest=DeviceTerminalControllerTest 2>&1 | tail -30
```
Expected: PASS — all 5 tests green.

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q test 2>&1 | tail -20
```
Expected: BUILD SUCCESS, all tests pass.

- [ ] **Step 5: Commit (green)**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/terminal/DeviceTerminalController.java src/main/java/com/automation/instagram/terminal/DeviceTerminalExceptionHandler.java
git commit -m "feat(terminal): REST controller for session lifecycle"
```

---

### Task 9: Implement STOMP controller for input/resize/ping

No dedicated unit test (would require an embedded STOMP broker, low ROI). The behavior is verified manually after frontend wiring.

**Files:**
- Create: `src/main/java/com/automation/instagram/terminal/DeviceTerminalStompController.java`

- [ ] **Step 1: Write the STOMP controller**

Create `/Users/samyhne/IG-bot/InstagramAutomation/src/main/java/com/automation/instagram/terminal/DeviceTerminalStompController.java`:

```java
package com.automation.instagram.terminal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Reçoit les frames client STOMP pour les sessions terminal :
 * - input  : keystrokes utilisateur
 * - resize : dimensions PTY
 * - ping   : heartbeat anti-reaper
 *
 * <p>Si la {@code sessionId} est inconnue (typiquement reaped/closed), on broadcast un
 * message {@code closed} sur le topic output pour que le client ferme l'UI proprement.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class DeviceTerminalStompController {

    private final DeviceTerminalSessionManager sessionManager;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/devices/terminal/{sid}/input")
    public void onInput(@DestinationVariable String sid, @Payload Map<String, Object> payload) {
        sessionManager.get(sid).ifPresentOrElse(
                s -> {
                    Object data = payload.get("data");
                    if (data instanceof String str) s.write(str);
                },
                () -> notifyClosed(sid));
    }

    @MessageMapping("/devices/terminal/{sid}/resize")
    public void onResize(@DestinationVariable String sid, @Payload Map<String, Object> payload) {
        sessionManager.get(sid).ifPresentOrElse(
                s -> {
                    Integer cols = asInt(payload.get("cols"));
                    Integer rows = asInt(payload.get("rows"));
                    if (cols != null && rows != null) s.resize(cols, rows);
                },
                () -> notifyClosed(sid));
    }

    @MessageMapping("/devices/terminal/{sid}/ping")
    public void onPing(@DestinationVariable String sid) {
        sessionManager.get(sid).ifPresentOrElse(
                DeviceTerminalSession::touch,
                () -> notifyClosed(sid));
    }

    private void notifyClosed(String sid) {
        log.debug("Session inconnue {} — broadcast closed/expired", sid);
        messagingTemplate.convertAndSend(
                "/topic/devices/terminal/" + sid + "/output",
                Map.of("type", "closed", "reason", "expired"));
    }

    private static Integer asInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s) {
            try { return Integer.parseInt(s); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }
}
```

- [ ] **Step 2: Compile**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q -DskipTests compile 2>&1 | tail -10
```
Expected: BUILD SUCCESS.

- [ ] **Step 3: Boot the backend to ensure no startup errors**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q spring-boot:run 2>&1 | head -80 &
sleep 25
curl -sS -o /dev/null -w 'health: %{http_code}\n' http://localhost:8081/actuator/health || true
pkill -f spring-boot:run || true
```
Expected: `health: 200` (or 401 if auth-protected — both confirm the app booted cleanly). If startup logs show stack traces, fix before continuing.

- [ ] **Step 4: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/terminal/DeviceTerminalStompController.java
git commit -m "feat(terminal): STOMP controller for input/resize/ping"
```

---

## Frontend — Tasks 10-15

### Task 10: Add xterm dependencies and CSS

**Files:**
- Modify: `/Users/samyhne/IG-bot/InstagramDashboard/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard && npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```
Expected: packages added without warnings (peer warnings about React 19 are acceptable).

- [ ] **Step 2: Verify they appear in package.json**

```bash
grep -E '"@xterm/(xterm|addon-fit|addon-web-links)"' /Users/samyhne/IG-bot/InstagramDashboard/package.json
```
Expected: 3 lines printed.

- [ ] **Step 3: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add package.json package-lock.json
git commit -m "feat(terminal): add xterm.js deps"
```

---

### Task 11: Expose `publish` from useWebSocket

The existing hook only does `subscribe`. We need a `publish(destination, body)` to send STOMP frames client→server. We'll add it to the returned API without breaking existing callers.

**Files:**
- Modify: `/Users/samyhne/IG-bot/InstagramDashboard/src/hooks/useWebSocket.js`

- [ ] **Step 1: Add the `publish` function inside `useWebSocket`**

Open `/Users/samyhne/IG-bot/InstagramDashboard/src/hooks/useWebSocket.js`. Add this `useCallback` right after the `subscribe` definition (just before `return`):

```javascript
  const publish = useCallback((destination, body = {}) => {
    const client = clientRef.current
    if (!client?.connected) {
      // eslint-disable-next-line no-console
      console.warn('[ws] publish ignoré — client non connecté:', destination)
      return false
    }
    client.publish({
      destination,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
    return true
  }, [])
```

- [ ] **Step 2: Update the return statement to include `publish`**

Change the final `return` from:
```javascript
  return { status, subscribe, isConnected: status === CONNECTION_STATUS.CONNECTED }
```
to:
```javascript
  return { status, subscribe, publish, isConnected: status === CONNECTION_STATUS.CONNECTED }
```

- [ ] **Step 3: Run the linter**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run lint 2>&1 | tail -20
```
Expected: no new errors. Pre-existing lint warnings in unrelated files are acceptable.

- [ ] **Step 4: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/hooks/useWebSocket.js
git commit -m "feat(ws): expose publish() from useWebSocket"
```

---

### Task 12: Implement TerminalView component

**Files:**
- Create: `/Users/samyhne/IG-bot/InstagramDashboard/src/components/devices/TerminalView.jsx`

- [ ] **Step 1: Write the component**

Create `/Users/samyhne/IG-bot/InstagramDashboard/src/components/devices/TerminalView.jsx`:

```jsx
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useWebSocket } from '@/hooks/useWebSocket'

const PING_INTERVAL_MS = 30_000
const RESIZE_DEBOUNCE_MS = 100

const THEME = {
  background: '#0A0A0A',
  foreground: '#FAFAFA',
  cursor: '#FAFAFA',
  cursorAccent: '#0A0A0A',
  selectionBackground: '#3B82F640',
  black: '#0A0A0A',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#F59E0B',
  blue: '#3B82F6',
  magenta: '#A855F7',
  cyan: '#06B6D4',
  white: '#FAFAFA',
  brightBlack: '#52525B',
  brightRed: '#EF4444',
  brightGreen: '#22C55E',
  brightYellow: '#F59E0B',
  brightBlue: '#3B82F6',
  brightMagenta: '#A855F7',
  brightCyan: '#06B6D4',
  brightWhite: '#FAFAFA',
}

export default function TerminalView({ sessionId, onClosed }) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitAddonRef = useRef(null)
  const { subscribe, publish, isConnected } = useWebSocket()

  // Terminal mount/unmount
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: THEME,
      scrollback: 5000,
      allowProposedApi: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitAddonRef.current = fit

    return () => {
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [])

  // STOMP wiring (depends on sessionId + connected)
  useEffect(() => {
    if (!sessionId || !isConnected || !termRef.current) return
    const term = termRef.current

    const unsub = subscribe(`/topic/devices/terminal/${sessionId}/output`, (msg) => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'data' && typeof msg.data === 'string') {
        term.write(msg.data)
      } else if (msg.type === 'closed') {
        onClosed?.(msg.reason || 'unknown')
      }
    })

    const onDataDisp = term.onData((data) => {
      publish(`/app/devices/terminal/${sessionId}/input`, { data })
    })

    // Resize observer with debounce
    let resizeTimer = null
    const sendResize = () => {
      const fit = fitAddonRef.current
      if (!fit || !termRef.current) return
      fit.fit()
      const { cols, rows } = termRef.current
      publish(`/app/devices/terminal/${sessionId}/resize`, { cols, rows })
    }
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(sendResize, RESIZE_DEBOUNCE_MS)
    })
    ro.observe(containerRef.current)
    // initial resize once subscribed
    sendResize()

    // Heartbeat
    const pingId = setInterval(() => {
      publish(`/app/devices/terminal/${sessionId}/ping`, {})
    }, PING_INTERVAL_MS)

    term.focus()

    return () => {
      unsub()
      onDataDisp.dispose()
      ro.disconnect()
      clearTimeout(resizeTimer)
      clearInterval(pingId)
    }
  }, [sessionId, isConnected, subscribe, publish, onClosed])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#0A0A0A] border border-[#1a1a1a] rounded-md overflow-hidden"
    />
  )
}
```

- [ ] **Step 2: Lint check**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run lint 2>&1 | tail -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/components/devices/TerminalView.jsx
git commit -m "feat(terminal): TerminalView xterm.js component"
```

---

### Task 13: Implement DeviceTerminal page

**Files:**
- Create: `/Users/samyhne/IG-bot/InstagramDashboard/src/pages/DeviceTerminal.jsx`

- [ ] **Step 1: Write the page**

Create `/Users/samyhne/IG-bot/InstagramDashboard/src/pages/DeviceTerminal.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Terminal as TerminalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/shared/EmptyState'
import TerminalView from '@/components/devices/TerminalView'
import { useWebSocket } from '@/hooks/useWebSocket'

function errorMessage(err) {
  const status = err?.status
  if (status === 404) return { title: 'Device introuvable', desc: "L'UDID ne correspond à aucun device enregistré." }
  if (status === 422) return { title: 'IP non configurée', desc: "Édite le device sur la page Devices pour renseigner son IP." }
  if (status === 503) return { title: 'SSH injoignable', desc: 'Timeout ou authentification refusée par le device.' }
  return { title: 'Impossible d\'ouvrir le terminal', desc: err?.message || 'Erreur inconnue' }
}

export default function DeviceTerminal() {
  const { udid } = useParams()
  const navigate = useNavigate()
  const { isConnected } = useWebSocket()

  const [session, setSession] = useState(null) // { sessionId, deviceIp }
  const [openError, setOpenError] = useState(null)
  const [opening, setOpening] = useState(false)
  const [closedReason, setClosedReason] = useState(null)
  const sessionIdRef = useRef(null)

  const { data: device } = useQuery({
    queryKey: ['device-by-udid', udid],
    queryFn: () => apiGet(`/api/devices/udid/${udid}`),
    enabled: !!udid,
  })

  const openSession = async () => {
    if (!udid || opening) return
    setOpening(true)
    setOpenError(null)
    setClosedReason(null)
    try {
      const res = await apiPost(`/api/devices/${udid}/terminal/sessions`, {})
      setSession({ sessionId: res.sessionId, deviceIp: res.deviceIp })
      sessionIdRef.current = res.sessionId
    } catch (err) {
      setOpenError(err)
    } finally {
      setOpening(false)
    }
  }

  // Open on mount
  useEffect(() => {
    openSession()
    // Cleanup: tell the backend to close the session
    return () => {
      const sid = sessionIdRef.current
      if (sid) {
        apiDelete(`/api/devices/terminal/sessions/${sid}`).catch(() => {})
        sessionIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [udid])

  const handleClosed = (reason) => {
    setClosedReason(reason)
    setSession(null)
    sessionIdRef.current = null
    if (reason === 'expired') toast.info('Session expirée (inactivité). Reconnect pour continuer.')
    else if (reason === 'eof') toast.info('Le shell distant s\'est terminé.')
    else toast.error(`Session interrompue (${reason})`)
  }

  const reconnect = () => {
    setSession(null)
    sessionIdRef.current = null
    openSession()
  }

  const headerLabel = device?.name || device?.label || udid

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[#A1A1AA] hover:text-[#FAFAFA]"
            onClick={() => navigate('/devices')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Devices
          </Button>
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-[#A1A1AA]" />
            <span className="text-sm font-medium text-[#FAFAFA]">{headerLabel}</span>
            {session?.deviceIp && (
              <span className="text-xs font-mono text-[#52525B]">{session.deviceIp}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${isConnected ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}
          >
            WS: {isConnected ? 'connecté' : 'déconnecté'}
          </span>
          {(closedReason || openError) && (
            <Button size="sm" variant="outline" onClick={reconnect} disabled={opening}>
              <RefreshCw className="w-3 h-3 mr-1" /> Reconnect
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {opening && !session && (
          <div className="flex h-full items-center justify-center text-sm text-[#52525B]">
            Ouverture de la session SSH…
          </div>
        )}
        {openError && !session && (() => {
          const { title, desc } = errorMessage(openError)
          return (
            <EmptyState
              icon={TerminalIcon}
              title={title}
              description={desc}
              actionLabel="Réessayer"
              onAction={reconnect}
            />
          )
        })()}
        {!openError && session && (
          <TerminalView sessionId={session.sessionId} onClosed={handleClosed} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint check**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run lint 2>&1 | tail -20
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/pages/DeviceTerminal.jsx
git commit -m "feat(terminal): DeviceTerminal page composing TerminalView"
```

---

### Task 14: Wire button on Devices.jsx and route in App.jsx

**Files:**
- Modify: `/Users/samyhne/IG-bot/InstagramDashboard/src/App.jsx`
- Modify: `/Users/samyhne/IG-bot/InstagramDashboard/src/pages/Devices.jsx`

- [ ] **Step 1: Register the route in App.jsx**

In `/Users/samyhne/IG-bot/InstagramDashboard/src/App.jsx`, add the lazy import near the other lazy imports (after the `VncWall` line):

```jsx
const DeviceTerminal = lazy(() => import('@/pages/DeviceTerminal'))
```

Then add the route inside `<Routes>` next to `/devices/wall`:

```jsx
<Route path="/devices/:udid/terminal" element={<LazyPage><DeviceTerminal /></LazyPage>} />
```

- [ ] **Step 2: Propagate `deviceIp` in Devices.jsx merge**

In `/Users/samyhne/IG-bot/InstagramDashboard/src/pages/Devices.jsx`, find the `useMemo` that builds `devices` (around line 604-623). Add `deviceIp: d.deviceIp,` to the returned object:

```jsx
    return staticDevices.map(d => {
      const live = liveMap[d.udid] || {}
      return {
        ...d,
        name: d.name || live.deviceName,
        status: live.status || 'OFFLINE',
        currentAction: live.currentAction,
        currentAccount: live.currentAccount,
        currentRunId: live.currentRunId,
        lastActivityAt: live.lastActivityAt,
        manualMode: !!live.manualMode,
        port: d.ports?.appium || d.port,
        deviceIp: d.deviceIp,
      }
    })
```

(Note: `...d` already spreads `deviceIp`, but explicit is safer in case the merge order changes — keep the `...d` spread *and* add the explicit field for clarity.)

- [ ] **Step 3: Add Terminal button to DeviceCard**

In `/Users/samyhne/IG-bot/InstagramDashboard/src/pages/Devices.jsx`, import `Terminal` from lucide-react. Update the existing import:

Find:
```jsx
import {
  Smartphone,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Monitor,
  Clock,
  AlertTriangle,
  User,
  Loader2,
  Settings,
  History,
  Hand,
  LayoutGrid,
} from 'lucide-react'
```

Replace with (add `Terminal`):
```jsx
import {
  Smartphone,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Monitor,
  Clock,
  AlertTriangle,
  User,
  Loader2,
  Settings,
  History,
  Hand,
  LayoutGrid,
  Terminal,
} from 'lucide-react'
```

Then add `useNavigate` is already imported (verify — it is). In the `DeviceCard` function signature, add `onOpenTerminal` prop:

Change:
```jsx
function DeviceCard({ device, onSelect, onToggle, onTakeControl }) {
```
To:
```jsx
function DeviceCard({ device, onSelect, onToggle, onTakeControl, onOpenTerminal }) {
```

Inside the action buttons row (around line 155-178, the inner `<div>` with `onClick={(e) => e.stopPropagation()}`), add the Terminal button between "Take Control" and the `Switch`:

Find the existing block:
```jsx
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isManual ? (
            <span className="flex items-center gap-1 text-xs text-[#EF4444] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
              Manual
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
              onClick={() => onTakeControl(device)}
              disabled={device.status === 'OFFLINE'}
              title="Prendre le contrôle manuel via TrollVNC"
            >
              <Hand className="w-3 h-3 mr-1" />
              Take Control
            </Button>
          )}
          <Switch
            checked={device.enabled !== false}
            onCheckedChange={() => onToggle(device)}
            size="sm"
          />
        </div>
```

Replace with (insert the Terminal button right before `<Switch>`):
```jsx
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isManual ? (
            <span className="flex items-center gap-1 text-xs text-[#EF4444] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
              Manual
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
              onClick={() => onTakeControl(device)}
              disabled={device.status === 'OFFLINE'}
              title="Prendre le contrôle manuel via TrollVNC"
            >
              <Hand className="w-3 h-3 mr-1" />
              Take Control
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
            onClick={() => onOpenTerminal(device)}
            disabled={!device.deviceIp}
            title={device.deviceIp ? 'Ouvrir un terminal SSH' : 'IP non configurée'}
          >
            <Terminal className="w-3 h-3 mr-1" />
            Terminal
          </Button>
          <Switch
            checked={device.enabled !== false}
            onCheckedChange={() => onToggle(device)}
            size="sm"
          />
        </div>
```

- [ ] **Step 4: Pass `onOpenTerminal` from the parent**

In the same file, find the `filtered.map((device) => (...))` block (around line 736-748). Add the `onOpenTerminal` prop:

Change:
```jsx
          {filtered.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onSelect={(d) => {
                setSelectedDevice(d)
                setSheetOpen(true)
              }}
              onToggle={(d) => toggleMutation.mutate(d)}
              onTakeControl={handleTakeControlClick}
            />
          ))}
```

To:
```jsx
          {filtered.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onSelect={(d) => {
                setSelectedDevice(d)
                setSheetOpen(true)
              }}
              onToggle={(d) => toggleMutation.mutate(d)}
              onTakeControl={handleTakeControlClick}
              onOpenTerminal={(d) => navigate(`/devices/${d.udid}/terminal`)}
            />
          ))}
```

- [ ] **Step 5: Lint check**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run lint 2>&1 | tail -20
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/App.jsx src/pages/Devices.jsx
git commit -m "feat(terminal): wire Terminal button on Devices and route"
```

---

### Task 15: Manual end-to-end smoke test

This task is a manual verification — no code edits. Skip if no device is reachable; the prior unit/build steps cover regressions.

- [ ] **Step 1: Start the backend**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q spring-boot:run
```
Wait for "Started InstagramAutomationApplication" in the logs.

- [ ] **Step 2: Start the frontend (in another terminal)**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run dev
```
Wait for "Local: http://localhost:5173/".

- [ ] **Step 3: Manual checks (10 items)**

Open `http://localhost:5173/devices` after logging in. For each item, mark pass/fail:

1. **Open terminal on a device with IP configured** → page loads, prompt appears, `whoami` returns `mobile`.
2. **Resize the browser window** → run `stty size`, output reflects new dims (within 200ms of resize).
3. **Color test** → `ls --color=always /var/jb` (or any colored command) renders ANSI colors.
4. **Long output** → `cat /var/log/install.log` (or another long file) scrolls without freeze.
5. **Ctrl+C** → start `sleep 60`, press Ctrl+C, prompt returns immediately.
6. **Close tab, observe backend logs** → look for `Session SSH fermée (client)` within 1s. If the DELETE didn't fire (e.g. force-kill), the reaper closes within 120s + ≤30s.
7. **Device without IP** → click Terminal on a card with `deviceIp` empty. Button should be disabled with tooltip; if enabled, navigating directly shows "IP non configurée" empty state.
8. **Device offline / wrong IP** → temporarily edit a device's IP to a black-hole address (e.g. `10.255.255.1`), Terminal button → "SSH injoignable" empty state with Reconnect.
9. **Two tabs same device** → open `/devices/<udid>/terminal` twice. Type in tab A, only tab A receives output. Same for tab B.
10. **Idle 130s** → leave a session idle (no keystrokes, but the ping should keep it alive). Observe: it does NOT expire because the ping bumps activity. To verify expiry path, temporarily set `device.ssh.idle-timeout-ms: 5000` and disable the ping (comment the `setInterval`); after ~5s the topic should publish `closed/expired` and the toast should appear. Revert after testing.

- [ ] **Step 4: Stop both processes**

Ctrl+C in both terminals.

- [ ] **Step 5: No commit needed** — this is verification.

---

## Verification

After Task 15, both repos should have green commits in this order. Verify:

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && git log --oneline -10
cd /Users/samyhne/IG-bot/InstagramDashboard && git log --oneline -10
```

Backend: 8 commits (Tasks 1, 2, 3, 4, 5, 6, 7, 8, 9 — Task 4 and Task 7 are red-only commits, Task 5 and 8 are green).
Frontend: 5 commits (Tasks 10, 11, 12, 13, 14).

Final tests:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw -q test 2>&1 | tail -10
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run lint 2>&1 | tail -10
cd /Users/samyhne/IG-bot/InstagramDashboard && npm run build 2>&1 | tail -10
```
All three should be clean.
