# Tutoriel : Conteneurisation et Orchestration des Microservices

## 🎯 Objectifs d'Apprentissage

Dans ce tutoriel, vous allez :
- Dockeriser chaque microservice organisé par domaines (AB: gateway-ab, service-a, service-b / Marketplace: gateway-marketplace, service-clients, service-orders)
- Orchestrer l'ensemble avec **Docker Compose**
- Intégrer les services d'infrastructure : **Consul** (service discovery), **Kong** (API Gateway), **Keycloak** (authentification)
- Intégrer les logs avec **Promtail** via des labels Docker
- Migrer la stack vers **Kubernetes** avec **Minikube**
- Comprendre les différences entre Docker Compose et Kubernetes

---

## 📚 Contexte

Actuellement, votre architecture microservices est organisée par domaines :

### Domaine AB
- **Gateway AB** (HTTP - Port 3000) - Authentification JWT avec Keycloak
- **Service A** (TCP - Port 3001)
- **Service B** (TCP - Port 3002)

### Domaine Marketplace
- **Gateway Marketplace** (HTTP - Port 3010)
- **Service Clients** (TCP + RabbitMQ - Port 3003)
- **Service Orders** (RabbitMQ Consumer)

### Infrastructure
- **Consul** (Port 8500) - Service discovery et health checks
- **Kong** (Ports 8000, 8001, 8002) - API Gateway avec base PostgreSQL
- **Keycloak** (Port 8080) - Authentification et autorisation avec base PostgreSQL
- **RabbitMQ** (Ports 5672, 15672) - Message broker

Pour déployer cette architecture en environnement de production (ou de test), il est nécessaire de :
1. **Conteneuriser** chaque service avec Docker
2. **Orchestrer** les services avec Docker Compose ou Kubernetes
3. **Centraliser les logs** via Promtail/Loki

---

## 🏗️ Architecture Cible

```mermaid
graph TB
    subgraph "Docker Compose / Kubernetes"
        subgraph "Infrastructure Services"
            Consul["Consul<br/>Service Discovery<br/>:8500"]
            Kong["Kong API Gateway<br/>:8000, :8001, :8002"]
            Keycloak["Keycloak<br/>Auth Server<br/>:8080"]
            KongDB["PostgreSQL<br/>Kong DB<br/>:5433"]
            KeycloakDB["PostgreSQL<br/>Keycloak DB<br/>:5432"]
        end

        subgraph "Domain AB"
            GatewayAB["Gateway AB<br/>:3000"]
            ServiceA["Service A<br/>:3001"]
            ServiceB["Service B<br/>:3002"]
        end

        subgraph "Domain Marketplace"
            GatewayMP["Gateway Marketplace<br/>:3010"]
            ServiceClients["Service Clients<br/>:3003"]
            ServiceOrders["Service Orders<br/>(Consumer)"]
        end

        subgraph "Message Broker"
            RabbitMQ["RabbitMQ<br/>:5672, :15672"]
        end

        subgraph "Observability"
            Loki["Loki<br/>:3100"]
            Promtail["Promtail"]
            Grafana["Grafana<br/>:3000"]
        end

        Kong --> GatewayAB
        Kong --> GatewayMP
        
        GatewayAB -->|JWT Auth| Keycloak
        GatewayAB -->|TCP| ServiceA
        GatewayAB -->|TCP| ServiceB
        
        GatewayMP -->|TCP| ServiceClients
        ServiceClients -->|Publish| RabbitMQ
        RabbitMQ -->|Consume| ServiceOrders

        GatewayAB -.->|register| Consul
        ServiceA -.->|register| Consul
        ServiceB -.->|register| Consul
        GatewayMP -.->|register| Consul
        ServiceClients -.->|register| Consul

        Kong -.->|service discovery| Consul
        Keycloak --> KeycloakDB
        Kong --> KongDB

        GatewayAB -.->|logs| Promtail
        GatewayMP -.->|logs| Promtail
        ServiceA -.->|logs| Promtail
        ServiceB -.->|logs| Promtail
        ServiceClients -.->|logs| Promtail
        ServiceOrders -.->|logs| Promtail
        RabbitMQ -.->|logs| Promtail
        Kong -.->|logs| Promtail
        Keycloak -.->|logs| Promtail

        Promtail -->|push| Loki
        Grafana -->|query| Loki
    end

    Client([Client HTTP]) --> Kong
```

