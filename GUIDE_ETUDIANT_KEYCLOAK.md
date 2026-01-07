# Guide Étudiant : Configuration Keycloak + Kong

## 🎯 Vue d'Ensemble

Ce guide vous accompagne dans la configuration de l'authentification JWT avec Keycloak et Kong pour votre architecture microservices. Vous apprendrez deux approches complémentaires : une validation centralisée (Option A) et une validation distribuée (Option B).

---

## ⚡ Quick Start - Démarrage Rapide

```bash
# 1. Démarrer tous les services
docker compose up -d

# 2. Attendre que Keycloak soit prêt (30-60s)
docker logs -f keycloak
# Attendre : "Keycloak ... started in ...ms"

# 3. Vérifier les services
curl http://localhost:8080/health/ready  # Keycloak
curl http://localhost:8001/status        # Kong
```

### 🔑 Credentials Pré-Configurés

**Keycloak Admin Console** : http://localhost:8080
- Username: `admin` / Password: `admin`

**Utilisateurs de Test** (déjà créés) :
| User | Password | Role | Email |
|------|----------|------|-------|
| alice | `password` | admin | alice@example.com |
| bob | `password` | user | bob@example.com |

**Clients OAuth2** (déjà créés) :
| Client ID | Secret | Redirect URIs |
|-----------|--------|---------------|
| gateway-ab | `gateway-ab-secret` | localhost:3300/*, localhost:8000/* |
| gateway-marketplace | `gateway-marketplace-secret` | localhost:3301/*, localhost:8000/* |

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :
- ✅ Docker et Docker Compose installés
- ✅ `jq` installé (pour jouer le script de config de l'Option A) : `brew install jq` (macOS) ou `sudo apt-get install jq` (Linux)
- ✅ Les services suivants démarrés : RabbitMQ, Consul, Kong, Keycloak, PostgreSQL

## 🚀 Démarrage Rapide

### 1. Démarrer tous les services

```bash
# Depuis la racine du projet
docker compose up -d

# Vérifier que tous les services sont en cours d'exécution
docker compose ps

# Attendre que Keycloak soit prêt (environ 30-60 secondes)
docker logs -f keycloak
# Attendre de voir : "Keycloak ... started in ...ms"
```

### 2. Vérifier les services

```bash
# Keycloak Admin Console
open http://localhost:8080
# Login : admin / admin

# Kong Admin API
curl http://localhost:8001/status

# Consul UI
open http://localhost:8500
```

---

## ✅ Étape 2 & 3 : Realm, Clients, Utilisateurs, Rôles

**Bonne nouvelle !** Ces étapes sont **déjà configurées** via le fichier `ops/config/keycloak/realm-export.json`.

Au démarrage de Keycloak, le realm a été automatiquement importé avec :

### Realm
- **Nom** : `microservices-realm`

### Clients
- **gateway-ab** (confidential)
  - Client ID : `gateway-ab`
  - Client Secret : `gateway-ab-secret`
  - Redirect URIs : `http://localhost:3300/*`, `http://localhost:8000/*`
  
- **gateway-marketplace** (confidential)
  - Client ID : `gateway-marketplace`
  - Client Secret : `gateway-marketplace-secret`
  - Redirect URIs : `http://localhost:3301/*`, `http://localhost:8000/*`

### Utilisateurs
- **alice**
  - Email : alice@example.com
  - Password : `password`
  - Role : `admin`

- **bob**
  - Email : bob@example.com
  - Password : `password`
  - Role : `user`

### Rôles
- **admin** : Administrator role with full access
- **user** : Standard user role

**Vérification** : Connectez-vous à http://localhost:8080 et vérifiez que le realm `microservices-realm` existe avec les clients, utilisateurs et rôles ci-dessus.

---

## 🔐 Étape 4 : Choisir Votre Option de Sécurité

Vous avez **deux options** pour implémenter la sécurité JWT. Les deux fonctionnent !

### Option A : Kong avec JWT (Production-Ready)

**Quand l'utiliser** : Pour des déploiements en production, quand vous voulez une validation centralisée.

**Avantages** :
- 🔒 Sécurité centralisée au niveau de l'API Gateway
- ⚡ Meilleures performances (une seule validation)
- 🎯 Plus simple pour les services backend

**Comment configurer** :

```bash
# 1. Vérifier que jq est installé
which jq
# Si non installé : brew install jq (macOS) ou sudo apt-get install jq (Linux)

# 2. Exécuter le script de configuration
./ops/scripts/kong-jwt-setup.sh

# 3. Le script va :
#    - Configurer les services Kong
#    - Activer le plugin JWT
#    - Créer le consumer Keycloak
#    - Extraire la clé publique depuis Keycloak
```

**Tester** :

```bash
# 1. Obtenir un token pour Alice (admin)
TOKEN=$(curl -s -X POST 'http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=gateway-ab' \
  -d 'client_secret=gateway-ab-secret' \
  -d 'grant_type=password' \
  -d 'username=alice' \
  -d 'password=password' | jq -r '.access_token')

echo "Token obtenu : ${TOKEN:0:50}..."

# 2. Tester sans token (doit échouer avec 401 de Kong)
curl -i http://localhost:8000/ab/
# Attendu : 401 Unauthorized (de Kong)

# 3. Tester avec token (doit passer la validation Kong)
curl -i http://localhost:8000/ab/ \
  -H "Authorization: Bearer $TOKEN"
# Attendu : Réponse du service (si le service est démarré)
```

---

### Option B : Validation dans NestJS (Pédagogique)

**Quand l'utiliser** : Pour apprendre comment JWT fonctionne, setup plus simple.

**Avantages** :
- 📚 Plus facile à comprendre
- 🎓 Bon pour l'apprentissage
- 🔧 Plus de contrôle par service

**Comment configurer** :

```bash
# Rien à faire dans Kong ! 
# La configuration actuelle dans compose.yml est correcte.
# Kong agit comme un simple reverse proxy (transmet tout).
```

**⚠️ IMPORTANT** : Option B signifie "pas de changements dans Kong", **PAS** que la sécurité est déjà en place !

**Configuration actuelle** :
- ✅ `ops/config/kong/kong.yml` n'a **pas de plugin JWT** (OK pour Option B)
- ✅ Kong transmet toutes les requêtes aux services NestJS (pas de vérification)
- ❌ **La validation JWT n'est pas encore implémentée** - vous devez faire l'Étape 5 !

**Actions requises pour Option B** :
1. Continuez avec l'**Étape 5** du tutoriel (TODO_KEYCLOAK.md)
2. Implémentez la validation JWT dans les gateways NestJS
3. Testez après l'implémentation

**Sans l'Étape 5** : Vos services sont **non sécurisés** - n'importe qui peut y accéder !

---

## 📊 Comparaison des Options

| Critère | Option A (Kong JWT) | Option B (NestJS JWT) |
|---------|---------------------|----------------------|
| **Setup** | Script à exécuter | Rien à faire |
| **Complexité** | Moyenne | Simple |
| **Où est validé JWT** | Kong (API Gateway) | NestJS (chaque service) |
| **Performance** | ⭐⭐⭐ | ⭐⭐ |
| **Sécurité** | Centralisée | Dispersée |
| **Production** | ✅ Recommandé | ⚠️ OK mais moins optimal |
| **Apprentissage** | Avancé | ✅ Progressif |

---

## 🎯 Recommandation

### Pour les Étudiants

1. **Commencer avec Option B** (configuration actuelle)
   - Plus simple, rien à installer
   - Vous allez apprendre JWT dans NestJS (Étape 5)
   
2. **Tester Option A après l'Étape 5**
   - Une fois que vous comprenez JWT
   - Comparer les deux approches
   - Voir les avantages de la centralisation

### Pour les Projets Réels

- Utiliser **Option A** en production
- Validation centralisée = meilleure sécurité
- Plus facile à gérer et à auditer

---

## ✅ Exemple Fonctionnel: Gateway AB (Step 5)

### 📂 Code Complet Disponible

> ✅ **IMPLÉMENTATION** : Cette étape est complète pour `gateway-ab` avec un exemple fonctionnel.  
> 📂 Code: `domains/ab/gateway-ab/src/auth/`  
> 📖 Documentation détaillée: `domains/ab/gateway-ab/README_STEP5.md`  
> 🧪 Script de test: `ops/scripts/test-jwt-gateway-ab.sh`

L'implémentation complète de la validation JWT dans NestJS est disponible pour `gateway-ab` :

```bash
domains/ab/gateway-ab/
├── src/auth/
│   ├── jwt.strategy.ts       # Stratégie JWT avec JWKS
│   ├── jwt-auth.guard.ts     # Guard d'authentification
│   ├── roles.decorator.ts    # Décorateur @Roles()
│   ├── roles.guard.ts        # Guard de vérification des rôles
│   └── auth.module.ts        # Module d'authentification
├── README_STEP5.md           # Documentation détaillée
└── package.json              # Dépendances JWT ajoutées
```

### 🚀 Installation et Test

```bash
# 1. Installer les dépendances
cd domains/ab/gateway-ab
npm install

# 2. Démarrer Keycloak et Consul
docker compose up -d keycloak postgres-kc-db consul

# 3. Démarrer le gateway
# Option 1: Depuis la racine du projet (démarre tous les services)
npm run start:dev

# Option 2: Démarrer uniquement gateway-ab (plus simple pour tester JWT)
cd domains/ab/gateway-ab
npm run start:dev

# Note: Si Consul DNS ne fonctionne pas, le gateway utilisera automatiquement
# les connexions directes vers localhost (fallback). C'est normal pour les tests JWT.

# 4. Lancer le script de test automatique (dans un autre terminal)
cd /Users/bngams/Courses/cesi/maalsi-24-ORL/microservices-demo
./ops/scripts/test-jwt-gateway-ab.sh
```

### 🎯 Endpoints Protégés

Le contrôleur démontre 3 niveaux de sécurité :

```typescript
// ✅ Public - Aucune authentification
GET http://localhost:3300/health
GET http://localhost:3300/hello

// 🔐 Protégé - JWT requis
GET http://localhost:3300/protected
Headers: Authorization: Bearer <token>

// 👑 Admin seulement - JWT + rôle 'admin'
GET http://localhost:3300/admin
Headers: Authorization: Bearer <alice_token>

// 👤 User ou Admin - JWT + rôle 'user' OU 'admin'
GET http://localhost:3300/user
Headers: Authorization: Bearer <alice_or_bob_token>
```

### 🔍 Test Manuel Rapide

```bash
# 1. Obtenir un token pour Alice
TOKEN=$(curl -s -X POST http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token \
  -d "client_id=gateway-ab" \
  -d "client_secret=gateway-ab-secret" \
  -d "grant_type=password" \
  -d "username=alice" \
  -d "password=password" | jq -r '.access_token')

# 2. Tester l'endpoint protégé
curl http://localhost:3300/protected \
  -H "Authorization: Bearer $TOKEN"

# 3. Tester l'endpoint admin
curl http://localhost:3300/admin \
  -H "Authorization: Bearer $TOKEN"
```

### 📚 Pour Approfondir

Consultez `domains/ab/gateway-ab/README_STEP5.md` pour :
- Architecture détaillée de la validation JWT
- Explication de JWKS et RSA256
- Tests complets pour tous les scénarios
- Guide de dépannage

### 🎓 Points d'Apprentissage

Cette implémentation démontre :
1. **Validation JWT décentralisée** : Chaque gateway valide indépendamment
2. **JWKS (JSON Web Key Set)** : Récupération automatique des clés publiques
3. **Guards NestJS** : Authentification (`JwtAuthGuard`) et Autorisation (`RolesGuard`)
4. **Décorateurs** : `@Roles()` pour spécifier les rôles requis
5. **Extraction du payload** : Accès aux infos utilisateur via `req.user`

---

## 🧪 Tests Complets

### Test 1 : Obtenir un Token

```bash
# Token pour Alice (admin)
TOKEN_ALICE=$(curl -s -X POST 'http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=gateway-ab' \
  -d 'client_secret=gateway-ab-secret' \
  -d 'grant_type=password' \
  -d 'username=alice' \
  -d 'password=password' | jq -r '.access_token')

# Token pour Bob (user)
TOKEN_BOB=$(curl -s -X POST 'http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=gateway-ab' \
  -d 'client_secret=gateway-ab-secret' \
  -d 'grant_type=password' \
  -d 'username=bob' \
  -d 'password=password' | jq -r '.access_token')

echo "Token Alice : ${TOKEN_ALICE:0:50}..."
echo "Token Bob : ${TOKEN_BOB:0:50}..."
```

### Test 2 : Décoder le Token (voir le contenu)

```bash
# Installer jwt-cli (optionnel)
# brew install mike-engel/jwt-cli/jwt-cli

# Ou utiliser jwt.io en ligne
echo $TOKEN_ALICE

# Ou décoder manuellement
echo $TOKEN_ALICE | cut -d. -f2 | base64 -d | jq
```

**Vous devriez voir** :
```json
{
  "sub": "...",
  "preferred_username": "alice",
  "email": "alice@example.com",
  "realm_access": {
    "roles": ["admin"]
  },
  "iss": "http://localhost:8080/realms/microservices-realm",
  "aud": "gateway-ab",
  "exp": 1234567890
}
```

### Test 3 : Tester les Endpoints

```bash
# Test sans token (doit échouer)
curl -i http://localhost:8000/ab/

# Test avec token Alice
curl -i http://localhost:8000/ab/ \
  -H "Authorization: Bearer $TOKEN_ALICE"

# Test avec token Bob
curl -i http://localhost:8000/ab/ \
  -H "Authorization: Bearer $TOKEN_BOB"
```

**Résultats attendus** :
- **Option A** : 401 de Kong si pas de token ou token invalide
- **Option B** : Kong transmet, erreur vient de NestJS (après Étape 5)

---

## 🐛 Troubleshooting

### Problème : Script kong-jwt-setup.sh échoue

**Solution** :
```bash
# Vérifier que jq est installé
which jq

# Vérifier que Kong et Keycloak sont démarrés
docker compose ps

# Vérifier les logs
docker logs kong
docker logs keycloak

# Relancer les services si nécessaire
docker compose restart kong keycloak
```

### Problème : Token invalide ou expiré

**Solution** :
```bash
# Les tokens JWT expirent après 5-15 minutes
# Regénérer un nouveau token

TOKEN=$(curl -s -X POST 'http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=gateway-ab' \
  -d 'client_secret=gateway-ab-secret' \
  -d 'grant_type=password' \
  -d 'username=alice' \
  -d 'password=password' | jq -r '.access_token')
```

### Problème : JWKS endpoint inaccessible

**Solution** :
```bash
# Vérifier que Keycloak est accessible
curl http://localhost:8080/realms/microservices-realm/protocol/openid-connect/certs

# Si erreur, vérifier les logs Keycloak
docker logs keycloak

# Redémarrer Keycloak
docker compose restart keycloak
```

### Problème : Services NestJS ne démarrent pas

**Solution** :
```bash
# Les services NestJS ne sont pas encore configurés dans docker-compose
# C'est normal ! Vous allez les créer dans les prochaines étapes

# Pour l'instant, testez uniquement :
# - La création de tokens
# - La validation Kong (Option A)
```

---

## 📚 Prochaines Étapes

Une fois l'Étape 4 terminée, passez à :

- **Étape 5** : Intégration Keycloak dans les Gateways NestJS
  - Installation des dépendances
  - Création de la stratégie JWT
  - Création des guards
  - Protection des endpoints

- **Étape 6** : Authentification Service-to-Service (optionnel)

- **Étape 7** : Tests & Vérification

---

## 💡 Conseils

1. **Gardez plusieurs terminaux ouverts** :
   - Un pour docker compose logs
   - Un pour les commandes curl
   - Un pour éditer les fichiers

2. **Sauvegardez vos tokens** dans des variables d'environnement :
   ```bash
   export TOKEN_ALICE="eyJhbGc..."
   export TOKEN_BOB="eyJhbGc..."
   ```

3. **Utilisez Postman ou Insomnia** pour tester plus facilement :
   - Créer une collection avec vos requêtes
   - Gérer les tokens automatiquement

4. **Comparez les deux options** :
   - Implémentez d'abord Option B (plus simple)
   - Puis testez Option A (plus pro)
   - Comprenez les différences

---

## 📞 Support & Ressources

### Endpoints Utiles

| Service | URL | Purpose |
|---------|-----|---------|
| Keycloak Admin | http://localhost:8080 | Console d'administration |
| Keycloak Account | http://localhost:8080/realms/microservices-realm/account | Self-service utilisateur |
| JWKS Endpoint | http://localhost:8080/realms/microservices-realm/protocol/openid-connect/certs | Clés publiques |
| Token Endpoint | http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token | Obtenir des tokens |
| Kong Admin API | http://localhost:8001 | Configuration Kong |
| Kong Proxy | http://localhost:8000 | API Gateway |
| Consul UI | http://localhost:8500 | Service discovery |

### Documentation Complète

- **Tutorial Détaillé** : `TODO_KEYCLOAK.md` - Guide complet avec explications théoriques
- **Options Kong** : `ops/config/kong/README.md` - Documentation technique Kong
- **Script Setup** : `ops/scripts/kong-jwt-setup.sh` - Script automatisé Option A

### Commandes Utiles

```bash
# Vérifier l'état des services
docker compose ps

# Voir les logs
docker logs -f keycloak
docker logs -f kong

# Redémarrer un service
docker compose restart keycloak

# Reset complet (attention: supprime les données)
docker compose down -v
docker compose up -d

# Sauvegarder un token
export TOKEN_ALICE="eyJhbGc..."

# Décoder un token JWT
echo $TOKEN | cut -d. -f2 | base64 -d | jq
```

### En Cas de Problème

Si vous rencontrez des problèmes :

1. **Vérifiez les logs** : `docker compose logs -f`
2. **Vérifiez l'état** : `docker compose ps`
3. **Redémarrez les services** : `docker compose restart kong keycloak`
4. **Consultez** : `ops/config/kong/README.md` pour le troubleshooting détaillé
5. **Demandez de l'aide** à votre formateur

### Checklist de Vérification

- [ ] Tous les services running (`docker compose ps`)
- [ ] Keycloak accessible (http://localhost:8080)
- [ ] Realm `microservices-realm` existe
- [ ] Users alice & bob existent
- [ ] Peut obtenir un token pour alice
- [ ] Option A OU Option B configurée
- [ ] Validation de token fonctionne

---

**Bon courage avec votre implémentation ! 🚀🔐**
