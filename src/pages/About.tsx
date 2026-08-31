import {
  Shield,
  Smartphone,
  Cloud,
  Lock,
  Bot,
  Globe,
  Phone,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
  Heart,
  Code,
  Database,
  Cpu,
} from "lucide-react";

const WHATSAPP_URL =
  "https://wa.me/201119886662?text=" +
  encodeURIComponent(
    "السلام عليكم، أود الاستفسار بشأن نظام إدارة القضايا والمنظومة القانونية CRIM-SYS 2026.",
  );

const features = [
  {
    icon: Lock,
    title: "خصوصية البيانات",
    description:
      "جميع البيانات محفوظة محليًا عبر IndexedDB مع مزامنة سحابية مشفرة عبر Supabase RLS.",
  },
  {
    icon: Cloud,
    title: "عمل أوفلاين",
    description:
      "يعمل النظام دون اتصال بالإنترنت في قاعات المحاكم عبر كاش IndexedDB مع مزامنة ذكية.",
  },
  {
    icon: Bot,
    title: "وكيل ذكاء اصطناعي",
    description:
      "مساعد قانوني ذكي متعدد التخصصات مبني على معرفة بالقوانين المصرية المحدّثة.",
  },
  {
    icon: Smartphone,
    title: "متوافق مع الأجهزة",
    description:
      "تصميم متجاوب يدعم جميع أحجام الشاشات مع دعم CapacitorJS للهواتف.",
  },
  {
    icon: Database,
    title: "قاعدة بيانات مشفرة",
    description:
      "RLS على جميع الجداول مع سياسات الدور (مدير / مساعد) لحماية البيانات.",
  },
  {
    icon: Code,
    title: "مصدر مفتوح",
    description:
      "بنية مفتوحة قابلة للتوسع والتعديل حسب احتياجات الممارسين القانونيين.",
  },
];

export default function About() {
  return (
    <div className="space-y-6 pb-8" dir="rtl">
      {/* Header */}
      <div className="clay-card p-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Cpu className="w-8 h-8 text-clay-purple" />
          <h1 className="text-2xl font-bold font-arabic text-foreground">
            LAW-SYS 2026 Master
          </h1>
        </div>
        <p className="text-sm text-muted-foreground font-arabic max-w-2xl mx-auto leading-relaxed">
          منصة متعددة التخصصات لإدارة القضايا القانونية في مصر. تجمع بين الذكاء
          الاصطناعي المتقدم، والأوفلاين펌، وحماية البيانات المشفرة لتكون رفيقك
          الموثوق في قاعات المحاكم.
        </p>
      </div>

      {/* WhatsApp Contact Card */}
      <div className="clay-card p-6 border-2 border-green-500/30">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold font-arabic text-foreground">
              التواصل المباشر
            </h2>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground font-arabic">
              للاستفسارات والدعم الفني
            </p>
            <p className="text-xl font-bold font-arabic text-foreground" dir="ltr">
              01119886662
            </p>
            <p className="text-xs text-muted-foreground font-arabic" dir="ltr">
              +20 111 988 6662
            </p>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-arabic font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <MessageCircle className="w-5 h-5" />
            تواصل مباشر عبر الواتساب
            <ExternalLink className="w-4 h-4 opacity-70" />
          </a>
        </div>
      </div>

      {/* System Architecture */}
      <div className="clay-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-clay-blue" />
          <h2 className="text-lg font-bold font-arabic text-foreground">
            بنية النظام
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="clay-card p-4 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-clay-purple/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-clay-purple" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-arabic text-foreground mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground font-arabic leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="clay-card p-6">
        <h2 className="text-lg font-bold font-arabic text-foreground mb-4">
          البنية التقنية
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          {[
            { name: "React 18 + TypeScript", color: "bg-clay-blue/10 text-clay-blue" },
            { name: "Supabase PostgreSQL", color: "bg-clay-green/10 text-clay-green" },
            { name: "CapacitorJS", color: "bg-clay-purple/10 text-clay-purple" },
            { name: "Tailwind CSS", color: "bg-clay-coral/10 text-clay-coral" },
          ].map((tech) => (
            <div
              key={tech.name}
              className={`px-3 py-2 rounded-xl text-xs font-bold font-arabic ${tech.color}`}
            >
              {tech.name}
            </div>
          ))}
        </div>
      </div>

      {/* Team Credits */}
      <div className="clay-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5 text-clay-coral" />
          <h2 className="text-lg font-bold font-arabic text-foreground">
            فريق التطوير
          </h2>
        </div>
        <p className="text-sm text-muted-foreground font-arabic leading-relaxed">
          تم تطوير هذا النظام بواسطة فريق متخصص في تقنية المعلومات والقانون، بهدف
          تسهيل العمل القانوني وتمكين المحامين من إدارة قضاياهم بكفاءة وفعالية في
          بيئة رقمية آمنة ومتوافقة.
        </p>
      </div>

      {/* Legal Disclaimer */}
      <div className="clay-card p-4 border border-urgency-high/20 bg-urgency-high/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-urgency-high shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold font-arabic text-urgency-high mb-1">
              إخلاء مسؤولية قانوني
            </h3>
            <p className="text-xs text-muted-foreground font-arabic leading-relaxed">
              هذا النظام هو أداة مساعدة لإدارة البيانات وتنظيم المعلومات القانونية.
              لا يُغني عن استشارة المحامي المختص، ولا يُعتبر بديلًا عن الرأي
              القانوني المهني. جميع النتائج المحسوبة تقديرية ويجب التحقق منها مع
              المحامي المختص قبل اتخاذ أي إجراء قانوني.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
