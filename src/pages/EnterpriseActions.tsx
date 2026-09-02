import { useState, useMemo, useEffect } from "react";
import { useActions } from "@/hooks/useEnterprise";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import type { ActionRow } from "@/types/enterprise";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Clock, AlertTriangle, Loader2, Plus } from "lucide-react";

export default function EnterpriseActions() {
  const { user } = useSupabaseAuth();
  const { data: actions, loading, error } = useActions();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const canCreateAction = user?.role !== "readonly";

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (!actions) return [];
    if (statusFilter === "all") return actions;
    if (statusFilter === "overdue") {
      return actions.filter(
        (a) =>
          a.proposed_or_completed === "مقترح" &&
          a.due_date &&
          new Date(a.due_date).getTime() < nowTs,
      );
    }
    return actions.filter((a) => a.proposed_or_completed === statusFilter);
  }, [actions, statusFilter, nowTs]);

  const isOverdue = (a: ActionRow) => {
    return (
      a.proposed_or_completed === "مقترح" &&
      !!a.due_date &&
      new Date(a.due_date).getTime() < nowTs
    );
  };

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">الإجراءات والمهام</h1>
        {canCreateAction && (
          <Button className="gap-2 clay-button">
            <Plus className="h-4 w-4" />
            إجراء جديد
          </Button>
        )}
      </div>

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="تصنيف" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">جميع الإجراءات</SelectItem>
          <SelectItem value="مقترح">مقترحة فقط</SelectItem>
          <SelectItem value="مكتمل">مكتملة فقط</SelectItem>
          <SelectItem value="overdue">متأخرة فقط</SelectItem>
        </SelectContent>
      </Select>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="clay-card border-red-200">
          <CardContent className="p-6 text-center text-sm text-red-600">
            خطأ في تحميل الإجراءات: {error}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="clay-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {statusFilter === "all"
                ? "لا توجد إجراءات مسجلة"
                : "لا توجد إجراءات مطابقة"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} إجراء
          </p>
          {filtered.map((a) => (
            <Card
              key={a.id}
              className={`clay-card transition-all duration-200 hover:shadow-md ${
                isOverdue(a) ? "border-red-200 bg-red-50/30" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isOverdue(a) ? (
                        <AlertTriangle className="h-4 w-4 text-urgency-critical" />
                      ) : a.proposed_or_completed === "مكتمل" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-clay-blue" />
                      )}
                      <p className="text-sm font-medium">{a.description}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      نوع: {a.action_type} — الحالة: {a.proposed_or_completed}
                    </p>
                    {a.assigned_to && (
                      <p className="text-xs text-muted-foreground">
                        المسؤول: {a.assigned_to}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={
                        a.proposed_or_completed === "مكتمل"
                          ? "border-green-300 text-green-700"
                          : "border-yellow-300 text-yellow-700"
                      }
                    >
                      {a.proposed_or_completed}
                    </Badge>
                    {a.due_date && (
                      <p className="text-xs text-muted-foreground">
                        الموعد:{" "}
                        {new Date(a.due_date).toLocaleDateString("ar-EG")}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Legal Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
        جميع البيانات والإجراءات مقترحة تحتاج إلى مراجعة واعتماد محامٍ مختص.
      </div>
    </div>
  );
}
