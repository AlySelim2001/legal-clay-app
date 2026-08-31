import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileQuickActions } from "./MobileQuickActions";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-background font-arabic">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className={cn(
          "flex-1 p-6 pb-24 overflow-auto clay-scrollbar animate-fade-in",
          "lg:pb-6"
        )}>
          <Outlet />
        </main>
      </div>
      <MobileQuickActions />
    </div>
  );
}
