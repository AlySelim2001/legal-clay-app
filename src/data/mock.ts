// ===== Types =====

export type CaseStatus = "活跃" | "معلق" | "منتهي" | "طعن";
export type CasePriority = "حرج" | "مرتفع" | "عادي";
export type UrgencyLevel = "critical" | "high" | "normal";

export interface Case {
  id: string;
  caseCode: string;
  title: string;
  clientName: string;
  clientCode: string;
  status: CaseStatus;
  priority: CasePriority;
  court: string;
  judge: string;
  nextHearing: string;
  deadline: string;
  filingDate: string;
  crimeType: string;
  lawyer: string;
  notes: string;
}

export interface Client {
  id: string;
  clientCode: string;
  name: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
  caseCount: number;
  joinDate: string;
  occupation: string;
  nationality: string;
}

export interface Hearing {
  id: string;
  caseCode: string;
  caseTitle: string;
  date: string;
  time: string;
  court: string;
  judge: string;
  type: string;
  notes: string;
}

export interface Deadline {
  id: string;
  caseCode: string;
  caseTitle: string;
  description: string;
  dueDate: string;
  type: string;
  status: "معلق" | "مكتمل" | "متأخر";
  urgency: UrgencyLevel;
}

export interface Defense {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  applicableArticles: string[];
  successRate: number;
  precedentCases: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  joinedDate: string;
  activeCases: number;
  avatar: string;
  isAdmin: boolean;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  caseCode: string;
  uploadDate: string;
  size: string;
  uploadedBy: string;
}

// ===== Mock Data =====

