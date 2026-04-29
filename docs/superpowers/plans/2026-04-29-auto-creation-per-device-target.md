# Auto-Creation : limite par identité **par device** — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire en sorte que le `targetCount` configuré sur un device pour une identité s'évalue contre les comptes créés **par ce device** — et non contre l'ensemble global de l'identité — pour que deux devices ciblant la même identité travaillent indépendamment.

**Architecture:** Ajouter une méthode `countByIdentityIdAndDeviceUdidAndStatusIn` au `AccountRepository` (Spring Data dérive la requête depuis le nom). Remplacer les 4 sites d'appel actuels de `countByIdentityIdAndStatusIn` par la nouvelle variante filtrée. Dans `getGlobalStatus`, remplacer le dédoublonnage par identité par une vraie somme par couple `(device, target)`.

**Tech Stack:** Spring Boot 3.4 + Java 17 + Spring Data MongoDB + JUnit 5 + Mockito + AssertJ. Backend Maven, dossier `InstagramAutomation/`.

**Référence spec:** `InstagramDashboard/docs/superpowers/specs/2026-04-29-auto-creation-per-device-target-design.md`.

**Working dir:** `/Users/samyhne/IG-bot/InstagramAutomation` (le code à modifier est dans le backend, pas dans le dashboard).

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/main/java/com/automation/instagram/repository/AccountRepository.java` | Modify | Ajouter la signature `countByIdentityIdAndDeviceUdidAndStatusIn` |
| `src/main/java/com/automation/instagram/service/AutoCreationService.java` | Modify | Filtrer par `deviceUdid` aux 3 call sites (ll. 271, 377, 623) + refactor `getGlobalStatus` (ll. 570-606) |
| `src/main/java/com/automation/instagram/controller/AutoCreationController.java` | Modify | Filtrer par `deviceUdid` au call site `getStatus` (l. 391) |
| `src/test/java/com/automation/instagram/service/AutoCreationServiceTest.java` | Modify | Mettre à jour les 8 stubs Mockito vers la nouvelle signature à 3 args |

---

## Task 1 : Ajouter la signature repository

**Files:**
- Modify: `src/main/java/com/automation/instagram/repository/AccountRepository.java`

- [ ] **Step 1.1 : Ajouter la méthode dérivée par Spring Data**

Dans `src/main/java/com/automation/instagram/repository/AccountRepository.java`, juste après la ligne `long countByIdentityIdAndStatusIn(String identityId, Collection<InstagramAccount.AccountStatus> statuses);` (ligne 28), ajouter la nouvelle signature :

```java
    long countByIdentityIdAndDeviceUdidAndStatusIn(
            String identityId,
            String deviceUdid,
            Collection<InstagramAccount.AccountStatus> statuses);
