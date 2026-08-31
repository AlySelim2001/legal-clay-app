import {
  Gavel,
  Briefcase,
  Users,
  Landmark,
  HardHat,
} from "lucide-react";

type CaseCategory = "criminal" | "civil" | "family" | "administrative" | "labor";

const CATEGORY_CONFIG: Record<
  CaseCategory,
  { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }
> = {
  criminal: {
    label: "جنائي",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    icon: Gavel,
  },
  civil: {
    label: "مدني",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    icon: Briefcase,
  },
  family: {
    label: "أسرة",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-300",
    icon: Users,
  },
  administrative: {
    label: "إداري",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
    icon: Landmark,
  },
  labor: {
    label: "عمل",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-300",
    icon: HardHat,
  },
};

export function getCaseCategory(caseCode: string): CaseCategory {
  const prefix = caseCode.split("/")[0].toLowerCase();
  if (prefix.includes("جنح") || prefix.includes("جنائ") || prefix === "j") return "criminal";
  if (prefix.includes("مدن") || prefix === "c") return "civil";
  if (prefix.includes("أحوال") || prefix.includes("أسر") || prefix === "f") return "family";
  if (prefix.includes("إدار") || prefix === "a") return "administrative";
  if (prefix.includes("عمل") || prefix === "l") return "labor";
  return "criminal";
}

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
