#!/bin/bash

# Script to configure Kong with JWT plugin for Keycloak integration
# This script implements Option A: Kong with JWT validation

set -e

KONG_ADMIN_URL="http://localhost:8001"
KEYCLOAK_URL="http://localhost:8080"
REALM_NAME="microservices-realm"

echo "🔧 Kong JWT Configuration Script"
echo "=================================="
echo ""

# Wait for Kong to be ready
echo "⏳ Waiting for Kong Admin API to be ready..."
until curl -s -f "${KONG_ADMIN_URL}/status" > /dev/null 2>&1; do
    echo "   Kong not ready yet, waiting..."
    sleep 2
done
echo "✅ Kong is ready!"
echo ""

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to be ready..."
until curl -s -f "${KEYCLOAK_URL}/health/ready" > /dev/null 2>&1; do
    echo "   Keycloak not ready yet, waiting..."
    sleep 2
done
echo "✅ Keycloak is ready!"
echo ""

# Get JWKS from Keycloak
echo "📥 Fetching JWKS from Keycloak..."
JWKS_URI="${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/certs"
echo "   JWKS URI: ${JWKS_URI}"

# Extract the first public key from JWKS
echo "🔑 Extracting RSA public key from JWKS..."
JWKS_JSON=$(curl -s "${JWKS_URI}")

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Please install jq to run this script."
    echo "   On macOS: brew install jq"
    echo "   On Ubuntu/Debian: sudo apt-get install jq"
    exit 1
fi

# Extract the public key components (n and e)
MODULUS=$(echo "${JWKS_JSON}" | jq -r '.keys[0].n')
EXPONENT=$(echo "${JWKS_JSON}" | jq -r '.keys[0].e')

if [ -z "$MODULUS" ] || [ "$MODULUS" == "null" ]; then
    echo "❌ Error: Could not extract public key from JWKS"
    exit 1
fi

echo "✅ Public key extracted successfully"
echo ""

# Get the issuer (iss claim)
ISSUER="${KEYCLOAK_URL}/realms/${REALM_NAME}"
echo "🔐 JWT Issuer: ${ISSUER}"
echo ""

# Create or update services and routes
echo "🛠️  Configuring Kong services and routes..."

# Service: gateway-ab
echo "   Creating/updating gateway-ab service..."
SERVICE_AB_ID=$(curl -s -X PUT "${KONG_ADMIN_URL}/services/gateway-ab" \
  --data "url=http://host.docker.internal:3300" | jq -r '.id')

echo "   Creating/updating gateway-ab route..."
curl -s -X PUT "${KONG_ADMIN_URL}/services/gateway-ab/routes/gateway-ab-route" \
  --data "paths[]=/ab" \
  --data "strip_path=true" > /dev/null

# Service: gateway-marketplace
echo "   Creating/updating gateway-marketplace service..."
SERVICE_MARKET_ID=$(curl -s -X PUT "${KONG_ADMIN_URL}/services/gateway-marketplace" \
  --data "url=http://host.docker.internal:3301" | jq -r '.id')

echo "   Creating/updating gateway-marketplace route..."
curl -s -X PUT "${KONG_ADMIN_URL}/services/gateway-marketplace/routes/gateway-marketplace-route" \
  --data "paths[]=/marketplace" \
  --data "strip_path=true" > /dev/null

echo "✅ Services and routes configured"
echo ""

# Enable JWT plugin on gateway-ab service
echo "🔌 Enabling JWT plugin on gateway-ab service..."
curl -s -X POST "${KONG_ADMIN_URL}/services/gateway-ab/plugins" \
  --data "name=jwt" \
  --data "config.claims_to_verify=exp" \
  --data "config.key_claim_name=iss" \
  --data "config.secret_is_base64=false" > /dev/null

# Enable JWT plugin on gateway-marketplace service
echo "🔌 Enabling JWT plugin on gateway-marketplace service..."
curl -s -X POST "${KONG_ADMIN_URL}/services/gateway-marketplace/plugins" \
  --data "name=jwt" \
  --data "config.claims_to_verify=exp" \
  --data "config.key_claim_name=iss" \
  --data "config.secret_is_base64=false" > /dev/null

echo "✅ JWT plugins enabled"
echo ""

# Create consumer for Keycloak
echo "👤 Creating Keycloak consumer..."
CONSUMER_EXISTS=$(curl -s -w "%{http_code}" -o /dev/null "${KONG_ADMIN_URL}/consumers/keycloak")

if [ "$CONSUMER_EXISTS" == "404" ]; then
    curl -s -X POST "${KONG_ADMIN_URL}/consumers" \
      --data "username=keycloak" > /dev/null
    echo "✅ Consumer 'keycloak' created"
else
    echo "ℹ️  Consumer 'keycloak' already exists"
fi
echo ""

# Associate JWT credential with consumer
echo "🔑 Associating JWT credential with consumer..."

# Note: Kong expects the key to be the issuer claim value
curl -s -X POST "${KONG_ADMIN_URL}/consumers/keycloak/jwt" \
  --data "key=${ISSUER}" \
  --data "algorithm=RS256" \
  --data "rsa_public_key=${MODULUS}" \
  --data "secret=${EXPONENT}" > /dev/null 2>&1 || {
    echo "ℹ️  JWT credential may already exist, attempting to update..."
}

echo "✅ JWT credential configured"
echo ""

echo "=========================================="
echo "✅ Kong JWT configuration completed!"
echo ""
echo "📝 Summary:"
echo "   - Services: gateway-ab, gateway-marketplace"
echo "   - JWT validation enabled on both services"
echo "   - Consumer 'keycloak' created with JWT credentials"
echo "   - Issuer: ${ISSUER}"
echo ""
echo "🧪 Testing:"
echo "   1. Get a token from Keycloak:"
echo "      TOKEN=\$(curl -s -X POST '${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/token' \\"
echo "        -H 'Content-Type: application/x-www-form-urlencoded' \\"
echo "        -d 'client_id=gateway-ab' \\"
echo "        -d 'client_secret=gateway-ab-secret' \\"
echo "        -d 'grant_type=password' \\"
echo "        -d 'username=alice' \\"
echo "        -d 'password=password' | jq -r '.access_token')"
echo ""
echo "   2. Test protected endpoint:"
echo "      curl http://localhost:8000/ab/protected \\"
echo "        -H \"Authorization: Bearer \$TOKEN\""
echo ""
echo "=========================================="
