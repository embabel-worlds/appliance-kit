import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'

// A surface rendered with fixed data, for looking at: `node scripts/fixture.mjs [handler-studio|views]`.
const name = process.argv[2] ?? 'handler-studio'
const outdir = await mkdtemp(join(tmpdir(), `appliance-kit-${name}-`))
await build({
  entryPoints: [`test/fixtures/${name}.tsx`],
  bundle: true,
  format: 'esm',
  outdir,
  entryNames: name,
})
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${name} fixture</title><link rel="stylesheet" href="/${name}.css"></head><body><div id="root"></div><script type="module" src="/${name}.js"></script></body></html>`
const files = {
  '/': [html, 'text/html'],
  [`/${name}.js`]: [await readFile(resolve(outdir, `${name}.js`)), 'text/javascript'],
  [`/${name}.css`]: [await readFile(resolve(outdir, `${name}.css`)), 'text/css'],
}
await rm(outdir, { recursive: true, force: true })
const port = Number(process.env.PORT ?? 4179)
const server = createServer((request, response) => {
  const found = files[request.url ?? '/']
  if (!found) { response.writeHead(404).end(); return }
  response.writeHead(200, { 'Content-Type': found[1] })
  response.end(found[0])
})
server.listen(port, '127.0.0.1', () => console.log(`${name} fixture: http://127.0.0.1:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit()))
