# VIBE End-to-End Tests

This directory contains end-to-end tests for the VIBE pipeline.

## Running E2E Tests

To run the E2E tests, make sure the VIBE services are running:

```bash
# Start VIBE services
docker-compose up -d

# Or run them individually:
npm run dev:api      # API server on port 3001
npm run dev:executor # Executor service
```

Then run the E2E tests:

```bash
cd tests
npm install
npm run test:e2e
```

## Test Structure

### core-pipeline.test.ts

Tests the complete VIBE pipeline:
1. Create a project pointing at a small local test repository
2. Submit a prompt: "add a hello world function to src/index.ts"
3. Subscribe to SSE logs at `/jobs/:id/logs`

## Environment Variables

- `API_BASE_URL`: Base URL for the API (default: `http://localhost:3001`)

## Requirements

- Node.js v20 or higher
- VIBE services running (API and Executor)
- Git installed on the system
