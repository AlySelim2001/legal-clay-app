import { useState } from "react";
import {
  Search,
  Globe,
  ExternalLink,
  AlertTriangle,
  Loader2,
  FileText,
  Users,
  Hash,
  Building2,
  RefreshCw,
  MessageCircle,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────
interface SearchResult {
  id: string;
  source: string;
  sourceType: "forum" | "facebook" | "telegram" | "bar" | "court";
  title: string;
  snippet: string;
  date: string;
  url: string;
  confidence: number; // 0-100
  matchedField: string;
}

interface CaseDocument {
  id: string;
  caseCode: string;
  partyName: string;
  rollNumber: string;
  courtName: string;
  hearingDate: string;
}

// ── Mock Data ────────────────────────────────────────────────────────
const mockDocuments: CaseDocument[] = [
  { id: "1", caseCode: "ج/2026/1234", partyName: "محمد أحمد علي", rollNumber: "45/2026", courtName: "محكمة جنوب القاهرة", hearingDate: "2026-09-15" },
  { id: "2", caseCode: "ج/2026/5678", partyName: "عبدالله حسن إبراهيم", rollNumber: "89/2026", courtName: "محكمة شمال القاهرة", hearingDate: "2026-09-20" },
  { id: "3", caseCode: "ج/2026/9012", partyName: "سعيد محمود خالد", rollNumber: "12/2026", courtName: "محكمة east cairo", hearingDate: "2026-10-01" },
];

const legalChannels = [
  { name: "منتدى المحامين العرب", type: "forum" as const, url: "#", description: "منتدى نقابات المحامين — مناقشات جلسات اليوم", icon: Globe },
  { name: "مجموعات المحامين على Facebook", type: "facebook" as const, url: "#", description: "مجموعات عامة لrotating رولات الجلسات اليومية", icon: MessageCircle },
  { name: "قنوات رولات المحاكم — Telegram", type: "telegram" as const, url: "#", description: "نشر يومي لأرقام الروات والجلسات القادمة", icon: Send },
  { name: "نقابة المحامين المصرية", type: "bar" as const, url: "#", description: "آخر التحديثات الرسمية من النقابة العامة", icon: Building2 },
];

const mockResults: SearchResult[] = [
  {
    id: "1",
    source: "منتدى المحامين العرب",
    sourceType: "forum",
    title: "الجلسة تأجلت — جنوب القاهرة — الروة 45",
    snippet: "تؤكد مصادر من محكمة جنوب القاهرة أن القضية رقم ج/2026/1234 (محمد أحمد علي) قد تأجلت الجلسة المحددة لليوم 15/09/2026 إلى تاريخ لاحق...",
    date: "2026-09-15",
    url: "#",
    confidence: 92,
    matchedField: "rollNumber",
  },
  {
    id: "2",
    source: "مجموعة المحامين الجنائيين — Facebook",
    sourceType: "facebook",
    title: "تنبيه: تغيير قائمة القضاة — شمال القاهرة",
    snippet: "تم الإعلان عن تغيير قائمة القضاة في الدائرة الجنائية بمحكمة شمال القاهرة بدءاً من جلسة 20/09/2026. تأثر القضية 89/2026...",
    date: "2026-09-18",
    url: "#",
    confidence: 78,
    matchedField: "courtName",
  },
  {
    id: "3",
    source: "قناة رولات المحاكم — Telegram",
    sourceType: "telegram",
    title: "رول اليوم — eastern cairo — البت في Opposition",
    snippet: "رول جلسات اليوم 01/10/2026 يشمل القضية 12/2026 (سعيد محمود) — جلسة معارضة — القسم الثالث...",
    date: "2026-10-01",
    url: "#",
    confidence: 85,
    matchedField: "partyName",
  },
  {
    id: "4",
    source: "نقابة المحامين — الموقع الرسمي",
    sourceType: "bar",
    title: "循环 تحديث: مواعيد جلسات_kelassaات الاستئناف",
    snippet: "تُعلن النقابة العامة عن تحديث مواعيد جلسات الاستئناف في المحاكم الابتدائية جميع المحافظات...",
    date: "2026-09-20",
    url: "#",
    confidence: 60,
    matchedField: "courtName",
  },
  {
    id: "5",
    source: "قناة رولات المحاكم — Telegram",
    sourceType: "telegram",
    title: "تأكيد تحويل القضية — محكمة east cairo",
    snippet: "تم تحويل القضية 12/2026 من الدائرة الثالثة إلى الدائرة الخامسة بدءاً من الجلسة القادمة...",
    date: "2026-09-25",
    url: "#",
    confidence: 88,
    matchedField: "caseCode",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────
function confidenceColor(c: number) {
  if (c >= 85) return "text-green-600 bg-green-50";
  if (c >= 70) return "text-amber-600 bg-amber-50";
  return "text-gray-500 bg-gray-50";
}

function sourceIcon(type: SearchResult["sourceType"]) {
  switch (type) {
    case "forum": return Globe;
    case "facebook": return MessageCircle;
    case "telegram": return Send;
    case "bar": return Building2;
    case "court": return FileText;
  }
}

// ── Component ────────────────────────────────────────────────────────
export default function SocialSearch() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "party" | "roll" | "court">("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<CaseDocument | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    // Simulate search across channels
    await new Promise((r) => setTimeout(r, 1200));

    const filtered = mockResults.filter((r) => {
      const q = query.toLowerCase();
      if (searchType === "party") return r.matchedField === "partyName";
      if (searchType === "roll") return r.matchedField === "rollNumber";
      if (searchType === "court") return r.matchedField === "courtName";
      return r.title.toLowerCase().includes(q) || r.snippet.toLowerCase().includes(q);
    });

    setResults(filtered);
    setLoading(false);
  };

  const handleAutoFill = (doc: CaseDocument) => {
    setSelectedDoc(doc);
    setQuery(doc.caseCode);
    setSearchType("all");
  };

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">بحث تكييفي — غير رسمي</p>
          <p className="text-xs text-amber-700 mt-1">
            النتائج مستخلصة من قنوات عامة ولا تُغني عن التحقق الرسمي من سكرتارية المحكمة. يجب مراجعة بيانات الجلسة مع أمين السر المختص قبل اتخاذ أي إجراء.
          </p>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">محرك البحث في المحاكم الاجتماعية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          بحث مجمّع عبر قنوات القضاء العامة — منتديات، مجموعات فيسبوك، قنوات تيليجرام، وتحديثات النقابة
        </p>
      </div>

      {/* Quick Fill from Documents */}
      <div className="clay-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-clay-blue" />
          <h3 className="text-sm font-bold text-foreground">ملفات القضايا المحملة</h3>
          <span className="text-xs text-muted-foreground">— اضغط للبحث السريع</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mockDocuments.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleAutoFill(doc)}
              className={cn(
                "text-start rounded-xl border-2 p-3 transition-all hover:scale-[1.01]",
                selectedDoc?.id === doc.id
                  ? "border-primary bg-primary/5"
                  : "border-clay-border bg-clay-surface hover:border-primary/40"
              )}
            >
              <p className="text-xs font-mono font-bold text-clay-blue">{doc.caseCode}</p>
              <p className="text-sm font-semibold text-foreground mt-1">{doc.partyName}</p>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>📋 {doc.rollNumber}</span>
                <span>•</span>
                <span>🏛️ {doc.courtName}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="clay-card p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ابحث برقم القضية، اسم الخصم، رقم الروة، أو اسم المحكمة..."
              className="clay-input w-full pe-10 ps-4 py-3 text-sm bg-background"
            />
          </div>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as typeof searchType)}
            className="clay-input px-4 py-3 text-sm bg-background sm:w-48"
          >
            <option value="all">جميع المجالات</option>
            <option value="party">أسماء الخصوم</option>
            <option value="roll">أرقام الروات</option>
            <option value="court">المحاكم المختصة</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="clay-button px-6 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            بحث
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Results — Main Column */}
        <div className="lg:col-span-2 space-y-4">
          {searched && !loading && (
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                نتائج البحث — {results.length} نتيجة
              </h3>
              <button
                onClick={handleSearch}
                className="flex items-center gap-1 text-xs text-clay-blue hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                تحديث
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="mr-3 text-sm text-muted-foreground">جاري البحث عبر القنوات العامة...</span>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-12 clay-card-soft">
              <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد نتائج مطابقة</p>
              <p className="text-xs text-muted-foreground mt-1">جرّب كلمات مختلفة أو تحقق من صحة البيانات</p>
            </div>
          )}

          {results.map((result) => {
            const Icon = sourceIcon(result.sourceType);
            return (
              <div key={result.id} className="clay-card p-4 hover:scale-[1.002] transition-all">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-clay-surface p-2 shrink-0">
                    <Icon className="w-4 h-4 text-clay-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold text-muted-foreground bg-clay-surface px-2 py-0.5 rounded-full">
                        {result.source}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{result.date}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", confidenceColor(result.confidence))}>
                        {result.confidence}% ثقة
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground">{result.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{result.snippet}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-clay-blue">
                        الحقل المطابق: {
                          result.matchedField === "partyName" ? "اسم الخصم" :
                          result.matchedField === "rollNumber" ? "رقم الروة" :
                          result.matchedField === "caseCode" ? "رقم القضية" :
                          "اسم المحكمة"
                        }
                      </span>
                      <a href={result.url} className="text-[10px] text-clay-blue flex items-center gap-1 hover:underline">
                        <ExternalLink className="w-3 h-3" />
                        المصدر
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legal Channels Sidebar */}
        <div className="space-y-4">
          <div className="clay-card p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">قنوات البحث القانوني العام</h3>
            <div className="space-y-3">
              {legalChannels.map((ch) => {
                const Icon = sourceIcon(ch.type);
                return (
                  <a
                    key={ch.name}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-xl border border-clay-border bg-clay-surface p-3 hover:border-primary/40 transition-all group"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{ch.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{ch.description}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Match Matrix Info */}
          <div className="clay-card p-4">
            <h3 className="text-sm font-bold text-foreground mb-2">مصفوفة التطابق</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              يتم مطابقة نتائج البحث مع مستنداتك المرفوعة حسب:{'\n'}
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <Hash className="w-3 h-3 text-clay-blue" />
                رقم القضية / رقم الروة
              </li>
              <li className="flex items-center gap-2">
                <Users className="w-3 h-3 text-clay-blue" />
                أسماء الخصوم
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="w-3 h-3 text-clay-blue" />
                المحكمة المختصة
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-clay-blue" />
                تاريخ الجلسة
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
