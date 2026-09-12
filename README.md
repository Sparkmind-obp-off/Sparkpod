# SparkPod

SparkPod v0.1 is a provider-neutral isolated execution control surface. Session 2 adds a browser workspace experience on top of the existing execution core without changing the provider contract or fixed server-side command policy.

## Project goal
Let an authenticated operator submit a human-readable execution instruction, follow the server-reported lifecycle, and inspect a verified result without developer tooling. The browser never calls Daytona directly and never chooses the shell command.

## Completed features
- Hono + Cloudflare Pages application
- D1-backed authenticated workspace boundary
- Browser-only bearer-token connection flow; the token remains in memory for the current tab
- Current-workspace restoration from the authenticated API
- Workspace creation and focused instruction input
- Duplicate-submit protection and request progress state
- Server-reported lifecycle evidence for create → ready → execute → verify → cleanup
- Verified safe output, normalized safe failures, execution ID, and correlation ID
- Retry as a new execution
- Honest cancellation capability messaging for synchronous v0.1 executions
- Provider-neutral `ExecutionProvider` contract
- Daytona create → ready → execute → verify → cleanup adapter
- Fixed v0.1 server command policy: `printf 'SparkPod OK'`
- Unit, adapter, security, and UI/API integration tests

## Functional routes
- `GET /` — browser execution control surface
- `GET /api/v1/health` — public application health
- `GET /api/v1/health/provider` — authenticated provider health
- `GET /api/v1/workspaces/current` — current owned workspace and latest persisted execution
- `POST /api/v1/workspaces` — create an owned workspace; body: `{ "name": "..." }`
- `POST /api/v1/executions` — synchronous isolated execution; body: `{ "workspaceId": "...", "instruction": "...", "tool": "terminal.exec" }`
- `GET /api/v1/executions/:id` — retrieve an owned result
- `POST /api/v1/executions/:id/cancel` — explicit unsupported response for completed synchronous v0.1 execution records

Authenticated routes require `Authorization: Bearer <SPARKPOD_ACCESS_TOKEN>`.

## Data architecture
- **Cloudflare D1** stores workspaces and completed/failed execution responses.
- Workspace and execution reads are constrained by the server-derived owner ID.
- Daytona credentials stay in Cloudflare secrets and are used only by the server-side adapter.
- The browser receives normalized results, audit events, and safe error fields only.

## User guide
1. Open the production URL.
2. Enter the configured SparkPod access token and select **Connect**.
3. Create a workspace if the account has none; otherwise the most recent workspace is loaded from the API.
4. Enter an execution instruction and select **Run approved execution**.
5. Wait for the synchronous server lifecycle to finish. The UI shows a neutral waiting state until server evidence arrives.
6. Inspect lifecycle events, verification state, output, execution ID, and correlation ID.
7. Select **Retry as a new execution** when another run is appropriate.

The token is not stored in local storage, cookies, source code, or URLs. Refreshing the page signs the browser UI out; reconnecting reloads persisted workspace and latest execution state from the API.

## Production
- **Platform:** Cloudflare Pages + D1
- **Current URL:** https://sparkpod-b97.pages.dev
- **Database:** `sparkpod-production`
- **Deployment status:** Session 2 active (deployment: https://230e8e29.sparkpod-b97.pages.dev)
- **Provider verification:** blocked until `DAYTONA_API_KEY` is manually configured as a Cloudflare production secret

## Local development
Create `.dev.vars` (never commit it) with `DAYTONA_API_KEY`, `SPARKPOD_ACCESS_TOKEN`, and `SPARKPOD_SESSION_SECRET`, then run:

```bash
npm run db:migrate:local
npm test
npm run typecheck
npm run build
```

For a local Pages preview after building:

```bash
pm2 start ecosystem.config.cjs
```

## Not implemented
Persistent provider sandboxes, arbitrary commands, additional providers, async queues, teams/RBAC, billing, connectors/MCP, autonomous agents, and Threads-specific features remain intentionally outside Session 2.

Cancellation is not supported by the current synchronous v0.1 backend. The UI does not claim that closing the page or interrupting a browser request cancels the provider sandbox.

## Recommended next steps
1. Configure `DAYTONA_API_KEY` in Cloudflare production.
2. Run repeated authenticated production smoke lifecycles and verify cleanup evidence.
3. Rotate the generated SparkPod access token to an operator-managed value if still required.
4. Consider an asynchronous execution API only in a later phase if real-time cancellation or live polling becomes a product requirement.
