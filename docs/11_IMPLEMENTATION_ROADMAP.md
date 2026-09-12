# Implementation Roadmap

## Phase 0 — Foundation
- repository conventions
- Cloudflare runtime skeleton
- configuration/secrets contract
- provider interface
- health endpoint

**Gate:** app builds and provider interface is testable without Daytona.

## Phase 1 — Daytona Core
- Daytona adapter
- create/readiness/exec/destroy
- normalized errors
- deterministic adapter tests

**Gate:** real Daytona sandbox lifecycle succeeds in a controlled environment.

## Phase 2 — SparkPod UX
- workspace screen
- prompt input
- execution status
- terminal/result output
- retry/cancel states

**Gate:** user can complete the lifecycle without developer tooling.

## Phase 3 — Production Hardening
- auth
- isolation
- observability
- rate/cost controls
- deployment verification

**Gate:** production smoke test passes repeatedly.

## Phase 4 — Connector
Only after the core product is stable, expose the versioned API/connector consumed by Threads Tools.

## Phase 5 — Additional providers
Add other execution providers only when a concrete user requirement exists.
