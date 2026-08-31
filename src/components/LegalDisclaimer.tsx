import { AlertTriangle } from 'lucide-react';

export function LegalDisclaimer() {
  return (
    <div className="w-full bg-urgency-high/10 border-b border-urgency-high/20 px-4 py-2.5 flex items-center justify-center gap-2">
      <AlertTriangle className="w-4 h-4 text-urgency-high shrink-0" />
      <p className="text-xs font-medium text-urgency-high text-center">
        ⚠️ نتيجة تقديرية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.
      </p>
    </div>
  );
}