```

Spring Data MongoDB va dériver automatiquement la requête depuis le nom (filtre `identityId = ?` AND `deviceUdid = ?` AND `status IN (?)`).

- [ ] **Step 1.2 : Vérifier que le projet compile**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q compile -DskipTests`
Expected: BUILD SUCCESS, aucune erreur de compilation. (La méthode n'est pas encore appelée — ce step valide juste que la signature est syntaxiquement valide et acceptée par Spring Data.)

- [ ] **Step 1.3 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/repository/AccountRepository.java
git commit -m "feat(repository): add countByIdentityIdAndDeviceUdidAndStatusIn"
```

---

## Task 2 : Filtrer `enqueueNextCreation` par device — sélection du `bestTarget`

**Files:**
- Modify: `src/main/java/com/automation/instagram/service/AutoCreationService.java:271-272`
- Test: `src/test/java/com/automation/instagram/service/AutoCreationServiceTest.java`

Cette task fait basculer la **logique métier** centrale (lignes 271 du service). Les tests existants vont casser car ils mockent l'ancienne signature → on adapte les mocks dans la même task pour rester sur des commits verts.

- [ ] **Step 2.1 : Mettre à jour le code du service**

Dans `src/main/java/com/automation/instagram/service/AutoCreationService.java`, remplacer les lignes 270-273 (dans la boucle `for (IdentityTarget target : targets)` de `enqueueNextCreation`) :

```java
        for (IdentityTarget target : targets) {
            long currentCount = accountRepository.countByIdentityIdAndStatusIn(
                    target.getIdentityId(), SLOT_OCCUPYING_STATUSES);
```

par :

```java
        for (IdentityTarget target : targets) {
            long currentCount = accountRepository.countByIdentityIdAndDeviceUdidAndStatusIn(
                    target.getIdentityId(), deviceUdid, SLOT_OCCUPYING_STATUSES);
```

(Le paramètre `deviceUdid` est déjà dans la signature de la méthode `enqueueNextCreation(String deviceUdid, AutoCreationConfig config)`.)

- [ ] **Step 2.2 : Mettre à jour les 8 stubs Mockito dans le test**

Dans `src/test/java/com/automation/instagram/service/AutoCreationServiceTest.java`, remplacer **toutes les occurrences** de :

```java
        when(accountRepository.countByIdentityIdAndStatusIn(IDENTITY_A,
                Set.of(InstagramAccount.AccountStatus.ACTIVE, InstagramAccount.AccountStatus.AUTO_SUSPENDED)))
                .thenReturn(...)
```

par la version à 3 args (en injectant `DEVICE_UDID`, qui est déjà la constante définie ligne 55) :

```java
        when(accountRepository.countByIdentityIdAndDeviceUdidAndStatusIn(IDENTITY_A, DEVICE_UDID,
                Set.of(InstagramAccount.AccountStatus.ACTIVE, InstagramAccount.AccountStatus.AUTO_SUSPENDED)))
                .thenReturn(...)
```

Faire de même pour les stubs sur `IDENTITY_B` (lignes 231, et toute autre que ton éditeur trouvera). Lignes attendues : 160, 186, 228, 231, 251, 271, 305, 330. Garder la valeur `.thenReturn(...)` actuelle de chaque appel inchangée.

Commande pour confirmer qu'il ne reste aucun ancien stub :

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
grep -n "countByIdentityIdAndStatusIn" src/test/java/com/automation/instagram/service/AutoCreationServiceTest.java
```

Expected: aucune sortie (zéro occurrence restante).

- [ ] **Step 2.3 : Lancer le test du service**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q test -Dtest=AutoCreationServiceTest`
Expected: BUILD SUCCESS, tous les tests verts.

Si un test échoue avec un message du genre `Wanted but not invoked`, c'est qu'un stub Mockito n'a pas été migré vers la nouvelle signature → relire le diff du test et vérifier toutes les occurrences.

- [ ] **Step 2.4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/service/AutoCreationService.java \
        src/test/java/com/automation/instagram/service/AutoCreationServiceTest.java
git commit -m "feat(auto-creation): scope target check to device in enqueue loop"
```

---

## Task 3 : Filtrer le log de progression dans `enqueueNextCreation`

**Files:**
- Modify: `src/main/java/com/automation/instagram/service/AutoCreationService.java:377-378`

C'est juste un log informatif (pas de logique métier) — mais il doit refléter le bon nombre pour que les diagnostics restent cohérents.

- [ ] **Step 3.1 : Remplacer le call site**

Dans `src/main/java/com/automation/instagram/service/AutoCreationService.java`, remplacer les lignes 377-378 :

```java
            long currentCount = accountRepository.countByIdentityIdAndStatusIn(
                    identityId, SLOT_OCCUPYING_STATUSES);
```

par :

```java
            long currentCount = accountRepository.countByIdentityIdAndDeviceUdidAndStatusIn(
                    identityId, deviceUdid, SLOT_OCCUPYING_STATUSES);
```

- [ ] **Step 3.2 : Vérifier que les tests existants restent verts**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q test -Dtest=AutoCreationServiceTest`
Expected: BUILD SUCCESS.

(Aucun test ne vérifie le contenu du log lui-même, donc aucun stub à toucher ici. Mais lancer le test confirme que la branche est encore exécutable.)

- [ ] **Step 3.3 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/service/AutoCreationService.java
git commit -m "chore(auto-creation): scope progress log to device"
```

---

## Task 4 : Filtrer `getDeviceStatus` par device

**Files:**
- Modify: `src/main/java/com/automation/instagram/service/AutoCreationService.java:623-624`

`getDeviceStatus(String deviceUdid)` décide si un device est `IDLE` (il reste du travail à faire) ou `ALL_DONE`. Sans filtre par device, un device peut afficher `ALL_DONE` alors qu'il n'a lui-même rien créé.

- [ ] **Step 4.1 : Remplacer le call site**

Dans `src/main/java/com/automation/instagram/service/AutoCreationService.java`, dans la méthode `getDeviceStatus`, remplacer les lignes 623-624 :

```java
                long count = accountRepository.countByIdentityIdAndStatusIn(
                        target.getIdentityId(), SLOT_OCCUPYING_STATUSES);
```

par :

```java
                long count = accountRepository.countByIdentityIdAndDeviceUdidAndStatusIn(
                        target.getIdentityId(), deviceUdid, SLOT_OCCUPYING_STATUSES);
```

(`deviceUdid` est le paramètre de la méthode `getDeviceStatus(String deviceUdid)`.)

- [ ] **Step 4.2 : Vérifier que les tests existants restent verts**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q test -Dtest=AutoCreationServiceTest`
Expected: BUILD SUCCESS.

- [ ] **Step 4.3 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/service/AutoCreationService.java
git commit -m "feat(auto-creation): scope getDeviceStatus to device target"
```

---

## Task 5 : Filtrer `IdentityProgress` exposé au frontend

**Files:**
- Modify: `src/main/java/com/automation/instagram/controller/AutoCreationController.java:388-402`

C'est l'unique call site **hors `AutoCreationService`**. C'est ici que la barre de progression de chaque `DeviceCard` du frontend tire ses chiffres. Sans le filtre, la progression affichée contredirait la décision de l'enqueue (corrigée Task 2).

- [ ] **Step 5.1 : Remplacer le call site dans le controller**

Dans `src/main/java/com/automation/instagram/controller/AutoCreationController.java`, dans la méthode `getStatus()`, remplacer le bloc lignes 388-402 :

```java
            List<AutoCreationStatusResponse.IdentityProgress> progressList = new ArrayList<>();
            if (config.getIdentityTargets() != null) {
                for (IdentityTarget target : config.getIdentityTargets()) {
                    long currentCount = accountRepository.countByIdentityIdAndStatusIn(
                            target.getIdentityId(), AutoCreationService.SLOT_OCCUPYING_STATUSES);
                    double percentage = target.getTargetCount() > 0
                            ? (double) currentCount / target.getTargetCount() * 100.0
                            : 0.0;
                    progressList.add(AutoCreationStatusResponse.IdentityProgress.builder()
                            .identityId(target.getIdentityId())
                            .targetCount(target.getTargetCount())
                            .currentCount((int) currentCount)
                            .percentage(Math.round(percentage * 10.0) / 10.0)
                            .build());
                }
            }
```

par :

```java
            List<AutoCreationStatusResponse.IdentityProgress> progressList = new ArrayList<>();
            if (config.getIdentityTargets() != null) {
                for (IdentityTarget target : config.getIdentityTargets()) {
                    long currentCount = accountRepository.countByIdentityIdAndDeviceUdidAndStatusIn(
                            target.getIdentityId(),
                            config.getDeviceUdid(),
                            AutoCreationService.SLOT_OCCUPYING_STATUSES);
                    double percentage = target.getTargetCount() > 0
                            ? (double) currentCount / target.getTargetCount() * 100.0
                            : 0.0;
                    progressList.add(AutoCreationStatusResponse.IdentityProgress.builder()
                            .identityId(target.getIdentityId())
                            .targetCount(target.getTargetCount())
                            .currentCount((int) currentCount)
                            .percentage(Math.round(percentage * 10.0) / 10.0)
                            .build());
                }
            }
```

(`config.getDeviceUdid()` est le device de la config en cours d'itération — c'est le même `deviceUdid` que la `DeviceStatus` qu'on est en train de construire.)

- [ ] **Step 5.2 : Vérifier que la compilation passe**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q compile -DskipTests`
Expected: BUILD SUCCESS.

- [ ] **Step 5.3 : Lancer la suite de tests complète**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q test`
Expected: BUILD SUCCESS, aucun test rouge.

- [ ] **Step 5.4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/controller/AutoCreationController.java
git commit -m "feat(auto-creation): scope IdentityProgress count to device"
```

---

## Task 6 : Refactor `getGlobalStatus` — somme par couple `(device, target)`

**Files:**
- Modify: `src/main/java/com/automation/instagram/service/AutoCreationService.java:570-606`

C'est le bandeau « Remaining / Active / Failed » en haut de la page Auto-Creation. La spec impose le comportement (a) : pas de dédoublonnage, on somme par couple.

- [ ] **Step 6.1 : Remplacer la méthode `getGlobalStatus`**

Dans `src/main/java/com/automation/instagram/service/AutoCreationService.java`, remplacer le corps actuel de `getGlobalStatus` (lignes 570-606, depuis `public Map<String, Object> getGlobalStatus()` jusqu'à la dernière `}` de la méthode) :

```java
    public Map<String, Object> getGlobalStatus() {
        List<AutoCreationConfig> allConfigs = configRepository.findAll();

        // Dédupliquer par identité pour éviter le double-comptage
        // quand plusieurs devices ciblent la même identité.
        // On garde le targetCount le plus élevé par identité (somme des targets par device).
        Map<String, Integer> targetByIdentity = new HashMap<>();
        for (AutoCreationConfig config : allConfigs) {
            if (config.getIdentityTargets() != null) {
                for (IdentityTarget target : config.getIdentityTargets()) {
                    targetByIdentity.merge(target.getIdentityId(), target.getTargetCount(), Integer::sum);
                }
            }
        }

        int totalTarget = 0;
        int totalActive = 0;
        for (Map.Entry<String, Integer> entry : targetByIdentity.entrySet()) {
            totalTarget += entry.getValue();
            long count = accountRepository.countByIdentityIdAndStatusIn(
                    entry.getKey(), SLOT_OCCUPYING_STATUSES);
            totalActive += (int) Math.min(count, entry.getValue());
        }

        long totalFailed = historyRepository.countBySuccess(false);

        Map<String, Object> status = new HashMap<>();
        status.put("globalEnabled", globalEnabled);
        status.put("totalDevicesConfigured", allConfigs.size());
        status.put("activeDevices", allConfigs.stream().filter(c -> c.getMode().isActive()).count());
        status.put("totalTargetAccounts", totalTarget);
        status.put("totalActiveAccounts", totalActive);
        status.put("totalFailed", totalFailed);
        status.put("avgCreationTimeMs", getAverageCreationTimeMs());
        status.put("nextScheduledRun", schedulerService.getNextRunTime());
        return status;
    }
```

par :

```java
    public Map<String, Object> getGlobalStatus() {
        List<AutoCreationConfig> allConfigs = configRepository.findAll();

        // Chaque (device, target) compte indépendamment : la limite par identité est
        // désormais locale au device. Pas de dédoublonnage par identité ici.
        int totalTarget = 0;
        int totalActive = 0;
        for (AutoCreationConfig config : allConfigs) {
            if (config.getIdentityTargets() == null) continue;
            for (IdentityTarget target : config.getIdentityTargets()) {
                totalTarget += target.getTargetCount();
                long count = accountRepository.countByIdentityIdAndDeviceUdidAndStatusIn(
                        target.getIdentityId(),
                        config.getDeviceUdid(),
                        SLOT_OCCUPYING_STATUSES);
                totalActive += (int) Math.min(count, target.getTargetCount());
            }
        }

        long totalFailed = historyRepository.countBySuccess(false);

        Map<String, Object> status = new HashMap<>();
        status.put("globalEnabled", globalEnabled);
        status.put("totalDevicesConfigured", allConfigs.size());
        status.put("activeDevices", allConfigs.stream().filter(c -> c.getMode().isActive()).count());
        status.put("totalTargetAccounts", totalTarget);
        status.put("totalActiveAccounts", totalActive);
        status.put("totalFailed", totalFailed);
        status.put("avgCreationTimeMs", getAverageCreationTimeMs());
        status.put("nextScheduledRun", schedulerService.getNextRunTime());
        return status;
    }
```

- [ ] **Step 6.2 : Vérifier qu'il ne reste plus aucun appel à l'ancienne signature dans le code de prod**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
grep -rn "countByIdentityIdAndStatusIn" src/main/
```
Expected: aucune sortie. Si une occurrence subsiste, c'est qu'un call site a été oublié — le remplacer par la variante à 3 args avec le `deviceUdid` du scope.

- [ ] **Step 6.3 : Lancer la suite de tests complète**

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn -q test`
Expected: BUILD SUCCESS, suite complète au vert.

- [ ] **Step 6.4 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
git add src/main/java/com/automation/instagram/service/AutoCreationService.java
git commit -m "feat(auto-creation): sum global status per (device, target)"
```

---

## Task 7 : Vérification end-to-end manuelle

**Files:** none (smoke test sur l'app qui tourne)

L'objectif : confirmer le nouveau comportement sur des données réelles avant de considérer la feature "shippable".

- [ ] **Step 7.1 : Démarrer le backend Automation**

Run dans un terminal : `cd /Users/samyhne/IG-bot/InstagramAutomation && mvn spring-boot:run`
Expected: Spring Boot démarre sur le port 8081.

- [ ] **Step 7.2 : Démarrer le dashboard frontend**

Run dans un autre terminal : `cd /Users/samyhne/IG-bot/InstagramDashboard && npm run dev`
Expected: Vite démarre sur le port 5173.

- [ ] **Step 7.3 : Configurer deux devices avec la même identité**

Dans le navigateur, ouvrir `http://localhost:5173/auto-creation`. Si deux devices sont disponibles :

1. Configurer Device A avec `targetCount = 5` pour identité X
2. Configurer Device B avec `targetCount = 5` pour la même identité X
3. Vérifier dans le bandeau « Remaining / Active / Failed » que `totalTarget = 10` (et non 5).
4. Vérifier dans chaque `DeviceCard` que la barre de progression affiche `n/5` où `n` est le nombre de comptes que **ce device** a créés (pas le total cumulé).

Si seul un device est dispo, il suffit de vérifier qu'avec `targetCount = 5`, la barre affiche bien le compteur local et qu'`totalTargetAccounts` égale exactement la somme des targets configurés.

- [ ] **Step 7.4 : Vérification d'absence de régression sur le mode `EXISTING_CONTAINER`**

Si tu utilises ce mode actuellement : vérifier qu'avec un pool de containers configuré, le device pioche toujours correctement le prochain container et qu'il s'arrête bien quand son target local est atteint (et non quand l'identité globale est full).

- [ ] **Step 7.5 : Si tout est OK, marquer la branche prête**

Pas de commit final ici (le travail est déjà committé). Juste s'assurer que `git status` est clean :

Run: `cd /Users/samyhne/IG-bot/InstagramAutomation && git status`
Expected: `nothing to commit, working tree clean`.

---

## Self-review checklist (effectué pendant l'écriture)

- **Spec § Repository** : couvert Task 1.
- **Spec § Sites d'appel à filtrer (4)** : ligne 271 → Task 2 ; ligne 377 → Task 3 ; ligne 623 → Task 4 ; ligne 391 controller → Task 5.
- **Spec § `getGlobalStatus`** : couvert Task 6 (refactor avec la formule `min(count, target)` somme par `(device, target)`).
- **Spec § Tests existants** : couvert Task 2.2 (8 stubs Mockito migrés en bloc avec validation `grep`).
- **Spec § Frontend** : aucun changement nécessaire — pas de task frontend, c'est volontaire.
- **Pas de placeholder** : tous les blocs de code sont complets, toutes les commandes ont leur valeur attendue.
- **Cohérence des types** : la signature `countByIdentityIdAndDeviceUdidAndStatusIn(String, String, Collection<...>)` est utilisée à l'identique dans toutes les tasks.
- **Frequent commits** : un commit par task (sauf Task 7 qui est juste smoke test).
- **Vérification anti-oubli** : Task 6.2 fait un `grep` qui doit retourner zéro pour confirmer qu'aucun ancien call site n'a été oublié dans `src/main/`.
