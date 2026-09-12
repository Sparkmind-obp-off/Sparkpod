# SparkPod

SparkPod v0.1 is a provider-neutral isolated execution control surface. It runs the single approved smoke command through a server-side Daytona adapter, verifies the exact result, and guarantees cleanup.

## Completed
- Hono/Cloudflare Pages application and minimal execution UI
- Authenticated workspace boundary backed by Cloudflare D1
- Provider-neutral `ExecutionProvider` contract
- Daytona create → ready → execute → verify → cleanup adapter
- Normalized errors, correlation IDs, safe lifecycle audit events
- Fixed v0.1 command policy: `printf 'SparkPod OK'`
- Unit/adapter/security-oriented tests

## Routes
- `GET /` — control surface
- `GET /api/v1/health` — public application health
- `GET /api/v1/health/provider` — authenticated provider health
- `POST /api/v1/workspaces` — create owned workspace
- `POST /api/v1/executions` — synchronous isolated execution
- `GET /api/v1/executions/:id` — retrieve owned result
- `POST /api/v1/executions/:id/cancel` — explicit v0.1 cancellation response

Authenticated routes require `Authorization: Bearer <SPARKPOD_ACCESS_TOKEN>`.

## Production
- URL: https://sparkpod-b97.pages.dev
- Platform: Cloudflare Pages + D1
- Database: `sparkpod-production`
- Deployment: active
- Provider verification: pending `DAYTONA_API_KEY` production secret

## Local development
Create `.dev.vars` (never commit it) with `DAYTONA_API_KEY`, `SPARKPOD_ACCESS_TOKEN`, and `SPARKPOD_SESSION_SECRET`, then run:

```bash
npm install
npm run db:migrate:local
npm test
npm run typecheck
npm run build
```

## Not implemented
Persistent provider sandboxes, arbitrary commands, additional providers, async queues, teams, billing, connectors/MCP, and Threads-specific features are intentionally outside v0.1.

## Next step
Configure the Daytona production secret, run the real production smoke lifecycle repeatedly, then rotate the generated SparkPod access token to an operator-managed value.
