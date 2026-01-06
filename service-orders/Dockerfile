# --- Build stage ---
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

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

# Démarrer l'application (pas de port exposé car consumer RabbitMQ)
CMD ["node", "dist/main"]
