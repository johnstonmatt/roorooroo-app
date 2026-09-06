/*
  Emoji rendering utilities and components
  - Uses local static assets under /public/emoji
  - Assets are Twemoji, copied in by scripts/copy-twemoji-assets.mjs
*/

import * as React from "react";
import twemoji from "twemoji";
import { parse as parseEmoji } from "twemoji-parser";

/** Every emoji resolves to the one pack we ship. */
const EMOJI_ASSET_BASE = "/emoji/twemoji/latest";

function normalizeTwemojiFilename(code: string): string {
  // Twemoji asset filenames typically omit the VS16 (FE0F) suffixes
  return code.replace(/-fe0f/gi, "");
}

function toCodePointFromEmoji(emoji: string): string {
  // twemoji.convert.toCodePoint preserves ZWJ sequences, skin tones, etc.
  const code = twemoji.convert.toCodePoint(emoji);
  return normalizeTwemojiFilename(code);
}

export type EmojiProps = {
  char: string;
  className?: string;
  title?: string;
  ext?: ".svg" | ".png";
};

// Renders a single emoji character as a static <img> pointing to local assets.
export function Emoji({ char, className, title, ext = ".svg" }: EmojiProps) {
  const src = `${EMOJI_ASSET_BASE}/${toCodePointFromEmoji(char)}${ext}`;
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
  );
}

export type EmojiTextProps = {
  text: string;
  className?: string;
  ext?: ".svg" | ".png";
};

// Safely renders a text string by splitting on emoji clusters and replacing them
// with <img> tags pointing to local static assets. Non-emoji content remains as
// text nodes (no dangerous HTML injection).
export function EmojiText({ text, className, ext = ".svg" }: EmojiTextProps) {
  const entities = parseEmoji(text);

  if (!entities.length) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  entities.forEach((entity, idx) => {
    const [start, end] = entity.indices;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    const emojiStr = entity.text;
    const src = `${EMOJI_ASSET_BASE}/${toCodePointFromEmoji(emojiStr)}${ext}`;
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
      />,
    );
    lastIndex = end;
  });

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <span className={className}>{nodes}</span>;
}
