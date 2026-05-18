"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Sidebar } from "@/components/app/Sidebar";

const plainShellRoutes = ["/login", "/onboarding"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const plain = plainShellRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    let active = true;
    window.queueMicrotask(() => {
      if (active) setSidebarCollapsed(window.localStorage.getItem("sb-sidebar-collapsed") === "1");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { isAdmin?: boolean } | null) => {
        if (active) setIsAdmin(Boolean(payload?.isAdmin));
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateSidebarCollapsed(nextCollapsed: boolean) {
    setSidebarCollapsed(nextCollapsed);
    window.localStorage.setItem("sb-sidebar-collapsed", nextCollapsed ? "1" : "0");
  }

  if (plain) {
    return <>{children}</>;
  }

  return (
    <div className="sb-app-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <Sidebar collapsed={sidebarCollapsed} isAdmin={isAdmin} onCollapsedChange={updateSidebarCollapsed} />
      <div className="sb-app-main">{children}</div>
    </div>
  );
}
