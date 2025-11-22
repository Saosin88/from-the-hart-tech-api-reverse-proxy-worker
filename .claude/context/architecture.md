# Reverse Proxy Worker Architecture

Last updated: 2025-11-22

## Current State
- Cloudflare Workers runtime (TypeScript)
- API gateway / reverse proxy pattern
- Multi-cloud authentication (AWS SigV4, GCP identity tokens, Azure tokens)
- Compatibility date: 2025-10-11
- Environment-based configuration (local, dev, prod)
- Wrangler CLI for local development and deployment

## Core Components

### Request Flow Pipeline
```
Request → Size Limit Check → Rate Limit Check → CORS Handling → Route Resolution
→ Token Validation (Turnstile/Access Token) → Cloud Auth Signing → Backend Fetch → Response Headers
```

### Authentication Handlers

#### AWS Authentication (aws-auth.ts)
- Implements AWS SigV4 signing for Lambda Function URLs
- Components:
  - `addAwsSignatureToRequest()` - Main entry point
  - `createCanonicalRequest()` - Builds AWS canonical request format
  - `hmacSha256()` - Cryptographic signing
  - Region extraction from hostname
- Signed headers: `host`, `x-amz-content-sha256`, `x-amz-date`
- Payload hashing: SHA-256 of request body or empty string hash
- Preserves incoming Authorization header as `X-From-The-Hart-Authorization`

#### GCP Authentication (gcp-auth.ts)
- Generates Google ID tokens for Cloud Run service access
- Components:
  - `addGoogleIdTokenToRequest()` - Adds `X-Serverless-Authorization` header
  - `getGoogleIdToken()` - Core JWT signing and token exchange
  - Token caching with 5-minute buffer before expiry
- JWT construction with service account credentials
- Uses `crypto.subtle` for RS256 signature generation
- Cache implementation using Cloudflare Cache API

#### Azure Authentication (azure-auth.ts)
- Obtains Azure access tokens via OAuth2 client credentials flow
- Components:
  - `addAzureTokenToRequest()` - Adds Bearer token to Authorization header
  - `getAzureAccessToken()` - Handles OAuth2 token exchange
  - Token caching strategy matching GCP implementation
- Uses Microsoft login endpoint for token acquisition
- Supports service scope configuration

### Security & Validation

#### Access Token Verification (verify-access-token.ts)
- Validates Firebase access tokens via auth service endpoint
- Components:
  - `handleAccessTokenValidation()` - Intercepts and validates tokens
  - `sha256Hex()` - Hashes tokens for caching
- Cache key strategy: SHA-256 hash of token + path
- Verification delegation to `/auth/verify-access-token` endpoint
- GCP authentication required for calling auth service

#### Cloudflare Turnstile Validation (cloudflare-turnstile.ts)
- Bot challenge verification for sensitive endpoints
- `validateTurnstileToken()` - Calls Cloudflare challenge API
- Required for login, register, forgot-password endpoints in dev/prod
- IP address validation during challenge verification

#### Rate Limiting (rate-limiter.ts)
- Uses Cloudflare Durable Objects rate limiter
- Configuration per environment:
  - Local: 10 req/minute
  - Dev: 100 req/minute
  - Prod: 200 req/minute
- Rate limit key strategy:
  - If authenticated: `{path}|{token}`
  - If not authenticated: `{path}|{client-ip}`

### Request & Response Management

#### Request Size Limiting (size-limit.ts)
- Enforces 1MB maximum request body size
- Two-stage validation:
  1. Check `content-length` header if present
  2. Verify actual request body buffer size
- Returns 413 Payload Too Large on violation

#### CORS Handling (response-headers.ts)
- Implements CORS preflight handling
- Configuration per environment:
  - Production: Only `https://www.fromthehart.tech`
  - Dev/Local: `http://localhost:3000`, `https://dev.fromthehart.tech`
- Allowed methods: GET, POST, OPTIONS
- Allowed headers: Authorization, Content-Type, X-Requested-With, Accept, Origin, x-cf-turnstile-token
- Exposed headers: Content-Length, Content-Type, Cache-Control
- Credentials allowed with `allowCredentials: true`
- Max age: 3600 seconds