---

## 📋 Partie 1 : Conteneurisation avec Docker Compose

### Étape 1.0 : Préparer les services pour Docker (Variables d'environnement)

Avant de conteneuriser, il faut modifier le code de chaque service pour utiliser des **variables d'environnement** au lieu de valeurs hardcodées (`localhost`, ports fixes, etc.).

#### 1.0.1 : Installer le module de configuration NestJS

NestJS recommande d'utiliser `@nestjs/config` pour gérer les variables d'environnement de manière propre.

**Pour chaque service (gateway-ab, gateway-marketplace, service-a, service-b, service-clients, service-orders) :**

```bash
cd domains/ab/gateway-ab  # Ou autre service
npm install @nestjs/config
```

**📝 Note :** `@nestjs/config` utilise `dotenv` en interne, pas besoin d'installer `dotenv` séparément.

---

#### 1.0.2 : Créer les fichiers `.env` (pour le développement local)

À la racine de chaque service, créez un fichier `.env` pour les valeurs par défaut en développement.

**`domains/ab/gateway-ab/.env` :**
```bash
# Gateway port
PORT=3000

# Consul configuration
CONSUL_HOST=localhost
CONSUL_PORT=8500

# Service A connection
SERVICE_A_HOST=localhost
SERVICE_A_PORT=3001

# Service B connection
SERVICE_B_HOST=localhost
SERVICE_B_PORT=3002

# Keycloak configuration
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=microservices-realm
KEYCLOAK_CLIENT_ID=gateway-ab-client
KEYCLOAK_CLIENT_SECRET=your-client-secret
```

**`domains/marketplace/gateway-marketplace/.env` :**
```bash
# Gateway port
PORT=3010

# Consul configuration
CONSUL_HOST=localhost
CONSUL_PORT=8500

# Service Clients connection
CLIENTS_SERVICE_HOST=localhost
CLIENTS_SERVICE_PORT=3003
```

**`domains/marketplace/service-clients/.env` :**
```bash
# Service port
PORT=3003

# Consul configuration
CONSUL_HOST=localhost
CONSUL_PORT=8500

# RabbitMQ connection
RABBITMQ_URL=amqp://admin:admin@localhost:5672
RABBITMQ_QUEUE=invoices
```

**`domains/marketplace/service-orders/.env` :**
```bash
# RabbitMQ connection
RABBITMQ_URL=amqp://admin:admin@localhost:5672
RABBITMQ_QUEUE=invoices
```

**`domains/ab/service-a/.env` et `domains/ab/service-b/.env` :**
```bash
# Service port
PORT=3001  # ou 3002 pour service-b

# Consul configuration
CONSUL_HOST=localhost
CONSUL_PORT=8500
```

---

#### 1.0.3 : Modifier le code pour utiliser les variables d'environnement

##### **Gateway AB : `domains/ab/gateway-ab/src/app.module.ts`**

**Avant :**
```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SERVICE_A',
        transport: Transport.TCP,
        options: {
          host: 'localhost',
          port: 3001,
        },
      },
      // ...
    ]),
  ],
})
export class AppModule {}
```

**Après :**
```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClientsModule.registerAsync([
      {
        name: 'SERVICE_A',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>('SERVICE_A_HOST'),
            port: configService.get<number>('SERVICE_A_PORT'),
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'SERVICE_B',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<string>('SERVICE_B_HOST'),
            port: configService.get<number>('SERVICE_B_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
})
export class AppModule {}
```

**📝 Note :** Intégrez également le module Consul pour le service discovery (voir `shared/consul`)
  ],
})
export class AppModule {}
```

**📝 Points clés :**
- Utilisez `ConfigModule.forRoot({ isGlobal: true })` pour charger les variables d'environnement
- Utilisez `registerAsync` au lieu de `register` pour injecter `ConfigService`
- `configService.get<string>('NOM_VARIABLE')` récupère la valeur

---

##### **Gateway AB : `domains/ab/gateway-ab/src/main.ts`**

Modifiez le port d'écoute pour utiliser la variable d'environnement :

**Avant :**
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
```

