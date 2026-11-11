"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
      <Link href="/" className="font-serif text-xl">OrbitPast</Link>
      <nav aria-label="Main navigation" className="-mr-3 flex text-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-3 hover:text-ink ${pathname === link.href ? "text-ink" : "text-muted"}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
