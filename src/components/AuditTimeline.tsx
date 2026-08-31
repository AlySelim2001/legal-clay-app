import { useState, useEffect } from "react";
import { Clock, User, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AuditEntry {
  id: string;
  changed_by: string | null;
  changed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by_email: string | null;
}

interface AuditTimelineProps {
  tableName: string;
  recordId: string;
}

// Fields to display in the timeline
const DISPLAY_FIELDS: Record<string, string> = {
  procedural_status: "الحالة الإجرائية",
  bail_amount_egp: "مبلغ الكفالة",
  opposition_hearing_date: "تاريخ جلسة المعارضة",
  tactical_classification: "التصنيف التكتيكي",
  memo_notes: "الملاحظات",
  first_instance_ruling: "حكم أول درجة",
  bail_payment_status: "حالة الكفالة",
  appeal_status: "حالة الاستئناف",
  cassation_status: "حالة النقض",
  prescription_date: "تاريخ التقادم",
  court_name: "المحكمة",
  case_no: "رقم القضية",
  updated_at: "آخر تحديث",
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string" && val.includes("T")) {
    try {
      return new Date(val).toLocaleDateString("ar-EG");
    } catch {
      return String(val);
    }
  }
  if (typeof val === "number") return val.toLocaleString("ar-EG");
  return String(val);
}

export function AuditTimeline({ tableName, recordId }: AuditTimelineProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("get_audit_trail", { p_table_name: tableName, p_record_id: recordId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setEntries(data as AuditEntry[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tableName, recordId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">لا توجد سجلات تعديل بعد</p>
      </div>
    );
  }

  // Group entries by date
  const grouped = entries.reduce<Record<string, AuditEntry[]>>((acc, entry) => {
    const dateKey = entry.changed_at.split("T")[0];
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey]!.push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayEntries]) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-clay-blue shrink-0" />
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground shrink-0">
              {new Date(date).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Entries for this date */}
          <div className="space-y-3 me-6">
            {dayEntries.map((entry) => {
              const changes = getFieldChanges(entry.old_values, entry.new_values);
              return (
                <div key={entry.id} className="clay-card-soft p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-xl bg-clay-blue/15 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-clay-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {entry.changed_by_email ?? "نظام"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(entry.changed_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="clay-badge text-[9px] font-bold bg-clay-purple/10 text-clay-purple px-1.5 py-0.5">
                      تعديل
                    </span>
                  </div>
                  {changes.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {changes.map((change) => (
                        <div key={change.field} className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-foreground">{change.label}:</span>
                          <span className="text-muted-foreground line-through">{change.oldVal}</span>
                          <span className="text-clay-blue">→</span>
                          <span className="text-urgency-normal font-medium">{change.newVal}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function getFieldChanges(
  oldVals: Record<string, unknown> | null,
  newVals: Record<string, unknown> | null,
): Array<{ field: string; label: string; oldVal: string; newVal: string }> {
  if (!oldVals || !newVals) return [];
  const changes: Array<{ field: string; label: string; oldVal: string; newVal: string }> = [];

  for (const key of Object.keys(newVals)) {
    if (key === "updated_at" || key === "id" || key === "created_at") continue;
    const oldVal = oldVals[key];
    const newVal = newVals[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const label = DISPLAY_FIELDS[key] ?? key;
      changes.push({
        field: key,
        label,
        oldVal: formatValue(oldVal),
        newVal: formatValue(newVal),
      });
    }
  }
  return changes;
}
