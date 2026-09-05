/** @type {import('next').NextConfig} */
const nextConfig = {
  // This repo keeps a single curated CLAUDE.md at the repo root; Next 16 would
  // otherwise regenerate frontend/AGENTS.md + frontend/CLAUDE.md on every `next dev`.
  agentRules: false,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  output: "export",
};

export default nextConfig;
