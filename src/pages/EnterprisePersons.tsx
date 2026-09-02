import { useState, useMemo } from "react";
import { Link } from "react-router";
import { usePersons } from "@/hooks/useEnterprise";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Users, Loader2, Phone, Mail, AlertTriangle } from "lucide-react";

export default function EnterprisePersons() {
  const { data: persons, loading, error } = usePersons();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!persons) return [];
    if (!search) return persons;
    const q = search.toLowerCase();
    return persons.filter(
      (p) =>
        p.legal_full_name?.toLowerCase().includes(q) ||
        p.person_code?.toLowerCase().includes(q) ||
        p.national_id_display?.includes(q),
    );
  }, [persons, search]);

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">الأشخاص</h1>
        <Link to="/app/persons/new">
          <Button className="gap-2 clay-button">
            <Plus className="h-4 w-4" />
            شخص جديد
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم، الكود، أو آخر 4 أرقام من الرقم القومي..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pe-10 clay-input"
        />
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
            خطأ في تحميل الأشخاص: {error}
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="clay-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "لا توجد نتائج" : "لا يوجد أشخاص مسجلون بعد"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{filtered.length} شخص</p>
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/app/persons/${p.person_code}`}
              className="block no-underline"
            >
              <Card className="clay-card transition-all duration-200 hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-bold text-primary">
                      {p.legal_full_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      كود: {p.person_code}
                    </p>
                    {p.national_id_display && (
                      <p className="text-xs text-muted-foreground">
                        ****{p.national_id_display}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.phone_optional && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Phone className="h-3 w-3" />
                      </Badge>
                    )}
                    {p.email && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Mail className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
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
