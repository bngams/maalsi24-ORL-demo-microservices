# Tutoriel : Conteneurisation et Orchestration des Microservices

## 🎯 Objectifs d'Apprentissage

Dans ce tutoriel, vous allez :
- Dockeriser chaque microservice (Gateway, Service A, B, Clients, Orders)
- Orchestrer l'ensemble avec **Docker Compose**
- Intégrer les logs avec **Promtail** via des labels Docker
- Migrer la stack vers **Kubernetes** avec **Minikube**
- Comprendre les différences entre Docker Compose et Kubernetes

---

## 📚 Contexte

Actuellement, votre architecture microservices fonctionne en local :
- **Gateway** (HTTP - Port 3000)
- **Service A** (TCP - Port 3001)
- **Service B** (TCP - Port 3002)
- **Service Clients** (TCP + RabbitMQ - Port 3003)
- **Service Orders** (RabbitMQ Consumer)

Pour déployer cette architecture en environnement de production (ou de test), il est nécessaire de :
1. **Conteneuriser** chaque service avec Docker
2. **Orchestrer** les services avec Docker Compose ou Kubernetes
3. **Centraliser les logs** via Promtail/Loki

---

## 🏗️ Architecture Cible

```mermaid
graph TB
    subgraph "Docker Compose / Kubernetes"
        subgraph "Microservices"
            Gateway["Gateway<br/>:3000"]
            ServiceA["Service A<br/>:3001"]
            ServiceB["Service B<br/>:3002"]
            ServiceClients["Service Clients<br/>:3003"]
            ServiceOrders["Service Orders<br/>(Consumer)"]
        end

        subgraph "Infrastructure"
            RabbitMQ["RabbitMQ<br/>:5672, :15672"]
            Loki["Loki<br/>:3100"]
            Promtail["Promtail"]
            Grafana["Grafana<br/>:3000"]
        end

        Gateway -->|TCP| ServiceA
        Gateway -->|TCP| ServiceB
        Gateway -->|TCP| ServiceClients
        ServiceClients -->|Publish| RabbitMQ
        RabbitMQ -->|Consume| ServiceOrders

        Gateway -.->|logs| Promtail
        ServiceA -.->|logs| Promtail
        ServiceB -.->|logs| Promtail
        ServiceClients -.->|logs| Promtail
        ServiceOrders -.->|logs| Promtail
        RabbitMQ -.->|logs| Promtail

        Promtail -->|push| Loki
        Grafana -->|query| Loki
    end

    Client([Client HTTP]) --> Gateway
```

---

## 📋 Partie 1 : Conteneurisation avec Docker Compose

### Étape 1.0 : Préparer les services pour Docker (Variables d'environnement)

Avant de conteneuriser, il faut modifier le code de chaque service pour utiliser des **variables d'environnement** au lieu de valeurs hardcodées (`localhost`, ports fixes, etc.).

#### 1.0.1 : Installer le module de configuration NestJS

NestJS recommande d'utiliser `@nestjs/config` pour gérer les variables d'environnement de manière propre.

**Pour chaque service (gateway, service-a, service-b, service-clients, service-orders) :**

```bash
cd gateway  # Ou service-a, service-b, etc.
npm install @nestjs/config
```

**📝 Note :** `@nestjs/config` utilise `dotenv` en interne, pas besoin d'installer `dotenv` séparément.

---

#### 1.0.2 : Créer les fichiers `.env` (pour le développement local)

À la racine de chaque service, créez un fichier `.env` pour les valeurs par défaut en développement.

**`gateway/.env` :**
```bash
# Gateway port
PORT=3000

# Service A connection
SERVICE_A_HOST=localhost
SERVICE_A_PORT=3001

# Service B connection
SERVICE_B_HOST=____  # À compléter
SERVICE_B_PORT=____

# Service Clients connection
CLIENTS_SERVICE_HOST=____
CLIENTS_SERVICE_PORT=____
```

