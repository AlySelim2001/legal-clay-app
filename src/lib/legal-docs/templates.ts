/**
 * Legal Document Templates & Automation — CRIM-SYS 2026
 *
 * Automated generation of Egyptian legal documents including
 * petitions, memoranda, notices, and procedural forms.
 * All templates are Arabic-first with proper legal formatting.
 */

// ============================================================
// Types
// ============================================================

export type DocumentType =
  | 'memorandum-defense'
  | 'appeal-memo'
  | 'cassation-memo'
  | 'opposition-memo'
  | 'release-request'
  | 'bail-request'
  | 'extension-request'
  | 'criminal-complaint'
  | 'civil-claim'
  | 'contract-template';

export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  nameAr: string;
  nameEn: string;
  description: string;
  fields: DocumentField[];
  content: string; // Template with placeholders
  category: string;
  requiredLaws: string[];
}

export interface DocumentField {
  key: string;
  labelAr: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface GeneratedDocument {
  id: string;
  type: DocumentType;
  title: string;
  content: string;
  generatedAt: string;
  fields: Record<string, string>;
}

// ============================================================
// Document Templates
// ============================================================

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tpl-defense-01',
    type: 'memorandum-defense',
    nameAr: 'مذكرة دفاع جنائية',
    nameEn: 'Criminal Defense Memorandum',
    description: 'مذكرة دفاع شاملة للطعن على أركان الجريمة أو الإجراءات',
    category: 'جنائي',
    requiredLaws: ['قانون الإجراءات الجنائية 150/1950', 'قانون العقوبات 58/1937'],
    fields: [
      { key: 'court_name', labelAr: 'اسم المحكمة', type: 'text', required: true },
      { key: 'case_number', labelAr: 'رقم القضية', type: 'text', required: true },
      { key: 'case_year', labelAr: 'سنة القضية', type: 'text', required: true },
      { key: 'defendant_name', labelAr: 'اسم المتهم', type: 'text', required: true },
      { key: 'lawyer_name', labelAr: 'اسم المحامي', type: 'text', required: true },
      { key: 'defense_type', labelAr: 'نوع الدفع', type: 'select', required: true, options: ['إسقاط الإجراءات', 'انتفاء الأركان', 'الضرورة القصوى', 'التقادم', 'الإنكار'] },
      { key: 'defense_details', labelAr: 'تفاصيل الدفع', type: 'textarea', required: true, placeholder: 'اشرح تفاصيل الدفع القانوني...' },
      { key: 'legal_basis', labelAr: 'الأساس القانوني', type: 'textarea', required: true, placeholder: 'اذكر المواد القانونية والحكم القضائي...' },
    ],
    content: `بسم الله الرحمن الرحيم

إلى السيد رئيس {court_name}
ولأعضاء المحكمة الموقرة

الموضوع: مذكرة دفاع في القضية رقم {case_number} ج {case_year}

أنا المحامي {lawyer_name}، المحال للمثول أمام المحكمة الموقرة في القضية المذكورة أعلاه، عن المتهم {defendant_name}،

أقدم أمام المحكمة الموقرة هذه المذكرة دفاعاً لموكل:

أولاً: {defense_details}

ثانياً: الأساس القانوني
{legal_basis}

لذلك نطلب الحكم {defense_type}に対して ب Accord_with_law.

تحريرًا في: __________

المحامي المختار: {lawyer_name}
التوقيع: __________

---
⚠️ هذه مذكرة معدّة تلقائيًا — يجب مراجعتها وتعديلها من قبل المحامي المختص قبل تقديمها.`,
  },
  {
    id: 'tpl-appeal-01',
    type: 'appeal-memo',
    nameAr: 'مذكرة استئناف',
    nameEn: 'Appeal Memorandum',
    description: 'مذكرة استئناف ضد الحكم الابتدائي',
    category: 'جنائي',
    requiredLaws: ['قانون الإجراءات الجنائية 150/1950'],
    fields: [
      { key: 'appellate_court', labelAr: 'محكمة الاستئناف', type: 'text', required: true },
      { key: 'case_number', labelAr: 'رقم القضية', type: 'text', required: true },
      { key: 'lower_court', labelAr: 'المحكمة الابتدائية', type: 'text', required: true },
      { key: 'judgment_date', labelAr: 'تاريخ الحكم المستأنف', type: 'date', required: true },
      { key: 'appellant_name', labelAr: 'اسم المستأنف', type: 'text', required: true },
      { key: 'appeal_grounds', labelAr: 'أسباب الاستئناف', type: 'textarea', required: true },
      { key: 'relief_sought', labelAr: 'المرادحصول عليه', type: 'textarea', required: true },
    ],
    content: `بسم الله الرحمن الرحيم

إلى السيد رئيس {appellate_court}

الموضوع: مذكرة استئناف في القضية رقم {case_number}

أتنبه المحكمة الموقرة إلى الحكم الابتدائي الصادر من {lower_court} في القضية رقم {case_number} بتاريخ {judgment_date}،{appellant_name} .

بناءً على ذلك، أنا المستأنف {appellant_name}، أقدم هذه المذكرة اعترافًا على الحكم المستأنف.

أسباب الاستئناف:
{appeal_grounds}

المراد الحصول عليه:
{relief_sought}

تحريرًا في: __________

المحامي المختار: __________
التوقيع: __________

---
⚠️ هذه مذكرة معدّة تلقائيًا — يجب مراجعتها وتعديلها من قبل المحامي المختص.`,
  },
  {
    id: 'tpl-cassation-01',
    type: 'cassation-memo',
    nameAr: 'مذكرة طعن بالنقض',
    nameEn: 'Cassation Appeal Memo',
    description: 'مذكرة طعن بالنقض أمام المحكمة الكبرى',
    category: 'جنائي',
    requiredLaws: ['قانون الإجراءات الجنائية 150/1950', 'قانون المرافعات المدنية 13/1968'],
    fields: [
      { key: 'cassation_court', labelAr: 'محكمة النقض', type: 'text', required: true },
      { key: 'case_number', labelAr: 'رقم القضية', type: 'text', required: true },
      { key: 'challenged_judgment', labelAr: 'الحكم المطعون فيه', type: 'textarea', required: true },
      { key: 'cassation_grounds', labelAr: 'أسباب النقض', type: 'textarea', required: true },
      { key: 'relief_sought', labelAr: 'المراد الحصول عليه', type: 'textarea', required: true },
    ],
    content: `بسم الله الرحمن الرحيم

إلى السيد رئيس {cassation_court}

الموضوع: طعن بالنقض في القضية رقم {case_number}

أarter the Article 418 من قانون الإجراءات الجنائية، أتقدم بالطعن على الحكم المطعون فيه:

الحكم المطعون فيه:
{challenged_judgment}

أسباب النقض:
{cassation_grounds}

المرادحصول عليه:
{relief_sought}

تحريرًا في: __________

المحامي المختار: __________
التوقيع: __________

---
⚠️ يجب تقديم هذا الطعن خلال 40 يومًا من تاريخ إعلان الحكم (المادة 418).`,
  },
  {
    id: 'tpl-release-01',
    type: 'release-request',
    nameAr: 'طلب إفراج مؤقت',
    nameEn: 'Temporary Release Request',
    description: 'طلب الإفراج عن المتهم مؤقتاً بكفالة',
    category: 'جنائي',
    requiredLaws: ['قانون الإجراءات الجنائية 150/1950'],
    fields: [
      { key: 'court_name', labelAr: 'اسم المحكمة', type: 'text', required: true },
      { key: 'case_number', labelAr: 'رقم القضية', type: 'text', required: true },
      { key: 'defendant_name', labelAr: 'اسم المتهم', type: 'text', required: true },
      { key: 'bail_amount', labelAr: 'مبلغ الكفالة', type: 'text', required: true },
      { key: 'justification', labelAr: 'مبرر الإفراج', type: 'textarea', required: true },
    ],
    content: `بسم الله الرحمن الرحيم

إلى السيد رئيس {court_name}

الموضوع: طلب الإفراج المؤقت عن المتهم {defendant_name}

في القضية رقم {case_number}

وفقًا للمادة 134 من قانون الإجراءات الجنائية، أطلب الإفراج عن المتهم {defendant_name} بكفالة مبلغ {bail_amount} جنيه مصري.

مبرر الطلب:
{justification}

تحريرًا في: __________

المحامي المختار: __________
التوقيع: __________`,
  },
  {
    id: 'tpl-civil-claim-01',
    type: 'civil-claim',
    nameAr: ' صحيفة دعوى مدنية',
    nameEn: 'Civil Lawsuit Statement',
    description: 'صحيفة دعوى مدنية أو تجارية',
    category: 'مدني',
    requiredLaws: ['قانون المرافعات المدنية 13/1968', 'القانون المدني 131/1948'],
    fields: [
      { key: 'court_name', labelAr: 'اسم المحكمة', type: 'text', required: true },
      { key: 'plaintiff_name', labelAr: 'اسم المدعي', type: 'text', required: true },
      { key: 'defendant_name', labelAr: 'اسم المدعى عليه', type: 'text', required: true },
      { key: 'claim_amount', labelAr: 'قيمة الدعوى', type: 'text', required: true },
      { key: 'claim_details', labelAr: 'تفاصيل الدعوى', type: 'textarea', required: true },
      { key: 'legal_basis', labelAr: 'الأساس القانوني', type: 'textarea', required: true },
    ],
    content: `بسم الله الرحمن الرحيم

إلى السيد رئيس {court_name}

الموضوع: صحيفة دعوى

المدعي: {plaintiff_name}
المدعى عليه: {defendant_name}

تفاصيل الدعوى:
{claim_details}

الأساس القانوني:
{legal_basis}

قيمة الدعوى: {claim_amount} جنيه مصري

المطلوب من المحكمة:
1. الحكم بالمبلغ المذكور
2. تحميل المدعى عليه المصروفات وال宓偿

تحريرًا في: __________

المحامي المختار: __________
التوقيع: __________`,
  },
  {
    id: 'tpl-contract-01',
    type: 'contract-template',
    nameAr: 'عقد وكالة تعسفي',
    nameEn: 'Power of Attorney Template',
    description: 'عقد وكالة تعسفي للمثول أمام المحاكم',
    category: ' عام',
    requiredLaws: ['القانون المدني 131/1948'],
    fields: [
      { key: 'principal_name', labelAr: 'اسم الموكل', type: 'text', required: true },
      { key: 'agent_name', labelAr: 'اسم الوكيل (المحامي)', type: 'text', required: true },
      { key: 'scope', labelAr: 'نطاق الوكالة', type: 'textarea', required: true },
      { key: 'duration', labelAr: 'مدة الوكالة', type: 'text', required: true },
    ],
    content: `بسم الله الرحمن الرحيم

عقد وكالة تعسفي

في協力 date __________

أنا الموقع أسفله {principal_name}، أُوكل بمقتضى هذا العقد {};
{agent_name} {scope}، وذلك لمدة {duration}.

وتكون للوكيل صلاحية المثول أمام المحاكم والنيابات والasaki jurisdictionseverything�related to.

تحريرًا في: __________

الموكل: {principal_name}
التوقيع: __________

الوكيل: {agent_name}
التوقيع: __________`,
  },
];

