import { describe, expect, it } from 'vitest'
import type { ExecutionProvider, ProviderHealth, ProviderSession } from '../src/domain'
import { runExecution, SMOKE_COMMAND, validateExecutionInput } from '../src/orchestrator'

class FakeProvider implements ExecutionProvider {
  name = 'fake'
  destroyed = false
  constructor(private readonly failure?: 'create' | 'ready' | 'exec' | 'cleanup', private readonly stdout = 'SparkPod OK') {}
  async createSession(): Promise<ProviderSession> { if (this.failure === 'create') throw Object.assign(new Error('unauthorized'), { statusCode: 401 }); return { id: 'sandbox_1', state: 'created' } }
  async waitReady(): Promise<void> { if (this.failure === 'ready') throw Object.assign(new Error('readiness timeout'), { code: 'READINESS_TIMEOUT' }) }
  async exec(_session: ProviderSession, request: { command: string }) { expect(request.command).toBe(SMOKE_COMMAND); if (this.failure === 'exec') throw new Error('execution failed'); return { stdout: this.stdout, stderr: '', exitCode: 0, durationMs: 7 } }
  async destroy(): Promise<void> { this.destroyed = true; if (this.failure === 'cleanup') throw new Error('cleanup failed') }
  async health(): Promise<ProviderHealth> { return { status: 'reachable', safeMessage: 'ok' } }
}

const input = { workspaceId: 'ws_valid123', instruction: 'Verify runtime', tool: 'terminal.exec' as const }

describe('execution policy', () => {
  it('accepts only the fixed v0.1 smoke command', () => {
    expect(validateExecutionInput({ ...input, input: { command: SMOKE_COMMAND } })).toEqual(input)
    expect(() => validateExecutionInput({ ...input, input: { command: 'rm -rf /' } })).toThrow(/not allowed/)
    expect(() => validateExecutionInput({ ...input, tool: 'provider.raw' })).toThrow(/terminal.exec/)
  })
})

describe('orchestrator lifecycle', () => {
  it('verifies output and always cleans the sandbox', async () => {
    const provider = new FakeProvider()
    const response = await runExecution(provider, input, { id: 'exe_1', correlationId: 'corr_1' })
    expect(response.status).toBe('completed')
    expect(response.result).toMatchObject({ stdout: 'SparkPod OK', verified: true })
    expect(response.cleanup).toEqual({ attempted: true, succeeded: true })
    expect(provider.destroyed).toBe(true)
    expect(response.events.map(event => event.event)).toEqual(['execution.created', 'sandbox.created', 'sandbox.ready', 'tool.started', 'tool.completed', 'execution.completed', 'sandbox.cleaned'])
  })

  it.each(['ready', 'exec'] as const)('cleans after %s failure', async failure => {
    const provider = new FakeProvider(failure)
    const response = await runExecution(provider, input)
    expect(response.status).toBe('failed')
    expect(response.cleanup).toEqual({ attempted: true, succeeded: true })
    expect(provider.destroyed).toBe(true)
  })

  it('surfaces cleanup failure without reporting success', async () => {
    const response = await runExecution(new FakeProvider('cleanup'), input)
    expect(response.status).toBe('failed')
    expect(response.error?.category).toBe('cleanup')
    expect(response.cleanup).toEqual({ attempted: true, succeeded: false })
  })

  it('rejects mismatched provider output', async () => {
    const response = await runExecution(new FakeProvider(undefined, 'wrong'), input)
    expect(response.status).toBe('failed')
    expect(response.error?.category).toBe('execution')
    expect(response.cleanup.succeeded).toBe(true)
  })
})
