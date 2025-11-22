# CLAUDE.md - From The Hart API Reverse Proxy Worker

This file provides guidance to Claude Code when working with the Reverse Proxy Worker in this repository.

## Service Overview

The **From The Hart API Reverse Proxy Worker** is a Cloudflare Worker that acts as an intelligent API gateway for the From The Hart ecosystem. It routes incoming requests from the frontend to appropriate backend services across multiple cloud providers (AWS Lambda, Google Cloud Run), handles authentication, implements CORS policies, manages caching strategies, and provides a unified entry point for all API traffic.

### Key Responsibilities
- **Request Routing**: Direct requests to appropriate backend services (AWS Lambda, Google Cloud Run)
- **Authentication**: Manage and validate JWT tokens from Firebase
- **Cloud Provider Integration**: Handle AWS SigV4 signing for Lambda requests and GCP token management
- **CORS Management**: Implement proper CORS headers for browser-based requests
- **Caching Strategy**: Optimize performance with intelligent caching rules
- **Edge Computation**: Leverage Cloudflare's global edge network for low-latency responses
- **Request/Response Transformation**: Modify headers, authentication schemes, and content as needed
- **Error Handling**: Graceful error responses and fallback strategies

### Architecture
- **Platform**: Cloudflare Workers (serverless edge computing)
- **Routing**: Path-based routing to AWS Lambda and Google Cloud Run
- **Authentication**: Firebase JWT validation before proxying to backends
- **Caching**: Cloudflare Cache API with custom TTL policies
- **Type Safety**: TypeScript with Cloudflare Workers types

## Technology Stack

### Core Technologies
- **Runtime**: Cloudflare Workers (V8 engine)
- **Language**: TypeScript
- **Build Tool**: Wrangler CLI
- **Build Transpiler**: esbuild (via Wrangler)
- **Type Definitions**: Cloudflare Workers types
- **API Authentication**: AWS SigV4 signing, GCP service account tokens
- **Caching**: Cloudflare Cache API

### Development Tools
- **Testing**: Vitest with @cloudflare/vitest-pool-workers
- **Type Generation**: Wrangler types command
- **Local Dev**: Wrangler dev server

### Cloudflare Services
- **Workers**: Serverless function execution
- **Cache**: Response caching at edge
- **KV**: Key-value storage for configuration/tokens
- **Environment**: Environment-specific deployment
- **Routes**: Domain routing to worker

## Project Structure

```
from-the-hart-tech-api-reverse-proxy-worker/
├── src/
│   ├── index.ts                    # Main worker entry point (fetch handler)
│   ├── routes.ts                   # Route definitions and routing logic
│   ├── requestHandler.ts           # Core request processing pipeline
│   ├── aws-auth.ts                 # AWS SigV4 authentication for Lambda
│   ├── gcp-auth.ts                 # GCP token management for Cloud Run
│   ├── caching.ts                  # Caching strategy and implementation
│   ├── cors.ts                     # CORS header management
│   ├── config.ts                   # Configuration variables and constants
│   ├── types.ts                    # TypeScript type definitions
│   └── utils.ts                    # Utility functions
├── test/
│   ├── index.spec.ts               # Main worker tests
│   ├── routes.spec.ts              # Route tests
│   ├── auth.spec.ts                # Authentication tests
│   ├── cors.spec.ts                # CORS tests
│   └── env.d.ts                    # Test environment type definitions
├── .env                            # Local environment configuration
├── .env.example                    # Environment template
├── wrangler.toml                   # Wrangler configuration
├── wrangler.local.toml             # Local development config
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Vitest configuration
└── README.md                       # Worker documentation
```

## Common Commands

### Installation & Setup
```bash
# Install dependencies
npm install

# Generate Cloudflare Workers type definitions
npm run cf-typegen

# Set up environment
cp .env.example .env
# Edit .env with your configuration
```

