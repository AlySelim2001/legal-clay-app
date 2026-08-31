import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Network, Loader2, AlertTriangle, FolderOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EntityLink {
  source_case_code: string;
  source_case_no: string;
  target_case_code: string;
  target_case_no: string;
  match_reason: string;
  target_court: string;
}

interface EntityNetworkProps {
  clientId: string;
}

export function EntityNetwork({ clientId }: EntityNetworkProps) {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("get_client_entity_links", { p_client_id: clientId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setLinks(data as EntityLink[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="text-center py-8">
        <Network className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">لا توجد روابط بين القضايا لهذا العميل</p>
        <p className="text-xs text-muted-foreground mt-1">سيتم اكتشاف الروابط تلقائيًا عند وجود أرقام هوية أو أسماء مشتركة</p>
      </div>
    );
  }

  // Group by match reason
  const grouped = links.reduce<Record<string, EntityLink[]>>((acc, link) => {
    if (!acc[link.match_reason]) acc[link.match_reason] = [];
    acc[link.match_reason]!.push(link);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Network className="w-5 h-5 text-clay-purple" />
        <h3 className="text-sm font-bold text-foreground">شبكة القضايا المرتبطة</h3>
        <span className="clay-badge text-[10px] font-bold bg-clay-purple/10 text-clay-purple px-2 py-0.5">
          {links.length} رابط
        </span>
      </div>

      {Object.entries(grouped).map(([reason, groupLinks]) => (
        <div key={reason} className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-urgency-high" />
            <span className="text-xs font-semibold text-foreground">{reason}</span>
            <span className="text-[10px] text-muted-foreground">({groupLinks.length})</span>
          </div>

          {groupLinks.map((link, i) => (
            <div key={i} className="clay-card-soft p-3">
              {/* Source → Target visual */}
              <div className="flex items-center gap-2 mb-2">
                <Link
                  to={`/app/cases/${link.source_case_code}`}
                  className="clay-badge text-[10px] font-bold bg-clay-blue/10 text-clay-blue px-2 py-1 hover:bg-clay-blue/20 transition-colors"
                >
                  {link.source_case_code}
                </Link>
                <span className="text-muted-foreground text-xs">→</span>
                <Link
                  to={`/app/cases/${link.target_case_code}`}
                  className="clay-badge text-[10px] font-bold bg-clay-rose/10 text-clay-rose px-2 py-1 hover:bg-clay-rose/20 transition-colors"
                >
                  {link.target_case_code}
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <FolderOpen className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{link.target_case_no}</p>
                <span className="text-[10px] text-muted-foreground">— {link.target_court}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
