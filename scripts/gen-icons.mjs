// Rasterize the master SVG (build/icon.svg) into the PNG sizes Electron needs
// for the window/taskbar icon, plus a multi-size .ico for packaging later.
// The SVG stays the single source of truth — re-run `npm run gen:icons` after
// editing it.
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')
const outDir = join(root, 'build', 'icons')
mkdirSync(outDir, { recursive: true })

const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
const paths = []
for (const size of sizes) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  const p = join(outDir, `icon-${size}.png`)
  writeFileSync(p, png)
  paths.push(p)
}

// Primary window icon (highest res; Electron downsamples as needed).
writeFileSync(join(root, 'build', 'icon.png'), readFileSync(join(outDir, 'icon-512.png')))

// Windows .exe / installer icon (multi-resolution).
const icoSizes = [16, 24, 32, 48, 64, 128, 256].map((s) => join(outDir, `icon-${s}.png`))
const ico = await pngToIco(icoSizes)
writeFileSync(join(root, 'build', 'icon.ico'), ico)

console.log(`Generated ${sizes.length} PNGs, icon.png, and icon.ico in build/`)
