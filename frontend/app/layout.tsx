import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Suspense } from "react";
import StatusTag from "@/components/status-tag";

export const metadata: Metadata = {
  title: "RooRooRoo - Your Faithful Website Watcher",
  description:
    "Monitor websites for changes and get instant notifications. Like a loyal pup watching out the window, RooRooRoo keeps an eye on your favorite websites.",
  keywords: [
    "website monitoring",
    "change detection",
    "notifications",
    "alerts",
    "web scraping",
  ],
  authors: [{ name: "mattjo" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "RooRooRoo - Your Faithful Website Watcher",
    description: "Monitor websites for changes and get instant notifications",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-2">
        <Suspense fallback={null}>
          {children}
          <StatusTag />
        </Suspense>
        <Analytics />
        </div>
      </body>
    </html>
  );
}