### Development
```bash
# Start local development server
npm run dev

# Local server available at:
# http://127.0.0.1:8787

# Wrangler dashboard available at:
# http://127.0.0.1:8787

# Test environment variable override
npm run dev -- --env local
```

### Building
```bash
# Compile TypeScript
npm run build

# This generates JavaScript files ready for deployment
# Includes type checking and bundling
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- routes.spec.ts

# Run with coverage (requires coverage support)
npm test -- --coverage
```

### Type Generation
```bash
# Generate Cloudflare Workers types
npm run cf-typegen

# Regenerate types after wrangler.toml changes
# Useful for new bindings (KV, R2, etc.)
```

### Deployment
```bash
# Deploy to Cloudflare (production)
npm run deploy

# Deploy to specific environment
npm run deploy -- --env production

# Dry-run deployment (preview)
wrangler deploy --dry-run

# Check deployment status
wrangler deployments list
```

## Environment Variables & Configuration

### wrangler.toml Configuration
```toml
name = "from-the-hart-tech-api-reverse-proxy-worker"
main = "src/index.ts"
compatibility_date = "2025-04-14"
workers_dev = false

[[routes]]
pattern = "api.fromthehart.tech/*"
custom_domain = true

[env.local]
vars = { ENVIRONMENT = "local" }

[env.development]
vars = { ENVIRONMENT = "development" }

[env.production]
vars = { ENVIRONMENT = "production" }
```

### Environment Variables

**Required Configuration**
- `ENVIRONMENT` - Deployment environment (local, development, production)
- `AWS_REGION` - AWS region for Lambda services
- `GCP_PROJECT_ID` - Google Cloud project ID
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

**Service Endpoints**
- `AUTH_SERVICE_URL` - Google Cloud Run auth service endpoint
- `PROJECTS_SERVICE_URL` - AWS Lambda projects service endpoint
- `STORAGE_SERVICE_URL` - AWS Lambda storage service endpoint
- `API_DOMAIN` - Main API domain (e.g., api.fromthehart.tech)

**Authentication Credentials**
- `AWS_ACCESS_KEY_ID` - AWS access key for SigV4 signing
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for SigV4 signing
- `GCP_SERVICE_ACCOUNT_KEY` - GCP service account JSON (base64 encoded)
- `FIREBASE_PROJECT_ID` - Firebase project for token validation

**Caching Configuration**
- `CACHE_DEFAULT_TTL` - Default cache TTL in seconds (default: 3600)
- `CACHE_API_TTL` - Cache TTL for API responses (default: 300)
- `CACHE_STATIC_TTL` - Cache TTL for static assets (default: 86400)

**CORS Configuration**
- `CORS_ORIGIN` - Allowed origin(s) (can be comma-separated)
- `CORS_ALLOW_METHODS` - Allowed HTTP methods
- `CORS_ALLOW_HEADERS` - Allowed request headers

### Using Cloudflare KV Storage
```toml
[[kv_namespaces]]
binding = "CONFIG_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-namespace-id"
```

Accessing in code:
```typescript
const cachedConfig = await CONFIG_KV.get('api-config');
```

## Local Development Setup

### Prerequisites
- Node.js v16+ (check with `node --version`)
- npm v8+ (included with Node.js)
- Wrangler CLI v3+ (`npm install -g @cloudflare/wrangler`)
- Cloudflare account with Workers enabled
- AWS credentials (for testing AWS SigV4 signing)
- GCP service account (for testing GCP authentication)

### Initial Setup
```bash
# Clone repository
git clone https://github.com/Saosin88/from-the-hart-tech-api-reverse-proxy-worker.git
cd from-the-hart-tech-api-reverse-proxy-worker

# Install dependencies
npm install

# Generate Cloudflare types
npm run cf-typegen

# Create environment file
cp .env.example .env

# Configure your environment:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - GCP_SERVICE_ACCOUNT_KEY (base64 encoded)
# - FIREBASE_PROJECT_ID
# - Service URLs for auth, projects, storage
```

