const $ = (id) => document.getElementById(id)
const state = $('state')
const button = $('run-button')
const events = $('events')
const output = $('output')
const errorBox = $('error')

function setState(value) {
  state.textContent = value.toUpperCase()
  state.className = `state ${value}`
}

async function api(path, token, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({ error: { safeMessage: 'The server returned an unreadable response.' } }))
  if (!response.ok && !data.id) throw Object.assign(new Error(data.error?.safeMessage || `Request failed (${response.status})`), { data })
  return data
}

fetch('/api/v1/health').then(r => r.json()).then(data => {
  $('health').textContent = data.status === 'ok' ? `Service online · ${data.providerConfigured ? 'Provider configured' : 'Provider not configured'}` : 'Service degraded'
  $('health').classList.add(data.providerConfigured ? 'ok' : 'warn')
}).catch(() => { $('health').textContent = 'Service unavailable' })

$('run-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const token = $('token').value
  button.disabled = true
  output.hidden = true
  errorBox.hidden = true
  events.innerHTML = '<li class="active"><span></span><div><strong>Creating workspace</strong><small>Authenticating and establishing isolation boundary</small></div></li>'
  setState('creating')
  try {
    const workspace = await api('/api/v1/workspaces', token, { method: 'POST', body: JSON.stringify({ name: $('workspace').value }) })
    setState('running')
    events.innerHTML += '<li class="active"><span></span><div><strong>Provider lifecycle running</strong><small>Create → ready → execute → verify → cleanup</small></div></li>'
    const execution = await api('/api/v1/executions', token, { method: 'POST', body: JSON.stringify({ workspaceId: workspace.id, instruction: $('instruction').value, tool: 'terminal.exec', input: { command: "printf \'SparkPod OK\'" } }) })
    $('correlation').textContent = execution.correlationId
    events.innerHTML = execution.events.map(item => `<li class="done"><span></span><div><strong>${item.event}</strong><small>${item.stage}${item.durationMs ? ` · ${item.durationMs}ms` : ''}</small></div></li>`).join('')
    if (execution.status === 'completed') {
      setState('completed')
      output.textContent = execution.result.stdout
      output.hidden = false
    } else {
      setState('failed')
      errorBox.textContent = `${execution.error.safeMessage} (${execution.error.category})`
      errorBox.hidden = false
    }
  } catch (error) {
    setState('failed')
    errorBox.textContent = error.message
    errorBox.hidden = false
  } finally {
    button.disabled = false
  }
})
