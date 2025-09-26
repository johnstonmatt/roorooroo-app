/*
  Emoji rendering utilities and components
  - Uses local static assets under /public/emoji
  - Defaults to Twemoji assets copied via scripts/copy-twemoji-assets.mjs
  - Includes a macOS version detector and pack selector stub so we can map to different
    asset packs per macOS version later if desired.
*/

import * as React from "react"
import twemoji from "twemoji"
import { parse as parseEmoji } from "twemoji-parser"

// Best-effort macOS major version extraction from UA string.
// Returns null if unknown.
export function getMacOSMajorFromUA(ua?: string | null): number | null {
  if (!ua) return null
  try {
    // Typical UA segments:
    // - "Macintosh; Intel Mac OS X 10_15_7"
    // - "Macintosh; Intel Mac OS X 13_5"
    const match = ua.match(/Mac OS X ([0-9_\.]+)/)
    if (!match) return null
    const ver = match[1].replace(/_/g, ".")
    const major = parseInt(ver.split(".")[0], 10)
    // macOS 10.x => treat as 10; 11+ are actual majors
    if (Number.isFinite(major)) return major
  } catch {}
  return null
}

// Map macOS major to an asset pack directory.
// For now, we default everything to the Twemoji "latest" pack, but this is where you'd
// branch to custom packs like: `apple/macos-12`, `apple/macos-14`, etc., if provided.
export function getEmojiAssetPackForMacOS(macosMajor: number | null): string {
  // Example future mapping (commented):
  // if (macosMajor && macosMajor >= 14) return "apple/macos-14"
  // if (macosMajor && macosMajor >= 13) return "apple/macos-13"
  // return "apple/macos-12"
  return "twemoji/latest"
}

export function getEmojiAssetBase(ua?: string): string {
  const macosMajor = getMacOSMajorFromUA(ua)
  const pack = getEmojiAssetPackForMacOS(macosMajor)
  return `/emoji/${pack}`
}

function normalizeTwemojiFilename(code: string): string {
  // Twemoji asset filenames typically omit the VS16 (FE0F) suffixes
  return code.replace(/-fe0f/gi, "")
}

function toCodePointFromEmoji(emoji: string): string {
  // twemoji.convert.toCodePoint preserves ZWJ sequences, skin tones, etc.
  const code = twemoji.convert.toCodePoint(emoji)
  return normalizeTwemojiFilename(code)
}

export type EmojiProps = {
  char: string
  className?: string
  title?: string
  ext?: ".svg" | ".png"
}

// Renders a single emoji character as a static <img> pointing to local assets.
export function Emoji({ char, className, title, ext = ".svg" }: EmojiProps) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined
  const base = getEmojiAssetBase(ua)
  const code = toCodePointFromEmoji(char)
  const src = `${base}/${code}${ext}`
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={["emoji", className].filter(Boolean).join(" ")}
      src={src}
      alt={char}
      title={title}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  )
}

export type EmojiTextProps = {
  text: string
  className?: string
  ext?: ".svg" | ".png"
}

// Safely renders a text string by splitting on emoji clusters and replacing them
// with <img> tags pointing to local static assets. Non-emoji content remains as
// text nodes (no dangerous HTML injection).
export function EmojiText({ text, className, ext = ".svg" }: EmojiTextProps) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined
  const base = getEmojiAssetBase(ua)
  const entities = parseEmoji(text)

  if (!entities.length) return <>{text}</>

  const nodes: React.ReactNode[] = []
  let lastIndex = 0

  entities.forEach((entity, idx) => {
    const [start, end] = entity.indices as [number, number]
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }
    const emojiStr = entity.text
    const code = toCodePointFromEmoji(emojiStr)
    const src = `${base}/${code}${ext}`
    nodes.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`emoji-${idx}-${start}`}
        className="emoji"
        src={src}
        alt={emojiStr}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    )
    lastIndex = end
  })

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return <span className={className}>{nodes}</span>
}
