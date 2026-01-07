# Docker Deployment Guide

This directory contains the Docker configuration for the microservices architecture, including a unified Dockerfile and Docker Compose orchestration files.

## 📁 Structure

```
ops/docker/
├── Dockerfile              # Unified multi-stage Dockerfile for all NestJS services
├── compose.yml             # Master compose file (includes tools + apps)
├── compose-tools.yml       # Infrastructure services (Consul, Kong, Keycloak, RabbitMQ, PostgreSQL)
├── compose-apps.yml        # Application microservices with domain profiles
└── README.md              # This file
```

## 🏗️ Architecture

### Infrastructure Services (compose-tools.yml)
- **Consul** - Service discovery and health checks (Port 8500)
- **Kong** - API Gateway (Ports 8000, 8001, 8002)
- **Keycloak** - Authentication & Authorization (Port 8080)
- **RabbitMQ** - Message broker (Ports 5672, 15672)
- **PostgreSQL** - Databases for Kong (Port 5433) and Keycloak (Port 5432)

### Application Services (compose-apps.yml)

#### Domain AB (Profile: `ab`)
- **gateway-ab** - HTTP Gateway with JWT auth (Port 3300)
- **service-a** - TCP microservice (Port 3001)
- **service-b** - TCP microservice (Port 3002)

#### Domain Marketplace (Profile: `marketplace`)
- **gateway-marketplace** - HTTP Gateway (Port 3301)
- **service-clients** - TCP + RabbitMQ publisher (Port 3003)
- **service-orders** - RabbitMQ consumer (no exposed port)

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install Docker and Docker Compose
docker --version
docker compose version

# Ensure you're in the project root
cd /path/to/microservices-demo
```

### 2. Environment Configuration

Check and create `.env` files for each service:

```bash
# Run environment check (creates .env from .env.example if missing)
npm run docker:env-check

# Or manually
bash ops/docker/env-check.sh
```

See [Environment Variables](#-environment-variables) section for details.

### 3. Start Infrastructure Only

```bash
# Using npm script (from project root)
npm run docker:up

# Or using docker compose directly (from ops/docker)
cd ops/docker
docker compose up -d
```

This starts:
- Consul
- Kong + PostgreSQL
- Keycloak + PostgreSQL
- RabbitMQ

### 4. Start with Domain Services

#### Start AB Domain
```bash
# Using npm script
npm run docker:up:ab

# Or using docker compose
cd ops/docker
docker compose --profile ab up -d
```

#### Start Marketplace Domain
```bash
# Using npm script
npm run docker:up:marketplace

# Or using docker compose
cd ops/docker
docker compose --profile marketplace up -d
```

#### Start Everything
```bash
# Using npm script
npm run docker:up:all

# Or using docker compose
cd ops/docker
docker compose --profile all up -d
```

## 🔨 Building Services

### Build All Services

```bash
# From ops/docker directory
docker compose build
```

### Build Specific Service

```bash
# Gateway AB
docker compose build gateway-ab

# Service Clients
docker compose build service-clients
```

### Build with No Cache

```bash
docker compose build --no-cache gateway-ab
```

### Build Individual Service Manually

Each service can be built individually using the unified Dockerfile:

```bash
# Build Gateway AB
docker build \
  -f ops/docker/Dockerfile \
  --build-arg SERVICE_PATH=domains/ab/gateway-ab \
  -t gateway-ab:latest \
  .

# Build Service A
docker build \
  -f ops/docker/Dockerfile \
  --build-arg SERVICE_PATH=domains/ab/service-a \
  -t service-a:latest \
  .

# Build Service B
docker build \
  -f ops/docker/Dockerfile \
  --build-arg SERVICE_PATH=domains/ab/service-b \
  -t service-b:latest \
  .

# Build Gateway Marketplace
docker build \
  -f ops/docker/Dockerfile \
  --build-arg SERVICE_PATH=domains/marketplace/gateway-marketplace \
  -t gateway-marketplace:latest \
  .

# Build Service Clients
docker build \
  -f ops/docker/Dockerfile \
  --build-arg SERVICE_PATH=domains/marketplace/service-clients \
  -t service-clients:latest \
  .

# Build Service Orders
docker build \
  -f ops/docker/Dockerfile \
  --build-arg SERVICE_PATH=domains/marketplace/service-orders \
  -t service-orders:latest \
  .
```

## 🔧 Common Commands

### NPM Scripts (from project root)

```bash
# Check .env files
npm run docker:env-check

# Build all services
npm run docker:build

# Start infrastructure only
npm run docker:up

