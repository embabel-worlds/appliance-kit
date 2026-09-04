import React, { useCallback, useEffect, useState } from 'react'
import type { Outcome } from '../../../client/outcome.ts'
import type {
  AgentConnection,
  AgentCredential,
  CodingAgentsSurfaceProps,
  McpProbe,
} from '../contracts.ts'
import { Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'

type McpState = 'noprobe' | 'down' | 'guarded' | 'open' | 'up'
type AuthKind = AgentCredential['kind']

const MODE_SAYS: Record<string, string> = {
  ASSISTANT: 'Your data and nothing else — the right default.',
  DEVELOPER: 'Also lets an agent install a realm and ask how to write one, and makes its orientation lead with realms rather than stay silent about them.',
}

const DEFAULT_MODES = ['ASSISTANT', 'DEVELOPER']

function probeState(outcome: Outcome<McpProbe>): McpState {
  if (!outcome.ok) {
    if (outcome.kind === 'unsupported') return 'noprobe'
    if (outcome.kind === 'unreachable') return 'down'
    return 'up'
  }

  const status = outcome.value.status
  if (status == null) return 'noprobe'
  if (status === 0) return 'down'
  if (status === 401) return 'guarded'
  if (status >= 200 && status < 300) return 'open'
  return 'up'
}

export function CodingAgentsSurface({
  services,
  host,
}: CodingAgentsSurfaceProps) {
  const currentCredential = host.currentCredential()
  const [mcp, setMcp] = useState<McpState | 'probing'>('probing')
  const [probeMessage, setProbeMessage] = useState('')
  const [mode, setMode] = useState('')
  const [modes, setModes] = useState<string[]>([])
  const [modeStatus, setModeStatus] = useState<{ tone: 'ok' | 'error' | null; text: string }>({
    tone: null,
    text: '',
  })
  const [changedMode, setChangedMode] = useState(false)
  const [authKind, setAuthKind] = useState<AuthKind>(() => currentCredential?.kind ?? 'basic')
  const [token, setToken] = useState('')
  const [username, setUsername] = useState(() => currentCredential?.username ?? '')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [baseUrl, setBaseUrl] = useState(host.initialBaseUrl ?? '')

  const load = useCallback(async () => {
    setMcp('probing')
    const [probe, modeConfig] = await Promise.all([
      services.probeMcp(),
      services.getMcpMode(),
    ])

    setMcp(probeState(probe))
    setProbeMessage(probe.ok || probe.kind === 'unsupported' ? '' : failureMessage(probe, 'MCP status'))

    if (modeConfig.ok) {
      setMode(modeConfig.value.mode ?? '')
      setModes(modeConfig.value.modes ?? DEFAULT_MODES)
      setModeStatus({ tone: null, text: '' })
    } else {
      setModeStatus({ tone: 'error', text: failureMessage(modeConfig, 'MCP mode settings') })
    }
  }, [services])

  useEffect(() => {
    void load()
  }, [load])

  async function chooseMode(next: string) {
    setModeStatus({ tone: null, text: 'switching…' })
    const result = await services.setMcpMode(next)
    if (!result.ok) {
      setModeStatus({ tone: 'error', text: failureMessage(result, 'MCP mode settings') })
      return
    }
    setMode(next)
    setChangedMode(true)
    setModeStatus({
      tone: 'ok',
      text: result.value.message ?? `switched to ${next.toLowerCase()} mode`,
    })
  }

  const url = baseUrl.trim().replace(/\/+$/, '')
  const suppliedCredential = currentCredential?.kind === authKind ? currentCredential : null
  const typedCredential: AgentCredential | null = authKind === 'bearer'
    ? token.trim() ? { kind: 'bearer', value: token.trim() } : null
    : username.trim() && password
      ? { kind: 'basic', username: username.trim(), value: password }
      : null
  const credential = suppliedCredential ?? typedCredential
  const haveCredential = credential !== null
  const canRender = Boolean(url && credential)

  const renderConnection = (client: AgentConnection['client']): string => {
    if (!credential || !url) return 'Enter an appliance URL and credential to build these instructions.'
    return host.renderConnection({ client, baseUrl: url, credential })
  }

  const mask = (text: string): string => {
    if (reveal || !credential) return text
    const withoutRawSecret = credential.value ? text.replaceAll(credential.value, '••••••••') : text
    return withoutRawSecret.replace(/\b(Basic|Bearer)\s+[^\s"'`}]+/g, '$1 ••••••••')
  }

  const claudeConnection = renderConnection('claude')
  const codexConnection = renderConnection('codex')
  const endpointLamp = mcp === 'guarded' || mcp === 'open'
    ? 'lit'
    : mcp === 'down'
      ? 'alert'
      : 'unlit'

  return (
    <div className="kit-feature kit-feature-coding-agents agents">
      <StudioPanel
        title="Coding agents"
        aside={<button className="btn ghost tiny" onClick={() => void load()}>Refresh</button>}
      >
        <p className="hint">
          Connect Claude Code or Codex through MCP so it can work with your documents, graph, and realms.
        </p>

        <div className="ladder">
          <div className="rung">
            <span className={`lamp lamp-${endpointLamp}`} />
            <div className="rung-body">
              <strong>MCP connection</strong>
              <p className="hint">
                {mcp === 'guarded' ? 'Ready. An agent must authenticate before it can use your world.' :
                 mcp === 'open' ? <>Ready, but <strong>unguarded</strong> — anything that can reach the appliance can use your world.</> :
                 mcp === 'down' ? (probeMessage || 'The appliance could not be reached.') :
                 mcp === 'noprobe' ? 'Connection status is not available for this appliance.' :
                 mcp === 'probing' ? 'checking…' :
                 (probeMessage || 'The MCP service is responding.')}
              </p>
            </div>
          </div>

          <div className="rung">
            <span className={`lamp lamp-${mode ? 'lit' : 'unlit'}`} />
            <div className="rung-body">
              <strong>What an agent may do</strong>
              <p className="hint">{MODE_SAYS[mode] ?? 'Pick what an agent connecting here is allowed to do.'}</p>
              <div className="row">
                <label className="field">
                  <span>Mode</span>
                  <select value={mode} onChange={(event) => void chooseMode(event.target.value)}>
                    {mode === '' && <option value="">unknown</option>}
                    {(modes.length ? modes : DEFAULT_MODES).map((availableMode) => (
                      <option key={availableMode} value={availableMode}>
                        {availableMode === 'ASSISTANT'
                          ? 'Assistant — my data'
                          : availableMode === 'DEVELOPER'
                            ? 'Developer — also build realms'
                            : availableMode}
                      </option>
                    ))}
                  </select>
                </label>
                <Status tone={modeStatus.tone}>{modeStatus.text}</Status>
              </div>
              {changedMode && (
                <p className="hint">
                  This takes effect immediately. An agent that is already connected can try its call again.
                </p>
              )}
            </div>
          </div>

          <div className="rung">
            <span className={`lamp lamp-${canRender ? 'lit' : 'unlit'}`} />
            <div className="rung-body">
              <strong>Point an agent at it</strong>
              <p className="hint">
                Build the connection instructions here, then copy them into your coding agent.
              </p>
              <div className="row">
                <label className="field grow">
                  <span>Appliance URL an agent will reach</span>
                  <input
                    value={baseUrl}
                    placeholder="https://your-appliance.example"
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                </label>
              </div>

              <div className="row authpick">
                <button
                  className={`btn${authKind === 'basic' ? ' primary' : ' ghost'}`}
                  onClick={() => setAuthKind('basic')}
                >
                  Use my sign-in
                </button>
                <button
                  className={`btn${authKind === 'bearer' ? ' primary' : ' ghost'}`}
                  onClick={() => setAuthKind('bearer')}
                >
                  Use a bearer token
                </button>
              </div>

              {authKind === 'basic' ? (
                <>
                  <p className="hint">
                    Use the username and password for the account the coding agent should act as.
                    {suppliedCredential && ' The host has supplied your current credential.'}
                  </p>
                  {!suppliedCredential && (
                    <div className="row">
                      <label className="field">
                        <span>Username</span>
                        <input value={username} onChange={(event) => setUsername(event.target.value)} />
                      </label>
                      <label className="field">
                        <span>Password</span>
                        <input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                  <p className="hint">
                    The agent's configuration may contain this credential in a readable form. Anyone who can
                    read that configuration can use the same account.
                  </p>
                </>
              ) : (
                <>
                  {suppliedCredential ? (
                    <p className="hint">The host has supplied your current bearer credential.</p>
                  ) : (
                    <div className="row">
                      <label className="field grow">
                        <span>Bearer token</span>
                        <input
                          type="password"
                          value={token}
                          placeholder="Paste a token for this appliance"
                          onChange={(event) => setToken(event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                  <p className="hint">
                    Use a bearer token created for the appliance when you do not want the agent to carry your sign-in.
                  </p>
                </>
              )}

              <p className="hint">
                Credentials entered here stay in this page only long enough to build the instructions.{' '}
                {haveCredential && (
                  <button className="status as-link" onClick={() => setReveal((value) => !value)}>
                    {reveal ? 'hide it' : 'show it'}
                  </button>
                )}
              </p>

              <Snippet
                label="Claude Code"
                shown={mask(claudeConnection)}
                copy={claudeConnection}
                disabled={!canRender}
              />
              <Snippet
                label="Codex"
                shown={mask(codexConnection)}
                copy={codexConnection}
                disabled={!canRender}
              />
            </div>
          </div>
        </div>
      </StudioPanel>
    </div>
  )
}

function Snippet({
  label,
  shown,
  copy,
  disabled,
}: {
  label: string
  shown: string
  copy: string
  disabled?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="snippet">
      <div className="snippet-head">
        <strong>{label}</strong>
        <button
          className="btn ghost tiny"
          disabled={disabled}
          onClick={() => {
            void navigator.clipboard?.writeText(copy)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="cmd">{shown}</pre>
    </div>
  )
}
