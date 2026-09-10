import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

const outdir = await mkdtemp(join(tmpdir(), 'appliance-kit-handlers-'))
await build({
  entryPoints: ['test/fixtures/handler-studio.tsx'],
  bundle: true,
  format: 'esm',
  outdir,
  entryNames: 'handler-studio',
})
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Agents fixture</title><link rel="stylesheet" href="/handler-studio.css"></head><body><div id="root"></div><script type="module" src="/handler-studio.js"></script></body></html>`
const files = {
  '/': [html, 'text/html'],
  '/handler-studio.js': [await readFile(resolve(outdir, 'handler-studio.js')), 'text/javascript'],
  '/handler-studio.css': [await readFile(resolve(outdir, 'handler-studio.css')), 'text/css'],
}
await rm(outdir, { recursive: true, force: true })
const port = Number(process.env.PORT ?? 4179)
const server = createServer((request, response) => {
  const found = files[request.url ?? '/']
  if (!found) { response.writeHead(404).end(); return }
  response.writeHead(200, { 'Content-Type': found[1] })
  response.end(found[0])
})
server.listen(port, '127.0.0.1', () => console.log(`Handler fixture: http://127.0.0.1:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()))