# Start with domain profiles
npm run docker:up:ab
npm run docker:up:marketplace
npm run docker:up:all

# Stop all services
npm run docker:down

# View logs
npm run docker:logs

# View running services
npm run docker:ps
```

### Docker Compose Commands (from ops/docker)

### View Running Services

```bash
docker compose ps
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f gateway-ab

# Infrastructure only
docker compose -f compose-tools.yml logs -f

# Last 100 lines
docker compose logs --tail=100 service-clients
```

### Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes
docker compose down -v

# Stop specific profile
docker compose --profile ab down
```

### Restart a Service

```bash
docker compose restart gateway-ab
```

### Execute Commands in Container

```bash
# Open shell
docker compose exec gateway-ab sh

# Run command
docker compose exec service-clients npm run some-command
```

### Health Check

```bash
# Check Consul
curl http://localhost:8500/v1/health/state/any

# Check Kong
curl http://localhost:8001/status

# Check Keycloak
curl http://localhost:8080/health
```

## 📋 Environment Variables

Each service requires two types of environment files:

### 1. `.env` - Local Development
Used when running services locally with `npm run start:dev`. Uses `localhost` for hostnames.

### 2. `.env.docker` - Docker Deployment
Used when running services in Docker containers. Uses Docker service names (e.g., `consul`, `keycloak`, `rabbitmq`) for hostnames.

### File Structure

```
domains/
├── ab/
│   ├── gateway-ab/
│   │   ├── .env          # Local dev (localhost)
│   │   ├── .env.docker   # Docker (consul, keycloak)
│   │   └── .env.example  # Template for .env
│   ├── service-a/
│   │   ├── .env          # Local dev
│   │   ├── .env.docker   # Docker
│   │   └── .env.example  # Template
│   └── service-b/
│       ├── .env          # Local dev
│       ├── .env.docker   # Docker
│       └── .env.example  # Template
└── marketplace/
    ├── gateway-marketplace/
    │   ├── .env          # Local dev
    │   ├── .env.docker   # Docker
    │   └── .env.example  # Template
    ├── service-clients/
    │   ├── .env          # Local dev
    │   ├── .env.docker   # Docker
    │   └── .env.example  # Template
    └── service-orders/
        ├── .env          # Local dev
        ├── .env.docker   # Docker
        └── .env.example  # Template
```

### Gateway AB

**`.env` (Local Development)**
```bash
NODE_ENV=development
PORT=3000
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_NAME=gateway-ab
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=microservices-realm
KEYCLOAK_CLIENT_ID=gateway-ab-client
SERVICE_A_HOST=localhost
SERVICE_A_PORT=3001
SERVICE_B_HOST=localhost
SERVICE_B_PORT=3002
```

**`.env.docker` (Docker Deployment)**
```bash
NODE_ENV=production
PORT=3000
CONSUL_HOST=consul
CONSUL_PORT=8500
SERVICE_NAME=gateway-ab
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=microservices-realm
KEYCLOAK_CLIENT_ID=gateway-ab-client
SERVICE_A_HOST=service-a
SERVICE_A_PORT=3001
SERVICE_B_HOST=service-b
SERVICE_B_PORT=3002
```

### Service A

**`.env` (Local)**
```bash
NODE_ENV=development
PORT=3001
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_NAME=service-a
```

**`.env.docker` (Docker)**
```bash
NODE_ENV=production
PORT=3001
CONSUL_HOST=consul
CONSUL_PORT=8500
SERVICE_NAME=service-a
```

### Service B

**`.env` (Local)**
```bash
NODE_ENV=development
PORT=3002
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_NAME=service-b
```

**`.env.docker` (Docker)**
```bash
NODE_ENV=production
PORT=3002
CONSUL_HOST=consul
CONSUL_PORT=8500
SERVICE_NAME=service-b
```

### Gateway Marketplace

**`.env` (Local)**
```bash
NODE_ENV=development
PORT=3010
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_NAME=gateway-marketplace
SERVICE_CLIENTS_HOST=localhost
SERVICE_CLIENTS_PORT=3003
```

**`.env.docker` (Docker)**
```bash
NODE_ENV=production
PORT=3010
CONSUL_HOST=consul
CONSUL_PORT=8500
SERVICE_NAME=gateway-marketplace
SERVICE_CLIENTS_HOST=service-clients
SERVICE_CLIENTS_PORT=3003
```

### Service Clients

**`.env` (Local)**
```bash
NODE_ENV=development
PORT=3003
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_NAME=service-clients
RABBITMQ_URL=amqp://admin:admin@localhost:5672
RABBITMQ_QUEUE=invoices
RABBITMQ_EXCHANGE=orders_exchange
```