### Running Locally
```bash
# Start local development server
npm run dev

# Worker is now at http://127.0.0.1:8787

# Test routing to different services
curl http://127.0.0.1:8787/auth/register
curl http://127.0.0.1:8787/projects
curl http://127.0.0.1:8787/storage/upload
```

### Testing Service Routing
```bash
# Test auth service routing
curl -X POST http://127.0.0.1:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!@#"}'

# Test projects service routing
curl http://127.0.0.1:8787/projects?page=1

# Test storage service routing
curl -F "file=@test.txt" http://127.0.0.1:8787/storage/upload

# Test with authorization header
curl -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8787/api/v1/endpoint
```

### Testing CORS
```bash
# Send preflight request
curl -X OPTIONS http://127.0.0.1:8787/auth/register \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Check CORS headers in response
```

### Testing Caching
```bash
# First request (cache miss)
curl -X GET http://127.0.0.1:8787/projects \
  -v 2>&1 | grep -i "cache-control"

# Second request (should show cache hit if cached)
# Check response headers for cache information
```

## Testing Approach

### Unit Tests
Tests verify routing, authentication, caching, and CORS logic:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- routes.spec.ts

# Run in watch mode
npm test -- --watch
```

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { handleRequest } from '../src/index';

describe('Reverse Proxy Worker', () => {
  it('should route /auth/* to auth service', async () => {
    const request = new Request('http://api.example.com/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'test' })
    });

    const response = await handleRequest(request);

    expect(response.status).toBeLessThan(500); // Should be routed successfully
  });

  it('should add CORS headers to response', async () => {
    const request = new Request('http://api.example.com/projects');
    const response = await handleRequest(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('should validate JWT tokens', async () => {
    const request = new Request('http://api.example.com/projects', {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });

    const response = await handleRequest(request);

    expect(response.status).toBe(401);
  });

  it('should cache API responses', async () => {
    const request = new Request('http://api.example.com/projects');
    const response = await handleRequest(request);

    expect(response.headers.get('Cache-Control')).toBeTruthy();
  });
});
```

### Test Environment
```typescript
// env.d.ts - Type definitions for test environment
export interface Env {
  ENVIRONMENT: string;
  AWS_REGION: string;
  GCP_PROJECT_ID: string;
  AUTH_SERVICE_URL: string;
  PROJECTS_SERVICE_URL: string;
  STORAGE_SERVICE_URL: string;
}
```

## Deployment Information

### Deployment Pipeline

**Local Development**
```bash
npm run dev
# Worker runs at http://127.0.0.1:8787
```

**Staging Deployment**
```bash
npm run deploy -- --env staging
# Requires staging configuration in wrangler.toml
```

**Production Deployment**
```bash
npm run deploy
# Deploys to production route(s) defined in wrangler.toml
# Available at api.fromthehart.tech
```

### Cloudflare Deployment Configuration

**Route Configuration**
- Pattern: `api.fromthehart.tech/*`
- Custom domain enabled
- Zone ID configured in wrangler.toml

**Triggers**
- GitHub Actions on main branch push (automated via CI/CD)
- Manual deployment: `npm run deploy`

**Rollback Strategy**
```bash
# List deployments
wrangler deployments list

# Check current active deployment
wrangler deployments status <deployment-id>

# Rollback to previous deployment
# Available through Cloudflare dashboard
```

### Performance Optimization

**Caching Strategy**
- Static assets: 24 hours (86400 seconds)
- API responses: 5 minutes (300 seconds) - configurable per endpoint
- No cache: Dynamic endpoints, user-specific data

**Request Optimization**
- Reduce payload size with gzip compression
- Implement request deduplication
- Cache authentication tokens in KV storage

**Monitoring & Metrics**
- Cloudflare Analytics available in dashboard
- Real-time request logs
- Performance metrics (response time, error rate)

