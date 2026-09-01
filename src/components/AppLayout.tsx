import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileQuickActions } from "./MobileQuickActions";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/ui";

export function AppLayout() {
  const { collapsed, toggleSidebar } = useSidebarStore();

  return (
    <div className="flex min-h-screen bg-background font-arabic">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main
          className={cn(
            "flex-1 p-6 pb-24 overflow-auto clay-scrollbar animate-fade-in",
            "lg:pb-6"
          )}
        >
          <Outlet />
        </main>
      </div>
      <MobileQuickActions />
    </div>
  );
}
