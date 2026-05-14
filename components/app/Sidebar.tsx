"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/studio", label: "Studio", icon: "St" },
  { href: "/search", label: "Search", icon: "Se" },
  { href: "/studio?wrongBefore=1", label: "Mistakes", icon: "Mi" },
  { href: "/studio", label: "Decks", icon: "De", disabled: true },
  { href: "/studio", label: "Progress", icon: "Pr", disabled: true },
  { href: "/admin/review", label: "Admin review", icon: "Ar" },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/studio") return pathname === "/" || pathname === "/studio";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sb-sidebar" aria-label="Navigazione app">
      <Link className="sb-sidebar-brand" href="/studio">
        <span className="sb-sidebar-mark">Sb</span>
        <span>
          <strong>Sbobby</strong>
          <small>Medical study</small>
        </span>
      </Link>
      <nav className="sb-sidebar-nav">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className="sb-sidebar-link"
              data-active={active}
              data-disabled={item.disabled ? "true" : undefined}
              href={item.href}
              key={item.label}
            >
              <span className="sb-sidebar-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sb-sidebar-footer">
        <span className="sb-badge">Published cards</span>
        <p>Search and study use the current approved question set.</p>
      </div>
    </aside>
  );
}
