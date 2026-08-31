import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  Gavel,
  LayoutDashboard,
  FolderOpen,
  Users,
  Calendar,
  AlertTriangle,
  Shield,
  Archive,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "لوحة التحكم", path: "/app/dashboard", icon: LayoutDashboard },
  { label: "القضايا", path: "/app/cases", icon: FolderOpen },
  { label: "العملاء", path: "/app/clients", icon: Users },
  { label: "التقويم", path: "/app/calendar", icon: Calendar },
  { label: "المواعيد النهائية", path: "/app/deadlines", icon: AlertTriangle },
  { label: "الدفوعات الجنائية", path: "/app/defenses", icon: Shield },
  { label: "الأرشيف", path: "/app/archive", icon: Archive },
  { label: "الإطار القانوني", path: "/app/legal-framework", icon: BookOpen },
  { label: "الوكيل القانوني الذكي", path: "/app/ai-agent", icon: Bot },
];

const bottomItems: NavItem[] = [
  { label: "إدارة الفريق", path: "/admin/team", icon: Users, adminOnly: true },
  { label: "الإعدادات", path: "/app/settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useSupabaseAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside
      className={cn(
        "clay-sidebar h-screen sticky top-0 flex flex-col transition-all duration-300 z-40",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
      dir="rtl"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border/30">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-clay-blue/20 shrink-0">
          <Gavel className="w-5 h-5 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold text-sidebar-foreground tracking-tight leading-tight">
              CRIM-SYS
            </h1>
            <p className="text-[10px] text-sidebar-foreground/50 font-medium">
              2026
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto clay-scrollbar px-2 py-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + "/");

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "clay-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all",
                collapsed && "justify-center px-0",
                isActive
                  ? "active text-sidebar-primary bg-sidebar-accent"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        {/* Divider */}
        <div className="my-3 border-t border-sidebar-border/30" />

        {bottomItems.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "clay-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all",
                collapsed && "justify-center px-0",
                isActive
                  ? "active text-sidebar-primary bg-sidebar-accent"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-sidebar-border/30 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