#### Security Headers (response-headers.ts)
- Applied to all responses via `addHeaders()` function
- Headers set:
  - Cache-Control: `no-store` (prevents caching)
  - Content-Security-Policy: Restrictive with script-src allowances
  - Strict-Transport-Security: `max-age=63072000; includeSubDomains; preload`
  - X-Content-Type-Options: `nosniff`
  - X-Frame-Options: `DENY`
  - Permissions-Policy: Restrictive (denies all features)
  - Referrer-Policy: `no-referrer`

### Route Configuration (routes.ts)

#### Endpoint Types
- `AWS_LAMBDA_FUNCTION_URL` - AWS Lambda function URLs
- `GCP_CLOUD_RUN_SERVICE_URL` - Google Cloud Run services
- `AZURE_CONTAINER_APPS_SERVICE_URL` - Azure Container Apps
- `OTHER` - Generic HTTP endpoints

#### Environment-Specific Routes
Three environments configured: local, dev, prod

**Local/Dev:**
- `/projects` → AWS Lambda (af-south-1)
- `/auth` → GCP Cloud Run (africa-south1)
- `/storage` → AWS Lambda (af-south-1)

**Production:**
- Different Lambda and Cloud Run endpoints
- Storage service not exposed in prod config

#### Path-Level Rules
Each service can define path rules for:
- `validateTurnstileToken` - Bot challenge requirement
- `validateAccessToken` - Token validation requirement
- `cacheable` - Cloudflare cache directive

Example (auth service):
```
/auth/login → Turnstile required
/auth/register → Turnstile required
/auth/forgot-password → Turnstile required
/auth/resend-verification → Access token required
```

### Configuration Management (config.ts)

#### Environment Variables Required
- `AWS_ACCESS_KEY_ID` - AWS IAM access key
- `AWS_SECRET_ACCESS_KEY` - AWS IAM secret key
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - GCP service account email
- `GOOGLE_SERVICE_ACCOUNT_KEY` - Base64-encoded GCP private key
- `AZURE_CLIENT_ID` - Azure app registration client ID
- `AZURE_CLIENT_SECRET` - Azure app registration client secret
- `AZURE_TENANT_ID` - Azure tenant ID
- `AZURE_ACA_AUDIENCE` - Azure Container Apps audience/target
- `CLOUDFLARE_TURNSTILE_SECRET_KEY` - Turnstile secret for bot challenge
- `ENVIRONMENT` - Deployment environment (local/dev/prod)

#### Security Headers Configuration
- CSP: Allows unsafe-inline for scripts (Cloudflare Insights), self-hosted fonts
- XSS Protection: Implicit (no XSS-Protection header needed)
- HSTS: 2 years with subdomains and preload

### Request Handler (request-handler.ts)

#### Processing Order (Critical)
1. Size limit validation (enforceRequestSizeLimit)
2. Rate limit check (enforceRateLimit)
3. CORS preflight/validation (handleCors)
4. Root path handling (renders HTML index page)
5. API route resolution (resolveApiRouteConfig)
6. Turnstile validation (if required)
7. Access token validation (if required)
8. Cloud-specific authentication (AWS/GCP/Azure signing)
9. Backend service fetch
10. Response header injection (addHeaders)

#### Caching Strategy
- Uses Cloudflare cache directive when `route.cacheable === true`
- Applied via `cf: { cacheEverything: true }` fetch option
- Currently only `/projects` endpoint is cacheable

#### Error Handling
- 404: Not Found (invalid routes)
- 401: Unauthorized (token validation failures)
- 403: Forbidden (CORS/Turnstile failures)
- 405: Method Not Allowed (unsupported HTTP methods)
- 413: Payload Too Large (size limit violation)
- 429: Rate Limit Exceeded
- 503: Service Unavailable (backend fetch failures)

### HTML Index Page (html-index-page.ts)
- Auto-generates links to API documentation endpoints
- Served at root path (`/`)
- Dynamically lists all configured APIs for current environment
- Styled with inline CSS, links to fromthehart.tech favicon

## Architectural Decisions

### Why Cloudflare Workers?
1. Global edge distribution for low-latency gateway
2. Built-in rate limiting via Durable Objects
3. Integrated DDoS protection
4. Flexible routing across cloud providers

