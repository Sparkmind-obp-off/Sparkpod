# SparkPod — Genspark Session 3 Execution Prompt

## Mission
Implement **SparkPod Session 3 = Real Production Daytona Verification + Hardening**.

The goal is to prove that the already-deployed SparkPod application can perform the real v0.1 execution lifecycle against Daytona in production.

Do NOT redesign the architecture. Do NOT merge Threads Tools. Do NOT add new product features before the real execution path is proven.

## Current state
SparkPod Session 2 is complete and deployed.

Production:
- Project: `sparkpod`
- Production site: `https://sparkpod-b97.pages.dev`
- Latest deployment: `https://230e8e29.sparkpod-b97.pages.dev`
- D1: `sparkpod-production`

The existing architecture already contains:
- Hono + Cloudflare Pages/Workers
- D1 workspace boundary
- provider-neutral `ExecutionProvider`
- Daytona adapter
- create → ready → execute → verify → cleanup lifecycle
- normalized errors
- correlation IDs and safe audit events
- fixed v0.1 command policy: `printf 'SparkPod OK'`
- browser execution UI
- authentication boundary

The owner has manually configured the Daytona production secret in Cloudflare. GitHub/source code must NOT contain or reveal its value.

## Critical secret/token distinction
There are TWO different credential concepts and they must never be confused:

### 1. `DAYTONA_API_KEY`
- Provider credential.
- Server-side only.
- Stored as a Cloudflare production secret.
- Never ask the user to paste it into the SparkPod UI.
- Never put it in Git, source code, URL, browser storage, logs, API responses, or documentation.
- The browser does not need this key.

### 2. `SPARKPOD_ACCESS_TOKEN`
- SparkPod application authentication credential.
- Used by the browser/API client as:
  `Authorization: Bearer <SPARKPOD_ACCESS_TOKEN>`
- It is separate from the Daytona key.
- It is acceptable for the user/operator to enter this token into the browser UI for authenticated testing, provided the implementation keeps it only in tab memory and never persists it to URL/localStorage/database/logs.
- Genspark must NEVER hard-code a real token.

If a production browser test asks for a token, it means **`SPARKPOD_ACCESS_TOKEN`**, not `DAYTONA_API_KEY`.

Do NOT ask the owner to send either secret to GitHub or to you.

## Session 3 target
Prove this exact production path:

`Browser → SparkPod auth → POST /api/v1/executions → Cloudflare runtime → server reads DAYTONA_API_KEY → Daytona API → sandbox created → sandbox ready → approved command executes → output verified → sandbox cleaned → safe result returned to browser`

## Scope

### 1. Inspect before changing code
Inspect the actual current repository and verify:
- current routes
- current auth handling
- current Daytona adapter
- current provider health route
- current execution/orchestrator flow
- current cleanup behavior
- current error normalization
- current tests
- current deployment configuration references

Do not assume the old docs exactly match the current implementation.

### 2. Production configuration verification
Do not attempt to read or print secret values.

Determine whether the runtime can safely distinguish:
- Daytona configuration missing
- Daytona configuration present
- Daytona provider reachable
- Daytona authentication accepted
- Daytona lifecycle successful

If a provider-health endpoint already exists, use it without exposing credentials.
If a small safe improvement is required to make provider configuration status observable, implement it using boolean/status metadata only.

Never return the API key itself, a prefix/suffix of the key, environment dumps, raw authorization headers, or raw provider secrets.

### 3. Real production smoke test
Execute the real production lifecycle using the existing approved command:

`printf 'SparkPod OK'`

The test must establish all of these:
- authenticated SparkPod request accepted
- Daytona sandbox creation succeeds
- sandbox reaches ready state
- approved command executes
- exact expected output is verified
- execution is marked completed only after verification
- cleanup/destroy is attempted after successful creation
- cleanup outcome is recorded safely
- browser receives a normalized safe result

Do not substitute a mock provider for this acceptance gate.

### 4. Repeatability
Run the production smoke test enough times to establish that success is repeatable, not a one-off.

