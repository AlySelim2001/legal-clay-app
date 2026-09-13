import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderOpen,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard } from "@/components/legal/ui";

/**
 * ملف القضية — personal case workspace. User-owned timeline, notes, tasks.
 * The system never declares guilt; events are typed as user claims vs
 * verified facts vs document events.
 */

interface CaseListItem {
  _id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

interface CaseDetail {
  case: CaseListItem;
  events: Array<{ _id: string; date: number; description: string; kind: string }>;
  notes: Array<{ _id: string; body: string; createdAt: number }>;
  tasks: Array<{ _id: string; title: string; dueAt?: number; status: string }>;
  documents: Array<{ _id: string; name: string; createdAt: number }>;
}

const KIND_LABELS: Record<string, string> = {
  user_claim: "بحسب أقوالك",
  verified_fact: "واقعة مُتحقق منها",
  document_event: "واقعة من مستند",
};

const KIND_STYLES: Record<string, string> = {
  user_claim: "bg-amber-100 text-amber-800",
  verified_fact: "bg-emerald-100 text-emerald-800",
  document_event: "bg-sky-100 text-sky-800",
};

export default function Dossier() {
  const cases = useQuery(
    api.workspace.listCases,
    CONVEX_URL ? {} : "skip",
  ) as CaseListItem[] | undefined;
  const createCase = useMutation(api.workspace.createCase);
  const addEvent = useMutation(api.workspace.addCaseEvent);
  const addNote = useMutation(api.workspace.addCaseNote);
  const addTask = useMutation(api.workspace.addCaseTask);
  const toggleTask = useMutation(api.workspace.toggleTask);

  const [openId, setOpenId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const detail = useQuery(
    api.workspace.caseDetail,
    openId && CONVEX_URL ? { caseId: openId as never } : "skip",
  ) as CaseDetail | undefined;

  const [eventText, setEventText] = useState("");
  const [eventKind, setEventKind] = useState<"user_claim" | "verified_fact" | "document_event">(
    "user_claim",
  );
  const [noteText, setNoteText] = useState("");
  const [taskText, setTaskText] = useState("");

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  async function handleCreate() {
    if (newTitle.trim().length < 3) return;
    setCreating(true);
    try {
      const id = await createCase({ title: newTitle });
      setNewTitle("");
      setOpenId(id);
      toast.success("تم إنشاء الملف.");
    } catch {
      toast.error("تعذّر إنشاء الملف.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">ملفك القضائي</h1>
        <p className="text-sm text-clay-text-secondary">
          نظّم وقائعك ومستنداتك في ملف شخصي خاص بك — بياناتك لك وحدك.
        </p>
      </div>

      {/* Create */}
      <div className="clay-card flex items-center gap-2 p-3">
        <FolderOpen className="ms-1 h-5 w-5 shrink-0 text-primary" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          placeholder="اسم الملف الجديد — مثال: خلاف إيصال أمانة"
          className="clay-input h-11 flex-1 text-sm"
          dir="rtl"
          maxLength={200}
        />
        <button
          onClick={() => void handleCreate()}
          disabled={creating || newTitle.trim().length < 3}
          className="clay-button flex h-11 items-center gap-1.5 bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          إنشاء
        </button>
      </div>

      {/* Cases list */}
      {cases === undefined ? (
        <div className="clay-card h-24 animate-pulse" />
      ) : cases.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد ملفات بعد"
          description="أنشئ ملفاً لتنظيم وقائع قضيتك خطوة بخطوة."
        />
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <div key={c._id} className="clay-card p-4">
              <button
                onClick={() => setOpenId(openId === c._id ? null : c._id)}
                className="flex w-full items-center gap-3 text-start"
              >
                <div className="rounded-xl bg-violet-100 p-2 text-violet-700">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-clay-text">{c.title}</p>
                  <p className="text-xs text-clay-text-secondary">
                    آخر تحديث: {new Date(c.updatedAt).toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <ArrowRight
                  className={`h-4 w-4 text-clay-text-secondary transition-transform ${
                    openId === c._id ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {openId === c._id && (
                <div className="mt-4 space-y-4 border-t border-clay-border/60 pt-3">
                  {detail === undefined ? (
                    <div className="h-20 animate-pulse rounded-xl bg-muted" />
                  ) : detail ? (
                    <>
                      {/* Timeline */}
                      <section>
                        <h4 className="mb-2 text-xs font-black text-clay-text">الخط الزمني</h4>
                        <div className="space-y-2">
                          {detail.events.length === 0 && (
                            <p className="text-xs text-clay-text-secondary">لا وقائع بعد.</p>
                          )}
                          {detail.events.map((ev) => (
                            <div key={ev._id} className="clay-inset p-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_STYLES[ev.kind] ?? "bg-muted"}`}
                                >
                                  {KIND_LABELS[ev.kind] ?? ev.kind}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-clay-text-secondary">
                                  <CalendarClock className="h-3 w-3" />
                                  {new Date(ev.date).toLocaleDateString("ar-EG")}
                                </span>
                              </div>
                              <p className="mt-1.5 text-sm leading-relaxed text-clay-text">
                                {ev.description}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <select
                            value={eventKind}
                            onChange={(e) => setEventKind(e.target.value as typeof eventKind)}
                            className="clay-input h-9 w-32 text-xs"
                            aria-label="نوع الواقعة"
                          >
                            <option value="user_claim">بحسب أقوالك</option>
                            <option value="document_event">من مستند</option>
                          </select>
                          <input
                            value={eventText}
                            onChange={(e) => setEventText(e.target.value)}
                            placeholder="أضف واقعة…"
                            className="clay-input h-9 flex-1 text-xs"
                            dir="rtl"
                          />
                          <button
                            onClick={async () => {
                              if (eventText.trim().length < 3) return;
                              await addEvent({
                                caseId: openId as never,
                                date: Date.now(),
                                description: eventText,
                                kind: eventKind,
                              });
                              setEventText("");
                            }}
                            className="clay-button bg-primary px-3 py-2 text-xs font-bold text-white"
                          >
                            إضافة
                          </button>
                        </div>
                      </section>

                      {/* Tasks */}
                      {detail.tasks.length > 0 && (
                        <section>
                          <h4 className="mb-2 text-xs font-black text-clay-text">المهام</h4>
                          <div className="space-y-1.5">
                            {detail.tasks.map((t) => (
                              <label
                                key={t._id}
                                className="flex items-center gap-2 clay-card-soft p-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={t.status === "done"}
                                  onChange={(e) =>
                                    void toggleTask({
                                      taskId: t._id as never,
                                      done: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[var(--primary)]"
                                />
                                <span
                                  className={
                                    t.status === "done"
                                      ? "text-clay-text-secondary line-through"
                                      : "text-clay-text"
                                  }
                                >
                                  {t.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </section>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={taskText}
                          onChange={(e) => setTaskText(e.target.value)}
                          placeholder="مهمة جديدة… مثال: التصوير على المحضر"
                          className="clay-input h-9 flex-1 text-xs"
                          dir="rtl"
                        />
                        <button
                          onClick={async () => {
                            if (taskText.trim().length < 2) return;
                            await addTask({ caseId: openId as never, title: taskText });
                            setTaskText("");
                          }}
                          className="clay-button bg-primary px-3 py-2 text-xs font-bold text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Notes */}
                      <section>
                        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-clay-text">
                          <StickyNote className="h-3.5 w-3.5" />
                          ملاحظات
                        </h4>
                        <div className="space-y-2">
                          {detail.notes.map((n) => (
                            <div key={n._id} className="clay-card-soft p-3">
                              <p className="text-sm leading-relaxed text-clay-text">{n.body}</p>
                              <p className="mt-1 text-[10px] text-clay-text-secondary">
                                {new Date(n.createdAt).toLocaleString("ar-EG")}
                              </p>
                            </div>
                          ))}
                        </div>
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="اكتب ملاحظة…"
                          rows={2}
                          className="clay-input mt-2 w-full resize-none text-xs"
                          dir="rtl"
                        />
                        <button
                          onClick={async () => {
                            if (noteText.trim().length < 2) return;
                            await addNote({ caseId: openId as never, body: noteText });
                            setNoteText("");
                          }}
                          className="clay-button mt-1.5 bg-primary px-3 py-2 text-xs font-bold text-white"
                        >
                          حفظ الملاحظة
                        </button>
                      </section>

                      {/* Linked documents */}
                      {detail.documents.length > 0 && (
                        <section>
                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-clay-text">
                            <FileText className="h-3.5 w-3.5" />
                            مستندات مرتبطة
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {detail.documents.map((d) => (
                              <span key={d._id} className="clay-badge text-xs">
                                <Trash2 className="hidden" />
                                {d.name}
                              </span>
                            ))}
                          </div>
                        </section>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-red-600">تعذّر تحميل الملف أو أنه غير موجود.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Link
          to="/app/legal/documents"
          className="text-xs font-bold text-primary hover:underline"
        >
          اربط مستنداتك من صفحة المستندات ←
        </Link>
      </div>

      <LegalDisclaimerCard compact />
    </div>
  );
}
