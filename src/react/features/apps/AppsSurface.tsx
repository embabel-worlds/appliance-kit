/*
 * APPS — the world's own HTML surfaces, which Me has had a tab for and this console did not.
 *
 * An app is a page the world ships or somebody vibe-coded into it: `data/apps/{name}` for the
 * user's own, the world template's `apps/` next, then a realm's. Each is served at its canonical
 * scoped URL `/apps/{scope}/{name}` (`workspace`, `world`, or a realm name), which the listing
 * returns as `url` — so this list and what opens can never disagree, and two realms shipping the
 * same filename are both reachable.
 *
 * TWO PATHS, AND ONLY ONE OF THEM IS VERSIONED. The LISTING is ordinary REST
 * (`GET /api/v1/artifacts/app`). The app itself is served at `/apps/{name}`, deliberately outside
 * the versioned prefix — the server calls it "a fixed, well-known location that a client cannot be
 * asked to version", because generated apps link to it directly.
 *
 * WHICH IS WHY THE CONSOLE DOES NOT NEED TO KNOW THE DOOR'S PORT. `/apps/` is proxied here the way
 * `/api/` is (nginx.conf in production, the Vite proxy in dev), so an app opens on the console's
 * own origin. That is not a convenience — it is what makes an app work at all. The server sends
 * `default-src 'self'; connect-src 'self'` and `X-Frame-Options: SAMEORIGIN`, and an app calls back
 * through `/api/v1/apps-runtime/gateway.js`. Same origin: `'self'` resolves here, the gateway's
 * calls reach the door through the existing proxy, and a frame is allowed. Linked at the door's
 * port instead, the frame is refused and the credential story splits in two.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { isBackgroundHandle } from '../../../client/kg.ts'
import { isOk } from '../../../client/outcome.ts'
import type { AppArtifact, AppPin, AppsHost, AppsServices, AppsSurfaceProps, PinRailProps } from '../contracts.ts'
import { AppIcon } from './AppIcon.tsx'
import { Status, StudioPanel, type Tone } from '../studio/chrome.tsx'

/** The app's URL on THIS origin — see the header for why that is not the door's origin.
 *  Prefers the server's canonical scoped `url`; an older door without one gets the legacy
 *  flat form, encoded per segment so the scope separator survives. */
const appUrl = (a: AppArtifact) => a.url ??
  `/apps/${[a.scope, a.name].filter(Boolean).flatMap((part) => part!.split('/')).map(encodeURIComponent).join('/')}`

export function validatedAppUrl(a: AppArtifact): string | null {
  try {
    const value = new URL(appUrl(a), window.location.origin)
    const parts = value.pathname.split('/').filter(Boolean)
    if (value.origin !== window.location.origin || parts[0] !== 'apps' || parts.length !== 3) return null
    if (parts.slice(1).some((part) => decodeURIComponent(part) === '.' || decodeURIComponent(part) === '..')) return null
    if (parts.some((part) => /%2f|%5c/i.test(part))) return null
    return `${value.pathname}${value.search}${value.hash}`
  } catch {
    return null
  }
}

/** Scope+name — the unique identity now that filenames may repeat across scopes. */
const appKey = (a: AppArtifact) => `${a.scope ?? ''}/${a.name}`

const title = (a: AppArtifact) => a.name.replace(/\.html?$/i, '')

/** What the pin store needs to draw this app from any tab, without a listing of its own. */
const asPin = (a: AppArtifact): AppPin => ({
  key: appKey(a), name: a.name, scope: a.scope ?? null, url: appUrl(a),
  iconUrl: a.iconUrl ?? null, description: a.description ?? null,
})

/* Where the framed app is on the page, so a chip can put the reader in front of it. A
 * module-level ref rather than a prop because the rail lives in the shell and the frame
 * lives in the tab, and threading one through the console to reach the other would be a
 * lot of plumbing for a scroll. */
