import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, ScanLine, Calculator, Bot, Wifi, WifiOff } from "lucide-react";

export function OfflineStatusPill() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        online
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? "متصل" : "غير متصل — وضع عدم الاتصال"}
    </div>
  );
}

export function MobileQuickActions() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const actions = [
    {
      icon: Search,
      label: "بحث سريع",
      color: "bg-blue-500",
      action: () => {
        const input = document.querySelector<HTMLInputElement>('[data-search-input]');
        if (input) {
          input.focus();
          input.select();
        }
        setExpanded(false);
      },
    },
    {
      icon: ScanLine,
      label: "مسح مستند",
      color: "bg-purple-500",
      action: () => {
        navigate("/app/archive");
        setExpanded(false);
      },
    },
    {
      icon: Calculator,
      label: "حاسبة المواعيد",
      color: "bg-amber-500",
      action: () => {
        navigate("/app/deadlines");
        setExpanded(false);
      },
    },
    {
      icon: Bot,
      label: "الوكيل الذكي",
      color: "bg-emerald-500",
      action: () => {
        navigate("/app/ai-agents");
        setExpanded(false);
      },
    },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 safe-area-bottom lg:hidden">
      {/* Expanded actions */}
      {expanded && (
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 pt-3 pb-2 shadow-lg">
          <div className="flex justify-around">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.action}
                className="flex flex-col items-center gap-1 rounded-xl p-2 transition-transform active:scale-95"
              >
                <div className={`${a.color} text-white rounded-xl p-2.5 shadow-md`}>
                  <a.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium text-gray-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="bg-clay-card/95 backdrop-blur-md border-t border-clay-border px-4 py-2.5 safe-area-bottom">
        <div className="flex items-center justify-between">
          <OfflineStatusPill />
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95"
          >
            {expanded ? "إغلاق" : "⚡ إجراءات سريعة"}
          </button>
        </div>
      </div>
    </div>
  );
}
