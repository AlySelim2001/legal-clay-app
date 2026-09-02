import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { UserRoleLabels, type UserRoleType } from "@/types/enterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Settings,
  User,
  Shield,
  Moon,
  Sun,
  Bell,
  BellOff,
  LogOut,
  AlertTriangle,
  Check,
} from "lucide-react";

export default function EnterpriseSettings() {
  const { user, signOut } = useSupabaseAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const role = (user?.role ?? "assistant") as UserRoleType;
  const roleLabel = UserRoleLabels[role] ?? "غير معروف";

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-fade-in" dir="rtl">
      <h1 className="text-2xl font-bold text-primary">الإعدادات</h1>

      {/* Profile Card */}
      <Card className="clay-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            الملف الشخصي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">البريد الإلكتروني</span>
            <span className="text-sm font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الدور</span>
            <Badge className="text-xs">{roleLabel}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">معرف المستخدم</span>
            <span className="text-xs text-muted-foreground font-mono">
              {user?.id?.slice(0, 8)}...
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card className="clay-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            الصلاحيات الحالية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            <PermissionItem label="إنشاء القضايا" allowed={role !== "readonly"} />
            <PermissionItem label="تعديل القضايا" allowed={role !== "readonly"} />
            <PermissionItem label="حذف القضايا" allowed={role === "admin"} />
            <PermissionItem label="إدارة المستخدمين" allowed={role === "admin"} />
            <PermissionItem label="عرض سجل التدقيق" allowed={role === "admin"} />
            <PermissionItem label="استيراد البيانات" allowed={role === "admin"} />
            <PermissionItem label="تصدير البيانات" allowed={role === "admin" || role === "lawyer"} />
            <PermissionItem label="إدارة الإعدادات" allowed={role === "admin"} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            لتعديل الصلاحيات، يرجى التواصل مع مدير النظام.
          </p>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="clay-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            تفضيلات التطبيق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <Label className="text-sm">الوضع الداكن</Label>
            </div>
            <button
              onClick={toggleDark}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                darkMode ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  darkMode ? "start-5.5" : "start-0.5"
                }`}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              <Label className="text-sm">إشعارات الجلسات</Label>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                notifications ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                  notifications ? "start-5.5" : "start-0.5"
                }`}
              />
            </button>
          </div>

          {/* Save */}
          <Button onClick={handleSave} className="gap-2 clay-button">
            {saved ? <Check className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            {saved ? "تم الحفظ ✓" : "حفظ التفضيلات"}
          </Button>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card className="clay-card">
        <CardContent className="p-4">
          <Button
            onClick={() => signOut()}
            variant="outline"
            className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        </CardContent>
      </Card>

      {/* Security Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
        جميع البيانات敏感ة محمية — لا تشارك بيانات الدخول مع أي طرف ثالث.
      </div>
    </div>
  );
}

function PermissionItem({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
          allowed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}
      >
        {allowed ? "✓" : "✗"}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}
