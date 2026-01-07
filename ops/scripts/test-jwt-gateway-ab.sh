#!/bin/bash

set -e

echo "🧪 Testing JWT Validation on Gateway AB"
echo "========================================"
echo ""

GATEWAY_URL="http://localhost:3300"
KEYCLOAK_URL="http://localhost:8080"
REALM="microservices-realm"
CLIENT_ID="gateway-ab"
CLIENT_SECRET="gateway-ab-secret"

echo "0️⃣ Checking prerequisites..."
echo ""

# Check if gateway is running
if ! curl -s -f -o /dev/null $GATEWAY_URL/health; then
    echo "  ❌ Gateway AB is not running on port 3300"
    echo ""
    echo "  Please start the gateway first:"
    echo "    cd /Users/bngams/Courses/cesi/maalsi-24-ORL/microservices-demo"
    echo "    npm run start:dev"
    echo ""
    echo "  Or start only gateway-ab:"
    echo "    cd domains/ab/gateway-ab"
    echo "    npm run start:dev"
    echo ""
    exit 1
fi
echo "  ✅ Gateway AB is running"

# Check if Keycloak is running
if ! curl -s -f -o /dev/null $KEYCLOAK_URL/realms/microservices-realm; then
    echo "  ❌ Keycloak is not running on port 8080"
    echo ""
    echo "  Please start Keycloak first:"
    echo "    docker compose up -d keycloak postgres-kc-db"
    echo ""
    echo "  Then wait for it to be ready (30-60 seconds):"
    echo "    docker logs -f keycloak"
    echo ""
    exit 1
fi
echo "  ✅ Keycloak is running"
echo ""

echo "1️⃣ Testing public endpoints (no auth required)..."
echo ""

echo "  GET /health"
curl -s $GATEWAY_URL/health | jq '.' || echo "OK"
echo ""

echo "  GET /hello"
curl -s $GATEWAY_URL/hello | jq '.' || echo "OK"
echo ""

echo "2️⃣ Testing protected endpoint without token (should fail with 401)..."
echo ""
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $GATEWAY_URL/protected)
if [ "$HTTP_CODE" == "401" ]; then
    echo "  ✅ Correctly rejected: $HTTP_CODE Unauthorized"
else
    echo "  ❌ Expected 401, got: $HTTP_CODE"
fi
echo ""

echo "3️⃣ Getting JWT token for alice (admin role)..."
echo ""
ALICE_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "username=alice" \
  -d "password=password" | jq -r '.access_token')

if [ "$ALICE_TOKEN" == "null" ] || [ -z "$ALICE_TOKEN" ]; then
    echo "  ❌ Failed to get token for alice"
    exit 1
fi
echo "  ✅ Token obtained for alice"
echo ""

echo "4️⃣ Getting JWT token for bob (user role)..."
echo ""
BOB_TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "username=bob" \
  -d "password=password" | jq -r '.access_token')

if [ "$BOB_TOKEN" == "null" ] || [ -z "$BOB_TOKEN" ]; then
    echo "  ❌ Failed to get token for bob"
    exit 1
fi
echo "  ✅ Token obtained for bob"
echo ""

echo "5️⃣ Testing /protected with alice token (should succeed)..."
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" $GATEWAY_URL/protected \
  -H "Authorization: Bearer $ALICE_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "  ✅ Success: $HTTP_CODE"
    echo "  Response: $BODY" | jq '.'
else
    echo "  ❌ Expected 200, got: $HTTP_CODE"
    echo "  Response: $BODY"
fi
echo ""

echo "6️⃣ Testing /admin with alice token (should succeed - alice is admin)..."
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" $GATEWAY_URL/admin \
  -H "Authorization: Bearer $ALICE_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "  ✅ Success: $HTTP_CODE"
    echo "  Response: $BODY" | jq '.'
else
    echo "  ❌ Expected 200, got: $HTTP_CODE"
    echo "  Response: $BODY"
fi
echo ""

echo "7️⃣ Testing /admin with bob token (should fail with 403 - bob is not admin)..."
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" $GATEWAY_URL/admin \
  -H "Authorization: Bearer $BOB_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "403" ]; then
    echo "  ✅ Correctly forbidden: $HTTP_CODE"
else
    echo "  ❌ Expected 403, got: $HTTP_CODE"
    echo "  Response: $BODY"
fi
echo ""

echo "8️⃣ Testing /user with alice token (should succeed)..."
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" $GATEWAY_URL/user \
  -H "Authorization: Bearer $ALICE_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "  ✅ Success: $HTTP_CODE"
    echo "  Response: $BODY" | jq '.'
else
    echo "  ❌ Expected 200, got: $HTTP_CODE"
    echo "  Response: $BODY"
fi
echo ""

echo "9️⃣ Testing /user with bob token (should succeed - bob has user role)..."
echo ""
RESPONSE=$(curl -s -w "\n%{http_code}" $GATEWAY_URL/user \
  -H "Authorization: Bearer $BOB_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo "  ✅ Success: $HTTP_CODE"
    echo "  Response: $BODY" | jq '.'
else
    echo "  ❌ Expected 200, got: $HTTP_CODE"
    echo "  Response: $BODY"
fi
echo ""

echo "========================================" 
echo "✅ All JWT validation tests completed!"
echo ""
echo "📋 Summary:"
echo "  - Public endpoints: accessible without token"
echo "  - Protected endpoints: require valid JWT"
echo "  - Admin endpoint: requires 'admin' role"
echo "  - User endpoint: requires 'user' or 'admin' role"
