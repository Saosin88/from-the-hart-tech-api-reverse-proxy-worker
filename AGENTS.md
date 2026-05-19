# From The Hart API Reverse Proxy Worker

> **Hierarchy:** Service-specific rules for the API gateway. Extends [master AGENTS.md](../AGENTS.md).
> Rules here take precedence over both master and personal AGENTS.md.
> **Stack:** TypeScript + Cloudflare Workers. When reading the master AGENTS.md, Rust/Vue/Terraform sections apply to other services.
>
> Cloudflare Worker acting as API gateway for multi-cloud backend services.
> Domain glossary: [CONTEXT.md](./CONTEXT.md).

## Responsibilities

- Route requests to AWS Lambda, GCP Cloud Run, Azure Container Apps
- Cloud provider auth (AWS SigV4, GCP ID tokens)
- JWT ID Token validation (cached)
- Cloudflare Turnstile bot protection
- Rate limiting
- Request size limiting (1MB max)
- CORS management
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Edge caching

## Tech Stack

- **Runtime:** Cloudflare Workers (V8 isolates)
- **Language:** TypeScript
- **Build:** Wrangler CLI
- **Testing:** Vitest with `@cloudflare/vitest-pool-workers`

## Common Commands

```bash
npm install              # Install deps
npm run dev              # Local dev (wrangler dev --env local)
npm run deploy           # Deploy to Cloudflare
npm test                 # Run tests
npm run cf-typegen       # Generate Cloudflare types
```

## Request Lifecycle

### Pipeline

The ordered sequence of independent stages that every request passes through. Each stage either accepts (continuing to the next stage) or rejects (returning an error response, terminating the pipeline). Stages run before the backend forward are pre-request guards; the final stage post-processes the backend response.

Sequence: pre-request guards → route resolution → provider credential generation + forward → response post-processing.

Implemented in `src/request-handler.ts`. Each stage maps to a dedicated file.

### Route Resolution

Routes are defined in `src/routes.ts` → `apiEndpointsMap`. Three environments: `local`, `dev`, `prod`, each with its own service endpoints.

**Route Prefix:** The base path segment that maps an incoming request to a backend service (e.g., `/auth` maps to the Auth Service). Each Route Prefix has one `serviceEndpoint` and one `ApiEndpointType`.

**Path Rule:** A per-path override of a Route Prefix setting. Defined in a Route Prefix's `pathRules` map. Can override `validateTurnstileToken`, `validateAccessToken`, and `cacheable` for a specific sub-path without changing the Route Prefix's defaults.

Example configuration:

```typescript
'/auth': {
  serviceEndpoint: 'https://...',
  endpointType: ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL,
  validateAccessToken: false,
  validateTurnstileToken: true,
  pathRules: {
    '/auth/login': { validateTurnstileToken: false },
  },
}
```

### Error Envelope

The canonical error response shape returned when any pipeline stage rejects a request. Always a JSON object:

```json
{ "error": { "message": "Unauthorized" } }
```

Produced by every pipeline stage that can reject a request. Injected with security and CORS headers before being returned to the client. Matches the error shape used by the Auth Service.

### Caching

Two distinct caching mechanisms:

**Edge Cache:** Response caching at the Cloudflare edge network for cacheable routes. Enabled via `cf.cacheEverything: true` on the `fetch()` to the backend service. The cached response is returned directly by Cloudflare — the request never reaches the Gateway. Currently only the `/projects` route uses this (24h TTL).

**Internal Cache:** The Gateway's use of the Cloudflare Cache API to store its own computational results for reuse. Stores two things: ID Token validation responses (keyed by SHA-256 hash of the token) and Provider Credentials (keyed by service account). Reduces latency to backend services by avoiding redundant validation and token minting. Populated by `verify-id-token.ts`, `gcp-auth.ts`, and `azure-auth.ts`. Cleared implicitly by Cache-Control `max-age`.

### Rate Limiting

Enforcement of request quotas per client. Keyed by `path|token` when the request carries an ID Token, or `path|IP` when it doesn't. Authenticated requests are keyed by the ID Token itself — not the Principal UID — so the same Principal using a different token gets a fresh bucket.

Implemented via Cloudflare's Rate Limiting API. Returns 429 with the canonical Error Envelope when exceeded. Enforced at pipeline stage 2, before route resolution or validation.

### Provider Credentials

Authentication of the Gateway *itself* to backend services. Each provider type uses a different mechanism:

- **AWS:** SigV4 request signing (cryptographic, no header token) via `aws-auth.ts`
- **GCP:** ID Token via `X-Serverless-Authorization` header via `gcp-auth.ts`
- **Azure:** OAuth2 access token via `Authorization` header via `azure-auth.ts`

Generated per-request depending on the route's `ApiEndpointType`. Cached in the Internal Cache for their respective expiry windows.

### ID Token Validation

Validates the ID Token JWT by proxying to Auth Service's `/auth/verify-id-token` endpoint. The validation response is cached in the Internal Cache with a 5-minute safety buffer — tokens are considered expired 5 minutes before their actual expiry to avoid serving near-expired results.

## Flow Diagram

```
Client → Cloudflare Worker
  1. Enforce size limit
  2. Enforce rate limit
  3. Handle CORS preflight
  4. Match route in apiEndpointsMap[environment]
  5. Validate Turnstile token (if route requires)
  6. Validate JWT ID token (if route requires, cached)
  7. Add cloud auth headers (AWS SigV4 or GCP ID token)
  8. Forward to backend service
  9. Return response with security + CORS headers
```

## Adding a New Backend

1. Add entry to `apiEndpointsMap` for all three environments
2. If new cloud provider, add `ApiEndpointType` variant + auth handler in dedicated file
3. Update `config.ts` if new secrets needed
4. Update Terraform in `from-the-hart-infrastructure` (Cloudflare provider)

## Key Files

```
src/
├── index.ts              # Entry point: createConfig → handleRequest
├── config.ts             # Config from env vars + typed config object
├── routes.ts             # Route map + resolution logic
├── request-handler.ts    # Main request pipeline (order matters)
├── aws-auth.ts           # AWS SigV4 signing
├── gcp-auth.ts           # GCP ID token generation
├── azure-auth.ts         # Azure token generation
├── verify-id-token.ts # JWT validation with caching
├── cloudflare-turnstile.ts # Turnstile token validation
├── rate-limiter.ts       # Rate limiting
├── size-limit.ts         # Request body size enforcement
├── response-headers.ts   # CORS + security headers
├── html-index-page.ts    # API documentation index page
├── types.ts              # Shared types
└── utils.ts              # Helpers (getBearerToken, etc.)
```

## Boundaries

- ✅ **Always:** Run `npm test` before changes. Follow the pipeline order (size limit → rate limit → CORS → route → auth → forward). Use the canonical Error Envelope shape for all error responses.
- ⚠️ **Ask first:** Adding new routes, changing rate limit thresholds, modifying cache TTLs, adding a new cloud provider type.
- 🚫 **Never:** Hard-code service endpoints (use env-specific `apiEndpointsMap`). Skip pipeline stages. Return non-standard error shapes.
