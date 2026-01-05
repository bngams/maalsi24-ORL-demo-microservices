# Tutoriel : Communication Asynchrone avec RabbitMQ

## 🎯 Objectifs d'Apprentissage

Dans ce tutoriel, vous allez apprendre à :
- Comprendre la différence entre communication synchrone (TCP) et asynchrone (Message Queue)
- Créer un **producteur** de messages avec RabbitMQ
- Créer un **consommateur** de messages avec RabbitMQ
- Observer le comportement des queues via l'interface d'administration RabbitMQ
- Implémenter un cas d'usage réaliste : génération asynchrone de factures

## 📚 Contexte

Actuellement, votre architecture utilise TCP pour la communication synchrone entre le Gateway et les microservices. Cette approche fonctionne bien, mais présente des limites :
- Le client doit attendre que le traitement soit terminé
- Si un service est indisponible, la requête échoue immédiatement
- Difficile de gérer des tâches longues ou de répartir la charge

**RabbitMQ** résout ces problèmes en introduisant une **communication asynchrone** via des files d'attente (queues).

## 🏗️ Architecture Cible

```
┌─────────────┐
│   Gateway   │  (HTTP - Port 3000)
└──────┬──────┘
       │
       ├────TCP────┬──────TCP────┐
       │           │             │
   ┌───▼────┐  ┌──▼───┐    ┌────▼────┐
   │Service │  │Service│    │Service  │
   │   A    │  │   B   │    │ Clients │
   │ (TCP)  │  │ (TCP) │    │  (TCP)  │
   └────────┘  └───────┘    └────┬────┘
                                  │
                            Publie message
                                  │
                            ┌─────▼──────┐
                            │  RabbitMQ  │
                            │   Queue:   │
                            │  invoices  │
                            └─────┬──────┘
                                  │
                            Consomme message
                                  │
                            ┌─────▼──────┐
                            │  Service   │
                            │  Orders    │
                            │ (RabbitMQ) │
                            └────────────┘
```

## 🎬 Scénario

Un client demande la génération d'une facture via l'API Gateway :

1. **Client** → `POST /clients/{id}/generate-invoice`
2. **Gateway** → Transmet la requête à **serviceClients** (via TCP)
3. **serviceClients** → Publie un message dans la queue RabbitMQ `invoices`
4. **Gateway** → Répond immédiatement au client : *"Votre facture sera envoyée par email lorsqu'elle sera prête"*
5. **serviceOrders** → Écoute la queue et traite le message (génération de facture)

---

## 📋 Prérequis

Assurez-vous que RabbitMQ est démarré :

```bash
docker-compose up -d
```

Vérifiez que l'interface d'administration est accessible : [http://localhost:15672](http://localhost:15672)
- **Username** : `admin`
- **Password** : `admin`

---

## 🛠️ Étape 1 : Créer le Service Clients (Producteur)

### 1.1 Créer le nouveau service

```bash
# À la racine du projet
nest new service-clients
cd service-clients
npm install @nestjs/microservices amqplib amqp-connection-manager
```

### 1.2 Configurer le service

**`service-clients/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: 3003,
      },
    },
  );
  
  await app.listen();
  console.log('Service Clients is listening on port 3003');
}
bootstrap();
```

### 1.3 Créer le module RabbitMQ

**`service-clients/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin@localhost:5672'],
          queue: 'invoices',
          queueOptions: {
            durable: true, // La queue persiste même si RabbitMQ redémarre
          },
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 1.4 Implémenter le contrôleur

**`service-clients/src/app.controller.ts`**

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @MessagePattern({ cmd: 'generate_invoice' })
  generateInvoice(data: { clientId: string }) {
    return this.appService.generateInvoice(data.clientId);
  }
}
```

### 1.5 Implémenter le service (Producteur)

**`service-clients/src/app.service.ts`**

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
  ) {}

  async generateInvoice(clientId: string) {
    const invoiceData = {
      invoiceId: `INV-${Date.now()}`,
      clientId: clientId,
      amount: Math.floor(Math.random() * 1000) + 100, // Montant aléatoire pour la démo
      createdAt: new Date().toISOString(),
    };

    console.log('📤 Publishing invoice to RabbitMQ:', invoiceData);

    // Envoyer le message à RabbitMQ (pattern: emit = fire and forget)
    this.rabbitClient.emit('invoice_created', invoiceData);

    return {
      message: 'Votre facture sera envoyée par email lorsqu\'elle sera prête',
      invoiceId: invoiceData.invoiceId,
    };
  }
}
```

### 1.6 Mettre à jour le Gateway

**`gateway/src/app.module.ts`** - Ajouter le client TCP pour serviceClients :

```typescript
ClientsModule.register([
  // ... Services A et B existants ...
  {
    name: 'CLIENTS_SERVICE',
    transport: Transport.TCP,
    options: {
      host: 'localhost',
      port: 3003,
    },
  },
]),
```

**`gateway/src/app.controller.ts`** - Ajouter la route :

```typescript
@Post('clients/:id/generate-invoice')
generateInvoice(@Param('id') clientId: string) {
  return this.appService.generateInvoice(clientId);
}
```

**`gateway/src/app.service.ts`** - Ajouter la méthode :

```typescript
@Inject('CLIENTS_SERVICE') private readonly clientsService: ClientProxy,

