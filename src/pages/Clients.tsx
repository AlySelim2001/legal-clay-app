import { useState, useMemo } from "react";
import { Link } from "react-router";
import { Search, Plus, Phone, Mail, Loader2 } from "lucide-react";
import { useClients } from "@/hooks/useSupabaseData";

export default function Clients() {
  const { data: clients, loading, error } = useClients();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search) return clients;
    return clients.filter(
      (c) =>
        c.full_name.includes(search) ||
        c.client_code.includes(search) ||
        c.national_id.includes(search) ||
        (c.phone ?? "").includes(search)
    );
  }, [clients, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">خطأ في تحميل البيانات: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">العملاء</h1>
          <p className="text-sm text-muted-foreground mt-1">
            سجل العملاء وبياناتهم الشخصية
          </p>
        </div>
        <button className="clay-button flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
          <Plus className="w-4 h-4" />
          عميل جديد
        </button>
      </div>

      {/* Search */}
      <div className="clay-card p-4">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم، الكود، أو رقم الهوية..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
          />
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        عرض {filtered.length} من {clients?.length ?? 0} عميل
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <Link
            key={client.id}
            to={`/app/clients/${client.client_code}`}
            className="clay-card p-5 hover:scale-[1.01] transition-transform block"
          >
            {/* Avatar + Name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-clay-teal/15 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-clay-teal">
                  {client.full_name.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">{client.full_name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{client.client_code}</p>
              </div>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-4">
              {client.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span dir="ltr">{client.phone}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">{client.national_id}</span>
              <span className="text-xs text-muted-foreground">
                {client.created_at.split("T")[0]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
