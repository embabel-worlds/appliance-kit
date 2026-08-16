/*
 * Turn the appliance's guarded surface snapshot into a document openapi-typescript can read.
 *
 * `spec/client-surface.json` is copied verbatim from the assistant repo, where
 * `OpenApiClientContractTest` regenerates it and fails the build when the published surface moves.
 * It is deliberately NOT a whole OpenAPI document — it is `{paths, schemas}`, the slice that test
 * guards: virtual Cypher (`/admin/kg`) and handler authoring (`/admin/handlers`), the two surfaces
 * the studios are built on. Generating from it means this client's types can only drift from the
 * server if that test was updated on purpose. That is the property worth having; a full
 * `/v3/api-docs` dump would include the parts of the API nothing yet guards.
 *
 * Everything this adds (openapi version, info, the security scheme) is document scaffolding that
 * carries no type information, so nothing here can invent a shape the server does not serve.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const surface = JSON.parse(readFileSync(join(root, 'spec/client-surface.json'), 'utf8'))

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Embabel appliance — the guarded front-end surface',
    description:
      'Generated from the snapshot `OpenApiClientContractTest` guards in the assistant repo. ' +
      'Do not hand-edit: run `npm run spec` after copying a newer snapshot.',
    version: '0.0.0',
  },
  paths: surface.paths,
  components: {
    schemas: surface.schemas,
    securitySchemes: {
      basicAuth: { type: 'http', scheme: 'basic' },
    },
  },
  security: [{ basicAuth: [] }],
}

const out = join(root, 'spec/openapi.json')
writeFileSync(out, JSON.stringify(document, null, 2) + '\n')

const operations = Object.values(surface.paths).reduce(
  (n, methods) =>
    n + Object.keys(methods).filter((k) => ['get', 'post', 'put', 'delete', 'patch'].includes(k)).length,
  0,
)
console.log(
  `spec/openapi.json: ${Object.keys(surface.paths).length} paths, ${operations} operations, ` +
    `${Object.keys(surface.schemas).length} schemas`,
)
