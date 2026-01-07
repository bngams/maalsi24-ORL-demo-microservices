#!/bin/bash

# Environment Check Script
# Verifies that all required .env.docker files exist for Docker deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Checking .env.docker files for Docker deployment..."
echo ""

missing_files=()
existing_files=()

# Check each service
services=(
    "domains/ab/gateway-ab"
    "domains/ab/service-a"
    "domains/ab/service-b"
    "domains/marketplace/gateway-marketplace"
    "domains/marketplace/service-clients"
    "domains/marketplace/service-orders"
)

for service in "${services[@]}"; do
    if [ -f "$PROJECT_ROOT/$service/.env.docker" ]; then
        existing_files+=("$service/.env.docker")
    else
        missing_files+=("$service/.env.docker")
    fi
done

echo ""
echo "=== Summary ==="
echo ""

if [ ${#existing_files[@]} -gt 0 ]; then
    echo -e "${GREEN}Existing .env.docker files (${#existing_files[@]}):${NC}"
    for file in "${existing_files[@]}"; do
        echo "  ✓ $file"
    done
    echo ""
fi

if [ ${#missing_files[@]} -gt 0 ]; then
    echo -e "${YELLOW}Missing .env.docker files (${#missing_files[@]}):${NC}"
    for file in "${missing_files[@]}"; do
        echo "  ✗ $file"
    done
    echo ""
    echo -e "${YELLOW}Note: .env.docker files should contain Docker-specific configuration (e.g., consul, keycloak, rabbitmq hostnames)${NC}"
    echo -e "${YELLOW}      .env files are for local development with localhost${NC}"
    exit 1
else
    echo -e "${GREEN}All .env.docker files are present!${NC}"
    exit 0
fi
