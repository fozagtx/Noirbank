import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Noirbank — Private agentic banking on Zcash",
    template: "%s · Noirbank",
  },
  description:
    "Private agentic banking on Zcash: shielded accounts, mandates and owner approvals for your AI agents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
