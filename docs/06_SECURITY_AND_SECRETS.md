# Security & Secrets

## Secret ownership

SparkPod owns its runtime credentials. Consumer apps never receive provider credentials.

## Never expose

- Daytona API keys
- OAuth client secrets
- session secrets
- access tokens
- cookies
- provider authorization headers

## Execution safety

MVP commands are policy-controlled. The server validates tool name, arguments, timeout, working directory and resource limits before execution.

No arbitrary browser-supplied provider request is forwarded directly to Daytona.

## Tenant/workspace isolation

Every execution is associated with an authenticated user/workspace. Provider session IDs are opaque to unauthorized users. Cross-workspace reads and commands are denied.

## Logging

Logs may include request/session IDs, stage, duration, exit code and normalized error category. They must not include secrets or complete authorization-bearing requests.

## Threat model priorities

1. credential leakage
2. command injection through orchestration parameters
3. cross-workspace access
4. SSRF through arbitrary URLs/tools
5. runaway execution/cost
6. sandbox cleanup failure
