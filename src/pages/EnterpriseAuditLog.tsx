import { useState } from "react";
import { useAuditLog } from "@/hooks/useEnterprise";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { canViewAuditLog } from "@/lib/enterprise/rbac";

export default function EnterpriseAuditLog() {
  const { user } = useSupabaseAuth();
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const { data: logs, loading, error } = useAuditLog(
    entityFilter === "all" ? undefined : entityFilter,
  );

  if (!user || !canViewAuditLog(user.role)) {
    return (
      <Card className="clay-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="mb-4 h-10 w-10 text-urgency-critical" />
          <p className="text-sm font-medium">لا تملك صلاحية الوصول لسجل التدقيق</p>
          <p className="text-xs text-muted-foreground">
            الصلاحية المطلوبة: مدير النظام
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">سجل التدقيق</h1>
        <Shield className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Filter */}
      <Select value={entityFilter} onValueChange={setEntityFilter}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="filtrage بالكيان" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">جميع الكيانات</SelectItem>
          <SelectItem value="enterprise_cases">القضايا</SelectItem>
          <SelectItem value="enterprise_sessions">الجلسات</SelectItem>
          <SelectItem value="enterprise_actions">الإجراءات</SelectItem>
          <SelectItem value="persons">الأشخاص</SelectItem>
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
            خطأ في تحميل سجل التدقيق: {error}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && (!logs || logs.length === 0) && (
        <Card className="clay-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              لا توجد سجلات تدقيق
            </p>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      {!loading && !error && logs && logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{logs.length} سجل</p>
          {logs.map((log) => (
            <Card key={log.id} className="clay-card">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {log.entity_type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      معرّف السجل: {log.entity_id.slice(0, 8)}...
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString("ar-EG")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
