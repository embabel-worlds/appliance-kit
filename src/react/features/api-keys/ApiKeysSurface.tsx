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
import type { ApiKeySummary, ApiKeysSurfaceProps, MintedApiKey } from '../contracts.ts'
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

export function ApiKeysSurface({ services, host }: ApiKeysSurfaceProps) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [loaded, setLoaded] = useState(false)
  const [absent, setAbsent] = useState(false)
  const [problem, setProblem] = useState('')
  const [name, setName] = useState('')
  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState<MintedApiKey | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

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
    setMinting(true)
    const result = await services.mintKey(trimmed)
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

  return (
    <div className="kit-feature kit-feature-api-keys apikeys">
      <StudioPanel
        title="API keys"
        aside={<button className="btn ghost tiny" onClick={() => void load()}>Refresh</button>}
      >
        <p className="hint">
          A key lets a script, a service or a coding agent call this appliance as you without
          carrying your password. Each one is named for what holds it and can be revoked on its own.
        </p>

        {absent ? (
          <Status tone="caution">{problem}</Status>
        ) : (
          <>
            {minted && <Minted minted={minted} onDismiss={() => setMinted(null)} />}

            <form className="row" onSubmit={(event) => void mint(event)}>
              <label className="field grow">
                <span>What will hold this key</span>
                <input
                  value={name}
                  maxLength={NAME_LIMIT}
                  placeholder="deploy pipeline, Slack relay, laptop"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <button className="btn primary inline-action" type="submit" disabled={!name.trim() || minting}>
                {minting ? 'Creating…' : 'Create key'}
              </button>
            </form>

            {problem && <Status tone="error">{problem}</Status>}

            {loaded && keys.length === 0 && !problem && (
              <p className="hint">No keys yet. The first one you create is shown once, here.</p>
            )}

            {keys.length > 0 && (
              <div className="tablewrap">
                <table className="results-table keytable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Key</th>
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
                <strong>Using a key</strong>
                <CopyButton label="Copy" text={example} />
              </div>
              <pre className="cmd">{example}</pre>
              <p className="hint">
                Send it in the <code>X-Embabel-Api-Key</code> header, or as{' '}
                <code>Authorization: Bearer</code> for a client that can only set that one. Keep it
                in an environment variable or a secrets store, never in a URL and never in a
                repository.
              </p>
            </div>
          </>
        )}
      </StudioPanel>
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
