import { useParams, Link } from "react-router";
import {
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Briefcase,
  Globe,
  FolderOpen,
  Calendar,
  Edit,
} from "lucide-react";
import { mockClients, mockCases } from "@/data/mock";
import { cn } from "@/lib/utils";

export default function ClientDetail() {
  const { clientCode } = useParams();
  const client = mockClients.find((c) => c.clientCode === clientCode) || mockClients[0];
  const clientCases = mockCases.filter((c) => c.clientCode === client.clientCode);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/app/clients" className="hover:text-foreground transition-colors">
          العملاء
        </Link>
        <ArrowRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      {/* Profile Card */}
      <div className="clay-card p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-3xl bg-clay-teal/15 flex items-center justify-center shrink-0">
            <span className="text-3xl font-bold text-clay-teal">{client.name.charAt(0)}</span>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
              <span className="font-mono text-xs font-semibold text-clay-blue bg-clay-blue/10 px-2 py-0.5 rounded-lg">
                {client.clientCode}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {client.occupation} — {client.nationality}
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
            { icon: CreditCard, label: "رقم الهوية", value: client.nationalId },
            { icon: Phone, label: "الهاتف", value: client.phone, dir: "ltr" },
            { icon: Mail, label: "البريد الإلكتروني", value: client.email, dir: "ltr" },
            { icon: MapPin, label: "العنوان", value: client.address },
            { icon: Briefcase, label: "المهنة", value: client.occupation },
            { icon: Calendar, label: "تاريخ الانضمام", value: client.joinDate },
          ].map((info) => {
            const Icon = info.icon;
            return (
              <div key={info.label} className="clay-inset p-3.5 rounded-xl flex items-start gap-3">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    {info.label}
                  </p>
                  <p
                    className="text-sm font-medium text-foreground"
                    dir={info.dir}
                  >
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
              to={`/app/cases/${c.caseCode}`}
              className={cn(
                "clay-card-soft p-4 flex items-start gap-4 hover:scale-[1.005] transition-transform block",
                c.priority === "حرج"
                  ? "urgency-border-critical"
                  : c.priority === "مرتفع"
                  ? "urgency-border-high"
                  : "urgency-border-normal"
              )}
            >
              <div className="p-2.5 rounded-2xl bg-clay-blue/10 shrink-0">
                <FolderOpen className="w-5 h-5 text-clay-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold text-clay-blue">
                    {c.caseCode}
                  </span>
                  <span
                    className={cn(
                      "clay-badge text-[10px] font-bold px-2 py-0.5",
                      c.status === "活跃"
                        ? "bg-urgency-normal/10 text-urgency-normal"
                        : "bg-urgency-high/10 text-urgency-high"
                    )}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{c.title}</p>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-xs text-muted-foreground">📅 {c.filingDate}</span>
                  <span className="text-xs text-muted-foreground">⚖ {c.court}</span>
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
