# Reverse Proxy Worker Decisions

Last updated: 2025-11-22

## Decisions Made

### [2025-11-22] Multi-cloud authentication strategy adopted
- Separate auth modules for AWS, GCP, and Azure
- Each cloud provider handled independently via environment-specific configuration
- Rationale: Decouples cloud provider changes, enables gradual migration if needed
- Trade-off: Slight code duplication in token caching logic

### [2025-11-22] Cloudflare Workers selected as API gateway platform
- Decision point: Edge computing vs centralized gateway
- Chosen for: Global distribution, built-in rate limiting, DDoS protection
- Alternative considered: AWS API Gateway (single region, lower latency but region-locked)
- Trade-off: Limited to Cloudflare Workers APIs, smaller execution environment

### [2025-11-22] Sequential validation pipeline architecture
- Validation order: Size → Rate Limit → CORS → Routing → Turnstile → Access Token → Auth Signing
- Rationale: Early termination on failures reduces unnecessary processing
- Decision: Fail fast before expensive operations (crypto signing, backend calls)
- Trade-off: Cannot parallelize validation stages

### [2025-11-22] Token caching using Cloudflare Cache API
- Cache implementation for: GCP tokens (1-hour TTL), Azure tokens (variable TTL), access token verification
- Decision: Use Cloudflare's native cache over external KV store
- Rationale: Lower latency, no additional costs, automatic cleanup
- Trade-off: Limited visibility into cache hit rates, no explicit TTL control

### [2025-11-22] Hardcoded endpoint configuration in routes.ts
- Three environments defined: local, dev, prod
- Each with separate endpoint URLs for Lambda/Cloud Run services
- Rationale: Simple configuration, no external dependencies
- Trade-off: Requires code change for endpoint updates, not infrastructure-aware

