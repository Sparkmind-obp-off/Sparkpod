import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { DaytonaExecutionProvider } from './providers/daytona'
import { runExecution, validateExecutionInput } from './orchestrator'
import type { ExecutionResponse } from './domain'

interface Bindings {
  DB: D1Database
  DAYTONA_API_KEY?: string
  DAYTONA_API_URL?: string
  DAYTONA_TARGET?: string
  SPARKPOD_ACCESS_TOKEN?: string
  SPARKPOD_SESSION_SECRET?: string
}
type Variables = { ownerId: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use('*', secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'self'"], styleSrc: ["'self'"], scriptSrc: ["'self'"], connectSrc: ["'self'"] } }))

const equal = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('')

app.use('/api/v1/*', async (c, next) => {
  if (c.req.path === '/api/v1/health') return next()
  const configured = c.env.SPARKPOD_ACCESS_TOKEN
  const authorization = c.req.header('Authorization')
  if (!configured) return c.json({ error: { category: 'configuration', safeMessage: 'SparkPod access control is not configured.', correlationId: crypto.randomUUID() } }, 503)
  if (!authorization?.startsWith('Bearer ') || !equal(authorization.slice(7), configured)) return c.json({ error: { category: 'authentication', safeMessage: 'Authentication required.', correlationId: crypto.randomUUID() } }, 401)
  c.set('ownerId', `usr_${(await hash(`${configured}:${c.env.SPARKPOD_SESSION_SECRET ?? ''}`)).slice(0, 24)}`)
  await next()
})

app.get('/api/v1/health', c => c.json({ service: 'sparkpod', version: '0.1.0', status: 'ok', providerConfigured: Boolean(c.env.DAYTONA_API_KEY), timestamp: new Date().toISOString() }))
app.get('/api/v1/health/provider', async c => {
  const provider = new DaytonaExecutionProvider({ apiKey: c.env.DAYTONA_API_KEY, apiUrl: c.env.DAYTONA_API_URL, target: c.env.DAYTONA_TARGET })
  return c.json({ provider: 'daytona', ...(await provider.health()) })
})

app.post('/api/v1/workspaces', async c => {
  const body = await c.req.json().catch(() => ({})) as { name?: string }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 80) return c.json({ error: { category: 'validation', safeMessage: 'Workspace name must contain 2–80 characters.' } }, 400)
  const id = `ws_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`
  const createdAt = new Date().toISOString()
  await c.env.DB.prepare('INSERT INTO workspaces (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, c.get('ownerId'), name, createdAt, createdAt).run()
  return c.json({ id, name, createdAt }, 201)
})

app.post('/api/v1/executions', async c => {
  const correlationId = crypto.randomUUID()
  try {
    const input = validateExecutionInput(await c.req.json())
    const workspace = await c.env.DB.prepare('SELECT id FROM workspaces WHERE id = ? AND owner_id = ?').bind(input.workspaceId, c.get('ownerId')).first()
    if (!workspace) return c.json({ error: { category: 'not_found', safeMessage: 'Workspace was not found.', correlationId } }, 404)
    const provider = new DaytonaExecutionProvider({ apiKey: c.env.DAYTONA_API_KEY, apiUrl: c.env.DAYTONA_API_URL, target: c.env.DAYTONA_TARGET })
    const response = await runExecution(provider, input, { correlationId })
    await c.env.DB.prepare(`INSERT INTO executions (id, workspace_id, owner_id, instruction, tool, provider, status, stage, response_json, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(response.id, response.workspaceId, c.get('ownerId'), input.instruction, response.tool, response.provider, response.status, response.stage, JSON.stringify(response), response.createdAt, response.finishedAt).run()
    return c.json(response, response.status === 'completed' ? 201 : 502)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.'
    return c.json({ error: { category: 'validation', retryable: false, safeMessage: message, stage: 'created', correlationId } }, 400)
  }
})

app.get('/api/v1/executions/:id', async c => {
  const row = await c.env.DB.prepare('SELECT response_json FROM executions WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('ownerId')).first<{ response_json: string }>()
  if (!row) return c.json({ error: { category: 'not_found', safeMessage: 'Execution was not found.' } }, 404)
  return c.json(JSON.parse(row.response_json) as ExecutionResponse)
})

app.post('/api/v1/executions/:id/cancel', async c => {
  const row = await c.env.DB.prepare('SELECT status FROM executions WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('ownerId')).first<{ status: string }>()
  if (!row) return c.json({ error: { category: 'not_found', safeMessage: 'Execution was not found.' } }, 404)
  return c.json({ error: { category: 'validation', safeMessage: `Execution is already ${row.status}; synchronous v0.1 executions cannot be cancelled.` } }, 409)
})

app.get('/', c => c.html(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SparkPod</title><meta name="description" content="Provider-safe isolated AI execution control surface"><link rel="stylesheet" href="/static/style.css"></head><body><header><a class="brand" href="/" aria-label="SparkPod home"><span class="mark">S</span><span>SparkPod</span><small>v0.1</small></a><span id="health" class="health">Checking service…</span></header><main><section class="intro"><p class="eyebrow">ISOLATED EXECUTION / DAYTONA</p><h1>Turn an instruction into<br><em>verified execution.</em></h1><p class="lede">A minimal control surface for disposable sandbox runs. Every execution is policy-limited, correlated, verified server-side, and cleaned up.</p></section><section class="panel" aria-labelledby="run-title"><div class="panel-head"><div><p class="step">01 / EXECUTION</p><h2 id="run-title">New run</h2></div><span id="state" class="state idle">IDLE</span></div><form id="run-form"><label>Access token<input id="token" type="password" autocomplete="off" placeholder="Server access token" required></label><label>Workspace name<input id="workspace" value="My Workspace" maxlength="80" required></label><label>Instruction<textarea id="instruction" rows="4" maxlength="500" required>Verify the SparkPod runtime</textarea></label><div class="policy"><span>Allowed tool</span><code>terminal.exec</code><span>Verified command</span><code>printf 'SparkPod OK'</code></div><button id="run-button" type="submit">Run in isolated sandbox <span>→</span></button></form></section><section class="timeline" aria-labelledby="timeline-title"><div class="panel-head"><div><p class="step">02 / LIFECYCLE</p><h2 id="timeline-title">Execution evidence</h2></div><span id="correlation">No correlation ID</span></div><ol id="events"><li class="empty">Run an execution to see provider-backed evidence.</li></ol><pre id="output" hidden></pre><p id="error" class="error" hidden></p></section></main><footer><span>SPARKPOD / CONTROL SURFACE</span><span>Provider-neutral orchestration · Daytona adapter</span></footer><script src="/static/app.js" defer></script></body></html>`))

export default app
