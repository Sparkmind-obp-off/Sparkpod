const $ = (id) => document.getElementById(id)

const ui = {
  authForm: $('auth-form'),
  authState: $('auth-state'),
  authError: $('auth-error'),
  connectButton: $('connect-button'),
  token: $('token'),
  workspaceSection: $('workspace-section'),
  workspaceForm: $('workspace-form'),
  workspaceName: $('workspace-name'),
  workspaceDisplay: $('workspace-display'),
  workspaceId: $('workspace-id'),
  changeWorkspace: $('change-workspace'),
  runForm: $('run-form'),
  runButton: $('run-button'),
  retryButton: $('retry-button'),
  instruction: $('instruction'),
  characterCount: $('character-count'),
  state: $('state'),
  correlation: $('correlation'),
  executionSummary: $('execution-summary'),
  executionId: $('execution-id'),
  verification: $('verification'),
  events: $('events'),
  resultPanel: $('result-panel'),
  output: $('output'),
  duration: $('duration'),
  errorPanel: $('error-panel'),
  errorMessage: $('error-message'),
  errorDetail: $('error-detail'),
}

const session = {
  token: '',
  workspace: null,
  latestExecution: null,
  busy: false,
}

const eventCopy = {
  'execution.created': ['Execution accepted', 'The server created a correlated execution record.'],
  'sandbox.created': ['Sandbox created', 'The provider returned an isolated sandbox session.'],
  'sandbox.ready': ['Sandbox ready', 'The server confirmed provider readiness.'],
  'tool.started': ['Approved tool running', 'The server started the policy-approved command.'],
  'tool.completed': ['Tool finished', 'The provider returned execution output.'],
  'execution.completed': ['Result verified', 'Output matched the server-side verification policy.'],
  'execution.failed': ['Execution failed', 'The server stopped the lifecycle with a normalized error.'],
  'sandbox.cleaned': ['Sandbox cleaned', 'Disposable provider resources were removed.'],
  'sandbox.cleanup_failed': ['Cleanup not confirmed', 'The server could not confirm provider cleanup.'],
}

function setChip(element, value) {
  element.textContent = value.toUpperCase()
  element.className = `status-chip ${value}`
}

function setBusy(value) {
  session.busy = value
  ui.connectButton.disabled = value
  ui.changeWorkspace.disabled = value
  ui.runButton.disabled = value || !session.workspace
  ui.retryButton.disabled = value
  ui.instruction.disabled = value
}

function safeError(error, fallback = 'The request could not be completed.') {
  const data = error?.data?.error
  return {
    message: data?.safeMessage || error?.message || fallback,
    category: data?.category || 'network',
    stage: data?.stage || '',
    correlationId: data?.correlationId || '',
    retryable: Boolean(data?.retryable),
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({ error: { safeMessage: 'The server returned an unreadable response.' } }))
  if (!response.ok) {
    const error = new Error(data.error?.safeMessage || `Request failed (${response.status}).`)
    error.data = data
    error.status = response.status
    throw error
  }
  return data
}

function clearEvidence(message = 'Run an instruction to see server-reported evidence.') {
  ui.correlation.textContent = 'NO EXECUTION'
  ui.correlation.title = 'No correlation ID'
  ui.executionSummary.hidden = true
  ui.resultPanel.hidden = true
  ui.errorPanel.hidden = true
  ui.retryButton.hidden = true
  ui.events.innerHTML = ''
  const item = document.createElement('li')
  item.className = 'empty'
  item.textContent = message
  ui.events.append(item)
}

function renderWorkspace(workspace) {
  session.workspace = workspace
  ui.workspaceDisplay.textContent = workspace?.name || 'Not selected'
  ui.workspaceId.textContent = workspace?.id || '—'
  ui.workspaceForm.hidden = Boolean(workspace)
  ui.runForm.hidden = !workspace
  ui.runButton.disabled = session.busy || !workspace
  setChip(ui.state, 'idle')
}

function appendPending(label, detail) {
  ui.events.innerHTML = ''
  const item = document.createElement('li')
  item.className = 'active'
  const marker = document.createElement('span')
  const content = document.createElement('div')
  const title = document.createElement('strong')
  const description = document.createElement('small')
  title.textContent = label
  description.textContent = detail
  content.append(title, description)
  item.append(marker, content)
  ui.events.append(item)
}

function renderEvents(items = []) {
  ui.events.innerHTML = ''
  if (!items.length) {
    clearEvidence('The server returned no lifecycle events.')
    return
  }
  items.forEach((item) => {
    const row = document.createElement('li')
    row.className = item.event.includes('failed') ? 'failed' : 'done'
    const marker = document.createElement('span')
    const content = document.createElement('div')
    const title = document.createElement('strong')
    const description = document.createElement('small')
    const copy = eventCopy[item.event] || [item.event, `Server stage: ${item.stage}`]
    title.textContent = copy[0]
    description.textContent = `${copy[1]}${item.durationMs ? ` · ${item.durationMs} ms` : ''}`
    content.append(title, description)
    row.append(marker, content)
    ui.events.append(row)
  })
}

