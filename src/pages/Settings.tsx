import { useState } from "react";
import {
  Settings as SettingsIcon,
  Bell,
  User,
  Shield,
  Save,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [activeSection, setActiveSection] = useState("general");

  const sections = [
    { id: "general", label: "عام", icon: SettingsIcon },
    { id: "profile", label: "الملف الشخصي", icon: User },
    { id: "notifications", label: "الإشعارات", icon: Bell },
    { id: "appearance", label: "المظهر", icon: Palette },
    { id: "security", label: "الأمان", icon: Shield },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تخصيص إعدادات النظام والتفضيلات الشخصية
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="clay-card p-3">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-start",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 clay-card p-6">
          {/* General Settings */}
          {activeSection === "general" && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-foreground">الإعدادات العامة</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    اسم المكتب
                  </label>
                  <input
                    type="text"
                    defaultValue="مكتب محمد فتحي للمحاماة"
                    className="clay-input w-full px-4 py-3 text-sm bg-background"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    اللغة
                  </label>
                  <select className="clay-input w-full px-4 py-3 text-sm bg-background">
                    <option value="ar" selected>
                      العربية
                    </option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    المنطقة الزمنية
                  </label>
                  <select className="clay-input w-full px-4 py-3 text-sm bg-background">
                    <option value="cairo" selected>
                      القاهرة (UTC+2)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    تنسيق التاريخ
                  </label>
                  <select className="clay-input w-full px-4 py-3 text-sm bg-background">
                    <option value="ar" selected>
                      30 أغسطس 2026
                    </option>
                    <option value="en">Aug 30, 2026</option>
                    <option value="iso">2026-08-30</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="clay-button flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </button>
              </div>
            </div>
          )}

          {/* Profile Settings */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-foreground">الملف الشخصي</h2>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-clay-blue/15 flex items-center justify-center">
                  <span className="text-2xl font-bold text-clay-blue">م</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">محمد فتحي</p>
                  <p className="text-xs text-muted-foreground">محامٍ رئيسي</p>
                  <button className="text-xs text-clay-blue hover:underline mt-1">
                    تغيير الصورة
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    defaultValue="محمد فتحي"
                    className="clay-input w-full px-4 py-3 text-sm bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    defaultValue="mohamed.fathi@crimsys.com"
                    className="clay-input w-full px-4 py-3 text-sm bg-background"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    الهاتف
                  </label>
                  <input
                    type="tel"
                    defaultValue="01012345678"
                    className="clay-input w-full px-4 py-3 text-sm bg-background"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    defaultValue="محامٍ رئيسي"
                    className="clay-input w-full px-4 py-3 text-sm bg-background"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button className="clay-button flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </button>
              </div>
            </div>
          )}

          {/* Notifications Settings */}
          {activeSection === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-foreground">إعدادات الإشعارات</h2>

              <div className="space-y-4">
                {[
                  {
                    label: "إشعارات المواعيد النهائية",
                    desc: "تنبيهات قبل انتهاء المواعيد القانونية",
                    enabled: true,
                  },
                  {
                    label: "تنبيهات الجلسات",
                    desc: "تذكير بالجلسات القادمة قبل 24 ساعة",
                    enabled: true,
                  },
                  {
                    label: "إشعارات القضايا الجديدة",
                    desc: "تنبيه عند إضافة قضية جديدة",
                    enabled: true,
                  },
                  {
                    label: "إشعارات البريد الإلكتروني",
                    desc: "إرسال ملخص يومي على البريد الإلكتروني",
                    enabled: false,
                  },
                  {
                    label: "تنبيهات الفريق",
                    desc: "إشعارات عند تحديثات الفريق",
                    enabled: false,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-4 clay-card-soft rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      className={cn(
                        "w-11 h-6 rounded-full transition-all relative",
                        item.enabled ? "bg-urgency-normal" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                          item.enabled ? "start-5.5" : "start-0.5"
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button className="clay-button flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </button>
              </div>
            </div>
          )}

          {/* Appearance Settings */}
          {activeSection === "appearance" && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-foreground">المظهر والثيمات</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    نمط العرض
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "clay", label: "طيني (Claymorphism)", active: true },
                      { id: "flat", label: "مسطح" },
                      { id: "material", label: "Material" },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        className={cn(
                          "clay-card-soft p-4 text-center transition-all border-2",
                          theme.active
                            ? "border-clay-blue bg-clay-blue/5"
                            : "border-transparent hover:border-border"
                        )}
                      >
                        <div className="w-full h-16 rounded-xl bg-gradient-to-br from-clay-blue/20 to-clay-purple/20 mb-2" />
                        <p className="text-xs font-semibold text-foreground">{theme.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    اللون الأساسي
                  </label>
                  <div className="flex gap-3">
                    {[
                      { color: "bg-clay-blue", label: "أزرق" },
                      { color: "bg-clay-purple", label: "بنفسجي" },
                      { color: "bg-clay-teal", label: "أخضر" },
                      { color: "bg-clay-rose", label: "وردي" },
                      { color: "bg-primary", label: "بني" },
                    ].map((c) => (
                      <button
                        key={c.label}
                        className={cn(
                          "w-10 h-10 rounded-xl transition-all",
                          c.color,
                          c.label === "بني" ? "ring-2 ring-offset-2 ring-primary" : ""
                        )}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    حجم الخط
                  </label>
                  <div className="clay-inset p-3 rounded-xl flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">صغير</span>
                    <input
                      type="range"
                      min="12"
                      max="18"
                      defaultValue="14"
                      className="flex-1 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">كبير</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="clay-button flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </button>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeSection === "security" && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-foreground">الأمان</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    كلمة المرور الحالية
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="clay-input w-full px-4 py-3 text-sm bg-background max-w-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="clay-input w-full px-4 py-3 text-sm bg-background max-w-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    تأكيد كلمة المرور الجديدة
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="clay-input w-full px-4 py-3 text-sm bg-background max-w-md"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button className="clay-button flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
                  <Save className="w-4 h-4" />
                  تحديث كلمة المرور
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
