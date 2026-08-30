import { useState } from "react";
import { Search, Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { mockDeadlines } from "@/data/mock";

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const criticalDeadlines = mockDeadlines.filter(
    (d) => d.urgency === "critical" && d.status !== "مكتمل"
  );

  return (
    <header className="clay-topbar sticky top-0 z-30 h-16 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-xl ms-4">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في القضايا، العملاء، الوثائق..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background placeholder:text-muted-foreground/50"
          />
          {searchOpen && searchQuery.length > 0 && (
            <div className="absolute top-full mt-2 w-full clay-card p-3 animate-fade-in">
              <p className="text-xs text-muted-foreground mb-2">نتائج البحث</p>
              <p className="text-sm text-foreground/60">لا توجد نتائج لـ "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="clay-button relative p-2.5 bg-card rounded-xl"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {criticalDeadlines.length > 0 && (
              <span className="absolute top-1.5 start-1.5 w-2.5 h-2.5 bg-urgency-critical rounded-full animate-pulse-glow" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute start-0 top-full mt-2 w-80 clay-card p-4 animate-fade-in z-50">
              <h3 className="text-sm font-bold text-foreground mb-3">الإشعارات</h3>
              <div className="space-y-2">
                {criticalDeadlines.map((d) => (
                  <div
                    key={d.id}
                    className="clay-card-soft p-3 urgency-border-critical"
                  >
                    <p className="text-xs font-semibold text-urgency-critical mb-1">
                      ⚠ موعد نهائي حرج
                    </p>
                    <p className="text-sm font-medium text-foreground">{d.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.caseCode} — الموعد النهائي: {d.dueDate}
                    </p>
                  </div>
                ))}
                {criticalDeadlines.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    لا توجد إشعارات عاجلة
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className="clay-button flex items-center gap-2 px-3 py-2 bg-card rounded-xl"
          >
            <div className="w-8 h-8 rounded-xl bg-clay-blue/20 flex items-center justify-center">
              <span className="text-sm font-bold text-clay-blue">م</span>
            </div>
            <div className="text-end hidden sm:block">
              <p className="text-sm font-semibold text-foreground leading-tight">محمد فتحي</p>
              <p className="text-[10px] text-muted-foreground">محامٍ رئيسي</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {profileOpen && (
            <div className="absolute start-0 top-full mt-2 w-56 clay-card p-2 animate-fade-in z-50">
              <a
                href="/app/settings"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                <User className="w-4 h-4" />
                الملف الشخصي
              </a>
              <a
                href="/app/settings"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" />
                الإعدادات
              </a>
              <div className="my-1 border-t border-border" />
              <a
                href="/login"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