**Après :**
```typescript
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Gateway AB is running on port ${port}`);
}
```

**📝 Note :** Répétez la même logique pour `domains/marketplace/gateway-marketplace/src/main.ts` (avec port 3010 par défaut)

---

##### **Service Clients : `domains/marketplace/service-clients/src/app.module.ts`**

**Avant :**
```typescript
ClientsModule.register([
  {
    name: 'RABBITMQ_SERVICE',
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://admin:admin@localhost:5672'],
      queue: 'invoices',
      queueOptions: {
        durable: true,
      },
    },
  },
]),
```

**Après :**
```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: configService.get<string>('RABBITMQ_QUEUE')],
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
})
```

---

##### **Service Orders : `domains/marketplace/service-orders/src/main.ts`**

**Avant :**
```typescript
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://admin:admin@localhost:5672'],
        queue: 'invoices',
        queueOptions: { durable: true },
        noAck: false,
      },
    },
  );
  await app.listen();
}
```

**Après :**
```typescript
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672'],
        queue: process.env.RABBITMQ_QUEUE || 'invoices',
        queueOptions: { durable: true },
        noAck: false,
      },
    },
  );
  await app.listen();
  console.log('Service Orders is listening for messages');
}
```

**`domains/marketplace/service-orders/src/app.module.ts` :** N'oubliez pas d'importer `ConfigModule` !

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  // ...
})
```

---

##### **Services A et B : `domains/ab/service-a/src/main.ts` et `domains/ab/service-b/src/main.ts`**

Ces services écoutent sur un port TCP et doivent s'enregistrer auprès de Consul.

**À compléter :**
```typescript
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: parseInt(process.env.PORT) || 3001,  // 3001 pour service-a, 3002 pour service-b
      },
    },
  );
  await app.listen();
  console.log(`Service A/B is listening on port ${process.env.PORT}`);
}
```

**📝 Note :** N'oubliez pas d'importer `ConfigModule` dans `app.module.ts` et d'intégrer le module Consul pour l'enregistrement du service.

---

#### ✅ Point de Contrôle 1.0

**Testez en local avec les fichiers `.env` :**

```bash
# Terminal 1 (lancement avec turbo)
npm run dev:all


# Tester
curl http://localhost:3000/service-a
```

**Vérifications :**
- ✅ Tous les services démarrent avec les variables d'environnement depuis les fichiers `.env`
- ✅ Le Gateway peut toujours communiquer avec les autres services
- ✅ RabbitMQ fonctionne correctement

**📝 Important :** Ajoutez `.env` à votre `.gitignore` pour éviter de versionner des secrets !

---

### Étape 1.1 : Créer les Dockerfiles

Pour chaque service NestJS, vous devez créer un `Dockerfile` à la racine du service.

**Arborescence attendue :**
```
microservices-demo/
├── domains/
│   ├── ab/
│   │   ├── gateway-ab/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── src/
│   │   ├── service-a/
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── src/
│   │   └── service-b/
│   │       ├── Dockerfile
│   │       └── ...
│   └── marketplace/
│       ├── gateway-marketplace/
│       │   ├── Dockerfile
│       │   └── ...
│       ├── service-clients/
│       │   ├── Dockerfile (déjà existant)
│       │   └── ...
│       └── service-orders/
│           ├── Dockerfile (déjà existant)
│           └── ...
└── compose.yml (déjà existant avec infra)
```

**Exemple de Dockerfile (à adapter pour chaque service) :**

```dockerfile
# --- Build stage ---
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Build l'application
RUN npm run build

# --- Production stage ---
FROM node:18-alpine

WORKDIR /app

# Copier uniquement les fichiers nécessaires depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Exposer le port du service
EXPOSE 3000  # 3000 pour gateway-ab, 3010 pour gateway-marketplace, 3001/3002/3003 pour les services

# Démarrer l'application
CMD ["node", "dist/main"]
```

**📝 Points d'attention :**
- Pour chaque service, adaptez le port exposé (`EXPOSE`)
- Les Dockerfiles pour `service-clients` et `service-orders` existent déjà
- Le service Orders (RabbitMQ consumer) n'expose pas de port HTTP mais doit quand même être conteneurisé
- Si vous utilisez le monorepo avec des dépendances partagées (ex: `shared/consul`), vous devrez adapter le Dockerfile

