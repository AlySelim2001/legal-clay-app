import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

type Lang = 'ar' | 'en';

interface I18nContextType {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  toggleLang: () => void;
}

const translations: Record<Lang, Record<string, string>> = {
  ar: {
    'nav.dashboard': 'لوحة التحكم',
    'nav.cases': 'القضايا',
    'nav.clients': 'العملاء',
    'nav.calendar': 'التقويم',
    'nav.deadlines': 'المواعيد النهائية',
    'nav.defenses': 'الدفوعات',
    'nav.archive': 'الأرشيف',
    'nav.legalFramework': 'الإطار القانوني',
    'nav.settings': 'الإعدادات',
    'nav.adminTeam': 'إدارة الفريق',
    'search.placeholder': 'بحث في القضايا، العملاء، الوثائق...',
    'search.noResults': 'لا توجد نتائج',
    'common.loading': 'جاري التحميل...',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.close': 'إغلاق',
    'common.viewAll': 'عرض الكل',
    'common.total': 'إجمالي',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.urgent': 'حرج',
    'common.high': 'مرتفع',
    'common.normal': 'عادي',
    'common.critical': 'حرج',
    'disclaimer': '⚠️ نتيجة تقديرية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.subtitle': 'نظرة عامة على حال القضايا والمواعيد',
    'dashboard.activeCases': 'القضايا النشطة',
    'dashboard.totalClients': 'إجمالي العملاء',
    'dashboard.urgentDeadlines': 'مواعيد حرجة',
    'dashboard.unpaidBail': 'الكفالة غير المسددة',
    'dashboard.monthlyCases': 'القضايا الشهرية',
    'dashboard.upcomingHearings': 'الجلسات القادمة',
    'cases.title': 'القضايا',
    'cases.subtitle': 'إدارة ومتابعة جميع القضايا الجنائية',
    'cases.newCase': 'قضية جديدة',
    'clients.title': 'العملاء',
    'clients.subtitle': 'سجل العملاء وبياناتهم الشخصية',
    'clients.newClient': 'عميل جديد',
    'deadlines.title': 'المواعيد النهائية',
    'deadlines.calculator': 'حاسبة المواعيد القانونية',
    'deadlines.startDate': 'تاريخ البدء',
    'deadlines.procedureType': 'نوع الإجراء',
    'deadlines.calculate': 'احتساب الموعد',
    'settings.title': 'الإعدادات',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.cases': 'Cases',
    'nav.clients': 'Clients',
    'nav.calendar': 'Calendar',
    'nav.deadlines': 'Deadlines',
    'nav.defenses': 'Defenses',
    'nav.archive': 'Archive',
    'nav.legalFramework': 'Legal Framework',
    'nav.settings': 'Settings',
    'nav.adminTeam': 'Team Management',
    'search.placeholder': 'Search cases, clients, documents...',
    'search.noResults': 'No results found',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.close': 'Close',
    'common.viewAll': 'View All',
    'common.total': 'Total',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.urgent': 'Urgent',
    'common.high': 'High',
    'common.normal': 'Normal',
    'common.critical': 'Critical',
    'disclaimer': '⚠️ Estimated result — must be verified with the competent lawyer before taking any action.',
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Overview of cases and deadlines',
    'dashboard.activeCases': 'Active Cases',
    'dashboard.totalClients': 'Total Clients',
    'dashboard.urgentDeadlines': 'Urgent Deadlines',
    'dashboard.unpaidBail': 'Unpaid Bail',
    'dashboard.monthlyCases': 'Monthly Cases',
    'dashboard.upcomingHearings': 'Upcoming Hearings',
    'cases.title': 'Cases',
    'cases.subtitle': 'Manage and track all criminal cases',
    'cases.newCase': 'New Case',
    'clients.title': 'Clients',
    'clients.subtitle': 'Client registry and personal data',
    'clients.newClient': 'New Client',
    'deadlines.title': 'Deadlines',
    'deadlines.calculator': 'Legal Deadline Calculator',
    'deadlines.startDate': 'Start Date',
    'deadlines.procedureType': 'Procedure Type',
    'deadlines.calculate': 'Calculate Deadline',
    'settings.title': 'Settings',
  },
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('crimsys-lang') as Lang) || 'ar';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const t = useCallback((key: string): string => {
    return translations[lang][key] ?? key;
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      localStorage.setItem('crimsys-lang', next);
      return next;
    });
  }, []);

  // Update document direction and lang attribute
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <I18nContext.Provider value={{ lang, dir, t, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
