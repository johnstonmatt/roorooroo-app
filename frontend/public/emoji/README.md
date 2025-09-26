# Emoji assets

This directory contains static emoji image assets served by the app.

Structure:
- /emoji/twemoji/latest/*.svg  (copied from node_modules/twemoji/assets/svg by scripts/copy-twemoji-assets.mjs)
- Optionally, you can add vendor-specific packs and macOS-versioned packs, e.g.:
  - /emoji/apple/macos-12/
  - /emoji/apple/macos-13/
  - /emoji/apple/macos-14/

Legal note: Do not include proprietary vendor emoji artwork (e.g., Apple Color Emoji) unless you have the appropriate rights. Twemoji is open-source (CC-BY 4.0) and is the default here.