**`service-clients/.env` :**
```bash
# Service port
PORT=3003

# RabbitMQ connection
RABBITMQ_URL=amqp://admin:admin@localhost:5672
RABBITMQ_QUEUE=invoices
```

**`service-orders/.env` :**
```bash
# RabbitMQ connection
RABBITMQ_URL=____  # À compléter
RABBITMQ_QUEUE=____
```

**📝 À compléter pour service-a et service-b :** Quelles variables sont nécessaires ? (Indice : port d'écoute)

---

#### 1.0.3 : Modifier le code pour utiliser les variables d'environnement

##### **Gateway : `gateway/src/app.module.ts`**

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

**Après (à compléter) :**
```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';  // Ajout

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,  // Rend le ConfigModule accessible partout
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
            host: ____,  // À compléter : utiliser configService.get()
            port: ____,
          },
        }),
        inject: [____],  // À compléter
      },
      // À compléter pour CLIENTS_SERVICE
    ]),
  ],
})
export class AppModule {}
```

**📝 Points clés :**
- Utilisez `ConfigModule.forRoot({ isGlobal: true })` pour charger les variables d'environnement
- Utilisez `registerAsync` au lieu de `register` pour injecter `ConfigService`
- `configService.get<string>('NOM_VARIABLE')` récupère la valeur

---

##### **Gateway : `gateway/src/main.ts`**

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
  console.log(`Gateway is running on port ${port}`);
}
```

---

##### **Service Clients : `service-clients/src/app.module.ts`**

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

**Après (à compléter) :**
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
            urls: [configService.get<string>('____')],  // À compléter
            queue: configService.get<string>('____'),   // À compléter
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

##### **Service Orders : `service-orders/src/main.ts`**

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

**Après (à compléter) :**
```typescript
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672'],
        queue: ____,  // À compléter : utiliser process.env.____
        queueOptions: { durable: true },
        noAck: false,
      },
    },
  );
  await app.listen();
}
```

**`service-orders/src/app.module.ts` :** N'oubliez pas d'importer `ConfigModule` !

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  // ...
})
```

---

##### **Services A et B : `service-a/src/main.ts` et `service-b/src/main.ts`**

**Indice :** Ces services écoutent sur un port TCP. Quelle variable d'environnement doit être utilisée ?

**À compléter :**
```typescript
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: ____,  // À compléter : utiliser parseInt(process.env.____)
      },
    },
  );
  await app.listen();
}
```

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
archi-cloud-native-microservices/
├── gateway/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── service-a/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── service-b/
│   ├── Dockerfile
│   └── ...
├── service-clients/
│   ├── Dockerfile
│   └── ...
├── service-orders/
│   ├── Dockerfile
│   └── ...
└── docker-compose.yml
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
EXPOSE ____  # À compléter : 3000, 3001, 3002, 3003

# Démarrer l'application
CMD ["node", "dist/main"]
```

**📝 Points d'attention :**
- Pour chaque service, adaptez le port exposé (`EXPOSE`)
- Vérifiez que le script `build` existe dans `package.json`
- Le service Orders (RabbitMQ consumer) n'expose pas de port HTTP

---

### Étape 1.2 : Configurer Docker Compose

Modifiez le fichier `docker-compose.yml` existant pour ajouter les services.

**Structure à ajouter :**

```yaml
services:
  # ========== MICROSERVICES ==========

  gateway:
    build:
      context: ./gateway
      dockerfile: Dockerfile
    container_name: gateway
    labels:
      logging: "promtail"
      logging_jobname: "containerlogs"
    ports:
      - "____:____"  # À compléter
    environment:
      - SERVICE_A_HOST=____  # Nom du service dans Docker Compose
      - SERVICE_A_PORT=____
      - SERVICE_B_HOST=____
      - SERVICE_B_PORT=____
      # ... autres variables d'environnement
    depends_on:
      - ____  # Services dont dépend le gateway
    networks:
      - ____  # Réseau à utiliser

  service-a:
    build:
      context: ./____  # À compléter
    container_name: ____
    labels:
      ____: "____"  # Labels Promtail à ajouter
      ____: "____"
    expose:
      - "____"  # Port interne (pas besoin de mapper sur l'hôte)
    networks:
      - ____

  # ... Compléter pour service-b, service-clients, service-orders
