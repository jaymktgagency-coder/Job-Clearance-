/**
 * layout.tsx — the wrapper every page sits inside.
 *
 * Plain English: fonts, the browser-tab title, and global styling live here.
 * Anything you want on literally every page (like a site header) goes here too.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