generateInvoice(clientId: string) {
  return this.clientsService.send(
    { cmd: 'generate_invoice' },
    { clientId }
  );
}
```

### ✅ Point de Contrôle 1

Démarrez le service :

```bash
cd service-clients
npm run start:dev
```

Testez la publication de messages :

```bash
curl -X POST http://localhost:3000/clients/123/generate-invoice
```

**Vérifications** :
1. ✅ Le Gateway répond immédiatement avec le message
2. ✅ Dans les logs de `service-clients`, vous voyez le message publié
3. ✅ **Interface RabbitMQ** : Allez sur [http://localhost:15672](http://localhost:15672) → onglet **Queues**
   - Vous devriez voir la queue `invoices` créée
   - Le compteur **Ready** augmente (messages en attente)

---

## 🛠️ Étape 2 : Créer le Service Orders (Consommateur)

### 2.1 Créer le nouveau service

```bash
# À la racine du projet
nest new service-orders
cd service-orders
npm install @nestjs/microservices amqplib amqp-connection-manager
```

### 2.2 Configurer le service RabbitMQ

**`service-orders/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://admin:admin@localhost:5672'],
        queue: 'invoices',
        queueOptions: {
          durable: true,
        },
        // Important : acknowledge manuel des messages
        noAck: false,
      },
    },
  );

  await app.listen();
  console.log('Service Orders is listening to RabbitMQ queue: invoices');
}
bootstrap();
```

### 2.3 Créer le contrôleur (Consommateur)

**`service-orders/src/app.controller.ts`**

```typescript
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

@Controller()
export class AppController {
  @EventPattern('invoice_created')
  async handleInvoiceCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    console.log('📥 Received invoice from RabbitMQ:');
    console.log('-----------------------------------');
    console.log(`Invoice ID: ${data.invoiceId}`);
    console.log(`Client ID: ${data.clientId}`);
    console.log(`Amount: ${data.amount}€`);
    console.log(`Created At: ${data.createdAt}`);
    console.log('-----------------------------------');
    console.log('✅ Invoice processing completed!');
    console.log('📧 (Simulated) Email sent to client\n');

    // Acknowledge le message (indique à RabbitMQ que le traitement est terminé)
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }
}
```

### ✅ Point de Contrôle 2

Démarrez le service :

```bash
cd service-orders
npm run start:dev
```

**Observez le comportement** :
1. Les messages en attente dans RabbitMQ sont **immédiatement consommés**
2. Dans les logs de `service-orders`, vous voyez le traitement des factures
3. **Interface RabbitMQ** : Le compteur **Ready** diminue, **Total** augmente

### ✅ Point de Contrôle 3 : Test End-to-End

Envoyez plusieurs requêtes :

```bash
curl -X POST http://localhost:3000/clients/123/generate-invoice
curl -X POST http://localhost:3000/clients/456/generate-invoice
curl -X POST http://localhost:3000/clients/789/generate-invoice
```

**Observations attendues** :
- ✅ Le Gateway répond immédiatement (asynchrone !)
- ✅ `service-clients` publie les messages
- ✅ `service-orders` traite les messages un par un
- ✅ Dans RabbitMQ : Les messages transitent par la queue

---

## 🔍 Explorer l'Interface RabbitMQ

Connectez-vous à [http://localhost:15672](http://localhost:15672) et explorez :

### Onglet **Queues**
- Cliquez sur la queue `invoices`
- **Get messages** : Visualisez les messages en attente (sans les consommer)
- **Purge** : Vider la queue
- **Delete** : Supprimer la queue

### Onglet **Connections**
- Voyez les connexions actives de vos services

### Onglet **Channels**
- Détails des canaux de communication

### Expérience
Arrêtez `service-orders` et envoyez plusieurs requêtes. Que se passe-t-il ?
- Les messages s'accumulent dans la queue
- Redémarrez `service-orders` → Les messages sont traités !

---

## 🚀 Pour Aller Plus Loin (Idées d'Extensions)

Voici quelques pistes pour approfondir vos connaissances (à explorer par vous-même) :

### 1. **Acknowledgment et Gestion d'Erreurs**
- Que se passe-t-il si le traitement échoue ?
- Comment renvoyer un message en erreur dans la queue ?
- Pattern : Dead Letter Queue (DLQ)

### 2. **Pattern Competing Consumers**
- Lancez plusieurs instances de `service-orders`
- Observez comment RabbitMQ répartit la charge

### 3. **Event-Driven Architecture**
- Faire publier un événement `invoice_completed` par `service-orders`
- Créer un service de notification qui écoute cet événement

### 4. **Types d'Exchanges**
- Actuellement : Default exchange (direct)
- Explorer : Topic exchange, Fanout exchange
- Cas d'usage : Router les messages selon des patterns

### 5. **Message Persistence**
- Que se passe-t-il si RabbitMQ redémarre ?
- Option `persistent: true` sur les messages

### 6. **Priority Queue**
- Traiter les factures VIP en priorité

---

## 📊 Comparaison TCP vs RabbitMQ

| Critère | TCP (Service A/B) | RabbitMQ (Service Orders) |
|---------|-------------------|---------------------------|
| **Type** | Synchrone | Asynchrone |
| **Réponse** | Attente obligatoire | Immédiate (fire & forget) |
| **Disponibilité** | Service doit être UP | Messages stockés en queue |
| **Scalabilité** | 1 service = 1 traitement | N services = load balancing |
| **Cas d'usage** | Requêtes rapides | Tâches longues, différées |

---

## 🎓 Résumé

Vous avez appris à :
- ✅ Configurer un **producteur** RabbitMQ (serviceClients)
- ✅ Configurer un **consommateur** RabbitMQ (serviceOrders)
- ✅ Utiliser les **patterns** `emit()` et `@EventPattern()`
- ✅ Observer les messages via l'interface d'administration
- ✅ Comprendre la **communication asynchrone** et ses avantages

**Prochaine étape** : Explorez les extensions proposées pour maîtriser les patterns avancés de RabbitMQ !

---

## 📚 Ressources

- [Documentation NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)
- [Pattern Messaging](https://www.enterpriseintegrationpatterns.com/patterns/messaging/)
