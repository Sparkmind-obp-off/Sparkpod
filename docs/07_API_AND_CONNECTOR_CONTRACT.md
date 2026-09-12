# API & Connector Contract

SparkPod is a standalone product. Consumer products such as Threads Tools connect to SparkPod through a stable API/connector contract.

## Core endpoints (MVP)

- `POST /api/v1/workspaces`
- `POST /api/v1/executions`
- `GET /api/v1/executions/:id`
- `POST /api/v1/executions/:id/cancel`
- `GET /api/v1/health`

Exact route names may change during implementation, but the contract concepts must remain stable.

## Execution request

```json
{
  "workspaceId": "ws_...",
  "instruction": "Run the requested task",
  "tool": "terminal.exec",
  "input": {}
}
```

## Response principle

Return SparkPod execution IDs and normalized status/results. Never return Daytona credentials or force consumers to understand Daytona lifecycle internals.

## Connector rule

Threads Tools, future products, and external clients are consumers. They must not share SparkPod internal code or provider secrets. Integration happens through authenticated API or a separately versioned connector/MCP layer later.
