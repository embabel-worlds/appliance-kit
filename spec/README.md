# spec/

Two documents that look alike and are not.

**`client-surface.json` + `openapi.json` — the GUARDED surface.** `client-surface.json` is
copied here from `OpenApiClientContractTest` in the assistant repo, which fails the build
when the published surface moves; `npm run generate` wraps it into `openapi.json` and
generates this package's typed client from it. It is deliberately a slice — virtual Cypher
and handler authoring, the two surfaces the studios are built on — because a client may
only be generated from endpoints something holds to a contract.

**`worlds-openapi.json` — the WHOLE API, for documentation.** Written by that same test
while it has a server up, and pushed here by `publish-openapi` in the assistant repo's
`maven.yml`. `worlds.embabel.com/api/` clones this repository at build time and renders it,
which is the only reason it lives in a package that does not ship it: the assistant repo is
private and the site's build has no token, so this is the public hop.

Nothing here is hand-edited, and `worlds-openapi.json` least of all — it is overwritten on
every green main build of the assistant, and an edit here would be gone within the day.
`worlds-openapi.meta.json` beside it carries the generation time, the commit it came from
and a link to the run, so the site can date the page instead of asserting freshness.

Generating a client from `worlds-openapi.json` would be a mistake worth naming: it includes
every endpoint nothing guards, so a client built on it can break silently on a server change
no test noticed. That is what `GUARDED_PREFIXES` exists to prevent, and adding a prefix
there is how a surface becomes generateable.