### [2025-11-22] AWS SigV4 signing for Lambda Function URLs
- Implementation in aws-auth.ts uses crypto.subtle API
- Rationale: Lambda Function URLs require AWS SigV4 authentication, workers support crypto.subtle
- Decision: Manual implementation vs AWS SDK (workers don't support SDK)
- Trade-off: Custom implementation requires careful header handling, higher maintenance

### [2025-11-22] GCP identity token strategy for Cloud Run
- Decision: Use JWT with service account credentials for identity token
- Alternative: OAuth2 client credentials (wrong token type for Cloud Run)
- Rationale: Cloud Run requires identity tokens, not access tokens
- Trade-off: Requires base64-decoded private key, more complex JWT construction

### [2025-11-22] Turnstile bot challenge enabled for sensitive endpoints
- Enabled for: /auth/login, /auth/register, /auth/forgot-password
- Disabled for: /auth/resend-verification (requires access token instead)
- Rationale: Protects authentication endpoints from brute force attacks
- Trade-off: User experience impact, requires client-side Turnstile widget

### [2025-11-22] Rate limiting by authenticated user OR client IP
- If bearer token present: Rate limit key includes token
- If no token: Rate limit key includes client IP
- Rationale: Protects individual users from misbehavior, prevents IP-based bypass
- Trade-off: Token-based limiting requires bearer token on all requests for predictability

### [2025-11-22] No request body caching for mutable endpoints
- Only GET-like endpoints cached: `/projects` → cacheable: true
- POST/PUT endpoints: cacheable: false
- Rationale: Prevents stale data from being served on state-changing operations
- Trade-off: Higher backend load for write-heavy workloads

### [2025-11-22] Environment-based CORS and rate limit configuration
- Local: 10 req/min, both localhost and dev allowed
- Dev: 100 req/min, dev.fromthehart.tech allowed
- Prod: 200 req/min, only www.fromthehart.tech allowed
- Rationale: Progressive security hardening from dev to prod
- Trade-off: Manual environment management, no automatic scaling

### [2025-11-22] Preserve original Authorization header as X-From-The-Hart-Authorization
- When AWS/Azure authentication added: original header moved to custom header
- Rationale: Allows backend services to access original client auth for logging/audit
- Trade-off: Extra header in requests, requires backend coordination

### [2025-11-22] 1MB maximum request body size
- Configuration in config.ts: `maxBodySize: 1024 * 1024`
- Two-stage validation: content-length header + actual buffer check
- Rationale: Prevent memory exhaustion, typical API payload size
- Trade-off: Blocks legitimate large file uploads (require separate upload service)

### [2025-11-22] Strict CSP with unsafe-inline for scripts only
- CSP allows: Self scripts, unsafe-inline (required for Cloudflare Insights), cloudflareinsights.com
- Rationale: Cloudflare analytics requires script-src settings
- Trade-off: Allows inline scripts but NOT styles (must be referenced)

## Pending Decisions

### Error Logging and Observability Strategy
- Current: Errors logged to console, no structured logging
- Decision needed: Implement W3C Trace Context? Use Cloudflare Logpush?
- Impact: Critical for production debugging and monitoring
- Options:
  1. Console.log with JSON formatting (simple, no external deps)
  2. Cloudflare Logpush to S3 (integrated, but cost per log)
  3. Structured logging with correlation IDs (more complex, better tracing)

### Environment Variable Validation Timing
- Current: No validation until config creation
- Decision needed: Validate at worker startup or lazily on first request?
- Impact: Early validation fails fast, lazy validation enables graceful degradation
- Options:
  1. Strict validation at startup (fail-fast)
  2. Lazy validation on first request (resilience)
  3. Try-catch with fallback configuration (graceful degradation)

### CORS Origins Configuration
- Current: Hardcoded in config.ts
- Decision needed: Move to environment variable? Terraform outputs? Dynamic discovery?
- Impact: Adds origins without code change
- Options:
  1. Comma-separated env var (simple, limited formatting)
  2. JSON env var (more flexible, parsing overhead)
  3. Cloudflare KV store (dynamic, costs, operational overhead)

### API Versioning Strategy
- Current: No version in URL or header
- Decision needed: Implement versioning? How to deprecate endpoints?
- Impact: Enables non-breaking changes in future
- Options:
  1. URL path versioning: `/v1/auth/login`, `/v2/auth/login`
  2. Header versioning: `Accept-Version: 1` header
  3. Subdomain versioning: `v1.api.fromthehart.tech`

### Request Tracing Approach
- Current: No trace context propagation
- Decision needed: Implement W3C Trace Context? Custom header?
- Impact: Critical for monitoring distributed requests
- Options:
  1. W3C Trace Context standard (widely supported)
  2. Custom X-Request-ID header (simpler, non-standard)
  3. CloudFlare's native request ID (integrated but proprietary)

### Token Cache Security
- Current: No signature verification of cached tokens
- Decision needed: HMAC sign cached tokens? Use content-addressed cache keys?
- Impact: Prevents potential cache poisoning
- Options:
  1. No additional security (current, trust Cloudflare cache)
  2. HMAC sign token responses (added security, slight overhead)
  3. Encrypt cached tokens (maximum security, decryption overhead)

### Maximum Concurrent Backend Requests
- Current: No limit, Cloudflare Workers has CPU time limits (50ms)
- Decision needed: Implement request queuing? Timeout strategy?
- Impact: Prevents thundering herd under high load
- Options:
  1. No limit (current, rely on Cloudflare timeout)
  2. Queue with max concurrency (complexity, latency)
  3. Timeout per backend request (causes 503 errors)

### Test Coverage Strategy
- Current: No tests (file is template only)
- Decision needed: What test framework setup? Mock strategy for backends?
- Impact: Enables safe refactoring and CI/CD
- Options:
  1. Vitest with @cloudflare/vitest-pool-workers (native support)
  2. Jest with custom Cloudflare Workers setup (more complex)
  3. Manual testing via `npm run dev` (no CI coverage)

## Rationale Documentation

### Why Sequential Pipeline Over Parallel Validation
- Sequential order ensures dependencies are met (e.g., CORS check before route resolution)
- Parallel validation would require error aggregation logic
- Performance gain minimal since first validation is fastest (size check)
- Simplicity and maintainability favored

### Why Service Account Credentials in Environment Variables
- Terraform can inject during deployment
- Alternative: Cloudflare KV store (adds latency, extra API calls)
- Trade-off: Credentials in memory longer, but standard practice for workers
- Mitigated by: Restrict IAM permissions, rotate keys regularly

### Why No Request Deduplication
- Cloudflare Workers edge location provides request caching
- Additional deduplication logic adds complexity
- Same request to same endpoint would come from same user (rare)
- Rationale: Benefit too low for complexity cost

### Why Cloudflare Cache API Over Durable Objects
- Durable Objects more expensive (per-request billing)
- Cache API included in Workers pricing
- TTL management is simpler with native cache
- Trade-off: No per-region cache invalidation, must wait for TTL expiry
