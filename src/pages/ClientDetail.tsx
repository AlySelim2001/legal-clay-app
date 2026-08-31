import { useParams, Link } from "react-router";
import {
  ArrowRight,
  Phone,
  Mail,
  CreditCard,
  FolderOpen,
  Edit,
  Loader2,
} from "lucide-react";
import { useClient } from "@/hooks/useSupabaseData";
import { cn } from "@/lib/utils";

export default function ClientDetail() {
  const { clientCode } = useParams();
  const { data: client, loading, error } = useClient(clientCode ?? "");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">خطأ في تحميل البيانات: {error ?? "لم يتم العثور على العميل"}</p>
      </div>
    );
  }

  const clientCases = client.cases ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/app/clients" className="hover:text-foreground transition-colors">
          العملاء
        </Link>
        <ArrowRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{client.full_name}</span>
      </div>

      {/* Profile Card */}
      <div className="clay-card p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-3xl bg-clay-teal/15 flex items-center justify-center shrink-0">
            <span className="text-3xl font-bold text-clay-teal">{client.full_name.charAt(0)}</span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-foreground">{client.full_name}</h1>
              <span className="font-mono text-xs font-semibold text-clay-blue bg-clay-blue/10 px-2 py-0.5 rounded-lg">
                {client.client_code}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              مسجل منذ {client.created_at.split("T")[0]}
            </p>
          </div>

          <button className="clay-button flex items-center gap-2 px-4 py-2.5 bg-card text-sm text-muted-foreground rounded-xl">
            <Edit className="w-4 h-4" />
            تعديل البيانات
          </button>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[
            { icon: CreditCard, label: "رقم الهوية", value: client.national_id },
            { icon: Phone, label: "الهاتف", value: client.phone ?? "—" },
            { icon: Mail, label: "البريد الإلكتروني", value: client.email ?? "—" },
          ].map((info) => {
            const Icon = info.icon;
            return (
              <div key={info.label} className="clay-inset p-3.5 rounded-xl flex items-start gap-3">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    {info.label}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {info.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cases History */}
      <div className="clay-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">
            القضايا المرتبطة ({clientCases.length})
          </h2>
        </div>
        <div className="space-y-3">
          {clientCases.map((c) => (
            <Link
              key={c.id}
              to={`/app/cases/${c.case_code}`}
              className={cn(
                "clay-card-soft p-4 flex items-start gap-4 hover:scale-[1.005] transition-transform block",
                "urgency-border-high"
              )}
            >
              <div className="p-2.5 rounded-2xl bg-clay-blue/10 shrink-0">
                <FolderOpen className="w-5 h-5 text-clay-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold text-clay-blue">
                    {c.case_code}
                  </span>
                  <span className="clay-badge text-[10px] font-bold px-2 py-0.5 bg-clay-blue/10 text-clay-blue">
                    {c.procedural_status ?? "أخرى"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{c.case_no}</p>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs text-muted-foreground">📅 {c.filing_date}</span>
                  <span className="text-xs text-muted-foreground">⚖ {c.court_name}</span>
                </div>
              </div>
            </Link>
          ))}
          {clientCases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              لا توجد قضايا مرتبطة بهذا العميل
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
