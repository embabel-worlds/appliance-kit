import { useCallback, useEffect, useMemo, useState } from 'react'
import { isOk } from '../../../client/outcome.ts'
import { RealmCatalog, ranInBackground, type CatalogRealm, type RealmFilter, type TagCount } from '../../../client/realmCatalog.ts'
import type { RealmsSurfaceProps } from '../contracts.ts'
import { Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'

type Loadable<T> = { data: T | null; error: string; loading: boolean; reload(): void }

function useLoadable<T>(load: () => Promise<import('../../../client/outcome.ts').Outcome<T>>, action: string): Loadable<T> {
  const [version, reload] = useState(0)
  const [state, setState] = useState<Omit<Loadable<T>, 'reload'>>({ data: null, error: '', loading: true })
  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true }))
    void load().then((outcome) => {
      if (!active) return
      setState(outcome.ok
        ? { data: outcome.value, error: '', loading: false }
        : { data: null, error: failureMessage(outcome, action), loading: false })
    })
    return () => { active = false }
  }, [load, version, action])
  return useMemo(() => ({ ...state, reload: () => reload((value) => value + 1) }), [state])
}

/** The GitHub account a realm URL lives under — the source worth one word on the row. */
function sourceOf(url?: string, provider?: string): string | null {
  const m = url?.match(/github\.com\/([^/]+)\//)
  return m?.[1] ?? provider ?? null
}

/** The appliance asking rather than refusing: `needs-confirmation` with the realm's own warning. */
const needsConfirmation = (outcome: { body?: unknown }): boolean =>
  typeof outcome.body === 'object' && outcome.body !== null
  && (outcome.body as { status?: unknown }).status === 'needs-confirmation'

function Lamp({ tone }: { tone: string }) {
  return <span className={`lamp lamp-${tone}`} aria-hidden="true" />
}

// ── realms ────────────────────────────────────────────────────────────────────
export function RealmsSurface({ services, host }: RealmsSurfaceProps) {
  /*
   * EVERY LIST HERE IS A QUERY over `(:Realm)` — see RealmCatalog. Installed and on offer are the
   * same rows with a different WHERE, and each facet below is another clause, so the list a person
   * filters and the answer chat gives to the same question come from one place.
   */
  const catalog = useMemo(() => new RealmCatalog((cypher, options) => services.searchRealms(cypher, options)), [services])
  const installed = useLoadable<CatalogRealm[]>(
    useCallback(() => catalog.realms({ show: 'installed', experimental: true }), [catalog]),
    'list installed realms',
  )
  const [dirRefreshing, setDirRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [installMsg, setInstallMsg] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  /* Installed realms render compressed — a known quantity earns one line; click expands. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (name: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  /*
   * THE FACETS on what is on offer. Words are matched as typed, a moment after the last keystroke;
   * Smart search sets `meaning`, which a model judges per realm. A tag is one chip at a time.
   * Experimental realms are left out until asked for, and the count of what was left out is shown.
   */
  const [words, setWords] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setWords(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])
  const [meaning, setMeaning] = useState<string | null>(null)
  const [tag, setTag] = useState('')
  const [showExperimental, setShowExperimental] = useState(false)
  const offerFilter: RealmFilter = useMemo(() => ({
    show: 'available', tag, experimental: showExperimental, ...(meaning ? { meaning } : { words }),
  }), [tag, showExperimental, meaning, words])

  const [offered, setOffered] = useState<{ realms: CatalogRealm[]; tags: TagCount[]; hidden: number } | null>(null)
  const [offeredError, setOfferedError] = useState('')
  const [offeredLoading, setOfferedLoading] = useState(true)
  const [searchNote, setSearchNote] = useState<{ tone: 'error' | 'caution'; text: string } | null>(null)
  const [offerVersion, reloadOffered] = useState(0)
  useEffect(() => {
    let active = true
    setOfferedLoading(true)
    void Promise.all([catalog.realms(offerFilter), catalog.tags(offerFilter), catalog.hiddenExperimental(offerFilter)])
      .then(([realms, tags, hidden]) => {
        if (!active) return
        setOfferedLoading(false)
        if (!realms.ok) {
          if (meaning) {
            /* Smart search failing is not the directory failing: fall back to the words. A run the
               engine parked in the background has not failed, so it is not worth retrying. */
            setSearchNote(ranInBackground(realms)
              ? { tone: 'caution', text: 'Smart search started a background run; its results are not available here. Showing keyword matches.' }
              : { tone: 'error', text: 'Smart search did not return results. Showing keyword matches instead; try Smart search again.' })
            setMeaning(null)
            return
          }
          setOfferedError(failureMessage(realms, 'load the realm directory'))
          return
        }
        setOfferedError('')
        setOffered({ realms: realms.value, tags: tags.ok ? tags.value : [], hidden: hidden.ok ? hidden.value : 0 })
      })
    return () => { active = false }
  }, [catalog, offerFilter, meaning, offerVersion])

  const refreshDirectory = useCallback(async () => {
    setDirRefreshing(true)
    await services.refreshDirectory()
    reloadOffered((v) => v + 1)
    installed.reload()
    setDirRefreshing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, installed])

  const searchByMeaning = useCallback(() => {
    const q = query.trim()
    if (!q) return
    setSearchNote(null)
    setMeaning(q)
  }, [query])

  /*
   * WHICH REALMS HAVE SOMETHING TO PULL. `GET /realms/updates` reads each realm's remote refs
   * (ls-remote — refs only, no objects) and says behind / current / unknown.
   *
   * Separate from the listing on purpose: it costs a network round trip per realm, so the panel
   * paints immediately and this fills in. `undefined` while it is in flight, `null` for a realm the
   * appliance could not determine — which keeps its Refresh, because hiding the only way to fix
   * something you cannot diagnose is the wrong side to err on.
   */
  const [updates, setUpdates] = useState<Record<string, boolean | null> | null>(null)
  const [updateDetail, setUpdateDetail] = useState<Record<string, string>>({})

  const checkUpdates = useCallback(async () => {
    const r = await services.listUpdates()
    // A 404 is an appliance older than the endpoint: leave `updates` null, which shows Refresh on
    // everything exactly as before rather than hiding it on an appliance that cannot answer.
    if (!r.ok) return
    const behind: Record<string, boolean | null> = {}
    const detail: Record<string, string> = {}
    for (const x of r.value.results ?? []) {
      if (!x.name) continue
      behind[x.name] = x.behind ?? null
      if (x.detail) detail[x.name] = x.detail
    }
    setUpdates(behind)
    setUpdateDetail(detail)
  }, [services])

  useEffect(() => { void checkUpdates() }, [checkUpdates])

  /** Offer Refresh when the realm HAS moved, or when nobody can say. Never when it is current. */
  const canRefresh = (name: string) => updates === null || updates[name] !== false
  const behindCount = (installed.data ?? []).filter((realm) => updates?.[realm.name] === true).length


  const suggestions = offered?.realms ?? []
  const installedShown = installed.data ?? []

  // Which realms ship a tour. One call, read for a label and a link — the Tours tab owns running
  // them, so nothing here knows what a step is.
  const [realmTours, setRealmTours] = useState<Record<string, { id: string; name: string }[]>>({})
  /** Per-realm failure text, shown on the row that produced it. */
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({})
  useEffect(() => {
    void (async () => {
      const outcome = await services.listTours()
      if (!isOk(outcome)) return
      const byRealm: Record<string, { id: string; name: string }[]> = {}
      for (const t of outcome.value) {
        const source = (t as { source?: string }).source
        if (!source) continue
        const name = ((t.presentation ?? {}) as Record<string, unknown>)['name']
        byRealm[source] = [...(byRealm[source] ?? []), { id: t.id, name: typeof name === 'string' ? name : t.declaredId }]
      }
      setRealmTours(byRealm)
    })()
  }, [installed.data, services])

  async function install(s: CatalogRealm, confirmed = false): Promise<void> {
    const repo = s.source || s.url
    if (!repo) { setInstallMsg(`Could not install '${s.name}': its directory entry has no repository link. Ask the directory maintainer to add one.`); return }
    setBusy(s.name)
    const r = await services.installRealm(repo, confirmed)
    setBusy(null)
    /*
     * An experimental realm is not refused, it is ASKED about: the appliance answers
     * `needs-confirmation` with its author's warning, and a yes retries carrying it.
     */
    if (!r.ok && !confirmed && needsConfirmation(r)) {
      const yes = host.confirmInstall ? await host.confirmInstall(r.message) : confirm(r.message)
      if (yes) return install(s, true)
      setInstallMsg(`Not installed: ${s.name} is experimental, and that was declined.`)
      return
    }
    setInstallMsg(r.ok ? `Installed ${s.name}.` : `Install failed: ${r.message}`)
    installed.reload()
    reloadOffered((v) => v + 1)
  }

  /*
   * REFRESH — `git pull` on the checkout behind a realm, then a world rebuild.
   *
   * The appliance has done this all along (`POST /realms/{name}/update`, and `/update-all`); the Me
   * app has called it for a while and this console never did, which made a realm look frozen at
   * whatever it was when it was installed. It is not a cosmetic gap: the shared realm cache is keyed
   * `name@ref`, so a branch that has moved upstream is still a CACHE HIT — reinstalling does not
   * refresh it and neither does restarting the appliance. Pulling is the only way forward.
   *
   * The server's own summary is reported verbatim ("merge: Fast-forward, updates: 1"), because
   * "updated" alone cannot tell "brought forward two commits" from "already current" — and those
   * are the two things someone pressing this wants distinguished.
   */
  async function refresh(name: string) {
    setBusy(name)
    setInstallMsg(`Refreshing ${name}…`)
    setRowMsg((m) => ({ ...m, [name]: '' }))
    const r = await services.updateRealm(name)
    setBusy(null)
    const failure = r.ok ? '' : r.message
    setInstallMsg(r.ok
      ? `${name}: ${r.value.summary ?? 'updated'}`
      : `Refresh failed: ${r.message}`)
    // AND ON THE ROW ITSELF. The page-level line is far below the realm list — on a world with a
    // few realms it is off the bottom of the screen entirely — so a failed update looked like
    // nothing happening at all: the row still says UPDATE AVAILABLE and the reason is somewhere
    // the user never scrolled to. A failure belongs where the button that caused it is.
    setRowMsg((m) => ({ ...m, [name]: failure }))
    installed.reload()
    void checkUpdates()
  }

  /* Real shape (read off RealmController.updateAllRealms): a LIST of
     `{name, status, summary}` — or `{name, status: 'error', message}`. Not a name→summary map,
     which is what it looks like from the outside and would have rendered every realm as blank. */
  async function refreshAll() {
    if (!(await host.confirmUpdateAll())) return
    setBusy('*')
    setInstallMsg('Refreshing every realm…')
    const r = await services.updateAll()
    setBusy(null)
    if (!r.ok) return setInstallMsg(`Refresh failed: ${r.message}`)
    const results = r.value.results ?? []
    const failed = results.filter((x) => x.status === 'error')
    // The failures first and in full: one realm that could not pull is the thing to act on, and a
    // list of thirty "Fast-forward" lines is where it would otherwise be lost.
    setInstallMsg(
      results.length === 0 ? 'No realms to refresh.'
        : failed.length ? `${failed.length} of ${results.length} failed — ${failed.map((x) => `${x.name}: ${x.message}`).join(' · ')}`
        : `${results.length} realm(s): ${results.map((x) => `${x.name} ${x.summary}`).join(' · ')}`,
    )
    installed.reload()
    // What was behind may not be any more — ask again rather than leave a stale Update badge.
    void checkUpdates()
  }

  return (
    <div className="kit-feature kit-feature-realms">
      <StudioPanel title="Realms" aside={host.observability}>
      {installed.loading ? <div className="notice">loading…</div> :
       installed.error ? <><Status tone="error">{installed.error}</Status><button className="btn" onClick={installed.reload}>Retry listing realms</button></> : (
        <>
          <div className="subhead subhead-row">
            <span>Installed · {installedShown.length}</span>
            {installedShown.length > 0 && (updates === null || behindCount > 0) && (
              <button className="btn ghost tiny" disabled={busy !== null} onClick={() => void refreshAll()}>
                {busy === '*' ? 'refreshing…'
                  : behindCount > 0 ? `Update ${behindCount}` : 'Refresh all'}
              </button>
            )}
          </div>
          <div className="realm-list">
            {installedShown.map((r: CatalogRealm) => (
              <div className={`realm-row ${expanded.has(r.name) ? 'is-open' : ''}`} key={r.name}>
                <button className="realm-row-head" onClick={() => toggle(r.name)}
                        aria-expanded={expanded.has(r.name)}>
                  {/* Amber while this realm is being pulled and the world rebuilt around it: `lit`
                      would go on claiming the realm is live throughout, which is the one moment it
                      is not. `busy === '*'` is Refresh all, so every lamp turns. */}
                  <Lamp tone={busy === r.name || busy === '*' ? 'caution' : 'lit'} />
                  <strong>{r.name}</strong> <code className="ver">v{r.version}</code>
                  {sourceOf(r.url) && <small className="realm-source">{sourceOf(r.url)}</small>}
                  {updates?.[r.name] === true && <span className="realm-behind">update available</span>}
                  {/* Installed and experimental is worth saying: it is why a view moved under
                      somebody, and nothing else on the row would explain it. */}
                  {r.maturity === 'experimental' && <span className="realm-maturity">experimental</span>}
                  <span className="realm-chevron" aria-hidden="true">{expanded.has(r.name) ? '▾' : '▸'}</span>
                </button>
                {expanded.has(r.name) && (
                  <div className="realm-row-body">
                    {rowMsg[r.name] && <p className="realm-problem">{rowMsg[r.name]}</p>}
                    <p>{r.description}</p>
                    {(realmTours[r.name] ?? []).map((tour) => (
                      <button
                        key={tour.id}
                        className="btn tiny"
                        title="A guided walk through what this realm added — it says what it will do before it does any of it"
                        onClick={() => host.openTour(tour.id)}
                      >
                        Take the tour: {tour.name}
                      </button>
                    ))}
                    {canRefresh(r.name) && (
                      <button
                        className={`btn tiny ${updates?.[r.name] === true ? '' : 'ghost'}`}
                        disabled={busy !== null}
                        title={updateDetail[r.name] ?? 'Pull the latest and rebuild the world'}
                        onClick={() => void refresh(r.name)}
                      >
                        {busy === r.name ? 'refreshing…' : updates?.[r.name] === true ? 'Update' : 'Refresh'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {(installed.data ?? []).length === 0 && <div className="notice">No realms installed yet — pick one below.</div>}
          </div>
          <div className="subhead subhead-row">
            <span>Suggested</span>
            {/* The server caches its realm directory (an hour once complete); this evicts it —
                how a realm published five minutes ago becomes installable without a restart.
                An older appliance answers 404: the browse still reloads, honestly unchanged. */}
            <button className="btn ghost tiny" disabled={dirRefreshing} onClick={() => void refreshDirectory()}>
              {dirRefreshing ? 'refreshing…' : offeredError ? 'Retry directory' : 'Refresh directory'}
            </button>
          </div>
          <div className="realmsearch">
            <input
              type="search"
              value={query}
              placeholder="Search available realms — Enter for smart search"
              aria-label="search available realms"
              onChange={(e) => { setQuery(e.target.value); setMeaning(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') searchByMeaning() }}
            />
            {query && (
              <button className="btn ghost tiny" disabled={offeredLoading && meaning !== null} onClick={searchByMeaning}
                      title="Understands what you're looking for, not just the words — 'money owed' finds an accounting realm">
                {offeredLoading && meaning !== null ? 'searching…' : 'Smart search'}
              </button>
            )}
            {query && <button className="btn ghost tiny" onClick={() => { setQuery(''); setMeaning(null) }}>Clear</button>}
          </div>
          {/* Facets: each chip is a WHERE on the same query, with the count choosing it would show. */}
          {((offered?.tags.length ?? 0) > 0 || (offered?.hidden ?? 0) > 0 || showExperimental) && (
            <div className="realm-facets" role="group" aria-label="Filter available realms">
              {tag && (
                <button className="realm-facet is-on" aria-pressed="true" onClick={() => setTag('')} title="Show every tag">
                  {tag} ×
                </button>
              )}
              {!tag && (offered?.tags ?? []).map((t) => (
                <button key={t.tag} className="realm-facet" aria-pressed="false" onClick={() => setTag(t.tag)}>
                  {t.tag} <span className="realm-facet-count">{t.realms}</span>
                </button>
              ))}
              {/* The only way to reach what was left out, and it states the number, so the choice is
                  a decision rather than an unexplained checkbox. */}
              {((offered?.hidden ?? 0) > 0 || showExperimental) && (
                <button
                  className={`realm-facet realm-facet-maturity ${showExperimental ? 'is-on' : ''}`}
                  aria-pressed={showExperimental}
                  title="Realms their own authors call experimental — they may change or break, and installing one asks you to confirm"
                  onClick={() => setShowExperimental((v) => !v)}
                >
                  {showExperimental ? 'Hide experimental' : `Show ${offered?.hidden ?? 0} experimental`}
                </button>
              )}
            </div>
          )}
          {meaning && !offeredLoading && (
            <div className="notice">
              Smart search for “{meaning}” · {suggestions.length} match{suggestions.length === 1 ? '' : 'es'} —
              matched on what each realm does, not just its words. Asking in chat works the same way.
            </div>
          )}
          {searchNote && <Status tone={searchNote.tone}>{searchNote.text}</Status>}
          {offeredError ? (
            <Status tone="error">{offeredError}</Status>
          ) : offered === null ? (
            <Status tone={null}>Loading realm directory…</Status>
          ) : suggestions.length > 0 ? (
            /* Suggested realms compress to ONE LINE each, like the installed list above: a
               directory of dozens read as a wall of cards; a directory reads as an index. The
               name expands to the description and tags; Install stays on the line. */
            <div className="realm-list">
              {suggestions.map((s) => {
                const id = `s:${s.name}`
                const open = expanded.has(id)
                return (
                  <div className={`realm-row suggested-row ${open ? 'is-open' : ''}`} key={id}>
                    <button className="realm-row-head" onClick={() => toggle(id)} aria-expanded={open}>
                      <Lamp tone="unlit" />
                      <strong>{s.name}</strong>
                      {s.version && <code className="ver">v{s.version}</code>}
                      {sourceOf(s.url || s.source, s.provider) && (
                        <small className="realm-source">{sourceOf(s.url || s.source, s.provider)}</small>
                      )}
                      {s.maturity === 'experimental' && <span className="realm-maturity">experimental</span>}
                      <span className="realm-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
                    </button>
                    <button className="btn tiny suggested-install" disabled={busy === s.name} onClick={() => void install(s)}>
                      {busy === s.name ? 'installing…' : 'Install'}
                    </button>
                    {open && (
                      <div className="realm-row-body suggested-body">
                        <p>{s.description}</p>
                        <div className="realm-meta">
                          <span>{s.author || s.provider}</span>
                          {s.tags.map((t) => <span className="realm-tag" key={t}>{t}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="notice">
              {query ? `No realm matches “${query}”.` : tag ? `No available realm is tagged ${tag}.` : 'Directory returned no further suggestions.'}
            </div>
          )}
          {installMsg && <div className="notice">{installMsg}</div>}
        </>
      )}
      </StudioPanel>
    </div>
  )
}
