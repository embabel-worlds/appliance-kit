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

## Consuming it

Straight from GitHub — no registry, no token:

```json
"@embabel/appliance-kit": "github:johnsonr/appliance-kit#v0.1.0"
```

`dist/` is committed deliberately. A git dependency has no build output unless
the consumer compiles it at install time, and both front ends already vendored
built artifacts — so the repo is simply the honest source of what they were
copying. It also keeps `npm ci` instant and the console's Dockerfile unchanged
apart from `apk add git`.

## Entry points

| Import | What |
| --- | --- |
| `.` | the appliance REST client — transport-blind, no DOM |
| `./vc` | virtual-Cypher semantics: compose, schema reading, view params |
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
npm test           # 104 checks, no browser, no server
npm run typecheck
npm run check      # build + test
```
