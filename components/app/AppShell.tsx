"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Sidebar } from "@/components/app/Sidebar";

const plainShellRoutes = ["/login", "/onboarding"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  function updateSidebarCollapsed(nextCollapsed: boolean) {
    setSidebarCollapsed(nextCollapsed);
    window.localStorage.setItem("sb-sidebar-collapsed", nextCollapsed ? "1" : "0");
  }

  if (plain) {
    return <>{children}</>;
  }

  return (
    <div className="sb-app-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={updateSidebarCollapsed} />
      <div className="sb-app-main">{children}</div>
    </div>
  );
}