export const mockCases: Case[] = [
  {
    id: "1",
    caseCode: "ج-2026-0847",
    title: " القضية رقم 847 — اتهام بالاختلاس",
    clientName: "أحمد محمد إبراهيم",
    clientCode: "عم-001",
    status: "活跃",
    priority: "حرج",
    court: "محكمة الجنايات الكبرى — القاهرة",
    judge: "المحكمه / سعيد عبد الرحمن",
    nextHearing: "2026-09-02",
    deadline: "2026-09-01",
    filingDate: "2026-03-15",
    crimeType: "اختلاس",
    lawyer: "محمد فتحي",
    notes: "الجلسة القادمة — تقديم المرافعة النهائية",
  },
  {
    id: "2",
    caseCode: "ج-2026-0923",
    title: " القضية رقم 923 — تزوير مستندات",
    clientName: "سارة علي حسن",
    clientCode: "عم-004",
    status: "活跃",
    priority: "مرتفع",
    court: "محكمة جنايات الجيزة",
    judge: "المحكمه / هاني محمود",
    nextHearing: "2026-09-05",
    deadline: "2026-09-04",
    filingDate: "2026-04-20",
    crimeType: "تزوير",
    lawyer: "نورا سعيد",
    notes: "توريد شهادة خبرة وهمية من الخبير المعين",
  },
  {
    id: "3",
    caseCode: "ج-2026-1105",
    title: " القضية رقم 1105 — نشر أخبار كاذبة",
    clientName: "خالد عثمان فتحي",
    clientCode: "عم-007",
    status: "معلق",
    priority: "عادي",
    court: "محكمة جنايات الإسكندرية",
    judge: "المحكمه / وليد عبد القادر",
    nextHearing: "2026-09-25",
    deadline: "2026-09-20",
    filingDate: "2026-06-10",
    crimeType: "النشر",
    lawyer: "محمد فتحي",
    notes: "انتظار قرار المحكمة حول حفظ الدعوى",
  },
  {
    id: "4",
    caseCode: "ج-2026-0756",
    title: "القضية رقم 756 — سرقة",
    clientName: "عبد الله حسين محمود",
    clientCode: "عم-012",
    status: "活跃",
    priority: "حرج",
    court: "محكمة جنايات المنوفية",
    judge: "المحكمه / كريم الشاذلي",
    nextHearing: "2026-08-31",
    deadline: "2026-08-30",
    filingDate: "2026-02-28",
    crimeType: "سرقة",
    lawyer: "نورا سعيد",
    notes: " Möglichkeit der Verständigung mit dem Opfer — قيد البحث",
  },
  {
    id: "5",
    caseCode: "ج-2026-1340",
    title: " القضية رقم 1340 — تزوير عملة",
    clientName: "مريم حسن أحمد",
    clientCode: "عم-015",
    status: "活跃",
    priority: "مرتفع",
    court: "محكمة جنايات الشرقية",
    judge: "المحكمه / فتحي الزعيم",
    nextHearing: "2026-09-12",
    deadline: "2026-09-10",
    filingDate: "2026-05-05",
    crimeType: "تزوير عملة",
    lawyer: "محمد فتحي",
    notes: "الأدلة المادية — صور مصورة من العينات",
  },
  {
    id: "6",
    caseCode: "ج-2026-0590",
    title: " القضية رقم 590 — جريمة شروع في القتل",
    clientName: "يوسف إسماعيل سعيد",
    clientCode: "عم-003",
    status: "طعن",
    priority: "حرج",
    court: "محكمة النقض",
    judge: "المحكمه / عادل الجمال",
    nextHearing: "2026-10-15",
    deadline: "2026-10-01",
    filingDate: "2025-11-20",
    crimeType: "شروع في القتل",
    lawyer: "نورا سعيد",
    notes: "طعن على الحكم الابتدائي — جلسة نظر الطعن",
  },
  {
    id: "7",
    caseCode: "ج-2025-0412",
    title: " القضية رقم 412 — غسيل أموال",
    clientName: "هدى رضا مصطفى",
    clientCode: "عم-020",
    status: "منتهي",
    priority: "مرتفع",
    court: "محكمة جنايات القاهرة",
    judge: "المحكمه / سعيد عبد الرحمن",
    nextHearing: "—",
    deadline: "—",
    filingDate: "2025-09-12",
    crimeType: "غسيل أموال",
    lawyer: "محمد فتحي",
    notes: "otechnische — الحكم بالبراءة نهائيًا",
  },
  {
    id: "8",
    caseCode: "ج-2026-1502",
    title: " القضية رقم 1502 — اتجار بالمخدرات",
    clientName: "عمر سامح بدر",
    clientCode: "عم-023",
    status: "活跃",
    priority: "حرج",
    court: "محكمة جنايات الجيزة",
    judge: "المحكمه / هاني محمود",
    nextHearing: "2026-09-08",
    deadline: "2026-09-06",
    filingDate: "2026-07-01",
    crimeType: "اتجار بالمخدرات",
    lawyer: "نورا سعيد",
    notes: "次の弁護戦略 — الاستعانة بخبراء",
  },
];

export const mockClients: Client[] = [
  {
    id: "1",
    clientCode: "عم-001",
    name: "أحمد محمد إبراهيم",
    nationalId: "29005151234567",
    phone: "01012345678",
    email: "ahmed.ibrahim@email.com",
    address: "المعادي، القاهرة",
    caseCount: 2,
    joinDate: "2026-01-15",
    occupation: "رجل أعمال",
    nationality: "مصري",
  },
  {
    id: "2",
    clientCode: "عم-004",
    name: "سارة علي حسن",
    nationalId: "29203151234567",
    phone: "01123456789",
    email: "sara.hassan@email.com",
    address: "الدقي، الجيزة",
    caseCount: 1,
    joinDate: "2026-03-20",
    occupation: "محاسبة",
    nationality: "مصرية",
  },
  {
    id: "3",
    clientCode: "عم-007",
    name: "خالد عثمان فتحي",
    nationalId: "28807201234567",
    phone: "01234567890",
    email: "khaled.fathi@email.com",
    address: "سموحة، الإسكندرية",
    caseCount: 1,
    joinDate: "2026-05-10",
    occupation: "صحفي",
    nationality: "مصري",
  },
  {
    id: "4",
    clientCode: "عم-012",
    name: "عبد الله حسين محمود",
    nationalId: "29106101234567",
    phone: "01098765432",
    email: "abdallah.mahmoud@email.com",
    address: "شبين الكوم، المنوفية",
    caseCount: 3,
    joinDate: "2025-12-01",
    occupation: "موظف بنك",
    nationality: "مصري",
  },
  {
    id: "5",
    clientCode: "عم-015",
    name: "مريم حسن أحمد",
    nationalId: "29302251234567",
    phone: "01187654321",
    email: "maryam.hassan@email.com",
    address: "الزقازيق، الشرقية",
    caseCount: 1,
    joinDate: "2026-04-05",
    occupation: "دكتورة جامعية",
    nationality: "مصرية",
  },
  {
    id: "6",
    clientCode: "عم-003",
    name: "يوسف إسماعيل سعيد",
    nationalId: "28708151234567",
    phone: "01543210987",
    email: "youssef.saeed@email.com",
    address: "مدينة نصر، القاهرة",
    caseCount: 1,
    joinDate: "2025-10-20",
    occupation: "مهندس معماري",
    nationality: "مصري",
  },
];

