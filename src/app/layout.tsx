/**
 * layout.tsx — the wrapper every page sits inside.
 *
 * Plain English: fonts, the browser-tab title, and global styling live here.
 * Anything you want on literally every page (like a site header) goes here too.
 */

import type { Metadata } from "next";
import { Outfit, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

/**
 * Three typefaces, each with one job.
 *
 * Outfit is the voice — headlines and page titles. It is geometric and has
 * real character at large sizes, which the default system font does not.
 * DM Sans is the workhorse — every paragraph, label, form field and table.
 * It stays legible at 14px, which Outfit does not.
 * Geist Mono is for money and dates only, where digits must line up.
 *
 * Next downloads and self-hosts these at build time, so no request ever
 * leaves for Google when a visitor loads the site. `display: "swap"` means
 * text is readable immediately in a fallback face rather than invisible
 * while a font downloads.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// The text shown in the browser tab and in link previews.
export const metadata: Metadata = {
  title: "Vouch — warm introductions to real employees",
  description:
    "Vouch gives job seekers warm introductions from verified employees, and gives employers a short list of vouched-for candidates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Terms, privacy and refunds must be reachable from every page —
            Stripe checks for it, and so do people looking for a refund. */}
        <SiteFooter />
      </body>
    </html>
  );
}
