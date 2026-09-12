import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { DaytonaExecutionProvider } from './providers/daytona'
import { runExecution, validateExecutionInput } from './orchestrator'
import type { ExecutionResponse } from './domain'

export interface Bindings {
  DB: D1Database
  DAYTONA_API_KEY?: string
  DAYTONA_API_URL?: string
  DAYTONA_TARGET?: string
  SPARKPOD_ACCESS_TOKEN?: string
  SPARKPOD_SESSION_SECRET?: string
}
type Variables = { ownerId: string }
type WorkspaceRow = { id: string; name: string; created_at: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use('*', secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'self'"], styleSrc: ["'self'"], scriptSrc: ["'self'"], connectSrc: ["'self'"], imgSrc: ["'self'", 'data:'] } }))

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

app.get('/api/v1/workspaces/current', async c => {
  const workspace = await c.env.DB.prepare('SELECT id, name, created_at FROM workspaces WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1').bind(c.get('ownerId')).first<WorkspaceRow>()
  if (!workspace) return c.json({ workspace: null, latestExecution: null })
  const execution = await c.env.DB.prepare('SELECT response_json FROM executions WHERE workspace_id = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 1').bind(workspace.id, c.get('ownerId')).first<{ response_json: string }>()
  return c.json({
    workspace: { id: workspace.id, name: workspace.name, createdAt: workspace.created_at },
    latestExecution: execution ? JSON.parse(execution.response_json) as ExecutionResponse : null,
  })
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

app.get('/', c => c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SparkPod — Verified execution workspace</title>
  <meta name="description" content="Run policy-approved instructions in isolated, disposable sandboxes.">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2311130f'/%3E%3Ctext x='32' y='43' text-anchor='middle' font-size='34' fill='%23d9ff53' font-family='monospace'%3ES%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="SparkPod home"><span class="brand-mark">S</span><span>SparkPod</span><small>0.2</small></a>
    <span id="health" class="health" role="status">Checking service…</span>
  </header>

  <main>
    <section class="hero" aria-labelledby="page-title">
      <p class="eyebrow">POLICY-BOUND / ISOLATED / VERIFIED</p>
      <h1 id="page-title">Your execution<br><em>control room.</em></h1>
      <p class="lede">Authenticate once for this tab, choose your workspace, and run the approved SparkPod verification lifecycle without developer tooling.</p>
    </section>

    <section class="auth-card" id="access-section" aria-labelledby="access-title">
      <header class="section-heading">
        <div><p class="step">01 / ACCESS</p><h2 id="access-title">Connect securely</h2></div>
        <span id="auth-state" class="status-chip idle">SIGNED OUT</span>
      </header>
      <form id="auth-form">
        <label for="token">SparkPod access token</label>
        <div class="field-action">
          <input id="token" type="password" autocomplete="off" placeholder="Bearer token" required aria-describedby="token-note">
          <button id="connect-button" type="submit" class="button secondary">Connect</button>
        </div>
        <small id="token-note" class="helper">Kept only in this browser tab. Never added to URLs or saved to storage.</small>
      </form>
      <p id="auth-error" class="notice error" hidden></p>
    </section>

    <section class="workspace-card" id="workspace-section" aria-labelledby="workspace-title" hidden>
      <header class="section-heading">
        <div><p class="step">02 / WORKSPACE</p><h2 id="workspace-title">Execution workspace</h2></div>
        <span id="state" class="status-chip idle">IDLE</span>
      </header>

      <aside class="workspace-identity" aria-label="Current workspace">
        <div><span class="meta-label">CURRENT WORKSPACE</span><strong id="workspace-display">Not selected</strong><code id="workspace-id">—</code></div>
        <button id="change-workspace" type="button" class="text-button">New workspace</button>
      </aside>

      <form id="workspace-form" class="compact-form" hidden>
        <label for="workspace-name">Workspace name</label>
        <div class="field-action">
          <input id="workspace-name" value="My Workspace" minlength="2" maxlength="80" required>
          <button id="create-workspace" type="submit" class="button secondary">Create</button>
        </div>
      </form>

      <form id="run-form">
        <label for="instruction">Execution instruction</label>
        <textarea id="instruction" rows="5" minlength="3" maxlength="500" required aria-describedby="instruction-note">Verify the SparkPod runtime</textarea>
        <div class="input-meta"><small id="instruction-note">Describe the intent. The server chooses the executable command.</small><span id="character-count">27 / 500</span></div>
        <aside class="policy" aria-label="Execution policy">
          <div><span>APPROVED TOOL</span><code>terminal.exec</code></div>
          <div><span>SERVER COMMAND</span><code>printf 'SparkPod OK'</code></div>
          <p>Arbitrary shell commands are not accepted. The server remains authoritative.</p>
        </aside>
        <button id="run-button" type="submit" class="button primary" disabled><span>Run approved execution</span><span aria-hidden="true">→</span></button>
      </form>
      <p id="capability-note" class="helper capability">Cancellation is unavailable for synchronous v0.1 runs. Closing this page does not cancel a provider operation.</p>
    </section>

    <section class="evidence-card" id="evidence-section" aria-labelledby="evidence-title">
      <header class="section-heading">
        <div><p class="step">03 / EVIDENCE</p><h2 id="evidence-title">Lifecycle & result</h2></div>
        <span id="correlation" title="Correlation ID">NO EXECUTION</span>
      </header>
      <div id="execution-summary" class="execution-summary" hidden>
        <div><span class="meta-label">EXECUTION</span><code id="execution-id">—</code></div>
        <div><span class="meta-label">VERIFICATION</span><strong id="verification">—</strong></div>
      </div>
      <ol id="events" class="timeline" aria-live="polite"><li class="empty">Connect to a workspace, then run an instruction to see server-reported evidence.</li></ol>
      <section id="result-panel" class="result-panel" hidden aria-labelledby="result-title">
        <header><span id="result-title">SAFE OUTPUT</span><span id="duration"></span></header>
        <pre id="output"></pre>
      </section>
      <section id="error-panel" class="error-panel" hidden aria-labelledby="error-title">
        <span id="error-title">EXECUTION FAILED</span>
        <strong id="error-message"></strong>
        <small id="error-detail"></small>
      </section>
      <button id="retry-button" type="button" class="button secondary retry" hidden>Retry as a new execution</button>
    </section>
  </main>

  <footer><span>SPARKPOD / SESSION 2</span><span>Provider-neutral orchestration · credentials remain server-side</span></footer>
  <script src="/static/app.js" defer></script>
</body>
</html>`))

export default app
