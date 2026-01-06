# Tutoriel : Service Registry avec Consul

## 🎯 Objectifs d'Apprentissage

Dans ce tutoriel, vous allez apprendre à :
- Comprendre le concept de **Service Registry** et **Service Discovery**
- Installer et configurer **Consul** comme registre de services
- Enregistrer automatiquement vos microservices dans Consul
- Implémenter la découverte de services dynamique
- Intégrer Consul avec Kong pour le routing dynamique
- Utiliser les health checks pour la résilience

## 📚 Contexte

Actuellement, votre architecture présente des limites :
- Les URLs des services sont **codées en dur** dans la configuration
- Impossible de scaler horizontalement (plusieurs instances d'un même service)
- Pas de détection automatique des services défaillants
- Configuration statique dans Kong (`kong.yml`)

**Problème** : Si un service change de port ou d'adresse, il faut modifier manuellement la configuration et redémarrer Kong.

**Solution** : Un **Service Registry** comme Consul permet aux services de s'enregistrer automatiquement et d'être découverts dynamiquement.

## 🏗️ Architecture Cible

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │ HTTP :8000
       │
┌──────▼──────────────┐
│   Kong API Gateway  │────────┐
│   (Point d'entrée)  │        │
└──────┬──────────────┘        │
       │                       │
       │ Query services        │
       │                       │
       │                  ┌────▼─────────┐
       │                  │    Consul    │
       │                  │   Registry   │ (Port 8500)
       │                  │              │
       │                  └────▲─────────┘
       │                       │
       │                       │ Register + Health Check
       │                       │
       ├────/ab/*──────────────┼────────────┐
       │                       │            │
       │                  ┌────┴──────┐ ┌──┴──────┐
       │                  │Service A  │ │Service B│
       │                  │(Port 3001)│ │(Port..?)│
       │                  └───────────┘ └─────────┘
       │
       ├────/marketplace/*─────┼────────────┐
                               │            │
                          ┌────┴──────┐ ┌──┴──────┐
                          │Service    │ │Service  │
                          │Clients    │ │Orders   │
                          └───────────┘ └─────────┘
```

**Avantages** :
- ✅ Découverte automatique des services
- ✅ Health checks intégrés (détection des pannes)
- ✅ Scalabilité horizontale (plusieurs instances)
- ✅ Configuration dynamique de Kong
- ✅ Load balancing automatique

---

## 📋 Prérequis

- Docker et Docker Compose installés
- Avoir suivi TODO-RMQ.md et TODO-KONG.md
- Services NestJS fonctionnels (service-a, service-b, service-clients, service-orders)

---

## 🛠️ Étape 1 : Installation de Consul

### 1.1 Comprendre Consul

**Consul** est un outil de HashiCorp qui fournit :
- **Service Registry** : Catalogue centralisé des services disponibles
- **Health Checking** : Surveillance de la santé des services
- **Key/Value Store** : Stockage de configuration distribuée
- **Service Mesh** (avancé) : Communication sécurisée entre services

### 1.2 Ajouter Consul au `compose.yaml`

**`compose.yaml`** - Ajouter le service Consul :

```yaml
services:
  # ... services existants (rabbitmq, kong)

  consul:
    image: hashicorp/consul:latest
    container_name: consul
    ports:
      - "8500:8500"   # HTTP API + Web UI
      - "8600:8600/udp" # DNS server
    command: agent -server -ui -bootstrap-expect=1 -client=0.0.0.0
    environment:
      CONSUL_BIND_INTERFACE: eth0
    volumes:
      - consul_data:/consul/data
    healthcheck:
      test: ["CMD", "consul", "members"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  rabbitmq_data:
  consul_data: # Nouveau volume pour Consul
```

**Explications** :
- `agent -server` : Mode serveur (pour un cluster, utiliser plusieurs serveurs)
- `-ui` : Active l'interface web de Consul
- `-bootstrap-expect=1` : Mode développement (un seul serveur)
- `-client=0.0.0.0` : Permet les connexions depuis l'extérieur du conteneur

### 1.3 Démarrer Consul

```bash
docker-compose up -d consul
```

Vérifiez que Consul est lancé :

```bash
docker logs consul
```

Accédez à l'interface web : [http://localhost:8500](http://localhost:8500)

### ✅ Point de Contrôle 1

- ✅ Consul démarre sans erreur
- ✅ L'interface web est accessible sur `:8500`
- ✅ Onglet "Services" : Vous voyez le service `consul` (lui-même)

---

## 🛠️ Étape 2 : Enregistrer un Service dans Consul

### 2.1 Installation du client Consul pour NestJS

Nous allons utiliser la bibliothèque `consul` pour Node.js :

```bash
# Dans chaque service (service-a, service-b, etc.)
npm install consul
```

### 2.2 Créer un module Consul réutilisable

**Objectif** : Créer un service NestJS qui s'enregistre automatiquement dans Consul au démarrage.

**`domains/ab/service-a/src/consul.service.ts`** (nouveau fichier) :

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as Consul from 'consul';

@Injectable()
export class ConsulService implements OnModuleInit, OnModuleDestroy {
  private consul: Consul.Consul;
  private serviceId: string;

  constructor() {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || '8500',
    });
  }

  async onModuleInit() {
    const serviceName = process.env.SERVICE_NAME || 'service-a';
    const servicePort = parseInt(process.env.SERVICE_PORT || '3001', 10);
    const serviceHost = process.env.SERVICE_HOST || 'host.docker.internal';

    this.serviceId = `${serviceName}-${servicePort}`;

    console.log(`📝 Registering service in Consul: ${this.serviceId}`);

    await this.consul.agent.service.register({
      id: this.serviceId,
      name: serviceName,
      address: serviceHost,
      port: servicePort,
      check: {
        http: `http://${serviceHost}:${servicePort}/health`,
        interval: '10s', // Vérifier la santé toutes les 10 secondes
        timeout: '5s',
      },
    });

    console.log(`✅ Service registered successfully in Consul`);
  }

  async onModuleDestroy() {
    console.log(`📤 Deregistering service from Consul: ${this.serviceId}`);
    await this.consul.agent.service.deregister(this.serviceId);
  }
}
```

**Explications** :
- `onModuleInit()` : S'enregistre dans Consul au démarrage du service
- `onModuleDestroy()` : Se désenregistre lors de l'arrêt (graceful shutdown)
- `check.http` : URL de health check (à créer)
- `interval` : Fréquence des health checks

### 2.3 Ajouter un endpoint de health check

**`domains/ab/service-a/src/app.controller.ts`** :

```typescript
import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Endpoint de health check pour Consul
  @Get('health')
  health() {
    return { status: 'ok', service: 'service-a' };
  }

  // ... vos autres endpoints TCP
  @MessagePattern({ cmd: 'get_service_a' })
  getServiceA() {
    return this.appService.getServiceA();
  }
}
```

### 2.4 Intégrer ConsulService dans le module

**`domains/ab/service-a/src/app.module.ts`** :

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsulService } from './consul.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ConsulService], // Ajouter ConsulService
})
export class AppModule {}
```

### 2.5 Configurer le service pour écouter HTTP + TCP

**`domains/ab/service-a/src/main.ts`** :

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Créer une application hybride (HTTP + TCP)
  const app = await NestFactory.create(AppModule);

  // Ajouter le microservice TCP
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: parseInt(process.env.SERVICE_PORT || '3001', 10),
    },
  });

  await app.startAllMicroservices();

  // Démarrer le serveur HTTP pour le health check
  const httpPort = parseInt(process.env.SERVICE_PORT || '3001', 10);
  await app.listen(httpPort);

  console.log(`Service A is listening on port ${httpPort} (HTTP + TCP)`);
}
bootstrap();
```

### 2.6 Démarrer le service

```bash
cd domains/ab/service-a
SERVICE_NAME=service-a SERVICE_PORT=3001 npm run start:dev
```

### ✅ Point de Contrôle 2

Vérifications :

1. **Logs du service** : `✅ Service registered successfully in Consul`
2. **Interface Consul** : [http://localhost:8500/ui/dc1/services](http://localhost:8500/ui/dc1/services)
   - Vous voyez `service-a` dans la liste
   - Status : ✅ (vert) = Health check passed
3. **Test du health check** :
   ```bash
   curl http://localhost:3001/health
   # Réponse : {"status":"ok","service":"service-a"}
   ```

---

## 🛠️ Étape 3 : Enregistrer Tous les Services

Plutôt que répliquer le code pour chaque service, on peut créer une librairie commune [voir ce scénario alternatif](./TODO-CONSUL-LIB.md) 

### 3.1 À FAIRE : Répliquer pour service-b

**Objectif** : Enregistrer `service-b` dans Consul (port 3002).

**Tâches** :
1. Copier `consul.service.ts` dans `domains/ab/service-b/src/`
2. Ajouter l'endpoint `/health` dans le contrôleur
3. Modifier `main.ts` pour créer une application hybride (HTTP + TCP)
4. Ajouter `ConsulService` dans `app.module.ts`
5. Démarrer le service :
   ```bash
   cd domains/ab/service-b
   SERVICE_NAME=service-b SERVICE_PORT=3002 npm run start:dev
   ```

### 3.2 À FAIRE : Répliquer pour service-clients

**Objectif** : Enregistrer `service-clients` dans Consul (port 3003).

Suivez les mêmes étapes que pour `service-b`.

### 3.3 À FAIRE : Répliquer pour service-orders

**Objectif** : Enregistrer `service-orders` dans Consul (port 3004).

**Note** : `service-orders` écoute RabbitMQ, mais peut quand même exposer un endpoint HTTP pour le health check.

**`domains/marketplace/service-orders/src/main.ts`** :

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Application hybride : RabbitMQ + HTTP
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://admin:admin@localhost:5672'],
      queue: 'invoices',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  await app.startAllMicroservices();

  // Serveur HTTP pour le health check
  const httpPort = parseInt(process.env.SERVICE_PORT || '3004', 10);
  await app.listen(httpPort);

  console.log(`Service Orders is listening on port ${httpPort} (HTTP) and RabbitMQ`);
}
bootstrap();
```

### ✅ Point de Contrôle 3

Vérifiez dans l'interface Consul : [http://localhost:8500/ui/dc1/services](http://localhost:8500/ui/dc1/services)

**Vous devriez voir** :
- ✅ `service-a` (status: passing)
- ✅ `service-b` (status: passing)
- ✅ `service-clients` (status: passing)
- ✅ `service-orders` (status: passing)

---

## 🛠️ Étape 4 : Découverte de Services Dynamique

### 4.1 Créer un module de découverte dans le Gateway

**Objectif** : Le Gateway interroge Consul pour découvrir les services au lieu d'utiliser des URLs codées en dur.

**`domains/ab/gateway-ab/src/consul-discovery.service.ts`** :

```typescript
import { Injectable } from '@nestjs/common';
import * as Consul from 'consul';

@Injectable()
export class ConsulDiscoveryService {
  private consul: Consul.Consul;

  constructor() {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || '8500',
    });
  }

  /**
   * Récupère l'URL d'un service à partir de Consul
   * @param serviceName Nom du service (ex: 'service-a')
   * @returns URL complète (ex: 'http://localhost:3001')
   */
  async getServiceUrl(serviceName: string): Promise<string> {
    try {
      const services = await this.consul.health.service({
        service: serviceName,
        passing: true, // Seulement les services en bonne santé
      });

      if (services.length === 0) {
        throw new Error(`Service ${serviceName} not found in Consul`);
      }

      // Load balancing simple : round-robin (première instance)
      const service = services[0].Service;
      const url = `http://${service.Address}:${service.Port}`;

      console.log(`🔍 Discovered service ${serviceName} at ${url}`);
      return url;
    } catch (error) {
      console.error(`❌ Error discovering service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Récupère tous les services d'un type donné
   * Utile pour le load balancing
   */
  async getServiceInstances(serviceName: string): Promise<Array<{ host: string; port: number }>> {
    const services = await this.consul.health.service({
      service: serviceName,
      passing: true,
    });

    return services.map(s => ({
      host: s.Service.Address,
      port: s.Service.Port,
    }));
  }
}
```

### 4.2 Utiliser la découverte dans le Gateway

**`domains/ab/gateway-ab/src/app.service.ts`** :

```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConsulDiscoveryService } from './consul-discovery.service';

@Injectable()
export class AppService implements OnModuleInit {
  private serviceAClient: ClientProxy;
  private serviceBClient: ClientProxy;

  constructor(private consulDiscovery: ConsulDiscoveryService) {}

  async onModuleInit() {
    // Découvrir service-a dynamiquement
    const serviceAUrl = await this.consulDiscovery.getServiceUrl('service-a');
    const [host, port] = this.parseUrl(serviceAUrl);

    this.serviceAClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host, port },
    });

    // Découvrir service-b dynamiquement
    const serviceBUrl = await this.consulDiscovery.getServiceUrl('service-b');
    const [hostB, portB] = this.parseUrl(serviceBUrl);

    this.serviceBClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: hostB, port: portB },
    });

    console.log('✅ Dynamic service discovery completed');
  }

  private parseUrl(url: string): [string, number] {
    const urlObj = new URL(url);
    return [urlObj.hostname, parseInt(urlObj.port, 10)];
  }

  getServiceA() {
    return this.serviceAClient.send({ cmd: 'get_service_a' }, {});
  }

  getServiceB() {
    return this.serviceBClient.send({ cmd: 'get_service_b' }, {});
  }
}
```

**`domains/ab/gateway-ab/src/app.module.ts`** :

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsulDiscoveryService } from './consul-discovery.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ConsulDiscoveryService],
})
export class AppModule {}
```

### ✅ Point de Contrôle 4

Démarrez le gateway :

```bash
cd domains/ab/gateway-ab
npm run start:dev
```

**Vérifications** :
1. Logs du gateway : `🔍 Discovered service service-a at http://...`
2. Testez une requête :
   ```bash
   curl http://localhost:3000/a
   ```
3. Le gateway utilise les URLs découvertes depuis Consul

---

## 🛠️ Étape 5 : Intégrer Consul avec Kong (Avancé)

### 5.1 Comprendre l'intégration Kong + Consul

Kong peut interroger Consul pour découvrir dynamiquement les services backend au lieu d'utiliser des URLs statiques.

**Problème actuel** : `kong.yml` contient des URLs codées en dur.

**Solution** : Utiliser le plugin `kong-plugin-consul` ou l'API Kong pour mettre à jour les upstreams dynamiquement.

### 5.2 Option 1 : Upstreams dynamiques avec Kong Admin API

**Objectif** : Créer un script qui interroge Consul et met à jour Kong via son API d'administration.

**`update-kong-services.sh`** (nouveau fichier à la racine) :

```bash
#!/bin/bash

# Récupérer les services depuis Consul
SERVICE_A=$(curl -s http://localhost:8500/v1/health/service/service-a?passing | jq -r '.[0].Service | "http://\(.Address):\(.Port)"')
SERVICE_B=$(curl -s http://localhost:8500/v1/health/service/service-b?passing | jq -r '.[0].Service | "http://\(.Address):\(.Port)"')

echo "Updating Kong with Consul service discovery..."
echo "Service A: $SERVICE_A"
echo "Service B: $SERVICE_B"

# Mettre à jour Kong via l'API Admin (nécessite mode DB pour la persistence)
# Cette approche nécessite Kong en mode DB (non DB-less)
```

**Note** : Cette approche nécessite Kong en mode base de données (Postgres). En mode DB-less, la configuration doit être déclarative.

### 5.3 Option 2 : Utiliser Kong en mode DB avec Consul KV

**Principe** : Stocker la configuration Kong dans Consul KV et utiliser un système de synchronisation.

**Cette approche est avancée et dépasse le cadre de ce tutoriel.**

### 5.4 Recommandation pour ce projet

Pour simplifier, **gardez Kong avec la configuration statique** (`kong.yml`) pour le routage vers les **gateways de domaine**.

Ensuite, **utilisez Consul uniquement pour la découverte de services** entre les gateways et les microservices (comme implémenté à l'Étape 4).

**Architecture finale** :
```
Kong (statique) → Gateway AB (dynamique via Consul) → Services A/B
                → Gateway Marketplace (dynamique via Consul) → Services Clients/Orders
```

---

## 🚀 Pour Aller Plus Loin (Extensions Optionnelles)

### 1. **Load Balancing avec Plusieurs Instances**

Lancez plusieurs instances d'un même service :

```bash
# Instance 1
SERVICE_NAME=service-a SERVICE_PORT=3001 npm run start:dev

# Instance 2 (dans un autre terminal)
SERVICE_NAME=service-a SERVICE_PORT=3011 npm run start:dev
```

Modifiez `ConsulDiscoveryService` pour implémenter un round-robin :

```typescript
private currentIndex = 0;

async getServiceUrl(serviceName: string): Promise<string> {
  const instances = await this.getServiceInstances(serviceName);
  if (instances.length === 0) {
    throw new Error(`No healthy instances for ${serviceName}`);
  }

  // Round-robin
  const instance = instances[this.currentIndex % instances.length];
  this.currentIndex++;

  return `http://${instance.host}:${instance.port}`;
}
```

### 2. **Consul Key/Value Store pour la Configuration**

Stockez la configuration partagée dans Consul KV :

```typescript
// Écrire une configuration
await this.consul.kv.set('config/database/url', 'postgres://...');

// Lire une configuration
const value = await this.consul.kv.get('config/database/url');
```

### 3. **Service Mesh avec Consul Connect**

Activer Consul Connect pour sécuriser la communication entre services (mTLS automatique).

### 4. **Monitoring avec Prometheus**

Exposer les métriques Consul dans Prometheus pour le monitoring.

### 5. **Failover Automatique**

Implémenter une logique de retry si un service devient indisponible :

```typescript
async getServiceUrl(serviceName: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const instances = await this.getServiceInstances(serviceName);
      if (instances.length > 0) {
        return `http://${instances[0].host}:${instances[0].port}`;
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error(`Service ${serviceName} unavailable after ${retries} retries`);
}
```

---

## 🔍 Tester la Résilience

### Expérience 1 : Arrêter un Service

1. Arrêtez `service-a` (Ctrl+C)
2. Allez sur Consul UI : Le service passe en **critical** (rouge)
3. Le Gateway ne découvre plus ce service
4. Redémarrez `service-a` → Redevient **passing** (vert)

### Expérience 2 : Scaler Horizontalement

1. Lancez 3 instances de `service-a` (ports 3001, 3011, 3021)
2. Dans Consul UI : Voyez les 3 instances enregistrées
3. Implémentez le load balancing dans le Gateway
4. Envoyez plusieurs requêtes → Observez la répartition de charge

---

## 📊 Comparaison : Avant / Après Consul

| Critère | Sans Consul | Avec Consul |
|---------|-------------|-------------|
| **URLs des services** | Codées en dur | Découverte dynamique |
| **Health checks** | Manuel | Automatique (10s) |
| **Scalabilité** | Une instance par service | Plusieurs instances |
| **Failover** | Manuel | Automatique |
| **Configuration** | Statique (redémarrage requis) | Dynamique (temps réel) |
| **Visibilité** | Limitée | Dashboard Consul |

---

## 🎓 Résumé

Vous avez appris à :
- ✅ Installer et configurer **Consul** comme Service Registry
- ✅ Enregistrer automatiquement des services NestJS dans Consul
- ✅ Créer des **health checks** HTTP pour la surveillance
- ✅ Implémenter la **découverte de services dynamique** dans un Gateway
- ✅ Comprendre les avantages de la **résilience** et de la **scalabilité**
- ✅ Intégrer Consul dans une architecture microservices existante

**Prochaine étape** : Explorez le load balancing, le service mesh, et la configuration distribuée avec Consul KV !

---

## 🧪 Exercice Final : Vérification Complète

### Scénario
Démarrez tous les services et testez le flux complet avec découverte dynamique.

**Flux attendu** :
```
Client
  → http://localhost:8000/ab/a (Kong)
  → gateway-ab (port 3000)
  → Consul: Où est service-a ?
  → Consul: http://localhost:3001
  → gateway-ab → service-a (TCP)
  → Réponse au client
```

### Commandes de test

```bash
# Démarrer tous les services
docker-compose up -d

# Service A
cd domains/ab/service-a
SERVICE_NAME=service-a SERVICE_PORT=3001 npm run start:dev

# Service B
cd domains/ab/service-b
SERVICE_NAME=service-b SERVICE_PORT=3002 npm run start:dev

# Gateway AB
cd domains/ab/gateway-ab
npm run start:dev

# Tester via Kong
curl http://localhost:8000/ab/a
```

### Vérifications

1. ✅ Tous les services sont enregistrés dans Consul (interface `:8500`)
2. ✅ Tous les health checks passent (statut **passing**)
3. ✅ Le Gateway découvre dynamiquement les services
4. ✅ Kong route correctement vers le Gateway AB
5. ✅ La requête aboutit avec succès

---

## 📚 Ressources

- [Documentation Consul](https://www.consul.io/docs)
- [Consul Service Discovery](https://www.consul.io/docs/discovery/services)
- [Health Checks in Consul](https://www.consul.io/docs/discovery/checks)
- [Consul KV Store](https://www.consul.io/docs/dynamic-app-config/kv)
- [Microservices Service Discovery Pattern](https://microservices.io/patterns/service-registry.html)
- [Consul + Kong Integration](https://docs.konghq.com/hub/kong-inc/consul/)

---

**Bon courage pour l'implémentation ! 🚀**