### Production Deployment Checklist
- [ ] Run tests: `npm test`
- [ ] Build successfully: `npm run build`
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] Environment variables configured in Cloudflare
- [ ] AWS credentials validated for SigV4 signing
- [ ] GCP service account key configured
- [ ] Backend service URLs verified
- [ ] CORS policies reviewed
- [ ] Caching TTLs appropriate
- [ ] Error handling covers edge cases
- [ ] Monitoring alerts configured in Cloudflare

### Scaling Considerations
- **Geographic Distribution**: Cloudflare automatically routes to nearest edge
- **Request Limits**: Monitor Cloudflare usage limits
- **KV Reads/Writes**: Monitor KV quota if caching config in KV
- **Rate Limiting**: Consider implementing rate limiting per origin
- **Timeout**: Default 30 seconds, increase if needed for slow backends

## Claude Code Integration Notes

### .claude Directory
Commands and context files are located in `.claude/commands/`:
- Custom slash commands for common Wrangler operations
- Integration with Claude Code agents

### Useful Patterns for Agent Work

**Understanding Cloudflare Workers**
- Main handler: `src/index.ts` (exports `fetch` function)
- Routes handled in `src/routes.ts`
- Request transformations in `src/requestHandler.ts`

**Authentication Flows**
- AWS SigV4 signing in `src/aws-auth.ts`
- GCP token generation in `src/gcp-auth.ts`
- JWT validation before routing

**Request Flow**
```
Incoming Request
  ↓
CORS Preflight Check
  ↓
JWT Token Validation
  ↓
Route Matching
  ↓
Add Authentication Headers
  ↓
Forward to Backend Service
  ↓
Cache Response (if applicable)
  ↓
Return Response with CORS Headers
```

### Common Claude Code Tasks

**Adding New Backend Service Route**
1. Define route in `src/routes.ts`
2. Determine authentication type (AWS, GCP, none)
3. Add handler in `src/requestHandler.ts`
4. Add tests in `test/routes.spec.ts`
5. Update `wrangler.toml` if custom domain routing needed

**Modifying Authentication**
- AWS SigV4: Update `src/aws-auth.ts`
- GCP: Update `src/gcp-auth.ts`
- JWT validation: Update token validation logic
- Test changes thoroughly before deploying

**Updating Caching Strategy**
- Configure TTLs in `src/caching.ts`
- Define cache rules per route
- Test cache hits/misses with multiple requests
- Monitor cache effectiveness

**Adding CORS Rules**
- Update `src/cors.ts` with new origin
- Configure allowed methods and headers
- Test with preflight requests
- Verify with browser DevTools

### Debugging Tips
- Enable debug logging: Check Cloudflare's real-time logs
- Test locally first: `npm run dev` before deploying
- Validate requests: Use curl or Postman to test routes
- Check backend connectivity: Verify service URLs are correct
- Monitor Cloudflare dashboard for error rates
- Use browser DevTools to inspect CORS headers
- Test authentication: Verify JWT tokens are valid

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | Main worker entry point |
| `src/routes.ts` | Route definitions and routing logic |
| `src/requestHandler.ts` | Core request processing |
| `src/aws-auth.ts` | AWS SigV4 authentication |
| `src/gcp-auth.ts` | GCP token management |
| `src/caching.ts` | Caching strategy and implementation |
| `src/cors.ts` | CORS header management |
| `src/config.ts` | Configuration constants |
| `src/types.ts` | TypeScript type definitions |
| `wrangler.toml` | Cloudflare Workers configuration |
| `test/index.spec.ts` | Main tests |

## Related Services

This service integrates with:
- **Auth Service** (`from-the-hart-auth`): Routes to Google Cloud Run
- **Projects Service** (`from-the-hart-projects`): Routes to AWS Lambda
- **Storage Service** (`from-the-hart-storage`): Routes to AWS Lambda
- **Tech Website** (`from-the-hart-tech-website`): Makes API requests through this worker
- **Infrastructure** (`from-the-hart-infrastructure`): Manages Cloudflare DNS and worker deployment
