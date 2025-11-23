# From The Hart API Reverse Proxy Worker

Cloudflare Worker acting as intelligent API gateway for multi-cloud backend services.

## Overview

**Responsibilities:**
- Request routing to AWS Lambda and Google Cloud Run
- Authentication (JWT validation, cloud provider signing)
- CORS management
- Caching strategy
- Edge computation for low-latency responses

**Architecture:** Cloudflare Workers (TypeScript) → Backend Services (AWS/GCP)

## Technology Stack

- **Runtime:** Cloudflare Workers (V8 engine)
- **Language:** TypeScript
- **Build:** Wrangler CLI with esbuild
- **Testing:** Vitest with @cloudflare/vitest-pool-workers
- **Auth:** AWS SigV4 signing, GCP service account tokens

## Common Commands

```bash
# Development
npm install                          # Install dependencies
npm run dev                          # Start local Wrangler dev server
npm run cf-typegen                   # Generate Cloudflare types

# Building & Deployment
npm run build                        # Build TypeScript
npm run deploy                       # Deploy to Cloudflare
npm run deploy -- --env production   # Deploy to specific environment

# Testing
npm test                             # Run tests
npm test -- --watch                  # Watch mode
```

## Environment Variables

**Required:**
- `AWS_ACCESS_KEY_ID` - AWS access key for SigV4 signing
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `GCP_SERVICE_ACCOUNT_KEY` - GCP service account JSON (base64)
- `FIREBASE_PROJECT_ID` - Firebase project for token validation

**Service Endpoints:**
- `AUTH_SERVICE_URL` - Google Cloud Run auth endpoint
- `PROJECTS_SERVICE_URL` - AWS Lambda projects endpoint
- `STORAGE_SERVICE_URL` - AWS Lambda storage endpoint

**Configuration:**
- `ENVIRONMENT` - local, development, production
- `CORS_ORIGIN` - Allowed origin(s)
- `CACHE_DEFAULT_TTL` - Default cache TTL (seconds)

## Local Development

```bash
npm install
npm run cf-typegen
cp .env.example .env
# Edit .env with credentials
npm run dev
```

**Worker available at:** http://127.0.0.1:8787

## Request Flow

```
Client → Cloudflare Worker
  1. CORS preflight check
  2. JWT token validation
  3. Route matching
  4. Add cloud auth headers (AWS SigV4 or GCP tokens)
  5. Forward to backend
  6. Cache response
  7. Return with CORS headers
```

## Deployment

```bash
# Deploy to production
npm run deploy

# Rollback
wrangler deployments list
# Use Cloudflare dashboard to rollback
```

## Related Services

- **Auth Service:** Routes to Google Cloud Run
- **Projects Service:** Routes to AWS Lambda
- **Storage Service:** Routes to AWS Lambda
- **Tech Website:** Makes API requests through this worker
- **Infrastructure:** Manages Cloudflare DNS and worker deployment
