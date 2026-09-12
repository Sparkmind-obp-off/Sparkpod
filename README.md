# SparkPod

SparkPod is a standalone AI execution platform. It turns a user instruction into an isolated execution environment, runs approved tools/commands, and returns verified results.

## MVP principle

`Prompt → Agent/Orchestrator → Tool Contract → Execution Adapter → Daytona Sandbox → Result → UI`

Daytona is the first execution provider, not the product itself. Cloudflare is the primary application and deployment platform.

## Scope of v0.1

- Prompt-based execution request
- Workspace/session boundary
- Daytona adapter
- Sandbox create/readiness/execute/cleanup lifecycle
- Terminal/process execution
- Safe result streaming/polling
- Server-side provider credentials
- Cloudflare production deployment
- Provider-independent contracts
- Audit-safe observability

## Explicit non-goals

Threads discovery, social APIs, marketplace features, billing, multi-provider execution, autonomous long-running agents, and advanced code preview are out of scope for v0.1.

## Architecture rule

SparkPod owns orchestration and contracts. Daytona owns sandbox execution. No consumer application may depend directly on Daytona-specific implementation details.

## Documents

See `docs/` for product requirements, architecture, contracts, security, testing, observability, roadmap, and implementation prompts.
