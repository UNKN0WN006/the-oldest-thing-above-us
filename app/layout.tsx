import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "./globals.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: "OrbitPast: The Oldest Thing Above You",
  description: "Explore sample stories about human-made objects in orbit.",
};

export const viewport: Viewport = { themeColor: "#07090c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body suppressHydrationWarning className="flex min-h-dvh flex-col bg-void text-ink antialiased">
        <div aria-hidden className="earth-horizon" />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
