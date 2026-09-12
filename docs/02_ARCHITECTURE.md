# SparkPod Architecture

## Layers

1. **Web/UI** — workspace, prompt, execution status, terminal/result view.
2. **Application API** — authentication, workspace/session APIs, orchestration requests.
3. **Orchestrator** — validates intent, selects approved tools, manages lifecycle.
4. **Tool layer** — typed, allowlisted operations such as `terminal.exec`.
5. **Execution adapter** — provider-neutral interface.
6. **Daytona adapter** — translates the provider-neutral contract to Daytona REST/SDK operations.
7. **Sandbox** — isolated execution environment.
8. **Persistence/observability** — session state and safe audit events.

## Core dependency direction

`UI → API → Orchestrator → Tool Contract → Execution Adapter → Provider`

Never: `UI → Daytona`, `Consumer → Daytona`, or `Business Logic → Daytona SDK types`.

## Runtime target

Cloudflare Workers/Pages hosts the application/API. Durable Objects may be introduced for stateful sessions when needed. D1/KV/R2 are optional and must only be added when a concrete requirement exists.

## Provider abstraction

```text
ExecutionProvider
  createSession()
  waitReady()
  exec()
  readFile()
  writeFile()
  destroy()
  health()
```

The first implementation is `DaytonaExecutionProvider`.

## Isolation

Each execution receives a unique session/workspace boundary. Provider credentials remain server-side. User command execution is never performed in the browser.
