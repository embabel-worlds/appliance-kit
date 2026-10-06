/*
 * API KEYS — a credential that is not a person's password.
 *
 * The appliance's REST and MCP doors have always taken the account's own sign-in, which is the
 * wrong thing to paste into a service's configuration: it is the whole account, it cannot be
 * revoked without changing the password, and nothing records that it was used. A key is minted
 * for one purpose, named for it, shown ONCE, and revoked on its own.
 *
 * The house rule for secrets applies with more force than usual here, because this is the only
 * screen that ever holds the whole key: masked on screen, whole on the clipboard, gone from
 * state the moment the panel is dismissed. The list below it shows a prefix and nothing more —
 * the appliance keeps a hash, so there is nothing it COULD show, and that is the point.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { ApiKeySummary, ApiKeysSurfaceProps, MintedApiKey, SurfaceFrameParts } from '../contracts.ts'
import { useFocusTrap } from '../../useFocusTrap.ts'
import { CopyButton, Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'

const NAME_LIMIT = 64
const MASK = '••••••••••••••••'

/** A date the row can be read at a glance; the ISO text stays on the title for the exact moment. */
function when(iso: string | null): string {
  if (!iso) return 'never'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/** What a key can do, in the words the form used when it was created. */
function access(key: ApiKeySummary): string {
  if (!key.agents) return 'Full access'
  return key.agents.includes('*') ? 'All agents' : `Agents: ${key.agents.join(', ')}`
}

/** The kit's own frame: a titled panel with the actions beside the title. */
function StudioFrame({ title, actions, children }: SurfaceFrameParts) {
  return <StudioPanel title={title} aside={actions}>{children}</StudioPanel>
}

export function ApiKeysSurface({ services, host, frame = StudioFrame }: ApiKeysSurfaceProps) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [absent, setAbsent] = useState(false)
  const [problem, setProblem] = useState('')
  const [name, setName] = useState('')
  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState<MintedApiKey | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  // What the key is for: everything its owner can do, or only talking to agents.
  const [forAgents, setForAgents] = useState(false)
  const [agents, setAgents] = useState('*')

  const load = useCallback(async () => {
    const result = await services.listKeys()
    setLoaded(true)
    if (!result.ok) {
      setAbsent(result.kind === 'unsupported')
      setProblem(failureMessage(result, 'list API keys'))
      return
    }
    setAbsent(false)
    setProblem('')
    setKeys(result.value)
  }, [services])

  useEffect(() => {
    void load()
  }, [load])

  async function mint(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || minting) return
    const named = agents.split(',').map((a) => a.trim()).filter(Boolean)
    if (forAgents && named.length === 0) return
    setMinting(true)
    const result = await services.mintKey(trimmed, forAgents ? named : undefined)
    setMinting(false)
    if (!result.ok) {
      setProblem(failureMessage(result, 'create an API key'))
      return
    }
    setProblem('')
    setName('')
    setMinted(result.value)
    await load()
  }

  async function revoke(key: ApiKeySummary) {
    if (!(await host.confirmRevoke(key))) return
    setRevoking(key.id)
    const result = await services.revokeKey(key.id)
    setRevoking(null)
    if (!result.ok) {
      setProblem(failureMessage(result, 'revoke an API key'))
      return
    }
    setProblem('')
    await load()
  }

  const baseUrl = (host.initialBaseUrl ?? '').trim().replace(/\/+$/, '') || 'https://your-appliance.example'
  const example = [
    `export EMBABEL_API_KEY=emb_…`,
    `curl -H "X-Embabel-Api-Key: $EMBABEL_API_KEY" ${baseUrl}/api/v1/watches`,
  ].join('\n')
  // An agent key goes into a chat client, which wants a base URL and a key and names the agent as the model.
  const agentExample = [
    `Base URL: ${baseUrl}/api/v1/openai/v1`,
    `API key:  emb_…`,
    `Model:    the agent's name, e.g. jonathon`,
  ].join('\n')

  return (
    <div className="kit-feature kit-feature-api-keys apikeys">
      {frame({
        title: 'API keys',
        actions: <button className="btn ghost tiny" onClick={() => void load()}>Refresh</button>,
        refresh: () => void load(),
        children: <>
        <p className="hint">
          An API key lets a program sign in to this appliance as you, without your password.
          Create one key for each program, so you can switch one off without affecting the others.
        </p>
        <ol className="hint keysteps">
          <li>Name the key after the program that will use it.</li>
          <li>Choose its access: full access does everything you can, agents only can just chat with agents.</li>
          <li>Create the key and copy it straight away. It is shown once.</li>
          <li>Paste it into the program. The examples at the bottom show where.</li>
        </ol>

        {absent ? (
          <Status tone="caution">{problem}</Status>
        ) : (
          <>
            {minted && <Minted minted={minted} onDismiss={() => setMinted(null)} />}

            <form className="row" onSubmit={(event) => void mint(event)}>
              <label className="field grow">
                <span>Name</span>
                <input
                  value={name}
                  maxLength={NAME_LIMIT}
                  placeholder="e.g. Open WebUI, deploy script"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Access</span>
                <select value={forAgents ? 'agents' : 'all'} onChange={(event) => setForAgents(event.target.value === 'agents')}>
                  <option value="all">Full access</option>
                  <option value="agents">Agents only</option>
                </select>
              </label>
              {forAgents && (
                <label className="field">
                  <span>Which agents</span>
                  <input
                    value={agents}
                    placeholder="names separated by commas, or * for all"
                    onChange={(event) => setAgents(event.target.value)}
                  />
                </label>
              )}
              <button className="btn primary inline-action" type="submit" disabled={!name.trim() || minting}>
                {minting ? 'Creating…' : 'Create key'}
              </button>
            </form>

            {problem && <Status tone="error">{problem}</Status>}

            {loaded && keys.length === 0 && !problem && (
              <p className="hint">No keys yet.</p>
            )}

            {keys.length > 0 && (
              <div className="tablewrap">
                <table className="results-table keytable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Key</th>
                      <th>Access</th>
                      <th>Created</th>
                      <th>Last used</th>
                      <th aria-label="actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((key) => (
                      <tr key={key.id}>
                        <td>{key.name}</td>
                        <td><code>{key.prefix}…</code></td>
                        <td>{access(key)}</td>
                        <td title={key.createdAt}>{when(key.createdAt)}</td>
                        <td title={key.lastUsedAt ?? undefined}>{when(key.lastUsedAt)}</td>
                        <td>
                          <button
                            className="btn ghost tiny arm"
                            disabled={revoking === key.id}
                            onClick={() => void revoke(key)}
                          >
                            {revoking === key.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="snippet">
              <div className="snippet-head">
                <strong>Full access key: scripts and services</strong>
                <CopyButton label="Copy" text={example} />
              </div>
              <pre className="cmd">{example}</pre>
              <p className="hint">
                Send the key in the <code>X-Embabel-Api-Key</code> header. If a program can only
                set <code>Authorization</code>, use <code>Authorization: Bearer</code> followed by
                the key.
              </p>
              <div className="snippet-head">
                <strong>Agents-only key: chat clients such as Open WebUI or LibreChat</strong>
                <CopyButton label="Copy" text={agentExample} />
              </div>
              <pre className="cmd">{agentExample}</pre>
              <p className="hint">
                Enter these in the chat client's connection settings. The model is the name of
                the agent you want to talk to.
              </p>
              <p className="hint">
                Keep a key in an environment variable or a secrets store, never in a URL or a
                repository. If a key leaks, revoke it here and create a new one.
              </p>
            </div>
          </>
        )}
        </>,
      })}
    </div>
  )
}

/*
 * The only rendering of a whole key, anywhere. Focus is trapped so the keyboard cannot wander
 * off before the person has decided what to do with it, and the secret leaves React state with
 * the panel — there is no "show it again", because the appliance could not honour one.
 */
function Minted({ minted, onDismiss }: { minted: MintedApiKey; onDismiss(): void }) {
  const [reveal, setReveal] = useState(false)
  const trap = useFocusTrap<HTMLDivElement>(true)
  return (
    <div className="keyreveal" role="dialog" aria-label={`API key ${minted.name}`} ref={trap}>
      <strong>Your new key, “{minted.name}”</strong>
      <p className="hint">
        Copy it now. It will not be shown again — the appliance keeps only a hash — so put it
        straight into the environment variable or secrets store of whatever will use it.
      </p>
      <pre className="cmd keyvalue" aria-live="polite">{reveal ? minted.key : `${minted.prefix}${MASK}`}</pre>
      <div className="row">
        <CopyButton label="Copy key" text={minted.key} />
        <button className="btn ghost" onClick={() => setReveal((value) => !value)}>
          {reveal ? 'Hide it' : 'Show it'}
        </button>
        <button className="btn ghost" onClick={onDismiss}>Done, I have copied it</button>
      </div>
    </div>
  )
}