---

### Étape 1.2 : Configurer Docker Compose

Le fichier `compose.yml` existant contient déjà l'infrastructure (RabbitMQ, Consul, Kong, Keycloak, PostgreSQL).
Vous devez maintenant ajouter les microservices.

**Structure à ajouter dans `compose.yml` :**

```yaml
services:
  # ========== Infrastructure (déjà présente) ==========
  # rabbitmq, consul, kong, keycloak, postgres-kong-db, postgres-kc-db

  # ========== DOMAIN AB ==========

  gateway-ab:
    build:
      context: ./domains/ab/gateway-ab
      dockerfile: Dockerfile
    container_name: gateway-ab
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - CONSUL_HOST=consul
      - CONSUL_PORT=8500
      - SERVICE_A_HOST=service-a
      - SERVICE_A_PORT=3001
      - SERVICE_B_HOST=service-b
      - SERVICE_B_PORT=3002
      - KEYCLOAK_URL=http://keycloak:8080
      - KEYCLOAK_REALM=microservices-realm
      - KEYCLOAK_CLIENT_ID=gateway-ab-client
      - KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}
    depends_on:
      - consul
      - keycloak
      - service-a
      - service-b
    networks:
      - microservices

  service-a:
    build:
      context: ./domains/ab/service-a
      dockerfile: Dockerfile
    container_name: service-a
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    expose:
      - "3001"
    environment:
      - PORT=3001
      - CONSUL_HOST=consul
      - CONSUL_PORT=8500
    depends_on:
      - consul
    networks:
      - microservices

  service-b:
    build:
      context: ./domains/ab/service-b
      dockerfile: Dockerfile
    container_name: service-b
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    expose:
      - "3002"
    environment:
      - PORT=3002
      - CONSUL_HOST=consul
      - CONSUL_PORT=8500
    depends_on:
      - consul
    networks:
      - microservices

  # ========== DOMAIN MARKETPLACE ==========

  gateway-marketplace:
    build:
      context: ./domains/marketplace/gateway-marketplace
      dockerfile: Dockerfile
    container_name: gateway-marketplace
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    ports:
      - "3010:3010"
    environment:
      - PORT=3010
      - CONSUL_HOST=consul
      - CONSUL_PORT=8500
      - CLIENTS_SERVICE_HOST=service-clients
      - CLIENTS_SERVICE_PORT=3003
    depends_on:
      - consul
      - service-clients
    networks:
      - microservices

  service-clients:
    build:
      context: ./domains/marketplace/service-clients
      dockerfile: Dockerfile
    container_name: service-clients
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    expose:
      - "3003"
    environment:
      - PORT=3003
      - CONSUL_HOST=consul
      - CONSUL_PORT=8500
      - RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
      - RABBITMQ_QUEUE=invoices
    depends_on:
      - consul
      - rabbitmq
    networks:
      - microservices

  service-orders:
    build:
      context: ./domains/marketplace/service-orders
      dockerfile: Dockerfile
    container_name: service-orders
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    environment:
      - RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
      - RABBITMQ_QUEUE=invoices
    depends_on:
      - rabbitmq
    networks:
      - microservices

networks:
  microservices:
    driver: bridge
  # obs: # Réseau pour observabilité (Loki, Promtail, Grafana) - à ajouter si nécessaire
```

