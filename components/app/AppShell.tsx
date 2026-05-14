"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/app/Sidebar";

const plainShellRoutes = ["/login", "/onboarding"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const plain = plainShellRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (plain) {
    return <>{children}</>;
  }

  return (
    <div className="sb-app-shell">
      <Sidebar />
      <div className="sb-app-main">{children}</div>
    </div>
  );
}
