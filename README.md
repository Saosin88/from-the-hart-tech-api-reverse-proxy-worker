# From The Hart Tech API Reverse Proxy Worker

A Cloudflare Worker that serves as an API gateway, routing requests between different backend services in the From The Hart multi-cloud architecture.

![Status](https://img.shields.io/badge/Status-Live-success)
![Platform](https://img.shields.io/badge/Platform-Cloudflare_Workers-orange)
![Architecture](https://img.shields.io/badge/Architecture-Multi--Cloud-blue)

## 🔍 Overview

This worker acts as a central API gateway for the From The Hart ecosystem, handling:

- **API Routing**: Directs requests to appropriate backend services (AWS Lambda, Google Cloud Run)
- **Authentication Handling**: Manages authentication tokens and forwards credentials to backend services
- **Cross-Origin Resource Sharing (CORS)**: Implements proper CORS headers for web client access
- **Caching Strategy**: Optimizes performance with configurable caching rules
- **Cloud Provider Authentication**: Handles authentication with AWS and GCP services
- **Edge Computing**: Leverages Cloudflare's global edge network for low-latency responses

This service is a critical component of the From The Hart multi-cloud architecture, providing a unified entry point for API requests across cloud platforms.

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Build Tools**: Wrangler CLI
- **Testing**: Vitest
- **Infrastructure**: Managed with Terraform (in the `from-the-hart-infrastructure` repository)

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)

## 🚀 Getting Started

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Saosin88/from-the-hart-tech-api-reverse-proxy-worker.git
cd from-the-hart-tech-api-reverse-proxy-worker
npm install
```

### Local Development

To start the development server:

```bash
npm run dev
```

This will start a local development server using Wrangler.

## 🧪 Testing

Run tests with:

```bash
npm test
```

The project uses Vitest for testing with the Cloudflare Workers-specific test pool.

## 📦 Deployment

To deploy the worker to Cloudflare:

```bash
npm run deploy
```

This will build and deploy the worker using Wrangler CLI.

## 🌐 Infrastructure

This worker is deployed on Cloudflare's global edge network and is configured through the `from-the-hart-infrastructure` repository using Terraform.

### Cloud Provider Details

- **Primary Platform**: Cloudflare Workers
- **Deployment Model**: Global edge deployment
- **Infrastructure as Code**: Terraform (remote state in AWS S3)
- **Integration Points**: AWS Lambda, Google Cloud Run

## ⚙️ Configuration

The worker is configured in `wrangler.toml` and through environment variables:

```toml
name = "from-the-hart-tech-api-reverse-proxy-worker"
main = "src/index.ts"
compatibility_date = "2025-04-14"
workers_dev = false

[[routes]]
pattern = "api.fromthehart.tech/*"
custom_domain = true

[vars]
ENVIRONMENT = "production"
```

## 📁 Project Structure

The worker consists of several key components:

```
from-the-hart-tech-api-reverse-proxy-worker/
├── src/
│   ├── index.ts            # Main entry point
│   ├── routes.ts           # Defines API routing rules and endpoints
│   ├── aws-auth.ts         # Handles AWS SigV4 authentication for Lambda access
│   ├── gcp-auth.ts         # Manages authentication for Google Cloud Run services
│   ├── caching.ts          # Implements caching strategies
│   ├── cors.ts             # Handles CORS headers and preflight requests
│   ├── config.ts           # Configuration variables and constants
│   ├── requestHandler.ts   # Core request processing logic
│   └── types.ts            # TypeScript definitions
├── test/                   # Test files
│   ├── index.spec.ts       # Main tests
│   └── env.d.ts            # Test environment type definitions
├── package.json            # Project dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── wrangler.toml           # Cloudflare Workers configuration
└── README.md               # Project documentation
```

## 📚 Scripts

- `npm run build` - Build the TypeScript project
- `npm run deploy` - Deploy the worker to Cloudflare
- `npm run dev` - Start a local development server
- `npm test` - Run the test suite
- `npm run cf-typegen` - Generate TypeScript types for Cloudflare Workers