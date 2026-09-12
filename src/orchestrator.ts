import type { AuditEvent, ExecutionProvider, ExecutionResponse, ProviderSession, SparkPodError } from './domain'
import { normalizeDaytonaError } from './providers/daytona'

export const SMOKE_COMMAND = "printf 'SparkPod OK'"
export const ALLOWED_TOOL = 'terminal.exec' as const

export function validateExecutionInput(value: unknown): { workspaceId: string; instruction: string; tool: typeof ALLOWED_TOOL } {
  if (!value || typeof value !== 'object') throw new Error('Request body must be an object.')
  const body = value as Record<string, unknown>
  if (typeof body.workspaceId !== 'string' || !/^ws_[a-zA-Z0-9_-]{3,64}$/.test(body.workspaceId)) throw new Error('A valid workspaceId is required.')
  if (typeof body.instruction !== 'string' || body.instruction.trim().length < 3 || body.instruction.length > 500) throw new Error('Instruction must contain 3–500 characters.')
  if (body.tool !== ALLOWED_TOOL) throw new Error('Only terminal.exec is allowed in SparkPod v0.1.')
  const input = body.input as Record<string, unknown> | undefined
  if (input?.command !== undefined && input.command !== SMOKE_COMMAND) throw new Error('This command is not allowed by the v0.1 execution policy.')
  return { workspaceId: body.workspaceId, instruction: body.instruction.trim(), tool: ALLOWED_TOOL }
}

export async function runExecution(provider: ExecutionProvider, input: { workspaceId: string; instruction: string; tool: typeof ALLOWED_TOOL }, options: { id?: string; correlationId?: string; now?: () => Date } = {}): Promise<ExecutionResponse> {
  const executionId = options.id ?? `exe_${crypto.randomUUID()}`
  const correlationId = options.correlationId ?? crypto.randomUUID()
  const now = options.now ?? (() => new Date())
  const createdAt = now().toISOString()
  const events: AuditEvent[] = []
  const emit = (event: AuditEvent['event'], stage: string, details: Partial<AuditEvent> = {}) => events.push({ event, executionId, workspaceId: input.workspaceId, correlationId, provider: provider.name, stage, ...details })
  emit('execution.created', 'created')

  let session: ProviderSession | undefined
  let error: SparkPodError | undefined
  let result: ExecutionResponse['result']
  let cleanupSucceeded = false

  try {
    session = await provider.createSession({ executionId, workspaceId: input.workspaceId })
    emit('sandbox.created', 'created')
    await provider.waitReady(session, 120_000)
    emit('sandbox.ready', 'ready')
    emit('tool.started', 'executing')
    const executed = await provider.exec(session, { command: SMOKE_COMMAND, timeoutSeconds: 30 })
    emit('tool.completed', 'executing', { durationMs: executed.durationMs })
    if (executed.exitCode !== 0 || executed.stdout !== 'SparkPod OK') throw Object.assign(new Error('Execution output verification failed'), { code: 'OUTPUT_VERIFICATION_FAILED' })
    result = { ...executed, verified: true }
    emit('execution.completed', 'completed')
  } catch (caught) {
    if ((caught as { code?: string })?.code === 'MISSING_DAYTONA_API_KEY') {
      error = { category: 'configuration', retryable: false, safeMessage: 'Daytona is not configured on the server.', stage: 'created', correlationId }
    } else if ((caught as { code?: string })?.code === 'OUTPUT_VERIFICATION_FAILED') {
      error = { category: 'execution', retryable: false, safeMessage: 'Sandbox output did not match the verified result.', stage: 'executing', correlationId }
    } else {
      const stage = session ? 'executing' : 'created'
      error = normalizeDaytonaError(caught, stage, correlationId)
    }
    emit('execution.failed', error.stage, { category: error.category })
  } finally {
    if (session) {
      try {
        await provider.destroy(session)
        cleanupSucceeded = true
        emit('sandbox.cleaned', 'cleaned')
      } catch (cleanupError) {
        emit('sandbox.cleanup_failed', 'cleaned', { category: 'cleanup' })
        if (!error) error = normalizeDaytonaError(cleanupError, 'cleaned', correlationId)
      }
    }
  }

  return {
    id: executionId,
    workspaceId: input.workspaceId,
    correlationId,
    status: error ? 'failed' : 'completed',
    stage: error ? 'failed' : 'cleaned',
    provider: provider.name,
    tool: ALLOWED_TOOL,
    result: error ? undefined : result,
    error,
    cleanup: { attempted: Boolean(session), succeeded: cleanupSucceeded },
    events,
    createdAt,
    finishedAt: now().toISOString(),
  }
}
