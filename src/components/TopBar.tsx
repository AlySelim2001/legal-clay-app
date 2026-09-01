import { useCallback } from "react";
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
import { useState } from "react";

interface SearchResult {
  result_type: string;
  id: string;
  title: string;
  subtitle: string;
  code: string;
}

export function TopBar() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const { query, isOpen, setQuery, close } = useSearchStore();
  const { isOpen: notifOpen, toggle: toggleNotif } = useNotificationStore();
  const { isOpen: profileOpen, toggle: toggleProfile, close: closeProfile } =
    useProfileStore();
  const { user, signOut } = useSupabaseAuth();
  const { t, lang, toggleLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { data: hearings } = useUpcomingHearings();

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
    <header className="clay-topbar sticky top-0 z-30 h-16 flex items-center justify-between px-6">
      {/* Global Search */}
      <div className="flex-1 max-w-xl ms-4 relative">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background placeholder:text-muted-foreground/50"
          />
        </div>
        {/* Search Results Dropdown */}
        {isOpen && (
          <div className="absolute top-full mt-2 w-full clay-card p-3 animate-fade-in z-50">
            {searchLoading ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                {t("common.loading")}
              </p>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((r) => (
                  <button
                    key={`${r.result_type}-${r.id}`}
                    onClick={() => handleSearchResultClick(r)}
                    className="w-full text-start p-2 rounded-xl hover:bg-muted/50 transition-colors"
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

      <div className="flex items-center gap-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="clay-button p-2.5 bg-card rounded-xl"
          title={
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

        {/* i18n Toggle */}
        <button
          onClick={toggleLang}
          className="clay-button flex items-center gap-1.5 px-2.5 py-2 bg-card rounded-xl"
          title={
            lang === "ar" ? "Switch to English" : "التبديل إلى العربية"
          }
        >
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {lang === "ar" ? "EN" : "عربي"}
          </span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              toggleNotif();
              closeProfile();
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
              <h3 className="text-sm font-bold text-foreground mb-3">
                {lang === "ar" ? "الإشعارات" : "Notifications"}
              </h3>
              <div className="space-y-2">
                {criticalDeadlines.map((d) => (
                  <div
                    key={d.id}
                    className="clay-card-soft p-3 urgency-border-critical"
                  >
                    <p className="text-xs font-semibold text-urgency-critical mb-1">
                      ⚠{" "}
                      {lang === "ar" ? "موعد نهائي حرج" : "Critical deadline"}
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

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => {
              toggleProfile();
              if (notifOpen) useNotificationStore.getState().close();
            }}
            className="clay-button flex items-center gap-2 px-3 py-2 bg-card rounded-xl"
          >
            <div className="w-8 h-8 rounded-xl bg-clay-blue/20 flex items-center justify-center">
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
            <div className="absolute start-0 top-full mt-2 w-56 clay-card p-2 animate-fade-in z-50">
              <Link
                to="/app/settings"
                onClick={() => closeProfile()}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                <User className="w-4 h-4" />
                {lang === "ar" ? "الملف الشخصي" : "Profile"}
              </Link>
              <Link
                to="/app/settings"
                onClick={() => closeProfile()}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" />
                {lang === "ar" ? "الإعدادات" : "Settings"}
              </Link>
              <div className="my-1 border-t border-border" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
