import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { DataModeBanner } from "@/components/DataModeBanner";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: { default: "Above Us — the oldest thing above you", template: "%s · Above Us" },
  description:
    "Find the earliest-launched spacecraft with a predicted pass over your city, and read the history it still carries. Predicted passes are geometric and do not guarantee visibility.",
};

export const viewport: Viewport = { themeColor: "#02040a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <DataModeBanner />
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div>
            <p className="wordmark" style={{ fontSize: "1.1rem" }}>
              <span className="wordmark__dot" aria-hidden="true" />
              Above Us
            </p>
            <p>The sky is not empty. It carries our history.</p>
            <p>Team Cosmic Compass · AARIVYN IGNITE 1.0</p>
          </div>
          <div>
            <p>
              Orbital elements and catalogue records: <a href="https://celestrak.org">CelesTrak</a>. Pass geometry:
              Skyfield on SGP4. Coastlines: Natural Earth.
            </p>
            <p>
              A predicted pass is geometry, not a promise that anything will be visible.{" "}
              <a href="/methodology">How this works and what it cannot tell you</a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
