# Execution Provider Contract

SparkPod must be provider-neutral at the application boundary.

## Required operations

### create
Input: workspace/session metadata, runtime policy, target/provider options.
Output: provider session ID and normalized state.

### waitReady
Input: provider session ID, timeout/deadline.
Output: ready/not-ready plus safe diagnostic.

### exec
Input: session ID, command, working directory, environment policy, timeout.
Output: stdout, stderr, exit code, duration, normalized error.

### destroy
Input: session ID.
Output: cleanup status.

### health
Input: none or provider configuration context.
Output: reachable/authenticated/provider-error/timeout/network/configuration.

## Normalized lifecycle

`created → ready → executing → completed|failed → cleaned`

## Error contract

Every provider error must normalize to:

- `category`
- `retryable`
- `providerStatus?`
- `providerCode?`
- `safeMessage`
- `stage`

Never return raw credentials, authorization headers, cookies, or provider secrets.

## Compatibility rule

Provider-specific response shapes may exist only inside the adapter. The orchestrator and consumers use normalized SparkPod types.
