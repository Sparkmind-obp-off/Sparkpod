# SparkPod — Genspark Session 2 Execution Prompt

## Mission
Implement **SparkPod Session 2 = Phase 2 — SparkPod UX** on top of the existing v0.1 execution core.

Do NOT redesign the backend/provider architecture. Do NOT merge Threads Tools. Do NOT block Session 2 on the Daytona production API key; production secret configuration will be handled manually later.

## Current repository state
SparkPod already has:
- Hono + Cloudflare Pages
- D1 authenticated workspace boundary
- provider-neutral `ExecutionProvider` contract
- Daytona create → ready → execute → verify → cleanup lifecycle
- normalized errors
- correlation IDs and safe lifecycle audit events
- fixed v0.1 command policy: `printf 'SparkPod OK'`
- unit/adapter/security-oriented tests
- active production deployment

Production Daytona verification is a configuration task, not a reason to redesign Session 2:
`DAYTONA_API_KEY` must be configured in Cloudflare production before the real provider smoke test can pass.

## Session 2 goal
Make SparkPod usable from the browser without developer tooling.

Target user flow:
`Open SparkPod → authenticate → workspace screen → enter execution instruction → run → creating → waiting → ready → running → completed/failed → inspect result → retry/cancel where applicable`

The UI consumes the existing API boundary. The browser must never call Daytona directly.

## Scope

### 1. Workspace/control screen
Provide a focused execution surface showing:
- current authenticated workspace
- execution instruction input
- Run action
- current execution status/stage
- latest result or safe error
- execution/correlation ID where useful

### 2. Execution input
- Provide a clear instruction field.
- Respect the existing server-side command/tool policy.
- Do NOT add arbitrary shell-command execution.
- The server remains authoritative over the actual executable tool/command.

### 3. Lifecycle state machine
Represent server truth clearly:
- `idle`
- `creating`
- `waiting`
- `ready`
- `running`
- `completed`
- `failed`
- `cleaning` when exposed by the API
- `cancelled` only when genuinely supported

Never show success before the server has verified the expected result.

### 4. Result and error presentation
Success should communicate:
- completed
- verified
- safe output
- execution/correlation ID

Failure should communicate:
- safe human-readable message
- safe category/stage when available

Never expose:
- provider credentials
- auth headers/tokens
- raw secrets
- internal stack traces
- sensitive provider payloads

### 5. Retry/cancel
- Implement only capabilities actually supported by the current backend.
- Retry should create a new execution when appropriate.
- Do not pretend a provider sandbox was cancelled if the backend cannot cancel it.
- If the cancel endpoint explicitly reports unsupported, present that honestly.

### 6. Loading and duplicate-submit protection
- Prevent duplicate execution submissions.
- Show progress while a request is in flight.
- Do not invent execution state after refresh/navigation.
- Keep the UI derived from API responses.

### 7. Authentication
Preserve the existing authentication boundary:
`Authorization: Bearer <SPARKPOD_ACCESS_TOKEN>`

Do not move tokens or Daytona credentials into source code. Do not create a second auth system unless inspection proves the existing one is incomplete.

## Non-goals
Do NOT implement in Session 2:
- Threads features, scraping, discovery, CRM, or social APIs
- billing
- teams/RBAC
- arbitrary shell execution
- autonomous multi-agent behavior
- persistent Daytona sandboxes
- async queues unless strictly required by the existing API
- MCP/connector integration
- additional execution providers
- speculative database tables
- frontend provider credentials
- elaborate design-system work

## Required implementation loop
`INSPECT → PLAN → IMPLEMENT → TEST → TYPECHECK → BUILD → DEPLOY (if configured) → VERIFY → FIX → REVERIFY → COMMIT`

Before changing code:
1. Inspect the actual repository.
2. Identify the UI entrypoint, API client, routes, auth handling, and actual response shapes.
3. Reuse the existing contracts instead of duplicating them.
4. Make the smallest coherent change that satisfies the Session 2 gate.

## Acceptance criteria
Session 2 is complete only when:
- the workspace/control surface is usable in a browser
- a user can submit an execution instruction
- lifecycle progress reflects server truth
- a completed result is rendered safely
- failures are rendered safely
- duplicate submissions are prevented
- retry/cancel behavior is honest and functional where supported
- the authentication boundary remains intact
- no provider secret appears in browser/source/logs/URL/database
- the Daytona adapter/provider-neutral contract remains intact
- existing tests pass
- practical UI/API integration tests are added where appropriate
- `npm test` passes
- `npm run typecheck` passes
- `npm run build` passes
- deployment succeeds when deployment credentials are available
- no unrelated scope is introduced

## Production secret handling
The Daytona production API key is intentionally NOT part of Session 2 implementation.

Never paste or hard-code the Daytona key into source code, documentation, client bundles, URLs, logs, or Git.

Continue local/mock/UI testing without the production key where possible. Preserve the existing secret contract. If production verification remains blocked, report the exact configuration blocker instead of weakening security.

## Final report required from Genspark
At the end of the session, report:
1. files changed
2. UX capabilities implemented
3. exact test results
4. typecheck result
5. build result
6. deployment result
7. Daytona production verification status
8. remaining blockers
9. final commit SHA
10. recommended next step

## Definition of Done
SparkPod is no longer only a developer-facing API/demo. A normal user can operate the approved execution lifecycle through the browser while the provider-neutral architecture, authentication boundary, secret handling, and execution safety rules remain intact.

**Do not stop at analysis. Implement Session 2.**