### Multi-Cloud Authentication Strategy
- Each cloud provider handled separately to maintain independence
- Token caching reduces repeated authentication overhead
- Service account credentials injected via environment variables

### Pipeline Architecture
- Sequential validation stages prevent unnecessary backend calls
- Early termination on failures (size, rate limit, CORS)
- Turnstile and access token validation only when needed

## Current Limitations

### High Priority Issues

1. **[2025-11-22] Hardcoded service endpoints in routes.ts**
   - File: `src/routes.ts` lines 34-114
   - Issue: Endpoints duplicated across local/dev/prod
   - Impact: Maintenance burden, inconsistency risk
   - Fix: Move to centralized configuration or Terraform outputs

2. **[2025-11-22] No environment variable validation**
   - File: `src/config.ts`
   - Issue: Missing credentials cause runtime failures, not startup failures
   - Impact: Deployment failures in production
   - Fix: Validate all env vars exist before creating config

3. **[2025-11-22] No comprehensive error logging**
   - File: `src/request-handler.ts`
   - Issue: Errors caught silently, making debugging difficult
   - Impact: Debugging production issues extremely difficult
   - Fix: Add structured logging with correlation IDs

### Medium Priority Issues

4. **[2025-11-22] Token cache not scoped by environment**
   - Files: `src/gcp-auth.ts`, `src/azure-auth.ts`, `src/verify-access-token.ts`
   - Issue: Different environments could share cached tokens
   - Impact: Wrong tokens used across environments
   - Fix: Include environment in cache key

5. **[2025-11-22] CORS origins hardcoded in config**
   - File: `src/config.ts` line 29
   - Issue: Requires code change to add new allowed origins
   - Impact: Deployment overhead for origin whitelisting
   - Fix: Make configurable via environment variable

6. **[2025-11-22] No request tracing/observability**
   - File: `src/request-handler.ts`
   - Issue: No way to track requests across services
   - Impact: Troubleshooting distributed failures is slow
   - Fix: Implement W3C Trace Context or similar

### Low Priority Issues

7. **[2025-11-22] Tests completely commented out**
   - File: `test/index.spec.ts`
   - Issue: No automated test coverage
   - Impact: Regressions not caught
   - Fix: Implement Vitest + @cloudflare/vitest-pool-workers tests

8. **[2025-11-22] No API versioning strategy**
   - File: `src/routes.ts`
   - Issue: Cannot deprecate endpoints gracefully
   - Impact: Breaking changes require coordinated deployments
   - Fix: Add version prefix to routes

## Performance Notes

### Cold Start Implications
- Cloudflare Workers have sub-millisecond cold starts
- Initialization cost: Crypto operations for key imports may be noticeable
- Token caching reduces repeated authentication overhead

### Request Size
- 1MB limit suitable for API metadata, but might constrain large POST bodies
- Consider increasing for file upload metadata scenarios

### Backend Latency
- Gateway adds minimal latency (routing + auth signing)
- Backend service latency dominates (AWS Lambda cold start, GCP Cloud Run)
- Caching `/projects` endpoint helps with repeated queries

## Testing Coverage

### Current State
- No active tests (test file is placeholder)
- No unit test coverage for:
  - AWS SigV4 signing
  - GCP JWT generation
  - CORS logic
  - Rate limiting
  - Route resolution

### Recommended Test Categories
1. **Unit Tests**: Auth signing, JWT generation, token hashing
2. **Integration Tests**: Full request flow with mocked backends
3. **Security Tests**: CORS enforcement, token validation, size limits
4. **Load Tests**: Rate limiter effectiveness under load

## Configuration Environments

### Local Development (env.local)
- ENVIRONMENT: "local"
- Rate limit: 10 req/min
- Namespace ID: 1001
- Used with `npm run dev -- --env local`

### Development (env.dev)
- ENVIRONMENT: "dev"
- Rate limit: 100 req/min
- Domain: dev-api.fromthehart.tech
- Turnstile validation: ENABLED for auth endpoints
- Used for staging deployments

### Production (env.prod)
- ENVIRONMENT: "prod"
- Rate limit: 200 req/min
- Domain: api.fromthehart.tech
- CORS: Only www.fromthehart.tech allowed
- Turnstile validation: ENABLED for auth endpoints
- No storage endpoint exposed
