# Kong Configuration Options for Keycloak Integration

This directory contains two Kong configuration approaches for JWT authentication with Keycloak.

## Option A: Kong with JWT Validation (Recommended for Production)

**Use when:** You want centralized JWT validation at the API Gateway level.

### Setup Steps:

1. **Ensure Kong is running in DB mode** (already configured in `compose.yml`)

2. **Run the Kong JWT setup script:**
   ```bash
   ./ops/scripts/kong-jwt-setup.sh
   ```

   This script will:
   - Configure Kong services and routes
   - Enable JWT plugin on both services
   - Create a Keycloak consumer
   - Extract and configure RSA public key from Keycloak JWKS

3. **Test the configuration:**
   ```bash
   # Get a token
   TOKEN=$(curl -s -X POST 'http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token' \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'client_id=gateway-ab' \
     -d 'client_secret=gateway-ab-secret' \
     -d 'grant_type=password' \
     -d 'username=alice' \
     -d 'password=password' | jq -r '.access_token')

   # Test protected endpoint through Kong
   curl http://localhost:8000/ab/protected \
     -H "Authorization: Bearer $TOKEN"
   ```

### Advantages:
- ✅ Centralized authentication at gateway level
- ✅ Services don't need to validate JWT
- ✅ Better performance (single validation point)
- ✅ Easier to manage authentication policies

### Disadvantages:
- ❌ More complex setup
- ❌ Requires Kong in DB mode
- ❌ Need to manage consumer credentials

---

## Option B: No JWT in Kong (Simplified - Recommended for Tutorial)

**Use when:** You want simpler setup for development/learning, or fine-grained control in each service.

### Setup Steps:

1. **Use the simplified Kong configuration:**
   
   The current `ops/config/kong/kong.yml` is already configured for Option B (no JWT plugin).
   
   Or use the explicit config file:
   ```bash
   # In compose.yml, update the volume mount:
   # - ./ops/config/kong/kong-no-jwt.yml:/usr/local/kong/declarative/kong.yml:ro
   ```

2. **Kong will act as a simple reverse proxy** - no JWT validation

3. **JWT validation is done in NestJS gateways** (Step 5 of the tutorial)

### Advantages:
- ✅ Simpler Kong configuration
- ✅ Can work with DB-less mode (but we use DB mode)
- ✅ Each service validates its own tokens
- ✅ More flexibility per service

### Disadvantages:
- ❌ Each service must validate JWT
- ❌ Duplicated validation logic
- ❌ Slightly lower performance (multiple validations)

---

## Current Configuration

Your `compose.yml` is configured with:
- **Kong in DB mode** (PostgreSQL)
- **Declarative config** pointing to `./ops/config/kong/kong.yml`

### To Switch Between Options:

#### Switch to Option A (Kong with JWT):
```bash
# Run the setup script
./ops/scripts/kong-jwt-setup.sh

# This configures Kong via Admin API (ignores declarative config)
# Or remove KONG_DECLARATIVE_CONFIG from compose.yml
```

#### Switch to Option B (No JWT in Kong):
```bash
# Use the current kong.yml (no JWT plugin)
# Or explicitly use kong-no-jwt.yml
docker compose restart kong
```

---

## Testing Both Options

### Test Option A (Kong validates JWT):
```bash
# Without token - should get 401 from Kong
curl http://localhost:8000/ab/protected

# With token - should succeed
TOKEN=$(curl -s -X POST 'http://localhost:8080/realms/microservices-realm/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=gateway-ab' \
  -d 'client_secret=gateway-ab-secret' \
  -d 'grant_type=password' \
  -d 'username=alice' \
  -d 'password=password' | jq -r '.access_token')

curl http://localhost:8000/ab/protected \
  -H "Authorization: Bearer $TOKEN"
```

### Test Option B (NestJS validates JWT):
```bash
# Same commands as above
# Difference: 401 error comes from NestJS, not Kong
# Kong just forwards the request
```

---

## For Students

**Recommended approach for learning:**

1. **Start with Option B** (current setup) - simpler to understand
2. Complete Steps 5-7 of the tutorial (NestJS integration)
3. Then try **Option A** to see centralized validation
4. Compare the two approaches

**For production deployments:**
- Use **Option A** for better security and performance
- Centralized authentication policies
- Easier to manage and audit

---

## Troubleshooting

### Kong JWT plugin not working?
- Check Kong logs: `docker logs kong`
- Verify JWKS endpoint is accessible: `curl http://localhost:8080/realms/microservices-realm/protocol/openid-connect/certs`
- Check consumer exists: `curl http://localhost:8001/consumers/keycloak`

### Script fails?
- Ensure `jq` is installed: `brew install jq` (macOS) or `sudo apt-get install jq` (Linux)
- Check Kong and Keycloak are running: `docker compose ps`

### Token validation fails?
- Verify token issuer matches: `echo $TOKEN | cut -d. -f2 | base64 -d | jq .iss`
- Should be: `http://localhost:8080/realms/microservices-realm`
