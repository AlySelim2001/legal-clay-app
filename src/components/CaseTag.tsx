import type { CaseCategory } from "@/lib/caseTagUtils";
import { CATEGORY_CONFIG, getCaseCategory } from "@/lib/caseTagUtils";

interface CaseTagProps {
  category?: CaseCategory;
  caseCode?: string;
  size?: "sm" | "md" | "lg";
}

export function CaseTag({ category, caseCode, size = "md" }: CaseTagProps) {
  const cat = category || (caseCode ? getCaseCategory(caseCode) : "criminal");
  const config = CATEGORY_CONFIG[cat];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold ${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses[size]}`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {config.label}
    </span>
  );
}

interface CaseTagGroupProps {
  caseCode: string;
  defenseCategory?: string;
  size?: "sm" | "md" | "lg";
}

export function CaseTagGroup({ caseCode, defenseCategory, size = "md" }: CaseTagGroupProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CaseTag caseCode={caseCode} size={size} />
      {defenseCategory && (
        <span className="inline-flex items-center rounded-full border border-clay-border bg-clay-surface px-3 py-1 text-xs font-medium text-clay-text-secondary">
          {defenseCategory}
        </span>
      )}
    </div>
  );
}
