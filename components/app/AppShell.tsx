"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { MobileStudyAnnouncement } from "@/components/app/MobileStudyAnnouncement";
import { Sidebar } from "@/components/app/Sidebar";

const plainShellRoutes = ["/login", "/onboarding", "/mobile-study"];
const mobileStudyRoute = "/mobile-study";
const mobileStudyAnnouncementDismissedKey = "sb-mobile-study-announcement-v1-dismissed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMobileStudyAnnouncement, setShowMobileStudyAnnouncement] = useState(false);
  const plain = plainShellRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const mobileStudyPlainRoute = pathname === mobileStudyRoute || pathname.startsWith(`${mobileStudyRoute}/`);
  const homeRoute = pathname === "/" || pathname === "/studio";

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

  useEffect(() => {
    let active = true;
    try {
      if (mobileStudyPlainRoute) {
        window.queueMicrotask(() => {
          if (active) setShowMobileStudyAnnouncement(false);
        });
        return () => {
          active = false;
        };
      }

      const hasDismissedAnnouncement = window.localStorage.getItem(mobileStudyAnnouncementDismissedKey) === "true";
      window.queueMicrotask(() => {
        if (active) setShowMobileStudyAnnouncement(homeRoute && !hasDismissedAnnouncement);
      });
    } catch {
      window.queueMicrotask(() => {
        if (active) setShowMobileStudyAnnouncement(false);
      });
    }

    return () => {
      active = false;
    };
  }, [homeRoute, mobileStudyPlainRoute]);

  function updateSidebarCollapsed(nextCollapsed: boolean) {
    setSidebarCollapsed(nextCollapsed);
    window.localStorage.setItem("sb-sidebar-collapsed", nextCollapsed ? "1" : "0");
  }

  function dismissMobileStudyAnnouncement() {
    setShowMobileStudyAnnouncement(false);
    try {
      window.localStorage.setItem(mobileStudyAnnouncementDismissedKey, "true");
    } catch {
      // Ignore storage failures; the in-memory close still prevents repeat display in this render.
    }
  }

  if (plain) {
    return <>{children}</>;
  }

  return (
    <div className="sb-app-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <Sidebar collapsed={sidebarCollapsed} isAdmin={isAdmin} onCollapsedChange={updateSidebarCollapsed} />
      <div className="sb-app-main">{children}</div>
      <MobileStudyAnnouncement open={showMobileStudyAnnouncement} onDismiss={dismissMobileStudyAnnouncement} />
    </div>
  );
}
