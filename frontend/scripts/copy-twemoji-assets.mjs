/*
  Populates Twemoji assets in public/ so the app serves emoji images locally.

  Strategy:
  1) If node_modules/twemoji/assets/svg exists, copy it wholesale
  2) Otherwise, fetch a minimal set of required SVGs from a stable CDN
*/

import fs from "fs"
import path from "path"
import url from "url"
import https from "https"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const repoRoot = path.resolve(__dirname, "..")
const nodeModulesTwemoji = path.join(repoRoot, "node_modules", "twemoji", "assets", "svg")
const destDir = path.join(repoRoot, "public", "emoji", "twemoji", "latest")

// Minimal set of emoji codepoints used in the UI. Add more as needed.
const minimalCodes = [
  "1f415", // dog
  "1f415-200d-1f9ba", // service dog
  "1f440", // eyes
  "1f514", // bell
  "1f3af", // direct hit / target
  "1f6d2", // shopping cart
  "1f3ab", // ticket
  "1f4bc", // briefcase
  "2764", // red heart (Twemoji stores without VS16 suffix)
  "1f4f0", // newspaper
  "1f50d" // magnifying glass
]

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true })
  }
}

function copyDir(src, dest) {
  ensureDir(dest)
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function download(urlStr, outPath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(outPath)
    https
      .get(urlStr, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          res.pipe(file)
          file.on("finish", () => file.close(() => resolve(true)))
        } else {
          // consume data to free memory, then resolve false
          res.resume()
          file.close(() => {
            try { fs.unlinkSync(outPath) } catch {}
            resolve(false)
          })
        }
      })
      .on("error", () => {
        try { fs.unlinkSync(outPath) } catch {}
        resolve(false)
      })
  })
}

async function ensureMinimalSet() {
  ensureDir(destDir)
  const baseCdn = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg"
  for (const code of minimalCodes) {
    const filePath = path.join(destDir, `${code}.svg`)
    if (fs.existsSync(filePath)) continue
    const urlSvg = `${baseCdn}/${code}.svg`
    // eslint-disable-next-line no-await-in-loop
    await download(urlSvg, filePath)
  }
}

;(async () => {
  try {
    if (fs.existsSync(nodeModulesTwemoji)) {
      ensureDir(destDir)
      copyDir(nodeModulesTwemoji, destDir)
    } else {
      await ensureMinimalSet()
    }
  } catch {
    // swallow errors to avoid breaking installs
  }
  process.exit(0)
})()
