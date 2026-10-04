/*
 * WHOSE ACCOUNT, AND RETIRING, on the agent's card (#1783).
 *
 * An agent calls an API with its sponsor's credentials unless its identity there is its own account;
 * then it sends the secret kept here, and with none kept it is refused rather than quietly borrowing
 * the sponsor's. Values go in and never come back: the list is of names.
 *
 * Retiring is final and is offered as such: a second press, with the consequences in words, rather
 * than a dialog the host may not be able to show.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Agent } from '../../../client/agents.ts'
import type { AgentsServices } from '../contracts.ts'
import { Status, failureMessage } from '../studio/chrome.tsx'

export function AccountsSection({ agent, services, onRetired }: {
  agent: Agent
  services: AgentsServices
  onRetired: () => void
}) {
  const [secrets, setSecrets] = useState<string[] | null>(null)
  const [secret, setSecret] = useState('')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState('')
  const [notice, setNotice] = useState('')
  const own = Object.entries(agent.identity ?? {}).filter(([, mode]) => mode === 'own-account').map(([api]) => api)
  const retired = agent.state === 'retired'

  const load = useCallback(async () => {
    if (!services.listAccounts) return
    const result = await services.listAccounts(agent.name)
    if (result.ok) setSecrets(result.value.secrets)
    else if (result.kind !== 'unsupported') setProblem(failureMessage(result, 'list its accounts'))
  }, [agent.name, services])

  useEffect(() => {
    void load()
  }, [load])

  if (!services.listAccounts) return null

  async function keep() {
    const result = await services.setAccount!(agent.name, secret.trim(), value)
    if (!result.ok) return setProblem(failureMessage(result, 'save that secret'))
    setProblem('')
    setSecret('')
    setValue('')
    setSecrets(result.value.secrets)
  }

  async function forget(name: string) {
    const result = await services.removeAccount!(agent.name, name)
    if (!result.ok) return setProblem(failureMessage(result, 'delete that secret'))
    setProblem('')
    setSecrets(result.value.secrets)
  }

  async function retire() {
    const result = await services.retire!(agent.name, reason.trim())
    setConfirming(false)
    if (!result.ok) return setProblem(failureMessage(result, 'retire it'))
    const r = result.value
    setProblem('')
    setNotice(`Retired. ${r.keysRevoked} key${r.keysRevoked === 1 ? '' : 's'} revoked, ${r.slotsDeleted} secret${r.slotsDeleted === 1 ? '' : 's'} deleted.`)
    onRetired()
  }

  return (
    <div className="agent-accounts">
      <h3 className="caption">Accounts</h3>
      {problem && <Status tone="error">{problem}</Status>}
      {notice && <Status tone="ok">{notice}</Status>}
      <p className="hint">
        {own.length === 0
          ? 'It calls every API on its sponsor’s behalf, and signs what it writes as acting for them.'
          : `Its own account on ${own.join(', ')}; everything else on its sponsor’s behalf. Without its own secret kept here, a call there is refused.`}
      </p>
      {secrets && secrets.length > 0 && (
        <ul className="agent-secrets">
          {secrets.map((s) => (
            <li key={s} className="row">
              <code>{s}</code>
              {!retired && <button className="btn ghost tiny" onClick={() => void forget(s)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {!retired && own.length > 0 && (
        <div className="row">
          <input placeholder="Secret name, e.g. ODOO_API_KEY" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <input type="password" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn" disabled={!secret.trim() || !value} onClick={() => void keep()}>Keep</button>
        </div>
      )}
      {services.retire && !retired && (
        <div className="row">
          {confirming ? (
            <>
              <input placeholder="Why (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn arm" onClick={() => void retire()}>Retire {agent.name} for good</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Keep it</button>
              <span className="hint">It goes off duty for good, every key that may talk to it is revoked, and its own secrets are deleted.</span>
            </>
          ) : (
            <button className="btn ghost" onClick={() => setConfirming(true)}>Retire…</button>
          )}
        </div>
      )}
    </div>
  )
}
