import { useState, useMemo } from "react";
import { Link } from "react-router";
import { useCases } from "@/hooks/useEnterprise";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Briefcase, Loader2 } from "lucide-react";
import type { ProceduralStatusType } from "@/types/enterprise";

const STATUS_COLORS: Record<ProceduralStatusType, string> = {
  جديدة: "bg-blue-100 text-blue-800",
  "قيد المحاكمة": "bg-purple-100 text-purple-800",
  "محدد لها جلسة": "bg-green-100 text-green-800",
  "تأجلت الجلسة": "bg-yellow-100 text-yellow-800",
  "صدر الحكم بالبراءة": "bg-emerald-100 text-emerald-800",
  "صدر الحكم بالإدانة": "bg-red-100 text-red-800",
  "جاري الاستئناف": "bg-orange-100 text-orange-800",
  انتهت: "bg-gray-100 text-gray-800",
};

export default function EnterpriseCases() {
  const { data: cases, loading, error } = useCases();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (!cases) return [];
    let result = cases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.case_number?.toLowerCase().includes(q) ||
          c.case_code?.toLowerCase().includes(q) ||
          c.court_name?.toLowerCase().includes(q) ||
          c.person?.legal_full_name?.toLowerCase().includes(q),
      );
    }
    if (statusFilter && statusFilter !== "all") {
      result = result.filter((c) => c.procedural_status === statusFilter);
    }
    return result;
  }, [cases, search, statusFilter]);

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">القضايا</h1>
        <Link to="/app/cases/new">
          <Button className="gap-2 clay-button">
            <Plus className="h-4 w-4" />
            قضية جديدة
          </Button>
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث برقم القضية، الكود، المحكمة، أو اسم الشخص..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-10 clay-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="过滤 بالحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="جديدة">جديدة</SelectItem>
            <SelectItem value="قيد المحاكمة">قيد المحاكمة</SelectItem>
            <SelectItem value="محدد لها جلسة">محدد لها جلسة</SelectItem>
            <SelectItem value="تأجلت الجلسة">تأجلت الجلسة</SelectItem>
            <SelectItem value="صدر الحكم بالبراءة">صدر الحكم بالبراءة</SelectItem>
            <SelectItem value="صدر الحكم بالإدانة">صدر الحكم بالإدانة</SelectItem>
            <SelectItem value="جاري الاستئناف">جاري الاستئناف</SelectItem>
            <SelectItem value="انتهت">انتهت</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
            خطأ في تحميل القضايا: {error}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="clay-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Briefcase className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || statusFilter !== "all"
                ? "لا توجد نتائج مطابقة للبحث"
                : "لا توجد قضايا مسجلة بعد"}
            </p>
            {!search && statusFilter === "all" && (
              <Link to="/app/cases/new" className="mt-4">
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  أضف أول قضية
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cases List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} قضية
          </p>
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/app/cases/${c.case_code}`}
              className="block no-underline"
            >
              <Card className="clay-card transition-all duration-200 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">
                          {c.case_number}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / {c.case_year}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {c.court_name}
                      </p>
                      {c.person && (
                        <p className="mt-0.5 text-xs text-clay-text-secondary">
                          {c.person.legal_full_name}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`text-xs ${
                        STATUS_COLORS[c.procedural_status as ProceduralStatusType] ??
                        "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {c.procedural_status}
                    </Badge>
                  </div>
                  {c.next_action && (
                    <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      الإجراء التالي: {c.next_action}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
