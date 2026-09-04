import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import {
  getElectronicSignature,
  getSigningIdentity,
  listSignedDocuments,
  PDF_SIGNATURE_LAW,
  type SignatureRecord,
  type SignedDocument,
  type SignatureVerificationResult,
} from "@/signature/electronic-signature";

// ============================================================
// Helpers
// ============================================================

function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function shortHash(hash: string, size = 18): string {
  return hash.length > size * 2 ? `${hash.slice(0, size)}…` : hash;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ============================================================
// PDF Signature Desk — التوقيع الرقمي لملفات PDF
// ============================================================

export function PDFSignatureDesk() {
  const engine = getElectronicSignature();

  const [signerName, setSignerName] = useState("");
  const [barLicense, setBarLicense] = useState("");
  const [role, setRole] = useState("محامٍ");
  const [signFile, setSignFile] = useState<File | null>(null);

  const [verifyFile, setVerifyFile] = useState<File | null>(null);

  const [keyFingerprint, setKeyFingerprint] = useState<string | null>(null);
  const [keyCreatedAt, setKeyCreatedAt] = useState<string | null>(null);
  const [records, setRecords] = useState<SignatureRecord[]>([]);

  const [signing, setSigning] = useState(false);
  const [lastSigned, setLastSigned] = useState<SignedDocument | null>(null);
  const [signError, setSignError] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<SignatureVerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const refreshRecords = useCallback(async () => {
    try {
      setRecords(await listSignedDocuments());
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const identity = await getSigningIdentity();
      if (identity) {
        setKeyFingerprint(identity.keyFingerprint);
        setKeyCreatedAt(identity.createdAt);
      }
      await refreshRecords();
    })();
  }, [refreshRecords]);

  const handleSign = useCallback(async () => {
    setSignError("");
    setLastSigned(null);
    if (!signFile || !signerName.trim()) return;
    setSigning(true);
    try {
      const bytes = new Uint8Array(await signFile.arrayBuffer());
      const signed = await engine.signDocument(
        bytes,
        { name: signerName.trim(), barLicense: barLicense.trim() || undefined, role: role.trim() },
        signFile.name,
      );
      setLastSigned(signed);
      const base = signFile.name.replace(/\.pdf$/i, "") || "document";
      downloadBytes(signed.pdfBytes, `${base}-signed.pdf`);
      void refreshRecords();
    } catch (err) {
      setSignError(err instanceof Error ? err.message : "حدث خطأ أثناء التوقيع الرقمي");
    } finally {
      setSigning(false);
    }
  }, [engine, signFile, signerName, barLicense, role, refreshRecords]);

  const handleVerify = useCallback(async () => {
    setVerifyError("");
    setVerifyResult(null);
    if (!verifyFile) return;
    setVerifying(true);
    try {
      const bytes = new Uint8Array(await verifyFile.arrayBuffer());
      const result = await engine.verifySignature(bytes);
      setVerifyResult(result);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "حدث خطأ أثناء التحقق");
    } finally {
      setVerifying(false);
    }
  }, [engine, verifyFile]);

  const inputClass =
    "clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic";

  return (
    <div className="space-y-4">
      {/* Intro + key identity */}
      <div className="clay-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-clay-purple" />
            <h3 className="text-sm font-bold font-arabic">
              التوقيع الرقمي للمستندات (PDF)
            </h3>
          </div>
          <span className="clay-badge text-[10px] bg-clay-purple/10 text-clay-purple px-2.5 py-1 inline-flex items-center gap-1.5 rounded-full w-fit font-arabic">
            <BadgeCheck className="w-3.5 h-3.5" />
            {PDF_SIGNATURE_LAW.law}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2">
            <KeyRound className="w-4 h-4 shrink-0 text-clay-amber mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-arabic mb-0.5">
                بصمة مفتاح التوقيع المحلي
              </p>
              {keyFingerprint ? (
                <code className="text-[10px] text-clay-blue break-all" dir="ltr">
                  {keyFingerprint}
                </code>
              ) : (
                <span className="text-[10px] text-muted-foreground font-arabic">جاري التهيئة…</span>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2">
            <Fingerprint className="w-4 h-4 shrink-0 text-clay-blue mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground font-arabic mb-0.5">تاريخ إنشاء المفتاح</p>
              <p className="text-xs font-medium text-foreground font-arabic">
                {keyCreatedAt ? fmtDate(keyCreatedAt) : "—"}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2">
            <FileText className="w-4 h-4 shrink-0 text-clay-green mt-0.5" />
            <div>
              <p className="text-[10px] text-muted-foreground font-arabic mb-0.5">مستندات موقّعة</p>
              <p className="text-xs font-medium text-foreground font-arabic">{records.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Sign ---- */}
        <div className="clay-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-clay-green" />
            <h4 className="text-xs font-bold font-arabic">توقيع ملف PDF رقمياً</h4>
          </div>

          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="اسم الموقّع (كما في بطاقة الهوية) *"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={barLicense}
              onChange={(e) => setBarLicense(e.target.value)}
              placeholder="رقم النقابة / الترخيص"
              className={inputClass}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="محامٍ">محامٍ</option>
              <option value="محامٍ بالنقض">محامٍ بالنقض</option>
              <option value="الموكل">الموكل</option>
              <option value="شاهد">شاهد</option>
              <option value="خبير">خبير</option>
            </select>
          </div>

          <label className="flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-clay-border bg-muted/20 px-3 py-2.5 cursor-pointer hover:border-clay-purple/50 transition-colors">
            <span className="flex items-center gap-2 text-xs font-arabic min-w-0">
              <Upload className="w-4 h-4 shrink-0 text-clay-purple" />
              {signFile ? (
                <span className="text-foreground font-medium truncate">{signFile.name}</span>
              ) : (
                <span className="text-muted-foreground">اختر ملف PDF للتوقيع</span>
              )}
            </span>
            {signFile && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {(signFile.size / 1024).toFixed(0)} KB
              </span>
            )}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSignFile(file);
                setLastSigned(null);
              }}
            />
          </label>

          <button
            onClick={handleSign}
            disabled={signing || !signFile || !signerName.trim()}
            className="clay-button w-full rounded-xl bg-clay-green/10 text-clay-green px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50 font-arabic"
          >
            {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            توقيع الملف رقمياً وتنزيل النسخة الموقّعة
          </button>

          {signError && (
            <div className="flex items-start gap-2 rounded-lg border border-urgency-high/30 bg-urgency-high/10 p-2 text-xs text-foreground font-arabic">
              <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-high" />
              {signError}
            </div>
          )}

          {lastSigned && (
            <div className="rounded-xl border border-clay-green/30 bg-clay-green/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-clay-green" />
                <p className="text-xs font-bold text-clay-green font-arabic">
                  تم التوقيع الرقمي بنجاح — جارٍ تنزيل النسخة
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                <span className="text-muted-foreground font-arabic">رقم الشهادة:</span>
                <code className="text-clay-blue truncate" dir="ltr">{lastSigned.certificateId}</code>
                <span className="text-muted-foreground font-arabic">التاريخ:</span>
                <span className="text-foreground font-arabic">{fmtDate(lastSigned.signedAt)}</span>
                <span className="text-muted-foreground font-arabic">الخوارزمية:</span>
                <code className="text-clay-blue" dir="ltr">{lastSigned.algorithm}</code>
                <span className="text-muted-foreground font-arabic">بصمة المستند:</span>
                <code className="text-clay-blue truncate" dir="ltr">{shortHash(lastSigned.docHash)}</code>
              </div>
              <button
                onClick={() => {
                  const base = (lastSigned.fileName || "document").replace(/\.pdf$/i, "");
                  downloadBytes(lastSigned.pdfBytes, `${base}-signed.pdf`);
                }}
                className="clay-button w-full rounded-lg bg-clay-purple/10 text-clay-purple px-3 py-1.5 flex items-center justify-center gap-1.5 text-xs font-bold font-arabic"
              >
                <Download className="w-3.5 h-3.5" />
                تنزيل النسخة الموقّعة مرة أخرى
              </button>
            </div>
          )}
        </div>

        {/* ---- Verify ---- */}
        <div className="clay-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ScanSearch className="w-4 h-4 text-clay-blue" />
            <h4 className="text-xs font-bold font-arabic">التحقق من ملف موقّع</h4>
          </div>
          <p className="text-[10px] text-muted-foreground font-arabic">
            ارفع النسخة الموقّعة — يقارن النظام بصمة الملف مع سجل التوقيعات ويتحقق من التوقيع
            التشفيري (ECDSA P-256).
          </p>

          <label className="flex items-center justify-between gap-2 rounded-xl border-2 border-dashed border-clay-border bg-muted/20 px-3 py-2.5 cursor-pointer hover:border-clay-blue/50 transition-colors">
            <span className="flex items-center gap-2 text-xs font-arabic min-w-0">
              <Upload className="w-4 h-4 shrink-0 text-clay-blue" />
              {verifyFile ? (
                <span className="text-foreground font-medium truncate">{verifyFile.name}</span>
              ) : (
                <span className="text-muted-foreground">اختر الملف الموقّع للتحقق</span>
              )}
            </span>
            {verifyFile && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {(verifyFile.size / 1024).toFixed(0)} KB
              </span>
            )}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                setVerifyFile(e.target.files?.[0] ?? null);
                setVerifyResult(null);
              }}
            />
          </label>

          <button
            onClick={handleVerify}
            disabled={verifying || !verifyFile}
            className="clay-button w-full rounded-xl bg-clay-blue/10 text-clay-blue px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50 font-arabic"
          >
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            التحقق من التوقيع
          </button>

          {verifyError && (
            <div className="flex items-start gap-2 rounded-lg border border-urgency-high/30 bg-urgency-high/10 p-2 text-xs text-foreground font-arabic">
              <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-high" />
              {verifyError}
            </div>
          )}

          {verifyResult &&
            (verifyResult.valid ? (
              <div className="rounded-xl border border-clay-green/30 bg-clay-green/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-clay-green" />
                  <p className="text-xs font-bold text-clay-green font-arabic">{verifyResult.message}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <span className="text-muted-foreground font-arabic">الموقّع:</span>
                  <span className="text-foreground font-medium font-arabic">{verifyResult.signedBy}</span>
                  <span className="text-muted-foreground font-arabic">تاريخ التوقيع:</span>
                  <span className="text-foreground font-arabic">{fmtDate(verifyResult.signedAt ?? "")}</span>
                  <span className="text-muted-foreground font-arabic">رقم الشهادة:</span>
                  <code className="text-clay-blue truncate" dir="ltr">{verifyResult.certificateId}</code>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-urgency-critical/30 bg-urgency-critical/5 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  {verifyResult.tampered ? (
                    <ShieldAlert className="w-4 h-4 text-urgency-critical" />
                  ) : (
                    <XCircle className="w-4 h-4 text-urgency-high" />
                  )}
                  <p className="text-xs font-bold font-arabic text-urgency-critical">{verifyResult.message}</p>
                </div>
                {verifyResult.signedBy && (
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    سجل التوقيع المطابق منسوب إلى: {verifyResult.signedBy} — {fmtDate(verifyResult.signedAt ?? "")}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* ---- Registry ---- */}
      <div className="clay-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-clay-purple" />
            <h4 className="text-xs font-bold font-arabic">سجل التوقيعات المحلي</h4>
          </div>
          <span className="text-[10px] text-muted-foreground font-arabic">
            {records.length} عملية توقيع
          </span>
        </div>

        {records.length === 0 ? (
          <p className="text-[11px] text-muted-foreground font-arabic text-center py-4">
            لا توجد توقيعات بعد — وقّع أول ملف PDF بالأعلى وسيظهر سجله هنا.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">الموقّع</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">الملف</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">التاريخ</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">بصمة المستند</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">الشهادة</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-2 font-medium text-foreground font-arabic">
                      {record.signer.name}
                      {record.signer.barLicense && (
                        <span className="text-[9px] text-muted-foreground block font-arabic">
                          {record.signer.barLicense}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground truncate max-w-[140px] font-arabic">
                      {record.fileName}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground font-arabic whitespace-nowrap">
                      {fmtDate(record.signedAt)}
                    </td>
                    <td className="px-2 py-2">
                      <code className="text-[10px] text-clay-blue" dir="ltr">
                        {shortHash(record.docHash, 10)}
                      </code>
                    </td>
                    <td className="px-2 py-2">
                      <code className="text-[10px] text-clay-purple" dir="ltr">
                        {shortHash(record.certificateId, 12)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 p-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-clay-green mt-0.5" />
          <p className="text-[10px] text-muted-foreground font-arabic leading-4">
            السجلات محفوظة محلياً على الجهاز (وضع دون اتصال) — راجع محامٍ مختص قبل الاعتماد على
            أي توقيع في أوراق رسمية؛ الشهادات الرسمية تصدر من جهات التصديق المعتمدة لدى ITIDA وفق
            قانون 15/2004.
          </p>
        </div>
      </div>
    </div>
  );
}
