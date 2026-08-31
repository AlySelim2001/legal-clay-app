import {
  Gavel,
  Briefcase,
  Users,
  Landmark,
  HardHat,
} from "lucide-react";

export type CaseCategory = "criminal" | "civil" | "family" | "administrative" | "labor";

export const CATEGORY_CONFIG: Record<
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