export const mockHearings: Hearing[] = [
  {
    id: "1",
    caseCode: "ج-2026-0847",
    caseTitle: "ادعاء بالاختلاس — أحمد إبراهيم",
    date: "2026-09-02",
    time: "10:00",
    court: "محكمة الجنايات الكبرى — القاهرة",
    judge: "المحكمه / سعيد عبد الرحمن",
    type: "مرافعة نهائية",
    notes: "تحضير الملف الكامل والمرافعة",
  },
  {
    id: "2",
    caseCode: "ج-2026-0923",
    caseTitle: "تزوير مستندات — سارة حسن",
    date: "2026-09-05",
    time: "11:30",
    court: "محكمة جنايات الجيزة",
    judge: "المحكمه / هاني محمود",
    type: "استجواب شهود",
    notes: "استجواب الخبير المعيّن",
  },
  {
    id: "3",
    caseCode: "ج-2026-0756",
    caseTitle: "سرقة — عبد الله محمود",
    date: "2026-08-31",
    time: "09:00",
    court: "محكمة جنايات المنوفية",
    judge: "المحكمه / كريم الشاذلي",
    type: "mıraja' al-marfada",
    notes: " yêu cầu المثول الشخصي",
  },
  {
    id: "4",
    caseCode: "ج-2026-1502",
    caseTitle: "اتجار بالمخدرات — عمر بدر",
    date: "2026-09-08",
    time: "10:30",
    court: "محكمة جنايات الجيزة",
    judge: "المحكمه / هاني محمود",
    type: "تقديم أدلّة",
    notes: "تقديم تقرير الخبير الكيميائي",
  },
  {
    id: "5",
    caseCode: "ج-2026-1340",
    caseTitle: "تزوير عملة — مريم أحمد",
    date: "2026-09-12",
    time: "14:00",
    court: "محكمة جنايات الشرقية",
    judge: "المحكمه / فتحي الزعيم",
    type: "مرافعة",
    notes: "المرافعة بالنيابة",
  },
  {
    id: "6",
    caseCode: "ج-2026-1105",
    caseTitle: "نشر أخبار كاذبة — خالد فتحي",
    date: "2026-09-25",
    time: "12:00",
    court: "محكمة جنايات الإسكندرية",
    judge: "المحكمه / وليد عبد القادر",
    type: " Decision hearing",
    notes: "سماع قرار المحكمة",
  },
  {
    id: "7",
    caseCode: "ج-2026-0590",
    caseTitle: "شروع في القتل — يوسف سعيد",
    date: "2026-10-15",
    time: "09:30",
    court: "محكمة النقض",
    judge: "المحكمه / عادل الجمال",
    type: "نظر الطعن",
    notes: "تقديم أسباب الطعن",
  },
];

