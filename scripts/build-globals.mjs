/*
 * The IIFE builds the Me app loads as plain <script> tags.
 *
 * One entry point per global, all map-free: a vendored copy travels without its
 * sourcemap, and a `sourceMappingURL` pointing at a file that never arrives is
 * an error in the consumer's dev server, not a convenience.
 */
import { build } from 'esbuild'

const GLOBALS = [
  ['src/vc/index.ts', 'EmbabelVc', 'embabel-vc.js'],
  ['src/code-surface/index.ts', 'EmbabelCodeSurface', 'embabel-code-surface.js'],
  ['src/studio-kit/index.ts', 'EmbabelStudioKit', 'embabel-studio-kit.js'],
  ['src/backdrop/backdrop.ts', 'EmbabelBackdrop', 'embabel-backdrop.js'],
  ['src/client/index.ts', 'EmbabelApplianceClient', 'embabel-appliance-client.js'],
]

await Promise.all(
  GLOBALS.map(([entry, globalName, out]) =>
    build({ entryPoints: [entry], bundle: true, format: 'iife', globalName, sourcemap: false, outfile: `dist/global/${out}` }),
  ),
)
console.log(`built ${GLOBALS.length} global bundles`)
