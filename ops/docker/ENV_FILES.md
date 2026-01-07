# Environment Files Structure

## Overview

This project uses separate environment files for **local development** and **Docker deployment** to handle different hostname configurations.

## File Types

### `.env` - Local Development
- Used by: `npm run start:dev` (runs services on host machine)
- Hostnames: `localhost` for all services
- Environment: `NODE_ENV=development`
- Example: `KEYCLOAK_URL=http://localhost:8080`

### `.env.docker` - Docker Containers
- Used by: Docker Compose (`docker compose up`)
- Hostnames: Docker service names (`consul`, `keycloak`, `rabbitmq`, etc.)
- Environment: `NODE_ENV=production`
- Example: `KEYCLOAK_URL=http://keycloak:8080`

### `.env.example` - Template
- Template for creating `.env` files
- Contains local development configuration (localhost)
- Checked into version control

## Quick Setup

### For Local Development
```bash
# All .env files already exist with localhost configuration
npm run start:dev
```

### For Docker Deployment
```bash
# Check .env.docker files exist
npm run docker:env-check

# All .env.docker files already exist with Docker service names
npm run docker:up:all
```

## Key Differences

| Configuration | Local (.env) | Docker (.env.docker) |
|--------------|--------------|---------------------|
| Consul | `localhost:8500` | `consul:8500` |
| Keycloak | `localhost:8080` | `keycloak:8080` |
| RabbitMQ | `localhost:5672` | `rabbitmq:5672` |
| Service A | `localhost:3001` | `service-a:3001` |
| Service B | `localhost:3002` | `service-b:3002` |
| Service Clients | `localhost:3003` | `service-clients:3003` |
| NODE_ENV | `development` | `production` |

## Why This Approach?

1. **Network Isolation**: Docker containers use Docker's internal DNS, while local development uses the host network
2. **Flexibility**: Developers can run some services locally and others in Docker without conflicts
3. **Security**: `.env` files are gitignored, `.env.example` provides templates
4. **Clarity**: Clear separation between local and containerized configurations
