import { NavLink } from "react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Clock,
  Shield,
  Archive,
  FileText,
  Settings,
  LogOut,
  Bot,
  Info,
  ChevronLeft,
  HardHat,
  Eye,
  Search,
  Map,
} from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "لوحة التحكم", labelEn: "Dashboard" },
  { to: "/app/cases", icon: Briefcase, label: "القضايا", labelEn: "Cases" },
  { to: "/app/clients", icon: Users, label: "العملاء", labelEn: "Clients" },
  { to: "/app/calendar", icon: Calendar, label: "التقويم", labelEn: "Calendar" },
  { to: "/app/deadlines", icon: Clock, label: "المواعيد القانونية", labelEn: "Deadlines" },
  { to: "/app/ai-agents", icon: Bot, label: "الوكيل القانوني المتعدد", labelEn: "AI Agents Swarm", badge: "جديد" },
  { to: "/app/ai-agent/colombo", icon: Eye, label: "محرك كولومبو التفتيشي", labelEn: "Colombo Forensic Engine" },
  { to: "/app/social-search", icon: Search, label: "بحث المحاكم الاجتماعية", labelEn: "Social Court Search" },
  { to: "/app/guides/opposition", icon: Map, label: "دليل المعارض", labelEn: "Opposition Guide" },
  { to: "/app/defenses", icon: Shield, label: "الدفوع الجنائية", labelEn: "Defenses" },
  { to: "/app/archive", icon: Archive, label: "الأرشيف", labelEn: "Archive" },
  { to: "/app/legal-framework", icon: FileText, label: "الإطار القانوني", labelEn: "Legal Framework" },
  { to: "/app/about", icon: Info, label: "عن النظام", labelEn: "About" },
  { to: "/app/settings", icon: Settings, label: "الإعدادات", labelEn: "Settings" },
];

const adminItems = [
  { to: "/admin/team", icon: HardHat, label: "إدارة الفريق", labelEn: "Team Management" },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, signOut } = useSupabaseAuth();

  const renderNavItem = (item: (typeof navItems)[0]) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          collapsed ? "justify-center" : "",
          isActive
            ? "bg-primary text-white shadow-md"
            : "text-clay-text-secondary hover:bg-clay-surface hover:text-clay-text"
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-l-2 border-clay-border bg-clay-card transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-clay-border p-4">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-black text-primary">CRIM-SYS</h1>
            <p className="text-[10px] text-clay-text-secondary">نظام إدارة القضايا 2026</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-clay-text-secondary hover:bg-clay-surface"
        >
          <ChevronLeft className={cn("h-5 w-5 transition-transform", collapsed ? "rotate-180" : "")} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(renderNavItem)}
        <div className="my-2 border-t border-clay-border" />
        {adminItems.map(renderNavItem)}
      </nav>

      {/* User section */}
      <div className="border-t border-clay-border p-3">
        {!collapsed && user && (
          <div className="mb-2 rounded-lg bg-clay-surface p-2">
            <p className="truncate text-xs font-medium text-clay-text">{user.email}</p>
            <p className="text-[10px] text-clay-text-secondary">
              {user.user_metadata?.role === "admin" ? "محامٍ ראשי" : "مساعد قانوني"}
            </p>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-clay-text-secondary transition-colors hover:bg-red-50 hover:text-red-600",
            collapsed ? "justify-center" : ""
          )}
          title={collapsed ? "تسجيل الخروج" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}
