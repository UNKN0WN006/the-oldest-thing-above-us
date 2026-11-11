"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/graveyard", label: "Graveyard" },
  { href: "/explore", label: "Explorer" },
  { href: "/methodology", label: "Method" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Above Us — home">
        <span className="wordmark__dot" aria-hidden="true" />
        Above Us
      </Link>
      <nav className="site-nav" aria-label="Primary">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
