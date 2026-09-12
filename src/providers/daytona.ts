import { Daytona, DaytonaError } from '@daytona/sdk'
import type { ExecutionProvider, ExecRequest, ExecResult, ProviderHealth, ProviderSession, SparkPodError, ExecutionStage } from '../domain'

export interface DaytonaConfig { apiKey?: string; apiUrl?: string; target?: string }

type ErrorLike = { name?: string; message?: string; statusCode?: number; code?: string }

export function normalizeDaytonaError(error: unknown, stage: ExecutionStage | 'health', correlationId: string): SparkPodError {
  const value = (error && typeof error === 'object' ? error : {}) as ErrorLike
  const status = value.statusCode
  const text = `${value.name ?? ''} ${value.message ?? ''} ${value.code ?? ''}`.toLowerCase()
  let category: SparkPodError['category'] = 'provider'
  let retryable = false
  let safeMessage = 'The execution provider returned an unexpected error.'

  if (status === 401) { category = 'authentication'; safeMessage = 'Execution provider authentication failed.' }
  else if (status === 403) { category = 'authorization'; safeMessage = 'Execution provider denied this operation.' }
  else if (status === 400 || status === 422) { category = 'validation'; safeMessage = 'The execution provider rejected the request.' }
  else if (status === 404) { category = 'not_found'; safeMessage = 'The provider session was not found.' }
  else if (status === 429) { category = 'rate_limit'; retryable = true; safeMessage = 'The execution provider is rate limiting requests.' }
  else if (status && status >= 500) { category = 'provider'; retryable = true; safeMessage = 'The execution provider is temporarily unavailable.' }
  else if (text.includes('timeout') || text.includes('timed out') || text.includes('abort')) { category = 'timeout'; retryable = true; safeMessage = stage === 'executing' ? 'Command execution timed out.' : 'The execution provider timed out.' }
  else if (text.includes('network') || text.includes('connection') || text.includes('fetch')) { category = 'network'; retryable = true; safeMessage = 'Could not reach the execution provider.' }
  else if (stage === 'executing') { category = 'execution'; safeMessage = 'The sandbox command failed.' }
  else if (stage === 'cleaned') { category = 'cleanup'; retryable = true; safeMessage = 'Sandbox cleanup could not be confirmed.' }

  return { category, retryable, providerStatus: status, providerCode: value.code, safeMessage, stage, correlationId }
}

export class DaytonaExecutionProvider implements ExecutionProvider {
  readonly name = 'daytona'
  private readonly client?: Daytona

  constructor(private readonly config: DaytonaConfig) {
    if (config.apiKey) {
      this.client = new Daytona({ apiKey: config.apiKey, apiUrl: config.apiUrl, target: config.target, useDeprecatedPolling: true })
    }
  }

  private requireClient(): Daytona {
    if (!this.client) throw Object.assign(new Error('Daytona is not configured'), { code: 'MISSING_DAYTONA_API_KEY' })
    return this.client
  }

  async createSession(context: { executionId: string; workspaceId: string }): Promise<ProviderSession> {
    try {
      const sandbox = await this.requireClient().create({
        snapshot: 'daytona-small',
        language: 'typescript',
        ephemeral: true,
        autoStopInterval: 5,
        labels: { 'sparkpod-execution': context.executionId, 'sparkpod-workspace': context.workspaceId },
      }, { timeout: 120 })
      return { id: sandbox.id, state: String(sandbox.state ?? 'created') }
    } catch (error) {
      if ((error as ErrorLike)?.code === 'MISSING_DAYTONA_API_KEY') throw error
      throw error
    }
  }

  async waitReady(session: ProviderSession, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs
    do {
      const sandbox = await this.requireClient().get(session.id)
      const state = String(sandbox.state ?? '').toLowerCase()
      if (state === 'started' || state === 'ready') return
      if (state === 'error' || state === 'destroyed' || state === 'stopped') throw new Error(`Sandbox entered terminal state: ${state}`)
      await new Promise(resolve => setTimeout(resolve, 1_000))
    } while (Date.now() < deadline)
    throw Object.assign(new Error('Sandbox readiness timeout'), { code: 'READINESS_TIMEOUT' })
  }

  async exec(session: ProviderSession, request: ExecRequest): Promise<ExecResult> {
    const started = Date.now()
    const sandbox = await this.requireClient().get(session.id)
    const response = await sandbox.process.executeCommand(request.command, request.cwd, undefined, request.timeoutSeconds)
    const output = response.result ?? response.artifacts?.stdout ?? ''
    return { stdout: output, stderr: response.exitCode === 0 ? '' : output, exitCode: response.exitCode, durationMs: Date.now() - started }
  }

  async destroy(session: ProviderSession): Promise<void> {
    const sandbox = await this.requireClient().get(session.id)
    await this.requireClient().delete(sandbox, 90, true)
  }

  async health(): Promise<ProviderHealth> {
    if (!this.config.apiKey) return { status: 'configuration', safeMessage: 'Daytona is not configured.' }
    try {
      const iterator = this.requireClient().list({ page: 1, limit: 1 } as never)
      await iterator.next()
      return { status: 'reachable', safeMessage: 'Daytona is reachable.' }
    } catch (error) {
      const normalized = normalizeDaytonaError(error, 'health', crypto.randomUUID())
      const status = ['authentication', 'authorization', 'timeout', 'network'].includes(normalized.category) ? normalized.category : 'provider_error'
      return { status: status as ProviderHealth['status'], safeMessage: normalized.safeMessage }
    }
  }
}

export { DaytonaError }
