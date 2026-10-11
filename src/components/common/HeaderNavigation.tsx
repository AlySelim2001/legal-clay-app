import { useCallback, useState, useEffect } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Globe,
  Sun,
  Moon,
  Menu,
  X,
  Accessibility,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useUpcomingHearings } from "@/hooks/useSupabaseData";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate, Link } from "react-router";
import { supabase } from "@/lib/supabase";
import {
  useSearchStore,
  useNotificationStore,
  useProfileStore,
} from "@/stores/ui";
import { cn } from "@/lib/utils";

interface SearchResult {
  result_type: string;
  id: string;
  title: string;
  subtitle: string;
  code: string;
}

export function HeaderNavigation() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [easeMode, setEaseMode] = useState(() => {
    // Load from localStorage or check DOM
    const stored = localStorage.getItem("ma-at-ease-mode");
    if (stored !== null) return stored === "true";
    return document.documentElement.classList.contains("ma-at-ease");
  });

  const { query, isOpen, setQuery, close } = useSearchStore();
  const { isOpen: notifOpen, toggle: toggleNotif } = useNotificationStore();
  const { isOpen: profileOpen, toggle: toggleProfile, close: closeProfile } =
    useProfileStore();
  const { user, signOut } = useSupabaseAuth();
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { data: hearings } = useUpcomingHearings();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Toggle Ease Mode
  const handleToggleEaseMode = useCallback(() => {
    const newState = !easeMode;
    setEaseMode(newState);
    localStorage.setItem("ma-at-ease-mode", String(newState));

    if (newState) {
      document.documentElement.classList.add("ma-at-ease");
    } else {
      document.documentElement.classList.remove("ma-at-ease");
    }
  }, [easeMode]);

  const now = new Date();
  const criticalDeadlines = (hearings ?? []).filter((h) => {
    const days = Math.ceil(
      (new Date(h.session_date).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    return days >= 0 && days <= 3;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSearch = useCallback(
    async (value: string) => {
      setQuery(value);
      if (value.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      const { data, error } = await supabase.rpc("global_search", {
        p_query: value,
      });
      if (!error && data) {
        setSearchResults(data as SearchResult[]);
      }
      setSearchLoading(false);
    },
    [setQuery]
  );

  const handleSearchResultClick = (result: SearchResult) => {
    close();
    setSearchResults([]);
    if (result.result_type === "case") {
      navigate(`/app/cases/${result.code}`);
    } else {
      navigate(`/app/clients/${result.code}`);
    }
  };

  return (
    <>
      {/* Main Header */}
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6 clay-topbar safe-area-top">
        {/* Left: Logo + Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Menu Button - 56dp */}
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className={cn(
              "clay-button hidden sm:hidden min-h-[56px] min-w-[56px] p-3 bg-card rounded-xl",
              "focus-visible:ring-2 focus-visible:ring-amber-500 transition-all active:scale-[0.98]"
            )}
            title={lang === "ar" ? "القائمة" : "Menu"}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileDrawerOpen}
          >
            {mobileDrawerOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>

          {/* Logo / Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-clay-blue to-clay-purple flex items-center justify-center">
              <span className="text-xs font-bold text-white">⚖️</span>
            </div>
            <span className="text-sm font-bold text-foreground hidden sm:inline">
              ماعت
            </span>
          </div>
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-md ms-4 relative hidden sm:block">
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Global search"
              role="searchbox"
            />
          </div>

          {/* Search Results Dropdown */}
          {isOpen && (
            <div className="absolute top-full mt-2 w-full clay-card p-3 animate-fade-in z-50 shadow-lg">
              {searchLoading ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t("common.loading")}
                </p>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {searchResults.map((r) => (
                    <button
                      key={`${r.result_type}-${r.id}`}
                      onClick={() => handleSearchResultClick(r)}
                      className={cn(
                        "w-full text-start p-2 rounded-xl hover:bg-muted transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="clay-badge text-[9px] font-bold bg-clay-blue/10 text-clay-blue px-1.5 py-0.5">
                          {r.result_type === "case" ? "قضية" : "عميل"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {r.code}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t("search.noResults")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Controls & Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online/Offline Status Indicator */}
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium",
              isOnline
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            )}
            title={lang === "ar" ? (isOnline ? "متصل" : "غير متصل") : isOnline ? "Online" : "Offline"}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">
              {isOnline ? (lang === "ar" ? "متصل" : "Online") : (lang === "ar" ? "غير متصل" : "Offline")}
            </span>
          </div>

          {/* Dark Mode Toggle - 56dp */}
          <button
            onClick={toggleTheme}
            className={cn(
              "clay-button min-h-[56px] min-w-[56px] p-2.5 bg-card rounded-xl",
              "focus-visible:ring-2 focus-visible:ring-amber-500 transition-all active:scale-[0.98]"
            )}
            title={
              theme === "dark"
                ? lang === "ar"
                  ? "الوضع الفاتح"
                  : "Light Mode"
                : lang === "ar"
                  ? "الوضع الداكن"
                  : "Dark Mode"
            }
            aria-label={
              theme === "dark"
                ? lang === "ar"
                  ? "الوضع الفاتح"
                  : "Light Mode"
                : lang === "ar"
                  ? "الوضع الداكن"
                  : "Dark Mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-clay-amber" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Maât Ease Mode Toggle - 56dp */}
          <button
            onClick={handleToggleEaseMode}
            className={cn(
              "clay-button min-h-[56px] min-w-[56px] p-2.5 rounded-xl transition-all active:scale-[0.98]",
              easeMode
                ? "bg-clay-blue/20 border border-clay-blue/50"
                : "bg-card",
              "focus-visible:ring-2 focus-visible:ring-amber-500"
            )}
            title={
              lang === "ar" ? "وضع التيسير" : "Ease Mode"
            }
            aria-label={
              lang === "ar" ? "وضع التيسير" : "Ease Mode"
            }
            aria-pressed={easeMode}
          >
            <Accessibility
              className={cn(
                "w-4 h-4 transition-colors",
                easeMode ? "text-clay-blue" : "text-muted-foreground"
              )}
            />
          </button>

          {/* i18n Toggle - 56dp */}
          <button
            onClick={toggleLang}
            className={cn(
              "clay-button min-h-[56px] min-w-[56px] flex items-center justify-center px-2.5 py-2 bg-card rounded-xl",
              "focus-visible:ring-2 focus-visible:ring-amber-500 transition-all active:scale-[0.98]"
            )}
            title={
              lang === "ar" ? "Switch to English" : "التبديل إلى العربية"
            }
            aria-label={
              lang === "ar" ? "Switch to English" : "التبديل إلى العربية"
            }
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline ms-1">
              {lang === "ar" ? "EN" : "عربي"}
            </span>
          </button>

          {/* Notifications - 56dp */}
          <div className="relative">
            <button
              onClick={() => {
                toggleNotif();
                closeProfile();
              }}
              className={cn(
                "clay-button relative min-h-[56px] min-w-[56px] p-2.5 bg-card rounded-xl",
                "focus-visible:ring-2 focus-visible:ring-amber-500 transition-all active:scale-[0.98]"
              )}
              aria-label={lang === "ar" ? "الإشعارات" : "Notifications"}
              aria-pressed={notifOpen}
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {criticalDeadlines.length > 0 && (
                <span className="absolute top-1.5 start-1.5 w-2.5 h-2.5 bg-urgency-critical rounded-full animate-pulse-glow" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute start-0 top-full mt-2 w-80 clay-card p-4 animate-fade-in z-50 shadow-lg">
                <h3 className="text-sm font-bold text-foreground mb-3">
                  {lang === "ar" ? "الإشعارات" : "Notifications"}
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {criticalDeadlines.map((d) => (
                    <div
                      key={d.id}
                      className="clay-card-soft p-3 urgency-border-critical"
                    >
                      <p className="text-xs font-semibold text-urgency-critical mb-1">
                        ⚠ {lang === "ar" ? "موعد نهائي حرج" : "Critical deadline"}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {d.session_type}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {d.case?.case_code ?? "—"} —{" "}
                        {lang === "ar" ? "الموعد" : "Date"}: {d.session_date}
                      </p>
                    </div>
                  ))}
                  {criticalDeadlines.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {lang === "ar"
                        ? "لا توجد إشعارات عاجلة"
                        : "No urgent notifications"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile - 56dp */}
          <div className="relative">
            <button
              onClick={() => {
                toggleProfile();
                setMobileDrawerOpen(false);
              }}
              className={cn(
                "clay-button min-h-[56px] min-w-[56px] flex items-center gap-2 px-3 py-2 bg-card rounded-xl",
                "focus-visible:ring-2 focus-visible:ring-amber-500 transition-all active:scale-[0.98]"
              )}
              aria-label={lang === "ar" ? "حساب المستخدم" : "User profile"}
              aria-pressed={profileOpen}
            >
              <div className="w-8 h-8 rounded-lg bg-clay-blue/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-clay-blue">
                  {user?.email?.charAt(0)?.toUpperCase() ?? "م"}
                </span>
              </div>
              <div className="text-end hidden sm:block">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {user?.email ?? (lang === "ar" ? "مستخدم" : "User")}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {user?.role === "admin"
                    ? lang === "ar"
                      ? "مدير"
                      : "Admin"
                    : lang === "ar"
                      ? "مساعد"
                      : "Assistant"}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {profileOpen && (
              <div className="absolute start-0 top-full mt-2 w-56 clay-card p-2 animate-fade-in z-50 shadow-lg">
                <Link
                  to="/app/settings"
                  onClick={() => closeProfile()}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-xl transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none min-h-[44px]"
                  )}
                >
                  <User className="w-4 h-4" />
                  {lang === "ar" ? "الملف الشخصي" : "Profile"}
                </Link>
                <Link
                  to="/app/settings"
                  onClick={() => closeProfile()}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-xl transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none min-h-[44px]"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  {lang === "ar" ? "الإعدادات" : "Settings"}
                </Link>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={handleSignOut}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 rounded-xl transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none min-h-[44px]"
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  {lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 top-16 z-30 sm:hidden bg-black/50 animate-fade-in">
          <div
            className="absolute start-0 top-0 w-64 h-[calc(100vh-64px)] clay-sidebar overflow-y-auto animate-fade-in"
            role="navigation"
            aria-label="Mobile navigation"
          >
            {/* Mobile Menu Items */}
            <nav className="space-y-1 p-4">
              <Link
                to="/app/dashboard"
                onClick={() => setMobileDrawerOpen(false)}
                className={cn(
                  "clay-nav-item min-h-[56px] min-w-[56px] flex items-center px-3 py-2 text-sm text-foreground hover:bg-sidebar-accent rounded-lg transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
                )}
              >
                {lang === "ar" ? "لوحة التحكم" : "Dashboard"}
              </Link>
              <Link
                to="/app/cases"
                onClick={() => setMobileDrawerOpen(false)}
                className={cn(
                  "clay-nav-item min-h-[56px] min-w-[56px] flex items-center px-3 py-2 text-sm text-foreground hover:bg-sidebar-accent rounded-lg transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
                )}
              >
                {lang === "ar" ? "القضايا" : "Cases"}
              </Link>
              <Link
                to="/app/deadlines"
                onClick={() => setMobileDrawerOpen(false)}
                className={cn(
                  "clay-nav-item min-h-[56px] min-w-[56px] flex items-center px-3 py-2 text-sm text-foreground hover:bg-sidebar-accent rounded-lg transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
                )}
              >
                {lang === "ar" ? "المواعيد" : "Deadlines"}
              </Link>
              <Link
                to="/app/calendar"
                onClick={() => setMobileDrawerOpen(false)}
                className={cn(
                  "clay-nav-item min-h-[56px] min-w-[56px] flex items-center px-3 py-2 text-sm text-foreground hover:bg-sidebar-accent rounded-lg transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
                )}
              >
                {lang === "ar" ? "التقويم" : "Calendar"}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
