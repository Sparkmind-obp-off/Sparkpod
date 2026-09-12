# Consumer Integration Model

## Principle

SparkPod is the execution platform. Threads Tools is a consumer application. They are separate products and repositories.

## Integration stages

### Stage A — standalone
SparkPod works independently with its own UI and Daytona provider.

### Stage B — stable API
Expose authenticated execution/workspace APIs with versioning.

### Stage C — connector
Threads Tools uses the API through a thin connector. The connector translates its own job into SparkPod requests and maps results back.

### Stage D — optional MCP
An MCP server can later expose selected SparkPod capabilities as tools. MCP is an integration surface, not the internal execution architecture.

## Ownership

SparkPod owns sandbox lifecycle, provider credentials, execution policy and execution evidence. Threads Tools owns Threads-specific discovery, targeting and workflow UX.

## Why this separation exists

It prevents a consumer feature from expanding the execution platform scope and prevents provider debugging from blocking unrelated product work.
