# Testing & Acceptance

## Unit tests

Cover normalization, provider errors, timeout detection, request validation, authorization, cleanup and tool allowlists.

## Adapter contract tests

Daytona adapter must cover:
- success lifecycle
- 401/403
- 400/422
- 404
- 429
- 5xx
- malformed/non-JSON responses
- network failure
- timeout
- readiness failure
- execution failure
- cleanup failure

## Integration test

A controlled integration test must perform real create → ready → exec → verify → cleanup against a configured Daytona environment.

## Security tests

Verify no credentials appear in HTML, client JavaScript, API responses, logs, errors, persisted records, or Git history.

## Production acceptance

The MVP is not complete when tests merely pass. It is complete when production performs:

`Sandbox created ✓ → Ready ✓ → Command executed ✓ → Output verified ✓ → Cleanup ✓ → Connected ✓`

The exact verification command for the first smoke test is equivalent to `printf 'SparkPod OK'` and must be checked server-side.
