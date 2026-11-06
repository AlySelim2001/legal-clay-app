import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  Gavel,
  Scale,
  Calendar,
  Users,
  BrainCircuit,
  FileText,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import logo from "@/assets/logo.svg";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-arabic selection:bg-primary/20 selection:text-primary" dir="rtl">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 start-1/4 w-96 h-96 bg-clay-blue/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 end-10 w-80 h-80 bg-clay-rose/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 start-10 w-96 h-96 bg-clay-teal/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-border/40 backdrop-blur-md bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl clay-card flex items-center justify-center p-2 bg-card">
              <img src={logo} alt="CRIM-SYS Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-foreground">CRIM-SYS</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  2026
                </span>
              </div>
              <p className="text-xs text-muted-foreground">نظام إدارة القضايا الجنائية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              تسجيل الدخول
            </Link>
            <Link
              to="/app/dashboard"
              className="clay-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 transition-all active:scale-[0.98]"
            >
              <span>لوحة التحكم</span>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-clay-blue/15 border border-clay-blue/30 text-xs font-semibold text-foreground mb-6">
              <Scale className="w-3.5 h-3.5 text-primary" />
              <span>المنظومة الرقمية الشاملة لمكاتب المحاماة الجنائية المصرية</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.25]">
              إدارة القضايا الجنائية بدقة واحترافية فائقة
            </h1>

            <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed">
              منظومة متطورة تجمع بين تتبع القضايا والمدعى عليهم، مواعيد الجلسات والإنذارات الإجرائية، فهرس الدفوع القانونية المعززة بأحكام محكمة النقض، والتحليل الجنائي المدعوم بالذكاء الاصطناعي.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/app/dashboard"
                className="clay-button inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-md hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <span>الدخول إلى النظام</span>
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <Link
                to="/app/cases"
                className="clay-button inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-card hover:bg-card/80 border border-border text-foreground font-semibold text-base shadow-sm active:scale-[0.98] transition-all"
              >
                <span>استعراض القضايا</span>
              </Link>
              <Link
                to="/login"
                className="clay-button inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-secondary/80 hover:bg-secondary text-secondary-foreground font-semibold text-base active:scale-[0.98] transition-all"
              >
                <span>الدخول التجريبي السريع</span>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>متوافق تماماً مع قانون الإجراءات الجنائية</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>دعم كامل للعمل دون اتصال (Offline-Ready)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>تشفير آمن للبيانات وسجلات التدقيق</span>
              </div>
            </div>
          </motion.div>

          {/* Quick Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="clay-card p-5 text-center">
              <p className="text-3xl font-extrabold text-foreground">150+</p>
              <p className="text-xs text-muted-foreground mt-1">قضية مسجلة ونشطة</p>
            </div>
            <div className="clay-card p-5 text-center">
              <p className="text-3xl font-extrabold text-clay-blue">45+</p>
              <p className="text-xs text-muted-foreground mt-1">موكل وشخص معني</p>
            </div>
            <div className="clay-card p-5 text-center">
              <p className="text-3xl font-extrabold text-clay-teal">100%</p>
              <p className="text-xs text-muted-foreground mt-1">تغطية الإجراءات القضائية</p>
            </div>
            <div className="clay-card p-5 text-center">
              <p className="text-3xl font-extrabold text-amber-500">24/7</p>
              <p className="text-xs text-muted-foreground mt-1">توافر في قاعات المحاكم</p>
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="mt-20">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                المزايا والوحدات الرئيسية في النظام
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                مصممة خصيصاً لتلبية متطلبات الدفاع الجنائي في المحاكم الابتدائية والاستئناف ومحكمة النقض
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link to="/app/cases" className="clay-card p-6 block group hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-clay-blue/20 flex items-center justify-center text-clay-blue mb-4 group-hover:scale-105 transition-transform">
                  <Gavel className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  إدارة القضايا والملفات الجنائية
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  تتبع شامل للجنايات والجنح والمخالفات، كود موحد للقضية، تصنيف المحاكم والدوائر، والحالة الإجرائية اللحظية.
                </p>
              </Link>

              <Link to="/app/persons" className="clay-card p-6 block group hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-clay-teal/20 flex items-center justify-center text-clay-teal mb-4 group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  سجل الأشخاص والمتهمين والموكلين
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  ربط الأشخاص بالقضايا المتعددة، تشفير الأرقام القومية، تتبع بيانات الاتصال، وإدارة التوكيلات الرسمية.
                </p>
              </Link>

              <Link to="/app/calendar" className="clay-card p-6 block group hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-clay-purple/20 flex items-center justify-center text-clay-purple mb-4 group-hover:scale-105 transition-transform">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  التقويم القضائي وأجندة الجلسات
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  جدول تفاعلي كامل للجلسات القادمة، قاعات المحاكم، مواعيد الطعن، وتنبيهات المهل القانونية الحرجة.
                </p>
              </Link>

              <Link to="/app/ai-agent/colombo" className="clay-card p-6 block group hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 mb-4 group-hover:scale-105 transition-transform">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  المساعد الجنائي الذكي Colombo AI
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  استخراج الكيانات وشبكات العلاقات الجنائية، تدقيق محاضر الضبط والتحقيقات، واقتراح خطط المرافعة.
                </p>
              </Link>

              <Link to="/app/defenses" className="clay-card p-6 block group hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-clay-rose/20 flex items-center justify-center text-clay-rose mb-4 group-hover:scale-105 transition-transform">
                  <Scale className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  كتالوج الدفوع الجنائية والطعون
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  مكتبة متخصصة بالدفوع الجنائية (بطلان القبض، التفتيش، الإذن الباطل، انقضاء الدعوى) مع السوابق القضائية.
                </p>
              </Link>

              <Link to="/app/actions" className="clay-card p-6 block group hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  الإجراءات وسجل التدقيق والتقارير
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  متابعة المهام القانونية، استيراد وتصدير بيانات Excel، وتوليد مذكرات الدفاع وإيصالات الكفالة بصيغة PDF.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 py-8 bg-background/90 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 CRIM-SYS — نظام إدارة القضايا والممارسات الجنائية. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4">
            <Link to="/app/about" className="hover:text-foreground transition-colors">عن النظام</Link>
            <Link to="/app/legal-framework" className="hover:text-foreground transition-colors">الإطار القانوني</Link>
            <Link to="/app/dashboard" className="hover:text-foreground transition-colors">لوحة التحكم</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