let frameEl: HTMLDivElement | null = null
function revealApp(): void {
  // After the tab has mounted and the frame exists — a click from another tab reaches
  // here before React has rendered the Apps tab at all.
  requestAnimationFrame(() => frameEl?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}

/**
 * THE PIN RAIL — pinned apps under the tab strip, reachable from every tab.
 *
 * Navigation by URL alone: `goTo('apps', key)` changes the hash, the shell's hashchange
 * listener moves to the Apps tab, and the Apps tab's own listener opens the named app. No
 * shared state between the rail and the tab, so the back button works on every hop.
 *
 * The click also asks to be SHOWN the app, which is not the same thing and was the bug in
 * the first cut: from the Apps tab, clicking a chip changed the URL, opened the frame — and
 * left the reader looking at the top of a directory listing with the app they had asked for
 * somewhere below the fold. It read as a dead button. Clicking a chip for the app already
 * open does nothing to the URL at all, so the reveal cannot be hung off the navigation.
 */
export function PinRail({ services, host }: PinRailProps) {
  const pins = useSyncExternalStore(host.pins.subscribe, host.pins.getSnapshot, host.pins.getSnapshot)
  const here = useSyncExternalStore(host.subscribeSelection, host.selectedAppKey, host.selectedAppKey)
  /* THE RAIL DRAWS ON EVERY TAB, so it cannot wait for the Apps tab to reconcile. Pins live in
     this browser and outlive the appliance: reinstall, or remove the realm that shipped an app,
     and the rail goes on offering tiles that 404. One listing on mount is enough to mark those,
     and reconcilePins ignores a listing that failed — a door mid-restart must never be read as
     "your apps are gone". */
  useEffect(() => {
    void services.listApps().then((r) => {
      if (isOk(r)) host.pins.reconcile(r.value.map(asPin))
    })
  }, [services, host.pins])
  if (!pins.length) return null
  /* Reading the location rather than holding a copy: the hash IS the answer to "which app
     is up", and the bump above is only what makes React ask again. */
  return (
    <nav className="kit-feature kit-feature-apps pinrail" aria-label="Pinned apps">
      {pins.map((p) => {
        /* Belt and braces with `migrate`, deliberately. One malformed pin used to blank the
           entire console, so the rail does not assume its input was cleaned — the cost is a
           `??` and the alternative is a whole-app crash from a value on somebody's disk. */
        const label = (p.name ?? p.key).replace(/\.html?$/i, '')
        const on = here === p.key
        const gone = p.missing === true
        /* A CHIP IS A TOGGLE. The app it names is either in front of you or it is not, and the
           same button is how you get both. Pressing the lit one closes the frame. */
        return (
          <button key={p.key} className={`pinchip${on ? ' is-on' : ''}${gone ? ' is-gone' : ''}`}
                  aria-current={on ? 'page' : undefined}
                  onClick={() => {
                    if (on) host.openApp(null)
                    else {
                      const url = validatedAppUrl(p)
                      if (url) host.openApp({ ...p, url })
                    }
                    revealApp()
                  }}
                  title={gone
                    ? `${label} — not in this world${p.scope ? ` (${p.scope} is not installed)` : ''}. The pin is still yours; unpin it in Apps.`
                    : on ? `Close ${label}` : p.scope ? `${label} — pinned from ${p.scope}` : label}>
            <AppIcon src={p.iconUrl} name={label} description={p.description} />
            <span className="pinchip-name">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function AppRow({ a, open, setOpen, pinned, onTogglePin, onNewTab }: {
  a: AppArtifact
  open: AppArtifact | null
  setOpen(a: AppArtifact | null): void
  pinned: boolean
  onTogglePin(): void
  onNewTab(a: AppArtifact): void
}) {
  const isViewing = open !== null && appKey(open) === appKey(a)
  return (
    <div className={`approw${isViewing ? ' is-open' : ''}`}>
      <button className={`app-pin${pinned ? ' is-pinned' : ''}`} onClick={onTogglePin}
              title={pinned ? 'Unpin — off the rail' : 'Pin to the rail, reachable from every tab'}
              aria-pressed={pinned}>
        {pinned ? '★' : '☆'}
      </button>
      <AppIcon src={a.iconUrl} name={title(a)} description={a.description} size={20} className="approw-icon" />
      <div className="approw-body">
        <strong>{title(a)}</strong>
        {a.readOnly === false && <span className="appmine">yours</span>}
        {pinned && a.scope && <span className="realm-source">{a.scope}</span>}
        <p>{a.description || 'No description.'}</p>
      </div>
      <div className="row">
        <button className="btn" onClick={() => setOpen(isViewing ? null : a)}>
          {isViewing ? 'Close' : 'Open'}
        </button>
        <button className="btn ghost" onClick={() => onNewTab(a)}>
          New tab
        </button>
      </div>
    </div>
  )
}

export function AppsSurface({ services, host }: AppsSurfaceProps) {
  const [apps, setApps] = useState<AppArtifact[]>([])
  const [status, setStatus] = useState<{ tone: Tone; text: string }>({ tone: null, text: 'loading…' })
  const [query, setQuery] = useState('')
  /* WHICH APP IS OPEN LIVES IN THE URL, not only here. Reloading — which signing out
     does — used to drop somebody three levels into a workspace app back onto the Realms
     tab with no memory of where they had been. The remainder of the hash is this tab's to
     spend, so `#apps/workspace/report.html` comes back to the same frame. */
  const [open, setOpenState] = useState<AppArtifact | null>(null)
  const setOpen = useCallback((a: AppArtifact | null) => {
    if (a === null) {
      setOpenState(null)
      host.openApp(null)
      return
    }
    const url = validatedAppUrl(a)
    if (!url) return setStatus({ tone: 'error', text: 'This app has an invalid serving address.' })
    const safe = { ...a, url }
    setOpenState(safe)
    host.openApp(safe)
  }, [host])
  /* Search-by-meaning, the Realms tab's move: one Virtual Cypher run over the ConfigApp catalog,
   * the engine's per-row judge deciding fit. null = keyword mode. An older appliance without the
   * catalog label errors the query; we then stay honestly in keyword mode and say so. */
  const [meaning, setMeaning] = useState<{ q: string; keys: Set<string> } | null>(null)
  /* Groups are CLOSED by default — a directory of realms reads as an index, and the apps you
   * actually live in are PINNED instead, to the rail as well as to the top of this list. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  /* The pins themselves live in `pins.ts` — the shell's rail draws from the same store, so
     starring something here lights it up under the tab strip immediately. */
  const pins = useSyncExternalStore(host.pins.subscribe, host.pins.getSnapshot, host.pins.getSnapshot)
  const pinnedKeys = useMemo(() => new Set(pins.map((p) => p.key)), [pins])
  const toggleGroup = (scope: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(scope)) next.delete(scope); else next.add(scope)
    return next
  })
  const [judging, setJudging] = useState(false)
  const [smartNote, setSmartNote] = useState<string | null>(null)

  const searchByMeaning = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setJudging(true)
    setSmartNote(null)
    const cypher =
      'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(a:ConfigApp) ' +
      `WHERE ai.relevant(a, '${q.replace(/'/g, "\\'")}') ` +
      'RETURN a.name AS name, a.scope AS scope'
    const outcome = await services.searchApps(cypher)
    setJudging(false)
    if (!isOk(outcome) || isBackgroundHandle(outcome.value) || outcome.value.error) {
      setMeaning(null)
      return setSmartNote('Smart search needs a newer appliance — showing keyword matches instead.')
    }
    const keys = new Set((outcome.value.rows ?? []).map((row) => {
      const r = row as Record<string, unknown>
      return `${String(r['scope'] ?? '')}/${String(r['name'] ?? '')}`
    }))
    setMeaning({ q, keys })
  }, [query, services])

  const load = useCallback(async () => {
    const r = await services.listApps()
    if (!r.ok && (r.status === 401 || r.status === 403)) {
      return setStatus({ tone: 'error', text: 'Sign in to see this world’s apps.' })
    }
    if (!r.ok) return setStatus({ tone: 'error', text: r.message })
    const found = r.value
    setApps(found)
    /* Only from a listing that actually succeeded — see reconcilePins on why a failed one
       must never get here. Names, icons and URLs refresh; an app that has gone loses its pin. */
    host.pins.reconcile(found.map(asPin))
    setStatus(found.length
      ? { tone: 'ok', text: `${found.length} app(s) in this world` }
      : { tone: null, text: 'No apps yet — a realm or a world template ships them, or you build one.' })
  }, [services, host.pins])

  useEffect(() => { void load() }, [load])

  /* FOLLOW the URL, don't just read it once. This began as a one-shot restore of whatever
     the hash named on arrival, which was enough when the only way to open an app was to
     click a row on this tab. The pin rail can now change the app while this tab is already
     up, and a one-shot restore would ignore it — so the hash stays the single source of
     truth for which app is open, and this listens for it. */
  useEffect(() => {
    const follow = () => {
      const wanted = host.selectedAppKey()
      if (!wanted) return setOpenState(null)
      const found = apps.find((a) => appKey(a) === wanted)
      if (found) setOpenState(found)
    }
    follow()
    return host.subscribeSelection(follow)
  }, [apps, host])

  const shown = useMemo(() => {
    if (meaning) return apps.filter((a) => meaning.keys.has(appKey(a)))
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return apps.filter((a) =>
      words.every((w) => `${a.name} ${a.description ?? ''}`.toLowerCase().includes(w)))
  }, [apps, query, meaning])

  const pinnedShown = useMemo(
    /* In the ORDER THE RAIL USES, not alphabetically: two lists of the same apps in two
       different orders is a puzzle, and the rail's order is the one you chose. */
    () => pins.map((p) => shown.find((a) => appKey(a) === p.key)).filter((a): a is AppArtifact => !!a),
    [shown, pins],
  )

  /* BY REALM below the pins: 'Yours' first, the world template second, then each shipping realm
   * alphabetically — the serving precedence made visible. Pinned apps live at the top only;
   * repeating them inside their realm would say the list is longer than it is. */
  const groups = useMemo(() => {
    const rank = (s: string) => (s === 'workspace' ? 0 : s === 'world' ? 1 : 2)
    const by = new Map<string, AppArtifact[]>()
    for (const a of shown) {
      if (pinnedKeys.has(appKey(a))) continue
      const k = a.scope ?? 'world'
      if (!by.has(k)) by.set(k, [])
      by.get(k)!.push(a)
    }
    return [...by.entries()]
      .sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0]))
      .map(([scope, list]) => [scope, list.slice().sort((a, b) => a.name.localeCompare(b.name))] as const)
  }, [shown, pinnedKeys])

  /* A search that only matched inside closed drawers would look like no results. */
  const searching = meaning !== null || query.trim().length > 0

  return (
    <div className="kit-feature kit-feature-apps apps">
      <div ref={(el) => { frameEl = el }}>
        {/* ABOVE the directory, not below it. Framed rather than replacing the console: an app
            is a view OF this world, and losing the console to open one would make going back a
            navigation problem — SAMEORIGIN allows the frame because the app is served through
            this origin. But the directory is a CHOOSER, and once you have chosen, the thing you
            chose should be the thing in front of you rather than something you have to go and
            find under a list you have finished with. */}
        {open && (
          <StudioPanel
            title={open.name.replace(/\.html?$/i, '')}
            aside={
              <button className="btn ghost tiny" onClick={() => {
                const url = validatedAppUrl(open)
                if (url) host.openInNewTab(url)
              }}>
                Open in a tab
              </button>
            }
          >
            <iframe className="appframe" src={appUrl(open)} title={open.name} />
          </StudioPanel>
        )}
      </div>
      <StudioPanel
        title="Apps"
        aside={<Status tone={status.tone}>{status.text}</Status>}
      >
        <p className="hint">
          The apps this world offers — shipped by a realm, by the world template, or built here.
          Each one runs against this world through the appliance's own gateway; pin the ones you
          live in and they sit under the tab strip, one click away from wherever you are.
        </p>

        {apps.length > 3 && (
          <div className="realmsearch">
            <input type="search" value={query} placeholder="Search apps — Enter for smart search" aria-label="search apps"
                   onChange={(e) => { setQuery(e.target.value); setMeaning(null); setSmartNote(null) }}
                   onKeyDown={(e) => { if (e.key === 'Enter') void searchByMeaning() }} />
            {query && (
              <button className="btn ghost tiny" disabled={judging} onClick={() => void searchByMeaning()}
                      title="Understands what you're looking for, not just the words — 'where the money goes' finds a grants app">
                {judging ? 'searching…' : 'Smart search'}
              </button>
            )}
            {query && <button className="btn ghost tiny" onClick={() => { setQuery(''); setMeaning(null); setSmartNote(null) }}>Clear</button>}
          </div>
        )}
        {meaning && (
          <p className="hint">Smart search for “{meaning.q}” · {meaning.keys.size} match{meaning.keys.size === 1 ? '' : 'es'} — judged on what each app does.</p>
        )}
        {smartNote && <p className="hint">{smartNote}</p>}

        <div className="applist">
          {pinnedShown.length > 0 && !searching && <div className="subhead">Pinned</div>}
          {pinnedShown.map((a) => <AppRow key={appKey(a)} a={a} open={open} setOpen={setOpen}
                                          pinned onTogglePin={() => host.pins.toggle(asPin(a))}
                                          onNewTab={(app) => { const url = validatedAppUrl(app); if (url) host.openInNewTab(url) }} />)}
          {groups.map(([scope, list]) => {
            const label = scope === 'workspace' ? 'Yours' : scope === 'world' ? 'World template' : scope
            const isOpen = searching || expanded.has(scope)
            return (
              <div key={scope}>
                {/* CLOSED, the row still says what it holds: the app names run to the right, so
                    scanning the directory never requires opening anything. */}
                <button className="appgroup-head" aria-expanded={isOpen} onClick={() => toggleGroup(scope)}>
                  <span className="realm-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  <strong>{label}</strong>
                  <span className="appgroup-count">{list.length}</span>
                  {!isOpen && (
                    <span className="appgroup-names">{list.map(title).join(' · ')}</span>
                  )}
                </button>
                {isOpen && list.map((a) => <AppRow key={appKey(a)} a={a} open={open} setOpen={setOpen}
                                                   pinned={false} onTogglePin={() => host.pins.toggle(asPin(a))}
                                                   onNewTab={(app) => { const url = validatedAppUrl(app); if (url) host.openInNewTab(url) }} />)}
              </div>
            )
          })}
          {apps.length > 0 && shown.length === 0 && (
            <p className="hint">No app matches “{query}”.</p>
          )}
        </div>
      </StudioPanel>

    </div>
  )
}