```

**📝 Points clés :**
- Utilisez `depends_on` pour gérer l'ordre de démarrage
- Les labels `logging: "promtail"` et `logging_jobname: "containerlogs"` sont **obligatoires** pour tous les services
- Utilisez `expose` pour les services internes (non accessibles depuis l'extérieur)
- Utilisez `ports` uniquement pour le Gateway et les services d'infra (RabbitMQ, Grafana, etc.)

---

### Étape 1.3 : Variables d'environnement et configuration réseau

**Dans chaque service NestJS**, vérifier que la configuration utilise les variables d'environnement (pour recevoir les valeurs proposées par compose)

**Exemple pour `gateway/src/main.ts` ou `app.module.ts` :**

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
urls: [configService.get<string>('RABBITMQ_URL')],  // À compléter
```

**Dans `docker-compose.yml`, définissez ces variables :**
```yaml
environment:
  - RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
```

**💡 Astuce :** Dans Docker Compose, utilisez le **nom du service** comme hostname (ex: `rabbitmq`, `service-a`).

---

### Étape 1.4 : Configuration du réseau

**Ajoutez ou modifiez la section `networks` dans `docker-compose.yml` :**

```yaml
networks:
  obs:  # Réseau existant pour observabilité
  microservices:  # Nouveau réseau pour les microservices
```

**Affectez les services aux réseaux appropriés :**
- **Gateway, Services A/B/Clients/Orders** : réseau `microservices`
- **RabbitMQ** : réseaux `microservices` + `obs` (pour être accessible par les services et Promtail)
- **Loki, Promtail, Grafana** : réseau `obs`

---

### ✅ Point de Contrôle 1 : Démarrage avec Docker Compose

**Commandes à exécuter :**

```bash
# Build et démarrage
docker-compose up --build -d

# Vérifier les logs
docker-compose logs -f gateway
docker-compose logs -f service-orders

# Tester l'API
curl http://localhost:3000/service-a
curl -X POST http://localhost:3000/clients/123/generate-invoice
```

