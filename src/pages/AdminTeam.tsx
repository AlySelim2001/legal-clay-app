import {
  Users,
  Plus,
  Mail,
  Phone,
  Shield,
  Edit,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

// Team data remains mock since there is no team_users table in the schema
const mockTeam = [
  {
    id: "1",
    name: "محمد فتحي",
    role: "محامٍ رئيسي",
    email: "mohamed.fathi@crimsys.com",
    phone: "01012345678",
    joinedDate: "2024-01-01",
    activeCases: 4,
    avatar: "م",
    isAdmin: true,
  },
  {
    id: "2",
    name: "نورا سعيد",
    role: "محامية",
    email: "noura.saeed@crimsys.com",
    phone: "01123456789",
    joinedDate: "2024-06-15",
    activeCases: 3,
    avatar: "ن",
    isAdmin: false,
  },
  {
    id: "3",
    name: "حسين عادل",
    role: "مساعد قانوني",
    email: "hussein.adel@crimsys.com",
    phone: "01234567890",
    joinedDate: "2025-03-01",
    activeCases: 5,
    avatar: "ح",
    isAdmin: false,
  },
  {
    id: "4",
    name: "فاطمة الزهراء",
    role: "باحثة قانونية",
    email: "fatma.z@crimsys.com",
    phone: "01098765432",
    joinedDate: "2025-09-01",
    activeCases: 2,
    avatar: "ف",
    isAdmin: false,
  },
  {
    id: "5",
    name: "عمر حسن",
    role: "مدير مكتب",
    email: "omar.hassan@crimsys.com",
    phone: "01187654321",
    joinedDate: "2024-03-01",
    activeCases: 0,
    avatar: "ع",
    isAdmin: true,
  },
];

const roleColors: Record<string, string> = {
  "محامٍ رئيسي": "bg-clay-blue/15 text-clay-blue",
  "محامية": "bg-clay-purple/15 text-clay-purple",
  "مساعد قانوني": "bg-clay-teal/15 text-clay-teal",
  "باحثة قانونية": "bg-clay-amber/15 text-clay-amber",
  "مدير مكتب": "bg-clay-rose/15 text-clay-rose",
};

export default function AdminTeam() {
  const { user } = useSupabaseAuth();

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">غير مصرح لك بالوصول إلى هذه الصفحة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة الفريق</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة مستخدمي النظام وصلاحياتهم
          </p>
        </div>
        <button className="clay-button flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
          <Plus className="w-4 h-4" />
          إضافة عضو
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="clay-card p-4 text-center">
          <Users className="w-6 h-6 text-clay-blue mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{mockTeam.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي الفريق</p>
        </div>
        <div className="clay-card p-4 text-center">
          <Shield className="w-6 h-6 text-clay-purple mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">
            {mockTeam.filter((m) => m.isAdmin).length}
          </p>
          <p className="text-xs text-muted-foreground">مدير</p>
        </div>
        <div className="clay-card p-4 text-center">
          <FolderOpen className="w-6 h-6 text-clay-teal mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">
            {mockTeam.reduce((sum, m) => sum + m.activeCases, 0)}
          </p>
          <p className="text-xs text-muted-foreground">قضايا نشطة</p>
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockTeam.map((member) => (
          <div key={member.id} className="clay-card p-5">
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-clay-blue/15 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-clay-blue">{member.avatar}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">{member.name}</h3>
                  {member.isAdmin && (
                    <span className="clay-badge text-[9px] font-bold bg-clay-purple/10 text-clay-purple px-1.5 py-0.5">
                      مدير
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "clay-badge text-[10px] font-semibold px-2 py-0.5 mt-1 inline-block",
                    roleColors[member.role] || "bg-muted text-muted-foreground"
                  )}
                >
                  {member.role}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span dir="ltr">{member.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3 h-3 shrink-0" />
                <span dir="ltr">{member.phone}</span>
              </div>
            </div>

            {/* Stats & Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  {member.activeCases} قضية نشطة
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-destructive/5 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
