# Auto-Creation : limite de comptes par identité **par device**

## Contexte

La page **Auto-Creation** du dashboard permet de configurer, pour chaque device, des objectifs `(identityId, targetCount)` indiquant combien de comptes ACTIVE doivent exister pour chaque identité.

Aujourd'hui, le backend `AutoCreationService` calcule la progression d'une identité avec :

```java
long currentCount = accountRepository.countByIdentityIdAndStatusIn(
        target.getIdentityId(), SLOT_OCCUPYING_STATUSES);
```

Ce `count` est **global à l'identité** : il agrège les comptes créés par tous les devices. Conséquence : si Device A et Device B ciblent tous les deux `sofia → 5`, dès que 5 comptes `sofia` existent au total, les deux devices s'arrêtent — au lieu que chaque device crée ses propres 5 comptes (10 au total).

L'utilisateur veut piloter le nombre de comptes par identité **indépendamment sur chaque device**.

## Objectif

Faire en sorte que `targetCount` configuré sur un device s'évalue contre **uniquement les comptes créés par ce device** (filtre par `deviceUdid`), et non plus contre l'ensemble global de l'identité.

## Pré-requis déjà en place

- `InstagramAccount.deviceUdid` (model, ligne 50) est rempli à la création par `AccountPersistenceService` et n'est jamais réécrit ensuite : c'est donc un identifiant stable du device qui a créé le compte.
- `accountRepository.countByIdentityIdAndStatusIn` est dérivée par Spring Data depuis le nom de méthode — ajouter une variante avec `deviceUdid` ne demande qu'une signature.

Aucune migration de données n'est nécessaire.

## Modifications

### 1. Repository

Ajouter dans `AccountRepository.java` :

```java
long countByIdentityIdAndDeviceUdidAndStatusIn(
        String identityId, String deviceUdid,
        Collection<InstagramAccount.AccountStatus> statuses);
```

### 2. Sites d'appel à filtrer par `deviceUdid`

Les **quatre** appels actuels à `countByIdentityIdAndStatusIn(target.getIdentityId(), SLOT_OCCUPYING_STATUSES)` doivent passer à la nouvelle variante avec filtre `deviceUdid`. Le `deviceUdid` est déjà dans le scope de chaque site :

| Fichier | Ligne (approx) | Rôle |
|---|---|---|
| `AutoCreationService.enqueueNextCreation` | 271 | Sélection du `bestTarget` (identité avec le % le plus bas) |
| `AutoCreationService.enqueueNextCreation` | 377 | Log informatif de progression à l'enqueue |
| `AutoCreationService.getDeviceStatus` | 623 | Décide si le device est `IDLE` ou `ALL_DONE` |
| `AutoCreationController.getStatus` | 391 | Calcule `currentCount` pour chaque `IdentityProgress` exposé au frontend |

Sans le changement à la ligne 391 du controller, la barre de progression de la `DeviceCard` continuerait d'afficher le count global, ce qui contredirait le comportement de l'enqueue. C'est le seul site **hors** `AutoCreationService`.

### 3. `getGlobalStatus` — bandeau "Stats" en haut de page

Le bandeau « Remaining / Active / Failed » actuel dédoublonne par identité, ce qui est incorrect dans le nouveau modèle où chaque target est indépendant. Le calcul devient :

```
totalTarget = somme de target.targetCount sur l'ensemble des (config, target)
totalActive = somme, par (config, target), de
              min( count(identityId, deviceUdid, statuses), target.targetCount )
totalFailed = inchangé
```

Effet : si Dev A vise 5 sofia et Dev B vise 5 sofia, `totalTarget = 10`. Quand chacun a créé ses 5 comptes, `totalActive = 10`.

### 4. Tests existants (`AutoCreationServiceTest`)

Adapter les fixtures de tests qui s'appuient sur la sémantique "global par identité" pour que les comptes mock soient désormais associés à un `deviceUdid` cohérent avec la config sous test. Pas de nouveau scénario de test à inventer dans cette spec : on rend les tests existants verts en suivant la nouvelle logique.

## Frontend

**Aucun changement.** La forme de la réponse `/api/auto-creation/status` reste identique — seuls les nombres servis dans `identityProgress[].currentCount` et dans les totaux globaux reflètent désormais le filtre par device. Les composants `IdentityProgressSection`, `DeviceCard`, `StatsRow` continuent de fonctionner sans modification.

## Risques et points d'attention

- **Comptes orphelins** (créés en dehors de l'auto-création, par scripts manuels, imports, etc.) : si leur `deviceUdid` ne correspond à aucune config Auto-Creation, ils ne contribuent plus à aucun `currentCount`. C'est cohérent avec le nouveau modèle (la limite est "ce que ce device a produit"), pas un régression.
- **Comptes dont `deviceUdid` est `null`** (anciens, antérieurs à l'introduction du champ) : ils ne sont comptés sur aucun device. Si l'utilisateur observe un décalage initial, il faudra investiguer ce cas — pas couvert par cette spec.
- **Re-création après suppression** : si un compte ACTIVE est supprimé/désactivé, le count baisse pour le device qui l'a créé, et l'auto-création reprend pour combler. Comportement inchangé, juste rendu local au device.

## Hors-scope

- Pas de changement d'UI (la spec ne touche pas le frontend).
- Pas de migration de données ou de backfill du `deviceUdid` sur d'anciens comptes.
- Pas de refactor du modèle de données (pas de compteur matérialisé dans `AutoCreationConfig`).