**Vérifications attendues :**
- ✅ Tous les conteneurs démarrent sans erreur
- ✅ Le Gateway peut communiquer avec les services TCP
- ✅ RabbitMQ reçoit et traite les messages
- ✅ Les logs apparaissent dans **Grafana** (http://localhost:3000)
- ✅ Tous les conteneurs ont les labels Promtail

**Commandes utiles :**
```bash
# Afficher les conteneurs en cours
docker-compose ps

# Inspecter les labels d'un conteneur
docker inspect gateway | grep -A 5 Labels

# Redémarrer un service spécifique
docker-compose restart service-a

# Arrêter tous les services
docker-compose down
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
├── rabbitmq/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── gateway/
│   ├── deployment.yaml
│   └── service.yaml
├── service-a/
│   ├── deployment.yaml
│   └── service.yaml
├── service-b/
│   ├── ...
├── service-clients/
│   ├── ...
├── service-orders/
│   ├── deployment.yaml  # Pas de service.yaml (consumer)
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

### Étape 2.4 : Exemple de Deployment (Gateway)

**`k8s/gateway/deployment.yaml` :**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
  namespace: microservices
  labels:
    app: gateway
spec:
  replicas: ____  # À compléter : nombre de réplicas
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
        logging: "promtail"  # Label pour Promtail
        logging_jobname: "containerlogs"
    spec:
      containers:
      - name: gateway
        image: ____/gateway:latest  # À compléter : votre registry
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: ____  # Port du conteneur
        env:
        - name: SERVICE_A_HOST
          value: "____"  # Nom du Service Kubernetes
        - name: SERVICE_A_PORT
          value: "____"
        # ... Autres variables d'environnement
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

---

### Étape 2.5 : Exemple de Service (Gateway)

**`k8s/gateway/service.yaml` :**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway
  namespace: microservices
spec:
  type: ____  # LoadBalancer ou NodePort pour exposer à l'extérieur
  selector:
    app: gateway
  ports:
  - protocol: TCP
    port: ____      # Port du service
    targetPort: ____ # Port du conteneur
```

**Types de Service à utiliser :**
- **Gateway** : `LoadBalancer` ou `NodePort` (accessible de l'extérieur)
- **Services A/B/Clients** : `ClusterIP` (interne uniquement)
- **RabbitMQ** : `ClusterIP` (+ `NodePort` pour le management UI si besoin)

---

### Étape 2.6 : Build et push des images Docker

**Configurer Minikube pour utiliser son Docker daemon :**

```bash
eval $(minikube docker-env)
```

**Build des images :**
```bash
# Gateway
docker build -t gateway:latest ./gateway

# Service A
docker build -t service-a:latest ./service-a

# ... Répéter pour chaque service
```

**💡 Note :** Avec Minikube, pas besoin de push vers un registry externe si vous utilisez `imagePullPolicy: IfNotPresent`.

---

### Étape 2.7 : Déployer sur Kubernetes

**Ordre de déploiement recommandé :**

```bash
# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. Infrastructure (RabbitMQ, Loki, Promtail)
kubectl apply -f k8s/rabbitmq/
kubectl apply -f k8s/observability/

# 3. Services métier
kubectl apply -f k8s/service-a/
kubectl apply -f k8s/service-b/
kubectl apply -f k8s/service-clients/
kubectl apply -f k8s/service-orders/

# 4. Gateway (en dernier, car dépend des autres)
kubectl apply -f k8s/gateway/
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
kubectl logs -f deployment/gateway -n microservices

# Décrire un pod (pour débugger)
kubectl describe pod <pod-name> -n microservices

# Accéder au Gateway (si NodePort)
minikube service gateway -n microservices
```

**Vérifications attendues :**
- ✅ Tous les pods sont en état `Running`
- ✅ Les services sont créés avec les bonnes ClusterIP
- ✅ Le Gateway est accessible via `minikube service`
- ✅ Les logs sont collectés par Promtail (vérifier dans Grafana)

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
- ✅ Créer un `Dockerfile` pour chaque service
- ✅ Configurer `docker-compose.yml` avec les dépendances
- ✅ Ajouter les labels Promtail sur tous les conteneurs
- ✅ Utiliser les variables d'environnement pour la configuration
- ✅ Tester l'ensemble de la stack avec `docker-compose up`

### Partie 2 : Kubernetes
- ✅ Créer les manifests (Deployment, Service) pour chaque composant
- ✅ Utiliser les labels pour Promtail (dans `template.metadata.labels`)
- ✅ Déployer sur Minikube avec `kubectl apply`
- ✅ Configurer Promtail en DaemonSet pour collecter les logs
- ✅ Comprendre les différences entre Docker Compose et Kubernetes

---

## 🚀 Pour Aller Plus Loin

### Extensions possibles :

1. **Ingress Controller**
   - Exposer le Gateway via un Ingress (au lieu de NodePort/LoadBalancer)
   - Configurer des routes basées sur le path

2. **ConfigMaps et Secrets**
   - Externaliser les configurations dans des ConfigMaps
   - Stocker les credentials RabbitMQ dans des Secrets

3. **Horizontal Pod Autoscaling (HPA)**
   - Scaler automatiquement les services en fonction du CPU/Mémoire

4. **Volumes Persistants**
   - Utiliser des PersistentVolumeClaims pour RabbitMQ et Loki

5. **Helm Charts**
   - Packager l'application avec Helm pour faciliter le déploiement

6. **Health Checks**
   - Implémenter `livenessProbe` et `readinessProbe` dans les Deployments

---

## 📚 Ressources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Minikube Getting Started](https://minikube.sigs.k8s.io/docs/start/)
- [Promtail Configuration](https://grafana.com/docs/loki/latest/clients/promtail/configuration/)
- [NestJS Docker](https://docs.nestjs.com/recipes/docker)