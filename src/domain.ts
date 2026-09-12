export type ExecutionStage = 'created' | 'ready' | 'executing' | 'completed' | 'failed' | 'cleaned'
export type ErrorCategory = 'configuration' | 'authentication' | 'authorization' | 'validation' | 'not_found' | 'rate_limit' | 'provider' | 'network' | 'timeout' | 'execution' | 'cleanup' | 'internal'

export interface SparkPodError {
  category: ErrorCategory
  retryable: boolean
  providerStatus?: number
  providerCode?: string
  safeMessage: string
  stage: ExecutionStage | 'health'
  correlationId: string
}

export interface ProviderSession { id: string; state: string }
export interface ExecRequest { command: string; cwd?: string; timeoutSeconds: number }
export interface ExecResult { stdout: string; stderr: string; exitCode: number; durationMs: number }
export interface ProviderHealth { status: 'reachable' | 'configuration' | 'authentication' | 'authorization' | 'provider_error' | 'timeout' | 'network'; safeMessage: string }

export interface ExecutionProvider {
  readonly name: string
  createSession(context: { executionId: string; workspaceId: string }): Promise<ProviderSession>
  waitReady(session: ProviderSession, timeoutMs: number): Promise<void>
  exec(session: ProviderSession, request: ExecRequest): Promise<ExecResult>
  destroy(session: ProviderSession): Promise<void>
  health(): Promise<ProviderHealth>
}

export interface AuditEvent {
  event: 'execution.created' | 'sandbox.created' | 'sandbox.ready' | 'tool.started' | 'tool.completed' | 'execution.completed' | 'execution.failed' | 'sandbox.cleaned' | 'sandbox.cleanup_failed'
  executionId: string
  workspaceId: string
  correlationId: string
  provider: string
  stage: string
  durationMs?: number
  category?: ErrorCategory
}

export interface ExecutionResponse {
  id: string
  workspaceId: string
  correlationId: string
  status: 'completed' | 'failed'
  stage: ExecutionStage
  provider: string
  tool: 'terminal.exec'
  result?: ExecResult & { verified: boolean }
  error?: SparkPodError
  cleanup: { attempted: boolean; succeeded: boolean }
  events: AuditEvent[]
  createdAt: string
  finishedAt: string
}