// ============================================================
// Document Generator
// ============================================================

export class DocumentGenerator {
  /**
   * Get all available templates.
   */
  getTemplates(): DocumentTemplate[] {
    return DOCUMENT_TEMPLATES;
  }

  /**
   * Get templates by category.
   */
  getTemplatesByCategory(category: string): DocumentTemplate[] {
    return DOCUMENT_TEMPLATES.filter((t) => t.category === category);
  }

  /**
   * Get a template by ID.
   */
  getTemplate(templateId: string): DocumentTemplate | undefined {
    return DOCUMENT_TEMPLATES.find((t) => t.id === templateId);
  }

  /**
   * Generate a document from template with provided fields.
   */
  generate(templateId: string, fields: Record<string, string>): GeneratedDocument | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    // Validate required fields
    for (const field of template.fields) {
      if (field.required && !fields[field.key]) {
        throw new Error(`الحقل المطلوب مفقود: ${field.labelAr}`);
      }
    }

    // Replace placeholders in template content
    let content = template.content;
    for (const [key, value] of Object.entries(fields)) {
      content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return {
      id: `doc-${Date.now()}`,
      type: template.type,
      title: template.nameAr,
      content,
      generatedAt: new Date().toISOString(),
      fields,
    };
  }

  /**
   * Generate and format as downloadable text.
   */
  generateAsText(templateId: string, fields: Record<string, string>): string | null {
    const doc = this.generate(templateId, fields);
    if (!doc) return null;
    return doc.content;
  }

  /**
   * Get categories of available templates.
   */
  getCategories(): string[] {
    return [...new Set(DOCUMENT_TEMPLATES.map((t) => t.category))];
  }
}

// Singleton
let generatorInstance: DocumentGenerator | null = null;

export function getDocumentGenerator(): DocumentGenerator {
  if (!generatorInstance) {
    generatorInstance = new DocumentGenerator();
  }
  return generatorInstance;
}
