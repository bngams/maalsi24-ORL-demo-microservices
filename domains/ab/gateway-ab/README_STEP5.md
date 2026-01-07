# Step 5: JWT Validation in NestJS - Gateway AB

## Installation

```bash
cd domains/ab/gateway-ab
npm install
```

This installs the JWT dependencies:
- `@nestjs/passport` - NestJS Passport integration
- `passport` - Authentication middleware
- `passport-jwt` - JWT authentication strategy
- `jwks-rsa` - RSA key fetching from Keycloak JWKS endpoint

## Testing the Protected Endpoints

### 1. Start Services

```bash
# From project root
docker-compose up -d keycloak postgres-kc-db kong postgres-kong-db

# Start gateway-ab
cd domains/ab/gateway-ab
npm run start:dev
```

### 2. Get JWT Token

**For alice (admin role):**
```bash
curl -X POST http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=gateway-ab" \
  -d "client_secret=gateway-ab-secret" \
  -d "username=alice" \
  -d "password=password" | jq -r '.access_token'
```

**For bob (user role):**
```bash
curl -X POST http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=gateway-ab" \
  -d "client_secret=gateway-ab-secret" \
  -d "username=bob" \
  -d "password=password" | jq -r '.access_token'
```

### 3. Test Public Endpoints (no authentication required)

```bash
# Should work without token
curl http://localhost:3300/health
curl http://localhost:3300/hello
```

### 4. Test Protected Endpoint (JWT required)

```bash
# Without token - should fail with 401
curl http://localhost:3300/protected

# With token - should succeed
TOKEN="<your_alice_or_bob_token>"
curl http://localhost:3300/protected \
  -H "Authorization: Bearer $TOKEN"
```

Expected success response:
```json
{
  "message": "This is a protected route",
  "user": {
    "userId": "...",
    "username": "alice",
    "email": "alice@example.com",
    "roles": ["admin"]
  }
}
```

### 5. Test Admin Endpoint (admin role required)

```bash
# With alice token - should succeed
ALICE_TOKEN="<alice_token>"
curl http://localhost:3300/admin \
  -H "Authorization: Bearer $ALICE_TOKEN"

# With bob token - should fail with 403 Forbidden
BOB_TOKEN="<bob_token>"
curl http://localhost:3300/admin \
  -H "Authorization: Bearer $BOB_TOKEN"
```

### 6. Test User Endpoint (user or admin role required)

```bash
# With alice token - should succeed (admin has access)
curl http://localhost:3300/user \
  -H "Authorization: Bearer $ALICE_TOKEN"

# With bob token - should succeed (bob has user role)
curl http://localhost:3300/user \
  -H "Authorization: Bearer $BOB_TOKEN"
```

## Architecture

```
┌──────────┐    JWT    ┌─────────────┐    Validates    ┌──────────┐
│  Client  │ ───────> │  Gateway AB  │ ──────────────> │ Keycloak │
└──────────┘          │   (NestJS)   │    via JWKS     │  (IdP)   │
                      │              │                 └──────────┘
                      │ - JwtStrategy│
                      │ - JwtGuard   │
                      │ - RolesGuard │
                      └─────────────┘
```

## Key Files

- **src/auth/jwt.strategy.ts** - Validates JWT using Keycloak's JWKS endpoint
- **src/auth/jwt-auth.guard.ts** - Applies JWT authentication to routes
- **src/auth/roles.guard.ts** - Checks user roles for authorization
- **src/auth/roles.decorator.ts** - Decorator to specify required roles
- **src/auth/auth.module.ts** - Bundles authentication components
- **src/app.controller.ts** - Example protected endpoints

## Troubleshooting

**401 Unauthorized:**
- Token expired (default 5 minutes)
- Invalid token signature
- Wrong issuer or audience

**403 Forbidden:**
- User doesn't have required role
- Check `realm_access.roles` in JWT

**Cannot connect to Keycloak:**
- Ensure Keycloak is running: `docker ps | grep keycloak`
- Check JWKS endpoint: `curl http://localhost:8080/realms/microservices-realm/protocol/openid-connect/certs`

**Inspect JWT Token:**
```bash
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq
```

## TODO : transform this in a lib (shared/keycload) to make it reusable in other parts like gateway-marketplace...