# Multi-stage Dockerfile for NestJS microservices
# This Dockerfile can build any NestJS service in the monorepo

# Build stage
# spec. version node:20-alpine3.18...
# AS = Multi-stage build alias
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY turbo.json ./

# Copy shared libraries
COPY shared/ ./shared/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy the specific service source code
# The SERVICE_PATH will be passed as a build arg
ARG SERVICE_PATH
COPY ${SERVICE_PATH} ./${SERVICE_PATH}

# Install service-specific dependencies and build
WORKDIR /app/${SERVICE_PATH}
RUN npm ci
RUN npx nest build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./

# Copy shared libraries
COPY shared/ ./shared/

# Install root dependencies (production only)
RUN npm ci --only=production

# Copy the specific service package.json
ARG SERVICE_PATH
COPY ${SERVICE_PATH}/package*.json ./${SERVICE_PATH}/

# Set working directory to the service
WORKDIR /app/${SERVICE_PATH}

# Install service production dependencies
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/${SERVICE_PATH}/dist ./dist

# Copy shared modules if needed at runtime
COPY --from=builder /app/shared /app/shared

# Expose port (will be overridden by docker-compose)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
