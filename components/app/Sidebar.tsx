"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/studio", label: "Studio", icon: "study" },
  { href: "/search", label: "Cerca", icon: "search" },
  { href: "/mistakes", label: "Errori", icon: "errors" },
  { href: "/admin/review", label: "Revisione admin", icon: "admin", adminOnly: true },
];

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/studio") return pathname === "/" || pathname === "/studio";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function Sidebar({
  collapsed,
  isAdmin,
  onCollapsedChange,
}: {
  collapsed: boolean;
  isAdmin: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="sb-sidebar" aria-label="Navigazione app" data-collapsed={collapsed}>
      <div className="sb-sidebar-head">
        <Link className="sb-sidebar-brand" href="/studio" aria-label="Sbobby Studio medico">
          <span className="sb-sidebar-mark">Sb</span>
          <span className="sb-sidebar-brand-text">
            <strong>Sbobby</strong>
            <small>Studio medico</small>
          </span>
        </Link>
        <button
          aria-label={collapsed ? "Espandi menu laterale" : "Comprimi menu laterale"}
          className="sb-sidebar-collapse"
          onClick={() => onCollapsedChange(!collapsed)}
          title={collapsed ? "Espandi menu" : "Comprimi menu"}
          type="button"
        >
          <SidebarIcon name={collapsed ? "expand" : "collapse"} />
        </button>
      </div>
      <nav className="sb-sidebar-nav">
        {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className="sb-sidebar-link"
              data-active={active}
              href={item.href}
              key={item.label}
              title={item.label}
              aria-label={item.label}
            >
              <span className="sb-sidebar-icon" aria-hidden="true">
                <SidebarIcon name={item.icon} />
              </span>
              <span className="sb-sidebar-link-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sb-sidebar-footer">
        <span className="sb-badge">Domande pubblicate</span>
        <p>Studio e ricerca usano il set approvato di domande.</p>
      </div>
    </aside>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }
  if (name === "errors") {
    return (
      <svg {...common}>
        <path d="M12 3 2.8 19a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  if (name === "admin") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.6 3 8.2 7 10 4-1.8 7-5.4 7-10V6l-7-3Z" />
        <path d="m9.5 12 1.7 1.7 3.8-4" />
      </svg>
    );
  }
  if (name === "collapse") {
    return (
      <svg {...common}>
        <path d="m15 6-6 6 6 6" />
      </svg>
    );
  }
  if (name === "expand") {
    return (
      <svg {...common}>
        <path d="m9 6 6 6-6 6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 1-3-3V4Z" />
      <path d="M8 4v13a3 3 0 0 0 3 3" />
      <path d="M9 8h6" />
      <path d="M9 12h5" />
    </svg>
  );
}