function showFailure(error, executionId = '') {
  const failure = error?.safeMessage ? error : safeError(error)
  setChip(ui.state, 'failed')
  ui.resultPanel.hidden = true
  ui.errorPanel.hidden = false
  ui.errorMessage.textContent = failure.safeMessage || failure.message
  const details = [failure.category, failure.stage].filter(Boolean).join(' · ')
  ui.errorDetail.textContent = details ? `Category / stage: ${details}` : 'No additional safe details are available.'
  const correlationId = failure.correlationId || error?.correlationId
  if (correlationId) {
    ui.correlation.textContent = correlationId
    ui.correlation.title = correlationId
  }
  if (executionId) {
    ui.executionSummary.hidden = false
    ui.executionId.textContent = executionId
    ui.verification.textContent = 'NOT VERIFIED'
  }
  ui.retryButton.hidden = !session.workspace
}

function renderExecution(execution) {
  session.latestExecution = execution
  ui.correlation.textContent = execution.correlationId || 'NO CORRELATION ID'
  ui.correlation.title = execution.correlationId || 'No correlation ID'
  ui.executionSummary.hidden = false
  ui.executionId.textContent = execution.id || '—'
  renderEvents(execution.events)

  const verified = execution.status === 'completed' && execution.result?.verified === true
  if (verified) {
    setChip(ui.state, 'completed')
    ui.verification.textContent = 'VERIFIED'
    ui.errorPanel.hidden = true
    ui.resultPanel.hidden = false
    ui.output.textContent = execution.result.stdout || '(empty output)'
    ui.duration.textContent = Number.isFinite(execution.result.durationMs) ? `${execution.result.durationMs} ms` : ''
    ui.retryButton.hidden = false
    return
  }

  showFailure(execution.error || {
    safeMessage: 'The server did not return a verified result.',
    category: 'execution',
    stage: execution.stage,
    correlationId: execution.correlationId,
  }, execution.id)
}

async function loadWorkspace() {
  const data = await api('/api/v1/workspaces/current')
  renderWorkspace(data.workspace)
  if (data.latestExecution) renderExecution(data.latestExecution)
  else clearEvidence(data.workspace ? 'Workspace ready. Run an instruction to begin.' : 'Create a workspace to begin.')
}

async function connect(event) {
  event.preventDefault()
  if (session.busy) return
  const token = ui.token.value.trim()
  if (!token) return
  session.token = token
  ui.authError.hidden = true
  setBusy(true)
  setChip(ui.authState, 'waiting')
  try {
    await loadWorkspace()
    setChip(ui.authState, 'ready')
    ui.workspaceSection.hidden = false
    ui.token.value = ''
  } catch (error) {
    session.token = ''
    session.workspace = null
    setChip(ui.authState, 'failed')
    ui.workspaceSection.hidden = true
    const failure = safeError(error, 'Could not authenticate with SparkPod.')
    ui.authError.textContent = failure.message
    ui.authError.hidden = false
  } finally {
    setBusy(false)
  }
}

async function createWorkspace(event) {
  event.preventDefault()
  if (session.busy) return
  setBusy(true)
  setChip(ui.state, 'creating')
  clearEvidence('Creating the authenticated workspace…')
  try {
    const workspace = await api('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: ui.workspaceName.value }),
    })
    renderWorkspace(workspace)
    clearEvidence('Workspace ready. Run an instruction to begin.')
  } catch (error) {
    showFailure(error)
  } finally {
    setBusy(false)
  }
}

async function runExecution(event) {
  event?.preventDefault()
  if (session.busy || !session.workspace) return
  setBusy(true)
  setChip(ui.state, 'waiting')
  ui.resultPanel.hidden = true
  ui.errorPanel.hidden = true
  ui.retryButton.hidden = true
  appendPending('Waiting for server lifecycle', 'Creating, readiness, execution, verification, and cleanup are confirmed by the final API response.')
  try {
    const execution = await api('/api/v1/executions', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: session.workspace.id,
        instruction: ui.instruction.value,
        tool: 'terminal.exec',
      }),
    })
    renderExecution(execution)
  } catch (error) {
    const response = error?.data
    if (response?.id) renderExecution(response)
    else showFailure(error)
  } finally {
    setBusy(false)
  }
}

ui.authForm.addEventListener('submit', connect)
ui.workspaceForm.addEventListener('submit', createWorkspace)
ui.runForm.addEventListener('submit', runExecution)
ui.retryButton.addEventListener('click', runExecution)
ui.changeWorkspace.addEventListener('click', () => {
  if (session.busy) return
  session.workspace = null
  ui.workspaceForm.hidden = false
  ui.runForm.hidden = true
  ui.workspaceName.focus()
  clearEvidence('Create a new authenticated workspace to continue.')
  setChip(ui.state, 'idle')
})
ui.instruction.addEventListener('input', () => {
  ui.characterCount.textContent = `${ui.instruction.value.length} / 500`
})

fetch('/api/v1/health')
  .then((response) => response.json())
  .then((data) => {
    $('health').textContent = data.status === 'ok'
      ? `Service online · ${data.providerConfigured ? 'provider configured' : 'provider setup pending'}`
      : 'Service degraded'
    $('health').classList.add(data.providerConfigured ? 'ok' : 'warn')
  })
  .catch(() => { $('health').textContent = 'Service unavailable' })

clearEvidence('Connect to load workspace state from the API.')
