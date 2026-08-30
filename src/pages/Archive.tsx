import { useState, useMemo } from "react";
import {
  Search,
  FileText,
  Image,
  File,
  Download,
  Trash2,
  FolderOpen,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockDocuments } from "@/data/mock";

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  jpg: Image,
  docx: File,
};

const typeColors: Record<string, string> = {
  pdf: "bg-clay-rose/10 text-clay-rose",
  jpg: "bg-clay-teal/10 text-clay-teal",
  docx: "bg-clay-blue/10 text-clay-blue",
};

export default function Archive() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("الكل");
  const [caseFilter, setCaseFilter] = useState<string>("الكل");

  const caseCodes = useMemo(() => {
    return ["الكل", ...new Set(mockDocuments.map((d) => d.caseCode))];
  }, []);

  const filtered = useMemo(() => {
    let result = mockDocuments;
    if (search) {
      result = result.filter(
        (d) =>
          d.name.includes(search) ||
          d.caseCode.includes(search) ||
          d.uploadedBy.includes(search)
      );
    }
    if (typeFilter !== "الكل") {
      result = result.filter((d) => d.type === typeFilter);
    }
    if (caseFilter !== "الكل") {
      result = result.filter((d) => d.caseCode === caseFilter);
    }
    return result;
  }, [search, typeFilter, caseFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الأرشيف</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة وتخزين الوثائق والمرفقات
          </p>
        </div>
        <button className="clay-button flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
          <Upload className="w-4 h-4" />
          رفع وثيقة
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="clay-card p-4 text-center">
          <FileText className="w-6 h-6 text-clay-rose mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">
            {mockDocuments.filter((d) => d.type === "pdf").length}
          </p>
          <p className="text-xs text-muted-foreground">ملفات PDF</p>
        </div>
        <div className="clay-card p-4 text-center">
          <Image className="w-6 h-6 text-clay-teal mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">
            {mockDocuments.filter((d) => d.type === "jpg").length}
          </p>
          <p className="text-xs text-muted-foreground">صور</p>
        </div>
        <div className="clay-card p-4 text-center">
          <File className="w-6 h-6 text-clay-blue mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">
            {mockDocuments.filter((d) => d.type === "docx").length}
          </p>
          <p className="text-xs text-muted-foreground">مستندات Word</p>
        </div>
        <div className="clay-card p-4 text-center">
          <FolderOpen className="w-6 h-6 text-clay-purple mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">{mockDocuments.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي الوثائق</p>
        </div>
      </div>

      {/* Filters */}
      <div className="clay-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في الوثائق..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="clay-input px-3 py-2 text-sm bg-background min-w-[120px]"
        >
          <option value="الكل">جميع الأنواع</option>
          <option value="pdf">PDF</option>
          <option value="jpg">صور</option>
          <option value="docx">Word</option>
        </select>
        <select
          value={caseFilter}
          onChange={(e) => setCaseFilter(e.target.value)}
          className="clay-input px-3 py-2 text-sm bg-background min-w-[180px]"
        >
          {caseCodes.map((cc) => (
            <option key={cc} value={cc}>
              {cc === "الكل" ? "جميع القضايا" : cc}
            </option>
          ))}
        </select>
      </div>

      {/* Documents Table */}
      <div className="clay-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  الاسم
                </th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  النوع
                </th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  القضية
                </th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  الحجم
                </th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  رفعه
                </th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  التاريخ
                </th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const Icon = typeIcons[doc.type] || File;
                return (
                  <tr
                    key={doc.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg", typeColors[doc.type])}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-foreground text-sm truncate max-w-[250px]">
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="clay-badge text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 uppercase">
                        {doc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-clay-blue">
                      {doc.caseCode}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{doc.size}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{doc.uploadedBy}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{doc.uploadDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-destructive/5 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
