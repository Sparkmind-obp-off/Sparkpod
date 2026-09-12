# Observability & Audit

Every execution receives a correlation ID.

## Safe events

`execution.created`, `sandbox.created`, `sandbox.ready`, `tool.started`, `tool.completed`, `execution.completed`, `sandbox.cleaned`, `execution.failed`.

Each event may contain execution ID, workspace ID, stage, duration, status, provider name and normalized error category.

## Metrics

Track lifecycle success rate, provider latency, timeout rate, execution failures, cleanup failures and active sessions.

## Diagnostics

Diagnostics are for operators, not credential exposure. Provider status/code may be retained when safe; raw headers and secrets are always redacted.

## Audit objective

An operator must be able to answer: who initiated an execution, which workspace it belonged to, which tool ran, which provider was used, what lifecycle stage failed, and whether cleanup occurred.
