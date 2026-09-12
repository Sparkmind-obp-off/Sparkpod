import { describe, expect, it } from 'vitest'
import app, { type Bindings } from '../src/index'

class FakeStatement {
  private values: unknown[] = []

  constructor(private readonly database: FakeDatabase, private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async first<T>() {
    if (this.sql.includes('FROM workspaces WHERE owner_id')) return this.database.currentWorkspace as T | null
    if (this.sql.includes('FROM workspaces WHERE id')) {
      return (this.database.workspaceExists ? { id: this.values[0] } : null) as T | null
    }
    if (this.sql.includes('FROM executions WHERE workspace_id')) return this.database.latestExecution as T | null
    if (this.sql.includes('SELECT response_json FROM executions WHERE id')) return this.database.executionById as T | null
    if (this.sql.includes('SELECT status FROM executions')) return this.database.executionStatus as T | null
    return null
  }

  async run() {
    this.database.writes.push({ sql: this.sql, values: this.values })
    return { success: true }
  }
}

class FakeDatabase {
  currentWorkspace: { id: string; name: string; created_at: string } | null = null
  latestExecution: { response_json: string } | null = null
  executionById: { response_json: string } | null = null
  executionStatus: { status: string } | null = null
  workspaceExists = false
  writes: Array<{ sql: string; values: unknown[] }> = []

  prepare(sql: string) {
    return new FakeStatement(this, sql)
  }
}

const environment = (database = new FakeDatabase()): Bindings => ({
  DB: database as unknown as D1Database,
  SPARKPOD_ACCESS_TOKEN: 'operator-token',
  SPARKPOD_SESSION_SECRET: 'session-secret',
})

const authenticated = { Authorization: 'Bearer operator-token' }

describe('SparkPod browser API boundary', () => {
  it('serves the Session 2 control surface without embedding credentials', async () => {
    const response = await app.request('/', {}, environment())
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('Your execution')
    expect(html).toContain('id="auth-form"')
    expect(html).toContain('id="workspace-section"')
    expect(html).toContain('id="retry-button"')
    expect(html).not.toContain('operator-token')
    expect(html).not.toContain('DAYTONA_API_KEY')
  })

  it('requires bearer authentication before workspace state is disclosed', async () => {
    const response = await app.request('/api/v1/workspaces/current', {}, environment())
    const body = await response.json() as { error: { category: string; safeMessage: string } }

    expect(response.status).toBe(401)
    expect(body.error).toMatchObject({ category: 'authentication', safeMessage: 'Authentication required.' })
  })

  it('returns the authenticated current workspace and latest server response', async () => {
    const database = new FakeDatabase()
    database.currentWorkspace = { id: 'ws_current123', name: 'Operator workspace', created_at: '2026-09-12T00:00:00.000Z' }
    database.latestExecution = { response_json: JSON.stringify({ id: 'exe_latest', status: 'completed', result: { verified: true, stdout: 'SparkPod OK' } }) }

    const response = await app.request('/api/v1/workspaces/current', { headers: authenticated }, environment(database))
    const body = await response.json() as { workspace: { id: string; name: string }; latestExecution: { id: string } }

    expect(response.status).toBe(200)
    expect(body.workspace).toMatchObject({ id: 'ws_current123', name: 'Operator workspace' })
    expect(body.latestExecution.id).toBe('exe_latest')
  })

  it('keeps the fixed command server-side and returns a safe configuration failure', async () => {
    const database = new FakeDatabase()
    database.workspaceExists = true

    const response = await app.request('/api/v1/executions', {
      method: 'POST',
      headers: { ...authenticated, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws_valid123', instruction: 'Verify runtime', tool: 'terminal.exec' }),
    }, environment(database))
    const body = await response.json() as { status: string; error: { category: string; safeMessage: string }; correlationId: string }

    expect(response.status).toBe(502)
    expect(body.status).toBe('failed')
    expect(body.error).toMatchObject({ category: 'configuration', safeMessage: 'Daytona is not configured on the server.' })
    expect(body.correlationId).toBeTruthy()
    expect(JSON.stringify(body)).not.toContain('session-secret')
    expect(database.writes.some((write) => write.sql.includes('INSERT INTO executions'))).toBe(true)
  })

  it('reports cancellation as unsupported instead of claiming cancellation', async () => {
    const database = new FakeDatabase()
    database.executionStatus = { status: 'completed' }

    const response = await app.request('/api/v1/executions/exe_123/cancel', { method: 'POST', headers: authenticated }, environment(database))
    const body = await response.json() as { error: { safeMessage: string } }

    expect(response.status).toBe(409)
    expect(body.error.safeMessage).toContain('cannot be cancelled')
  })
})