**`.env.docker` (Docker)**
```bash
NODE_ENV=production
PORT=3003
CONSUL_HOST=consul
CONSUL_PORT=8500
SERVICE_NAME=service-clients
RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
RABBITMQ_QUEUE=invoices
RABBITMQ_EXCHANGE=orders_exchange
```

### Service Orders

**`.env` (Local)**
```bash
NODE_ENV=development
CONSUL_HOST=localhost
CONSUL_PORT=8500
SERVICE_NAME=service-orders
RABBITMQ_URL=amqp://admin:admin@localhost:5672
RABBITMQ_QUEUE=invoices
RABBITMQ_EXCHANGE=orders_exchange
```

**`.env.docker` (Docker)**
```bash
NODE_ENV=production
CONSUL_HOST=consul
CONSUL_PORT=8500
SERVICE_NAME=service-orders
RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672
RABBITMQ_QUEUE=invoices
RABBITMQ_EXCHANGE=orders_exchange
```

## 🔍 Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   docker compose logs service-name
   ```

2. Verify dependencies are healthy:
   ```bash
   docker compose ps
   ```

3. Check environment variables:
   ```bash
   docker compose exec service-name env
   ```

### Network Issues

```bash
# Inspect network
docker network inspect docker_microservices-network

# Check if services can reach each other
docker compose exec gateway-ab ping consul
```

### Build Issues

```bash
# Clean build
docker compose build --no-cache service-name

# Remove all images and rebuild
docker compose down --rmi all
docker compose build
```

### Port Conflicts

If ports are already in use:

1. Modify port mappings in `compose-apps.yml` or `compose-tools.yml`
2. Or stop conflicting services:
   ```bash
   lsof -i :3000  # Find process using port
   kill -9 <PID>  # Stop the process
   ```

## 🧪 Development Workflow

### Local Development with Hot Reload

For development, you can use volume mounts:

```yaml
# Add to service in compose-apps.yml
volumes:
  - ../../domains/ab/gateway-ab/src:/app/domains/ab/gateway-ab/src
command: npm run start:dev
```

### Testing Changes

```bash
# Rebuild and restart specific service
docker compose up -d --build gateway-ab

# View logs
docker compose logs -f gateway-ab
```

## 📊 Monitoring

### Service Discovery (Consul)

```bash
# Open Consul UI
open http://localhost:8500
```

### API Gateway (Kong)

```bash
# Open Kong Manager
open http://localhost:8002

# List routes
curl http://localhost:8001/routes
```

### Authentication (Keycloak)

```bash
# Open Keycloak Admin Console
open http://localhost:8080
# Login: admin / admin
```

### Message Broker (RabbitMQ)

```bash
# Open RabbitMQ Management UI
open http://localhost:15672
# Login: admin / admin
```

## 🚢 Production Deployment

### Build for Production

```bash
# Build all services
docker compose build

# Tag for registry
docker tag gateway-ab:latest your-registry.com/gateway-ab:v1.0.0

# Push to registry
docker push your-registry.com/gateway-ab:v1.0.0
```

### Production Considerations

1. **Environment Variables**: Use secrets management (Docker Secrets, Vault)
2. **Health Checks**: Ensure all services have proper health checks
3. **Resource Limits**: Add CPU and memory limits
4. **Logging**: Configure centralized logging (ELK, Loki)
5. **Monitoring**: Add Prometheus metrics
6. **Scaling**: Use container orchestration (Kubernetes, Docker Swarm)

## 📦 Migration to Kubernetes

See `TODO_DOCKER_K8S_IMPLEMENTATION.md` for Kubernetes migration guide.

### Quick Kubernetes Deployment

```bash
# Convert compose to Kubernetes manifests (using kompose)
kompose convert -f compose.yml

# Or use the provided k8s manifests
kubectl apply -f ops/k8s/
```

## 🔗 Useful Links

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Consul Documentation](https://www.consul.io/docs)
- [Kong Documentation](https://docs.konghq.com/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)

## 📝 Notes

- The unified Dockerfile uses multi-stage builds to optimize image size
- Infrastructure services start automatically; application services require profiles
- All services share the `microservices-network` bridge network
- Volume mounts persist data for databases and Consul
- Health checks ensure services start in the correct order

## 🆘 Support

For issues or questions:
1. Check the logs: `docker compose logs -f`
2. Review service health: `docker compose ps`
3. Consult the main project documentation
4. Check service-specific README files in each domain folder