Minimum target: **3 sequential successful production executions**, unless Daytona/provider limits make that unsafe or impossible.

If a run fails, capture only safe diagnostic information and classify the failure correctly.

### 5. Failure-path verification
Verify at least the important failure classes already covered by the adapter contract:
- missing configuration
- invalid provider authentication
- provider HTTP failure
- provider rate limiting if testable without causing harm
- network/transport failure
- readiness failure/timeout
- execution failure
- cleanup failure

Do not deliberately damage the production environment just to create failures. Existing unit/adapter tests may be used for synthetic failure classes; the real production test is primarily for the success lifecycle.

### 6. Secret-leak audit
Search the implementation and production-facing responses/logging paths for accidental exposure of:
- `DAYTONA_API_KEY`
- `SPARKPOD_ACCESS_TOKEN`
- `Authorization` headers
- Daytona credentials
- raw provider payloads containing credentials

Confirm that secrets do not appear in:
- browser bundle
- URL/query string
- localStorage/sessionStorage
- D1 records
- normal API responses
- lifecycle audit events
- console logs
- source code
- README/docs

Never print a real secret during this audit.

### 7. Auth verification
Confirm that protected routes still reject unauthenticated requests with the existing safe auth behavior.

Confirm that authenticated requests using the application's access token can reach the execution route.

Do not create a second authentication mechanism.

### 8. Regression safety
Run:
- `npm test`
- `npm run typecheck`
- `npm run build`

Add only focused tests required by Session 3.

Do not introduce speculative test infrastructure or dependencies.

## Important non-goals
Do NOT implement in Session 3:
- Threads Tools integration
- MCP
- generic connectors
- arbitrary shell commands
- autonomous agents
- persistent Daytona sandboxes
- queues
- billing
- teams/RBAC
- additional providers
- large UI redesign
- new SaaS features

The single objective is: **prove and harden the real production Daytona execution path.**

## Required implementation loop
`INSPECT → PLAN → IMPLEMENT → TEST → TYPECHECK → BUILD → DEPLOY → VERIFY → FIX → REVERIFY → COMMIT`

Deployment must use the existing Cloudflare production configuration.

Do not weaken security to make the test pass.

## Acceptance gate
Session 3 passes only if the final evidence can honestly support:

`Auth ✓`
`Production Daytona configuration available ✓`
`Provider reachable ✓`
`Sandbox created ✓`
`Sandbox ready ✓`
`Approved command executed ✓`
`Exact output verified ✓`
`Cleanup attempted ✓`
`Cleanup result recorded ✓`
`Safe result returned ✓`
`No secret leakage ✓`
`3 sequential successful runs ✓` (or a documented safe provider limitation)
`npm test ✓`
`typecheck ✓`
`build ✓`
`production deployment ✓`

If any gate fails, report the exact failing stage. Do not mark Session 3 complete merely because the code builds.

## Browser testing instruction
When manually testing the deployed UI:

- Use the **SparkPod application access token** (`SPARKPOD_ACCESS_TOKEN`) when authentication is required.
- Do NOT enter the Daytona API key into the UI.
- Do NOT put the Daytona API key into a prompt, request body, URL, or browser storage.
- The Daytona key must remain server-side in Cloudflare.

## Final report required
At the end, report:

1. files changed
2. exact production URL tested
3. authentication result
4. provider configuration status (boolean/status only; never the secret)
5. provider connectivity result
6. sandbox creation result
7. readiness result
8. execution result
9. exact verification result for `SparkPod OK`
10. cleanup result
11. number of successful sequential production runs
12. failure-path tests performed
13. secret-leak audit result
14. `npm test` result
15. typecheck result
16. build result
17. deployment result
18. remaining blockers
19. final commit SHA
20. recommended next step

## Definition of Done
SparkPod has demonstrated that the deployed application can securely use the Cloudflare production Daytona credential to create a real sandbox, wait for readiness, execute the approved v0.1 command, verify the expected output, clean up the sandbox, and return a safe result to an authenticated browser client.

**Do not stop at analysis. Execute the Session 3 verification and hardening work.**
