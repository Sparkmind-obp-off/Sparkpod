# Daytona Adapter Specification

## Role

Daytona is SparkPod's first execution backend. The adapter is the only layer allowed to know Daytona-specific URLs, payloads, headers, SDK behavior, readiness semantics, and toolbox proxy details.

## Configuration

- `DAYTONA_API_KEY` — server-side secret
- `DAYTONA_API_URL` — optional provider endpoint override
- `DAYTONA_TARGET` — optional runtime/region target

## Lifecycle

1. Validate configuration.
2. Create sandbox using current supported Daytona contract.
3. Poll/read until ready with bounded deadline.
4. Execute an approved command through the supported execution mechanism.
5. Normalize stdout/stderr/exit status.
6. Destroy sandbox in a `finally` path when policy says disposable.

## Reliability

- No arbitrary 20-second hard timeout for sandbox creation.
- Use explicit per-stage deadlines.
- Distinguish HTTP provider responses from transport/network failures.
- Preserve provider status/code safely.
- Cleanup after every successful creation, including failed execution/verification.

## Acceptance

The adapter is complete only when a real production sandbox can be created, becomes ready, executes `printf 'SparkPod OK'`, returns verified output, and is cleaned up.
