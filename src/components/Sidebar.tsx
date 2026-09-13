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
  Info,
  ChevronLeft,
  HardHat,
  Eye,
  BrainCircuit,
  Landmark,
  MessageCircleQuestion,
  FileSearch,
  Route,
  Building2,
  GraduationCap,
  FolderOpen,
  Scale,
  History,
  Bell,
  BookMarked,
  FlaskConical,
} from "lucide-react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems: Array<{to: string; icon: React.ElementType; label: string; labelEn: string; badge?: string}> = [
  { to: "/app/legal", icon: Landmark, label: "منصة القانون", labelEn: "Legal Platform" },
  { to: "/app/legal/ask", icon: MessageCircleQuestion, label: "اسأل القانون", labelEn: "Ask the Law" },
  { to: "/app/legal/search", icon: FileSearch, label: "البحث القانوني", labelEn: "Legal Search" },
  { to: "/app/legal/next-steps", icon: Route, label: "ماذا أفعل الآن؟", labelEn: "What Now?" },
  { to: "/app/legal/authorities", icon: Building2, label: "الجهات الرسمية", labelEn: "Authorities" },
  { to: "/app/legal/rights", icon: GraduationCap, label: "اعرف حقك", labelEn: "Know Your Rights" },
  { to: "/app/legal/documents", icon: FileText, label: "مستنداتي", labelEn: "My Documents" },
  { to: "/app/legal/dossier", icon: FolderOpen, label: "ملفي القضائي", labelEn: "My Dossier" },
  { to: "/app/legal/sources", icon: Scale, label: "المصادر القانونية", labelEn: "Legal Sources" },
  { to: "/app/legal/history", icon: History, label: "سجل البحث", labelEn: "Search History" },
  { to: "/app/legal/notifications", icon: Bell, label: "الإشعارات", labelEn: "Notifications" },
];

const practiceItems: Array<{to: string; icon: React.ElementType; label: string; labelEn: string; badge?: string}> = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "لوحة التحكم", labelEn: "Dashboard" },
  { to: "/app/cases", icon: Briefcase, label: "القضايا", labelEn: "Cases" },
  { to: "/app/persons", icon: Users, label: "الأشخاص", labelEn: "Persons" },
  { to: "/app/calendar", icon: Calendar, label: "التقويم", labelEn: "Calendar" },
  { to: "/app/actions", icon: Clock, label: "الإجراءات والمهام", labelEn: "Actions & Tasks" },
  { to: "/app/defenses", icon: Shield, label: "الدفوع", labelEn: "Defenses" },
  { to: "/app/archive", icon: Archive, label: "المستندات", labelEn: "Documents" },
  { to: "/app/settings", icon: Settings, label: "الإعدادات", labelEn: "Settings" },
  { to: "/app/about", icon: Info, label: "عن النظام", labelEn: "About" },
];

const adminItems = [
  { to: "/admin/team", icon: HardHat, label: "إدارة الفريق", labelEn: "Team Management" },
  { to: "/admin/knowledge", icon: BookMarked, label: "إدارة المعرفة", labelEn: "Knowledge Admin" },
  { to: "/admin/evaluation", icon: FlaskConical, label: "تقييم الذكاء الاصطناعي", labelEn: "AI Evaluation" },
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
        {!collapsed && (
          <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-wide text-clay-text-secondary">
            منصة القانون المصري
          </p>
        )}
        {navItems.map(renderNavItem)}
        <div className="my-2 border-t border-clay-border" />
        {!collapsed && (
          <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-wide text-clay-text-secondary">
            إدارة الممارسة
          </p>
        )}
        {practiceItems.map(renderNavItem)}
        <div className="my-2 border-t border-clay-border" />
        {!collapsed && (
          <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-wide text-clay-text-secondary">
            الإدارة
          </p>
        )}
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