export const mockDeadlines: Deadline[] = [
  {
    id: "1",
    caseCode: "ج-2026-0756",
    caseTitle: "سرقة — عبد الله محمود",
    description: "تقديم صحيفة الدعوى المعدلة",
    dueDate: "2026-08-30",
    type: "تقديم مذكرات",
    status: "معلق",
    urgency: "critical",
  },
  {
    id: "2",
    caseCode: "ج-2026-0847",
    caseTitle: "اختلاس — أحمد إبراهيم",
    description: " Moroccan تجهيز المرافعة النهائية",
    dueDate: "2026-09-01",
    type: "مرافعة",
    status: "معلق",
    urgency: "critical",
  },
  {
    id: "3",
    caseCode: "ج-2026-1502",
    caseTitle: "اتجار بالمخدرات — عمر بدر",
    description: "تقديم تقرير الخبرة الكيميائية",
    dueDate: "2026-09-06",
    type: "تقديم أدلة",
    status: "معلق",
    urgency: "high",
  },
  {
    id: "4",
    caseCode: "ج-2026-0923",
    caseTitle: "تزوير مستندات — سارة حسن",
    description: "استجواب الخبير المعيّن",
    dueDate: "2026-09-05",
    type: "جلسة استماع",
    status: "معلق",
    urgency: "high",
  },
  {
    id: "5",
    caseCode: "ج-2026-1340",
    caseTitle: "تزوير عملة — مريم أحمد",
    description: "تقديم العينات المادية للمحكمة",
    dueDate: "2026-09-10",
    type: "تقديم أدلة",
    status: "معلق",
    urgency: "high",
  },
  {
    id: "6",
    caseCode: "ج-2026-1105",
    caseTitle: "نشر أخبار كاذبة — خالد فتحي",
    description: "تقديم مذكرة دفاعية",
    dueDate: "2026-09-20",
    type: "تقديم مذكرات",
    status: "معلق",
    urgency: "normal",
  },
  {
    id: "7",
    caseCode: "ج-2026-0590",
    caseTitle: "شروع في القتل — يوسف سعيد",
    description: "تقديم أسباب الطعن للمحكمة",
    dueDate: "2026-10-01",
    type: "تقديم مذكرات",
    status: "معلق",
    urgency: "normal",
  },
  {
    id: "8",
    caseCode: "ج-2025-0412",
    caseTitle: "غسيل أموال — هدى مصطفى",
    description: "archived",
    dueDate: "2025-12-15",
    type: "توصية",
    status: "مكتمل",
    urgency: "normal",
  },
];

export const mockDefenses: Defense[] = [
  {
    id: "1",
    code: "د-001",
    name: "ال Invalidate escapes",
    description: "الإثبات بأن الإجراءات الاست pivotal قد أُخطئت فيها أو نُقصت، مما يُبطل الإجراءات الجزائية تبعًا للمادة 137 من قانون الإجراءات الجنائية.",
    category: "إجراءاتية",
    applicableArticles: ["المادة 137 من قانون الإجراءات الجنائية", "المادة 216"],
    successRate: 62,
    precedentCases: ["طعن 2024/1156", "طعن 2023/892"],
  },
  {
    id: "2",
    code: "د-002",
    name: "الإنكار",
    description: "نفي التهمة со كاملها، مع التأكيد على عبء الإثبات على النيابة العامة، وعدم كفاية الدليل الدال على الجريمة.",
    category: "دفاع جوهري",
    applicableArticles: ["المادة 34 من قانون العقوبات"],
    successRate: 35,
    precedentCases: ["جنايات 2024/3341"],
  },
  {
    id: "3",
    code: "د-003",
    name: "الدفاع عن necessity",
    description: "ادعاء الضرورة القصوى كمبرر للسلوك الإجرامي، حيث كان المتهم في خطر وشيك لا يمكن تفاديه بوسيلة أخرى.",
    category: "مبرر",
    applicableArticles: ["المادة 49 من قانون العقوبات"],
    successRate: 18,
    precedentCases: ["جنايات 2023/789"],
  },
  {
    id: "4",
    code: "د-004",
    name: "الحصانة النيابية",
    description: "الاستناد إلى نقص في صلاحية الجهة المختصة أو عدم استيفاء شروط التصدي.",
    category: "إجراءاتية",
    applicableArticles: ["المادة 230 من قانون الإجراءات الجنائية"],
    successRate: 45,
    precedentCases: ["طعن 2025/201"],
  },
  {
    id: "5",
    code: "د-005",
    name: " Bugدフェンス",
    description: "اثبات وجود حجج دامغة تدل على براءة المتهم، مثل شهادة شهود الإثبات أو فيديو يثبت الحضور في مكان آخر.",
    category: "البراءة",
    applicableArticles: ["المادة 34 من قانون العقوبات"],
    successRate: 71,
    precedentCases: ["جنايات 2024/5567", "جنايات 2025/102"],
  },
  {
    id: "6",
    code: "د-006",
    name: "تقادم الجريمة",
    description: "استنادًا إلى مرور مدة法定 التقادم على الجريمة المنسوبة، مما يسقط الحق في مقاضاة المتهم.",
    category: "إجراءاتية",
    applicableArticles: ["المادة 15 من قانون العقوبات"],
    successRate: 88,
    precedentCases: ["طعن 2024/789"],
  },
  {
    id: "7",
    code: "د-007",
    name: "الإكراه",
    description: "ادعاء وقوع المتهم تحت تأثير قوة جسمية أو معنوية أوقفت إرادته الحرة عند ارتكاب الفعل.",
    category: "مبرر",
    applicableArticles: ["المادة 51 من قانون العقوبات"],
    successRate: 22,
    precedentCases: ["جنايات 2024/4432"],
  },
  {
    id: "8",
    code: "د-008",
    name: "الإفصاح الطوعي",
    description: "الإفصاح عن الجريمة طواعيًا قبل الشروع في التحقيقات، مع تقديم أدلة تدعم الاعتراف.",
    category: "تخفيف",
    applicableArticles: ["المادة 41 من قانون العقوبات"],
    successRate: 55,
    precedentCases: ["جنايات 2023/1234"],
  },
];