**📝 Points clés :**
- Utilisez `depends_on` pour gérer l'ordre de démarrage
- Les labels `logging: "promtail"` et `logging_jobname: "containerlogs"` sont **obligatoires** pour tous les services
- Utilisez `expose` pour les services internes (non accessibles depuis l'extérieur)
- Utilisez `ports` uniquement pour les gateways et les services d'infra
- Dans Docker Compose, utilisez le **nom du service** comme hostname (ex: `rabbitmq`, `consul`, `service-a`)

---

### Étape 1.3 : Variables d'environnement et configuration réseau

**Dans chaque service NestJS**, vérifier que la configuration utilise les variables d'environnement (pour recevoir les valeurs proposées par compose)

**Exemple pour `domains/ab/gateway-ab/src/main.ts` ou `app.module.ts` :**

```typescript
// Avant (hardcodé) :
// host: 'localhost',
// port: 3001,

// Après (via variables d'environnement) :
host: process.env.SERVICE_A_HOST || 'localhost',
port: parseInt(process.env.SERVICE_A_PORT) || 3001,
// ou
host: configService.get<string>('SERVICE_A_HOST'),
port: configService.get<number>('SERVICE_A_PORT'),
```

**Exemple Pour RabbitMQ :**
```typescript
// Avant :
urls: ['amqp://admin:admin@localhost:5672']

// Après :
urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672']
// ou
urls: [configService.get<string>('RABBITMQ_URL')],
```

**Dans `compose.yml`, les variables sont déjà définies :**
```yaml
environment:
  - RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
  - CONSUL_HOST=consul
```

**💡 Astuce :** Dans Docker Compose, utilisez le **nom du service** comme hostname (ex: `rabbitmq`, `consul`, `service-a`).

---

### Étape 1.4 : Configuration du réseau

**Ajoutez ou modifiez la section `networks` dans `compose.yml` :**

```yaml
networks:
  microservices:
    driver: bridge
  obs:  # Réseau pour observabilité (Loki, Promtail, Grafana)
    driver: bridge
```

**Affectez les services aux réseaux appropriés :**
- **Gateways, Services (A/B/Clients/Orders)** : réseau `microservices`
- **RabbitMQ, Consul, Kong, Keycloak** : réseau `microservices` (+ `obs` pour RabbitMQ si observabilité activée)
- **Loki, Promtail, Grafana** : réseau `obs`

**📝 Note :** Les services d'infrastructure (Consul, Kong, Keycloak) sont déjà configurés dans le `compose.yml` existant.

---

### ✅ Point de Contrôle 1 : Démarrage avec Docker Compose

**Commandes à exécuter :**

```bash
# Build et démarrage
docker compose up --build -d

# Vérifier les logs
docker compose logs -f gateway-ab
docker compose logs -f service-orders

# Tester l'API via Kong (si configuré)
curl http://localhost:8000/ab/service-a

# Tester directement les gateways
curl http://localhost:3000/service-a
curl http://localhost:3010/clients

# Tester avec JWT (Gateway AB + Keycloak)
# 1. Obtenir un token depuis Keycloak
# 2. Utiliser le token pour accéder aux routes protégées

# Vérifier Consul
open http://localhost:8500

# Vérifier Kong Admin
open http://localhost:8001

# Vérifier Keycloak
open http://localhost:8080
```

**Vérifications attendues :**
- ✅ Tous les conteneurs démarrent sans erreur
- ✅ Les services s'enregistrent auprès de Consul
- ✅ Le Gateway AB peut communiquer avec les services TCP (A et B)
- ✅ Le Gateway Marketplace peut communiquer avec le Service Clients
- ✅ RabbitMQ reçoit et traite les messages
- ✅ Kong route correctement les requêtes vers les gateways
- ✅ L'authentification Keycloak fonctionne sur Gateway AB
- ✅ Les logs apparaissent dans **Grafana** (si observabilité configurée)
- ✅ Tous les conteneurs ont les labels Promtail

**Commandes utiles :**
```bash
# Afficher les conteneurs en cours
docker compose ps

# Inspecter les labels d'un conteneur
docker inspect gateway-ab | grep -A 5 Labels

# Redémarrer un service spécifique
docker compose restart service-a

# Voir les logs d'un service
docker compose logs -f gateway-ab

# Arrêter tous les services
docker compose down

# Supprimer les volumes (attention: données perdues)
docker compose down -v
```

---

## 📋 Partie 2 : Migration vers Kubernetes avec Minikube

### Étape 2.1 : Prérequis Kubernetes

**Installation de Minikube et kubectl :**

```bash
# Démarrer Minikube
minikube start --driver=docker

# Vérifier que le cluster est actif
kubectl cluster-info
```

---

### Étape 2.2 : Créer les manifests Kubernetes

**Arborescence attendue :**
```
ops/k8s/
├── namespace.yaml
├── infrastructure/
│   ├── rabbitmq/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── consul/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── kong/
│   │   ├── postgres-deployment.yaml
│   │   ├── postgres-service.yaml
│   │   ├── kong-deployment.yaml
│   │   └── kong-service.yaml
│   └── keycloak/
│       ├── postgres-deployment.yaml
│       ├── postgres-service.yaml
│       ├── keycloak-deployment.yaml
│       └── keycloak-service.yaml
├── domain-ab/
│   ├── gateway-ab/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── service-a/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── service-b/
│       ├── deployment.yaml
│       └── service.yaml
├── domain-marketplace/
│   ├── gateway-marketplace/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── service-clients/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── service-orders/
│       └── deployment.yaml  # Pas de service.yaml (consumer)
└── observability/
    ├── loki-deployment.yaml
    ├── promtail-daemonset.yaml
    └── grafana-deployment.yaml
```

---

### Étape 2.3 : Créer le Namespace

**`k8s/namespace.yaml` :**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: microservices
  labels:
    name: microservices
```

**Appliquer :**
```bash
kubectl apply -f k8s/namespace.yaml
```

---

### Étape 2.4 : Exemple de Deployment (Gateway AB)

**`ops/k8s/domain-ab/gateway-ab/deployment.yaml` :**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway-ab
  namespace: microservices
  labels:
    app: gateway-ab
    domain: ab
spec:
  replicas: 2  # Nombre de réplicas
  selector:
    matchLabels:
      app: gateway-ab
  template:
    metadata:
      labels:
        app: gateway-ab
        domain: ab
        logging: "promtail"  # Label pour Promtail
        logging_jobname: "containerlogs"
    spec:
      containers:
      - name: gateway-ab
        image: gateway-ab:latest  # Image locale (avec Minikube)
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: CONSUL_HOST
          value: "consul"
        - name: CONSUL_PORT
          value: "8500"
        - name: SERVICE_A_HOST
          value: "service-a"
        - name: SERVICE_A_PORT
          value: "3001"
        - name: SERVICE_B_HOST
          value: "service-b"
        - name: SERVICE_B_PORT
          value: "3002"
        - name: KEYCLOAK_URL
          value: "http://keycloak:8080"
        - name: KEYCLOAK_REALM
          value: "microservices-realm"
        - name: KEYCLOAK_CLIENT_ID
          value: "gateway-ab-client"
        - name: KEYCLOAK_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: keycloak-secrets
              key: client-secret
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

**📝 Note :** Créez un Secret Kubernetes pour stocker les secrets Keycloak :
```bash
kubectl create secret generic keycloak-secrets \
  --from-literal=client-secret=your-secret-here \
  -n microservices
```

---

### Étape 2.5 : Exemple de Service (Gateway AB)

**`ops/k8s/domain-ab/gateway-ab/service.yaml` :**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway-ab
  namespace: microservices
spec:
  type: NodePort  # ou LoadBalancer pour exposer à l'extérieur
  selector:
    app: gateway-ab
  ports:
  - protocol: TCP
    port: 3000      # Port du service
    targetPort: 3000 # Port du conteneur
    nodePort: 30000  # Port d'accès externe (30000-32767)
```

**Types de Service à utiliser :**
- **Gateways (gateway-ab, gateway-marketplace)** : `NodePort` ou `LoadBalancer` (accessible de l'extérieur)
- **Services A/B/Clients** : `ClusterIP` (interne uniquement)
- **RabbitMQ** : `ClusterIP` (+ `NodePort` pour le management UI si besoin)
- **Consul** : `ClusterIP` (+ `NodePort` pour l'UI web)
- **Kong** : `NodePort` ou `LoadBalancer` pour le proxy (port 8000)
- **Keycloak** : `ClusterIP` ou `NodePort` selon besoin d'accès externe

---

### Étape 2.6 : Build et push des images Docker

**Configurer Minikube pour utiliser son Docker daemon :**

```bash
eval $(minikube docker-env)
```

**Build des images (depuis la racine du projet) :**
```bash
# Domain AB
docker build -t gateway-ab:latest ./domains/ab/gateway-ab
docker build -t service-a:latest ./domains/ab/service-a
docker build -t service-b:latest ./domains/ab/service-b

# Domain Marketplace
docker build -t gateway-marketplace:latest ./domains/marketplace/gateway-marketplace
docker build -t service-clients:latest ./domains/marketplace/service-clients
docker build -t service-orders:latest ./domains/marketplace/service-orders
```

**💡 Note :** Avec Minikube, pas besoin de push vers un registry externe si vous utilisez `imagePullPolicy: IfNotPresent`.

---

### Étape 2.7 : Déployer sur Kubernetes

**Ordre de déploiement recommandé :**

```bash
# 1. Namespace
kubectl apply -f ops/k8s/namespace.yaml

# 2. Secrets (pour Keycloak, etc.)
kubectl create secret generic keycloak-secrets \
  --from-literal=client-secret=your-secret-here \
  -n microservices

# 3. Infrastructure (Consul, RabbitMQ, PostgreSQL, Kong, Keycloak)
kubectl apply -f ops/k8s/infrastructure/consul/
kubectl apply -f ops/k8s/infrastructure/rabbitmq/
kubectl apply -f ops/k8s/infrastructure/kong/
kubectl apply -f ops/k8s/infrastructure/keycloak/

# Attendre que l'infrastructure soit prête
kubectl wait --for=condition=ready pod -l app=consul -n microservices --timeout=120s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n microservices --timeout=120s

# 4. Domain AB
kubectl apply -f ops/k8s/domain-ab/service-a/
kubectl apply -f ops/k8s/domain-ab/service-b/
kubectl apply -f ops/k8s/domain-ab/gateway-ab/

# 5. Domain Marketplace
kubectl apply -f ops/k8s/domain-marketplace/service-clients/
kubectl apply -f ops/k8s/domain-marketplace/service-orders/
kubectl apply -f ops/k8s/domain-marketplace/gateway-marketplace/

# 6. Observabilité (optionnel)
kubectl apply -f ops/k8s/observability/
```

---

### ✅ Point de Contrôle 2 : Vérification Kubernetes

**Commandes de vérification :**

```bash
# Lister tous les pods
kubectl get pods -n microservices

# Vérifier les services
kubectl get svc -n microservices

# Logs d'un pod
kubectl logs -f deployment/gateway-ab -n microservices

# Décrire un pod (pour débugger)
kubectl describe pod <pod-name> -n microservices

# Accéder aux gateways (si NodePort)
minikube service gateway-ab -n microservices
minikube service gateway-marketplace -n microservices

# Accéder à Kong
minikube service kong -n microservices

# Accéder à Consul UI
minikube service consul -n microservices

# Port-forward pour accéder à Keycloak
kubectl port-forward svc/keycloak 8080:8080 -n microservices
```

**Vérifications attendues :**
- ✅ Tous les pods sont en état `Running`
- ✅ Les services sont créés avec les bonnes ClusterIP
- ✅ Les services s'enregistrent dans Consul
- ✅ Les gateways sont accessibles via `minikube service`
- ✅ Kong route correctement vers les gateways
- ✅ L'authentification Keycloak fonctionne
- ✅ RabbitMQ traite les messages correctement
- ✅ Les logs sont collectés par Promtail (vérifier dans Grafana)

**Commandes de debug utiles :**
```bash
# Voir les événements
kubectl get events -n microservices --sort-by='.lastTimestamp'

# Vérifier les variables d'environnement d'un pod
kubectl exec -it <pod-name> -n microservices -- env

# Shell interactif dans un pod
kubectl exec -it <pod-name> -n microservices -- sh

# Vérifier la santé de Consul
kubectl exec -it <consul-pod> -n microservices -- consul members
```

---

### Étape 2.8 : Configuration de Promtail pour Kubernetes

**`k8s/observability/promtail-daemonset.yaml`** (extrait) :

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: microservices
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      containers:
      - name: promtail
        image: grafana/promtail:latest
        args:
        - -config.file=/etc/promtail/config.yaml
        volumeMounts:
        - name: config
          mountPath: /etc/promtail
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: promtail-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

**ConfigMap pour Promtail :**

Créez un ConfigMap avec la configuration Promtail pour filtrer les pods ayant les labels `logging: "promtail"`.

**Extrait du `promtail-config.yaml` :**

```yaml
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      # Ne garder que les pods avec le label logging="promtail"
      - source_labels: [__meta_kubernetes_pod_label_logging]
        regex: promtail
        action: keep

      # Ajouter le job name depuis le label
      - source_labels: [__meta_kubernetes_pod_label_logging_jobname]
        target_label: job
```

---

## 📊 Comparaison Docker Compose vs Kubernetes

| Critère | Docker Compose | Kubernetes |
|---------|----------------|------------|
| **Complexité** | Simple, fichier YAML unique | Plus complexe, multiples manifests |
| **Scalabilité** | Limitée (1 machine) | Horizontale (multi-machines) |
| **Auto-healing** | Non | Oui (redémarrage automatique) |
| **Load Balancing** | Basique (DNS round-robin) | Avancé (Services, Ingress) |
| **Secrets** | Variables d'env. ou fichiers | Kubernetes Secrets |
| **Monitoring** | Externe (Prometheus, Grafana) | Intégré + externe |
| **Cas d'usage** | Dev, test, petites prod | Production scalable |

---

## 🎓 Résumé

### Partie 1 : Docker Compose
- ✅ Créer un `Dockerfile` pour chaque service (certains existent déjà dans marketplace)
- ✅ Configurer `compose.yml` avec les microservices et leurs dépendances
- ✅ Intégrer les services d'infrastructure : Consul, Kong, Keycloak, RabbitMQ
- ✅ Ajouter les labels Promtail sur tous les conteneurs
- ✅ Utiliser les variables d'environnement pour la configuration
- ✅ Tester l'ensemble de la stack avec `docker compose up`

### Partie 2 : Kubernetes
- ✅ Créer les manifests (Deployment, Service) pour chaque composant par domaine
- ✅ Déployer l'infrastructure (Consul, Kong, Keycloak, RabbitMQ)
- ✅ Utiliser les labels pour Promtail (dans `template.metadata.labels`)
- ✅ Déployer sur Minikube avec `kubectl apply`
- ✅ Configurer Promtail en DaemonSet pour collecter les logs
- ✅ Comprendre les différences entre Docker Compose et Kubernetes
- ✅ Intégrer le service discovery avec Consul
- ✅ Sécuriser avec Keycloak (JWT) sur Gateway AB

---

## 🚀 Pour Aller Plus Loin

### Extensions possibles :

1. **Ingress Controller**
   - Exposer les gateways via un Ingress (au lieu de NodePort/LoadBalancer)
   - Configurer des routes basées sur le path
   - Intégrer avec Kong comme Ingress Controller

2. **ConfigMaps et Secrets**
   - Externaliser les configurations dans des ConfigMaps
   - Stocker les credentials (RabbitMQ, Keycloak, PostgreSQL) dans des Secrets
   - Utiliser des Sealed Secrets pour sécuriser les secrets dans Git

3. **Horizontal Pod Autoscaling (HPA)**
   - Scaler automatiquement les services en fonction du CPU/Mémoire
   - Configurer des métriques personnalisées

4. **Volumes Persistants**
   - Utiliser des PersistentVolumeClaims pour RabbitMQ, PostgreSQL et Consul
   - Configurer des StorageClasses

5. **Helm Charts**
   - Packager l'application avec Helm pour faciliter le déploiement
   - Créer des charts par domaine (ab, marketplace, infrastructure)

6. **Health Checks et Probes**
   - Implémenter `livenessProbe` et `readinessProbe` dans tous les Deployments
   - Créer des endpoints `/health` dans les services NestJS

7. **Service Mesh (Istio/Linkerd)**
   - Ajouter un service mesh pour gérer le trafic, la sécurité et l'observabilité
   - Implémenter des politiques de retry, circuit breaker, etc.

8. **GitOps avec ArgoCD**
   - Automatiser les déploiements avec ArgoCD
   - Synchroniser l'état du cluster avec Git

9. **Multi-cluster et High Availability**
   - Déployer Consul en mode cluster
   - Configurer Kong en mode HA avec plusieurs instances
   - Répliquer les bases PostgreSQL

---

## 📚 Ressources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Minikube Getting Started](https://minikube.sigs.k8s.io/docs/start/)
- [Promtail Configuration](https://grafana.com/docs/loki/latest/clients/promtail/configuration/)
- [NestJS Docker](https://docs.nestjs.com/recipes/docker)