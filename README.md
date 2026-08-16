# @embabel/appliance-kit

The shared code behind the **Embabel Me** app and the **Worlds console**: one
REST client, one visual language, one set of virtual-Cypher semantics.

> Parked under `johnsonr` rather than the `embabel` org for now — the package
> name is already `@embabel/*`, so moving it later changes no imports.

## Why one package

It began as five (`appliance-client`, `appliance-ui`, `vc`, `code-surface`,
`studio-kit`). Package boundaries were the honest way to say "the client must
not reach for the DOM" — but npm has **no subdirectory support for git
dependencies**, and consuming this from a public repo without publishing to npm
is worth more than the boundary. So: one package, entry points instead of
packages, and the DOM rule survives as a discipline about which entry point a
file may import from.

```js
import { ApplianceClient } from '@embabel/appliance-kit'            // REST, no DOM
import { compose, TARGETS } from '@embabel/appliance-kit/vc'        // pure semantics
import '@embabel/appliance-kit/css'                                 // the visual language
```

## Where the types come from

`src/client/generated/openapi.ts` is generated, never hand-edited. Its source is
`spec/client-surface.json`, copied verbatim from the assistant repo where
`OpenApiClientContractTest` regenerates it and fails the build when the published surface moves.
Two prefixes are guarded, and they are exactly the two the studios stand on:

| Prefix | Behind |
| --- | --- |
| `/api/v1/admin/kg` | Query Studio — virtual Cypher |
| `/api/v1/admin/handlers` | Handler Studio — TypeScript event handlers |

To take a newer server: copy that file in, `npm run generate`, `npm run check`, and read the diff
as a contract change. A surface outside those prefixes is not guarded and must not be typed here
by hand — add it to the test in the assistant first.

## Consuming it

Straight from GitHub — no registry, no token:

```json
"@embabel/appliance-kit": "github:johnsonr/appliance-kit#main"
```

Tracking `main` rather than a tag while this is early — the version has not moved
since the first cut and pinning to a stale tag would just mean consuming stale
code. `package-lock.json` records the resolved commit either way, so `npm ci` is
still reproducible; switch back to `#vX.Y.Z` once the version starts moving.

`dist/` is committed deliberately. A git dependency has no build output unless
the consumer compiles it at install time, and both front ends already vendored
built artifacts — so the repo is simply the honest source of what they were
copying. It also keeps `npm ci` instant and the console's Dockerfile unchanged
apart from `apk add git`.

## Entry points

| Import | What |
| --- | --- |
| `.` | the appliance REST client — transport-blind, no DOM. `client.kg` and `client.handlers` |
| `./vc` | virtual-Cypher semantics: compose, schema reading, view params, live run events |
| `./code-surface` | the editor surface |
| `./studio-kit` | hints, formatting, status, copy |
| `./backdrop` | the living-graph canvas |
| `./css`, `./css/*` | tokens, ground, base, components, markdown |
| `./global/*` | IIFE builds, for a renderer with no module system |

The global builds are **map-free on purpose**: a vendored copy travels without
its sourcemap, and a `sourceMappingURL` pointing at a file that never arrives is
an error in the consumer's dev server, not a convenience.

## Commands

```bash
npm run build      # esm + cjs + 5 global bundles
npm test           # 147 checks, no browser, no server
npm run typecheck
npm run check      # build + test
```