export const mockTeam: TeamMember[] = [
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

export const mockDocuments: Document[] = [
  { id: "1", name: "صحيفة الدعوى — أحمد إبراهيم", type: "pdf", caseCode: "ج-2026-0847", uploadDate: "2026-03-15", size: "2.3 MB", uploadedBy: "محمد فتحي" },
  { id: "2", name: "تقرير الخبير — سارة حسن", type: "pdf", caseCode: "ج-2026-0923", uploadDate: "2026-05-10", size: "1.8 MB", uploadedBy: "نورا سعيد" },
  { id: "3", name: "صور الأدلة — عبد الله محمود", type: "jpg", caseCode: "ج-2026-0756", uploadDate: "2026-04-20", size: "5.1 MB", uploadedBy: "نورا سعيد" },
  { id: "4", name: "عقد التوكيل — مريم أحمد", type: "pdf", caseCode: "ج-2026-1340", uploadDate: "2026-05-05", size: "0.8 MB", uploadedBy: "محمد فتحي" },
  { id: "5", name: "تقرير الكيميائي — عمر بدر", type: "pdf", caseCode: "ج-2026-1502", uploadDate: "2026-07-15", size: "3.2 MB", uploadedBy: "نورا سعيد" },
  { id: "6", name: "أسباب الطعن — يوسف سعيد", type: "docx", caseCode: "ج-2026-0590", uploadDate: "2026-08-01", size: "1.5 MB", uploadedBy: "نورا سعيد" },
  { id: "7", name: "حكم البراءة — هدى مصطفى", type: "pdf", caseCode: "ج-2025-0412", uploadDate: "2025-12-01", size: "0.6 MB", uploadedBy: "محمد فتحي" },
  { id: "8", name: "محضر الجلسة — خالد فتحي", type: "pdf", caseCode: "ج-2026-1105", uploadDate: "2026-07-20", size: "0.4 MB", uploadedBy: "حسين عادل" },
  { id: "9", name: "عقد الإجارة — أحمد إبراهيم", type: "pdf", caseCode: "ج-2026-0847", uploadDate: "2026-04-01", size: "1.1 MB", uploadedBy: "محمد فتحي" },
  { id: "10", name: "شهادة الشهود — سارة حسن", type: "pdf", caseCode: "ج-2026-0923", uploadDate: "2026-06-10", size: "0.9 MB", uploadedBy: "نورا سعيد" },
];
