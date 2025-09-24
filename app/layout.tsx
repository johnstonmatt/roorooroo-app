import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "RooRooRoo - Your Faithful Website Watcher",
  description:
    "Monitor websites for changes and get instant notifications. Like a loyal pup watching out the window, RooRooRoo keeps an eye on your favorite websites.",
  generator: "v0.app",
  keywords: ["website monitoring", "change detection", "notifications", "alerts", "web scraping"],
  authors: [{ name: "RooRooRoo Team" }],
  openGraph: {
    title: "RooRooRoo - Your Faithful Website Watcher",
    description: "Monitor websites for changes and get instant notifications",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
