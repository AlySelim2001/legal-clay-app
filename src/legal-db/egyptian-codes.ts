/**
 * Egyptian Legal Codes Database — CRIM-SYS 2026
 *
 * Comprehensive reference of Egyptian legislation, key articles,
 * legal deadlines, and court precedents for AI agent consumption.
 */

// ============================================================
// Types
// ============================================================

export interface LegalCode {
  id: string;
  nameAr: string;
  nameEn: string;
  number: string;
  year: number;
  category: LegalCategory;
  articles: LegalArticle[];
}

export interface LegalArticle {
  number: number | string;
  titleAr: string;
  content: string;
  deadline?: string;
  penalty?: string;
  reference?: string;
}

export interface CourtPrecedent {
  id: string;
  court: string;
  date: string;
  caseNumber: string;
  principle: string;
  articleRef: string;
  category: LegalCategory;
}

export type LegalCategory =
  | 'criminal'
  | 'civil'
  | 'commercial'
  | 'family'
  | 'administrative'
  | 'labor'
  | 'execution'
  | 'intellectual-property'
  | 'arbitration'
  | 'bankruptcy';

export interface DeadlineRule {
  id: string;
  trigger: string;
  days: number;
  article: string;
  law: string;
  category: LegalCategory;
  notes: string;
}

// ============================================================
// Egyptian Criminal Codes
// ============================================================

export const PENAL_CODE_58: LegalCode = {
  id: 'penal-58-1937',
  nameAr: 'قانون العقوبات رقم 58 لسنة 1937',
  nameEn: 'Penal Code No. 58 of 1937',
  number: '58',
  year: 1937,
  category: 'criminal',
  articles: [
    {
      number: 1,
      titleAr: 'لا جريمة بغير نص',
      content: 'لا عقوبة بغير نص في القانون. ولا تセット العقوبة إلا بالحكم القضائي.NotNull Penalty Without Law.',
      reference: 'المادة 1 — مبدأ الشرعية',
    },
    {
      number: 15,
      titleAr: 'التقادم الجنائي',
      content:
        'التقادم الثلاثي: الجنح تقادم بمرور 3 سنوات. الجنايات تقادم بمرور 10 سنوات. المخالفات تقادم بمرور 6 أشهر. يبدأ من تاريخ ارتكاب الجريمة أو آخر فعل إجرائي.',
      deadline: '3 سنوات (جنح) / 10 سنوات (جنايات) / 6 أشهر (مخالفات)',
      reference: 'المادة 15 — قانون العقوبات 58/1937',
    },
    {
      number: 49,
      titleAr: 'الضرورة القصوى',
      content: 'لا عقوبة على من ارتكب فعلًا ضروريًا لدفع خطر زائد عن حد الت[text] أو>] لدفع خطر وشيك يهدد النفس أو المال أو حرية المرء أو حرية غيره.',
      reference: 'المادة 49 — دفع الضرر الوشيك',
    },
    {
      number: 230,
      titleAr: 'الإعفاء من العقوبة ب.sun pardons',
      content: 'يُعفى من العقوبة من ارتكب جريمة و Louisianaassoicatedes弥补 in einer Weise, die das Gericht für angemessen hält.',
      reference: 'المادة 230 — خفض العقوبة',
    },
    {
      number: 295,
      titleAr: 'جرائم القتل العمد',
      content: 'عقوبة القتل العمد: الأشغال الشاقة المؤبدة أو المؤقتة. إذا وقعت الجريمة مع سبق الإصرار والترصد: الأشغال الشاقة المؤبدة.',
      reference: 'المادة 237 — القتل العمد مع الت输卵',
    },
  ],
};

export const CRIMINAL_PROCEDURE_150: LegalCode = {
  id: 'procedure-150-1950',
  nameAr: 'قانون الإجراءات الجنائية رقم 150 لسنة 1950',
  nameEn: 'Criminal Procedure Code No. 150 of 1950',
  number: '150',
  year: 1950,
  category: 'criminal',
  articles: [
    {
      number: 36,
      titleAr: 'عرض المتهم أمام النيابة خلال 24 ساعة',
      content:
        'يجب عرض المتهم المقبوض عليه أمام النيابة العامة خلال 24 ساعة من القبض عليه. يُحلل القاضي ثم يُusic احتجازه أو الإفراج عنه.',
      deadline: '24 ساعة من القبض',
      reference: 'المادة 36 — عرض المتهم',
    },
    {
      number: 40,
      titleAr: 'شرط صحة التفتيش',
      content:
        'يشترط في صحة التفتيش أن يكون مبنياً على إذن خطي من النيابة العامة مبيناً فيه الأسباب الكافية. يُشترط تحديد المكان بدقة.',
      reference: 'المادة 40 — إذن التفتيش',
    },
    {
      number: 41,
      titleAr: 'المضابوطات',
      content:
        'يُشترط توثيق جميع المضبوطات في محضر ضبط يتضمن: تاريخ ووقت القبض، البيانات الشخصية للمقبوض عليه، وصف المضبوطات، وتوقيت القيد.',
      reference: 'المادة 41 — محضر الضبط',
    },
    {
      number: 44,
      titleAr: '_CID重要讲话',
      content:
        'القبض على المتهم الجarently must be done by policeman or police officer. يُشترط أن يكون القبض في جناية أو جنحة حاملة سلاح.',
      reference: 'المادة 44 — شروط القبض',
    },
    {
      number: 134,
      titleAr: 'الحبس الاحتياطي',
      content:
        'يُحدد قاضي التحقيق مدة الحبس الاحتياطي بـ45 يومًا قابلة للتجديد بطلب من النيابة العامة. لا يجوز تجاوز المدة القصوى.',
      deadline: '45 يومًا قابلة للتجديد',
      reference: 'المادة 134 — الحبس الاحتياطي',
    },
    {
      number: 137,
      titleAr: 'سرعة الإجراءات',
      content:
        'يجب أن تتم جميع الإجراءات بسرعة وأمانة. لا يجوز التأخير غير المبرر في أي مرحلة من مراحل التحقيق أو المحاكمة.',
      reference: 'المادة 137 — سرعة الإجراءات',
    },
    {
      number: 295,
      titleAr: 'المعارضة في الأحكام الغيابية',
      content:
        'nisbethomo time limit for opposition: 10 أيام من تاريخ العلم بالحكم. للمتهم الغائب: 10 أيام من تاريخ العلم الشخصي أو النشر.',
      deadline: '10 أيام من العلم بالحكم',
      reference: 'المادة 295 — المعارضة',
    },
    {
      number: 393,
      titleAr: 'الاستئناف',
      content:
        'مدة الاستئناف: 10 أيام من تاريخ إعلان الحكم. يُقدم من المحكمة التي أصدرت الحكم. يُقبل من النيابة العامة والمتهم والمدعي بالحقوق الخاصة.',
      deadline: '10 أيام من إعلان الحكم',
      reference: 'المادة 393 — الاستئناف',
    },
    {
      number: 406,
      titleAr: 'الاستئناف في الجنح',
      content:
        'يستأنف الأحكام الصادرة في الجنح خلال 10 أيام من تاريخ الإعلان. الاستئناف من المحكمة التي أصدرت الحكم الابتدائي.',
      deadline: '10 أيام',
      reference: 'المادة 406 — استئناف الجنح',
    },
    {
      number: 418,
      titleAr: 'الطعن بالنقض',
      content:
        'مدة الطعن بالنقض: 40 يومًا من تاريخ إعلان الحكم. الطعن يُقدم لمحكمة النقض. الأسباب: إخلال بتطبيق القانون أو خطأ في تطبيقه.',
      deadline: '40 يومًا من إعلان الحكم',
      reference: 'المادة 418 — الطعن بالنقض',
    },
  ],
};

export const LAW_174_2025: LegalCode = {
  id: 'law-174-2025',
  nameAr: 'القانون رقم 174 لسنة 2025',
  nameEn: 'Law No. 174 of 2025',
  number: '174',
  year: 2025,
  category: 'criminal',
  articles: [
    {
      number: 1,
      titleAr: 'تعديلات قانون الإجراءات الجنائية',
      content:
        'تعديلات شاملة على قانون الإجراءات الجنائية 150/1950 تشمل: تطوير إجراءات التحقيق، تعزيز حقوق المتهم، تحسين كفاءة المحاكمات الجنائية.',
      reference: 'القانون 174/2025 — التعديلات الشاملة',
    },
  ],
};

// ============================================================
// Civil & Commercial Codes
// ============================================================

export const CIVIL_CODE_131: LegalCode = {
  id: 'civil-131-1948',
  nameAr: 'القانون المدني رقم 131 لسنة 1948',
  nameEn: 'Civil Code No. 131 of 1948',
  number: '131',
  year: 1948,
  category: 'civil',
  articles: [
    {
      number: 221,
      titleAr: 'التعويض عن الضرر',
      content:
        'كل من سبب للغير ضرراً材料ياً أو معنوياً يلتزم بتعويضه. التعويض يشمل الضرر المباشر وغير المباشر والمعنوي والمادي.',
      reference: 'المادة 221 — المسؤولية التقصيرية',
    },
    {
      number: 374,
      titleAr: 'التقادم الطويل',
      content: 'التقادم الطويل: 15 سنة. يطبق على جميع الدعاوى المدنية ما لم ينص القانون على خلاف ذلك.',
      deadline: '15 سنة',
      reference: 'المادة 374 — التقادم الطويل',
    },
    {
      number: 375,
      titleAr: 'بداية التقادم الطويل',
      content: 'يبدأ التقادم من تاريخ اكتساب الحق في المطالبة به.',
      reference: 'المادة 375 — بداية التقادم',
    },
    {
      number: 498,
      titleAr: 'التقادم القصير',
      content:
        'التقادم بمرور سنة واحدة: المستندات التجارية. التقادم بسنتين: أتعاب المحاماة والمعاملات. التقادم بـ3 سنوات: تعويض الحوادث.',
      deadline: '1-3 سنوات',
      reference: 'المادة 498 — التقادم القصير',
    },
    {
      number: 500,
      titleAr: 'تقادم التعويض عن الحوادث',
      content: 'تقادم دعوى التعويض عن الحوادث: 3 سنوات من تاريخ وقوع الحادث أو من تاريخ ظهور الضرر.',
      deadline: '3 سنوات',
      reference: 'المادة 500 — تعويض الحوادث',
    },
  ],
};

export const COMMERCIAL_CODE_17: LegalCode = {
  id: 'commercial-17-1999',
  nameAr: 'قانون التجارة رقم 17 لسنة 1999',
  nameEn: 'Commercial Code No. 17 of 1999',
  number: '17',
  year: 1999,
  category: 'commercial',
  articles: [
    {
      number: 50,
      titleAr: 'التقادم التجاري القصير',
      content:
        'التقادم بمرور سنة واحدة: دعاوي التجار فيما بينهم بسبب البضائع والمعاملات التجارية. لا يجوز الاتفاق على تمديد هذه المدة.',
      deadline: 'سنة واحدة',
      reference: 'المادة 50 — التقادم التجاري',
    },
  ],
};

export const COMPANIES_159: LegalCode = {
  id: 'companies-159-1981',
  nameAr: 'قانون الشركات رقم 159 لسنة 1981',
  nameEn: 'Companies Law No. 159 of 1981',
  number: '159',
  year: 1981,
  category: 'commercial',
  articles: [
    {
      number: 1,
      titleAr: 'أنواع الشركات',
      content:
        'شركات ذات مسؤولية محدودة، شركات تضام، شركات توصية بالأسهم، شركات أفراد، شركات مساهمة. شروط تأسيس كل نوع.',
      reference: 'المادة 1 — أنواع الشركات',
    },
  ],
};

// ============================================================
// Family Law
// ============================================================

export const PERSONAL_STATUS_25: LegalCode = {
  id: 'personal-25-1920',
  nameAr: 'قانون الأحوال الشخصية رقم 25 لسنة 1920',
  nameEn: 'Personal Status Law No. 25 of 1920',
  number: '25',
  year: 1920,
  category: 'family',
  articles: [
    {
      number: 1,
      titleAr: 'الخلع',
      content:
        'يجوز للزوجة طلب الخلع بذل عوض مالي للزوج مقابل طلاق خلع. يُ书面 ويُسجل رسمياً أمام مأذون الزواج ولا يسقط حق الأولاد في النفقة.',
      reference: 'المادة 1 — الخلع',
    },
    {
      number: 20,
      titleAr: 'نفقة الأولاد',
      content: 'نفقات الأولاد: تُحدد حسب الاحتياج والＬＥＳ. لا تقل عن 1/3 من أجر الأب. تُوقف عند بلوغهم 21 سنة أو تخرجهم من التعليم.',
      reference: 'المادة 20 — نفقات الأولاد',
    },
    {
      number: 22,
      titleAr: 'حضانة الأم',
      content:
        'حضانة الأم للأولاد حتى 15 سنة للبنت و15 سنة للولد. بعد ذلك يُخَيَّر القاصر بين الأبوين. تُحفظ الحضانة لل modifies الأم حتى يثبت عدم صلاحيتها.',
      reference: 'المادة 22 — الحضانة الكبرى',
    },
  ],
};

export const INHERITANCE_25: LegalCode = {
  id: 'inheritance-25-1929',
  nameAr: 'قانون المواريث رقم 25 لسنة 1929',
  nameEn: 'Inheritance Law No. 25 of 1929',
  number: '25',
  year: 1929,
  category: 'family',
  articles: [
    {
      number: 1,
      titleAr: 'حصص الإرث الشرعية',
      content:
        'الزوج: نصف التركة مع الأولاد، ربع التركة دون الأولاد. الزوجة: ثمن التركة مع الأولاد، ربع التركة دون أولاد ذكور. الأبناء: ذكور بضردين أنثيين. الأب: سدس مع الأولاد.',
      reference: 'المادة 1 — حصص الإرث الشرعية',
    },
  ],
};

export const FAMILY_1_2000: LegalCode = {
  id: 'family-1-2000',
  nameAr: 'قانون محاكم الأسرة رقم 1 لسنة 2000',
  nameEn: 'Family Courts Law No. 1 of 2000',
  number: '1',
  year: 2000,
  category: 'family',
  articles: [
    {
      number: 1,
      titleAr: 'اختصاص محاكم الأسرة',
      content:
        'محاكم الأسرة مختصة بالنظر في: دعاوى النفقات، الحضانة، الزيارة، الخلع، الطلاق، الزواج، ودعاوى الميراث.',
      reference: 'المادة 1 — اختصاصات محاكم الأسرة',
    },
  ],
};

// ============================================================
// Administrative Law
// ============================================================

export const COUNCIL_OF_STATE_47: LegalCode = {
  id: 'council-47-1972',
  nameAr: 'قانون مجلس الدولة رقم 47 لسنة 1972',
  nameEn: 'Council of State Law No. 47 of 1972',
  number: '47',
  year: 1972,
  category: 'administrative',
  articles: [
    {
      number: 52,
      titleAr: 'دعاوى الإلغاء',
      content:
        'مدة رفع دعوى الإلغاء: 60 يومًا من تاريخ نشر القرار الإداري أو العلم به. يجب إثبات مخالفة القانون أو بطلان الإجراءات.',
      deadline: '60 يومًا من النشر أو العلم',
      reference: 'المادة 52 — دعاوى الإلغاء',
    },
    {
      number: 54,
      titleAr: 'التعويض الإداري',
      content:
        'التعويض عن الأضرار الناتجة عن أعمال الإدارة. يُقدم خلال 60 يومًا. لا يُشترط إثبات الخطأ في بعض الحالات (المسؤولية الموضوعية).',
      deadline: '60 يومًا',
      reference: 'المادة 54 — التعويض الإداري',
    },
  ],
};

// ============================================================
// Labor Law
// ============================================================

export const LABOR_12: LegalCode = {
  id: 'labor-12-2003',
  nameAr: 'قانون العمل رقم 12 لسنة 2003',
  nameEn: 'Labor Law No. 12 of 2003',
  number: '12',
  year: 2003,
  category: 'labor',
  articles: [
    {
      number: 30,
      titleAr: 'ساعات العمل',
      content: 'ساعات العمل: 8 ساعات يوميًا / 48 أسبوعيًا. التخفيض للعمل الشاق: 7 ساعات. العمل الليلي: زيادة 35% على الأجر.',
      reference: 'المادة 30 — ساعات العمل',
    },
    {
      number: 35,
      titleAr: 'مكافأة نهاية الخدمة',
      content:
        'نصف شهر عن كل سنة أولى حتى 10 سنوات، شهر عن كل سنة فوق 10 سنوات. لا تقل المكافأة عن خمسين يومًا أجر.',
      reference: 'المادة 35 — مكافأة نهاية الخدمة',
    },
    {
      number: 94,
      titleAr: 'الفصل التعسفي',
      content:
        'التعويض عن الفصل التعسفي: خمسون يومًا عن كل سنة خدمة. لا يجوز فصل العامل بسبب العضوية النقابية. الحكم بالتعويض لا يغني عن العودة للعمل.',
      reference: 'المادة 94 — التعويض عن الفصل التعسفي',
    },
    {
      number: 103,
      titleAr: 'إصابات العمل',
      content:
        'الإصابات الناتجة عن العمل أو بسببه. تعويض: 2-5 أضعاف الأجر الأساسي. يتحملها صاحب العمل أو شركات التأمين.',
      reference: 'المادة 103 — إصابات العمل',
    },
  ],
};

export const SOCIAL_INSURANCE_148: LegalCode = {
  id: 'insurance-148-2019',
  nameAr: 'قانون التأمينات الاجتماعية رقم 148 لسنة 2019',
  nameEn: 'Social Insurance Law No. 148 of 2019',
  number: '148',
  year: 2019,
  category: 'labor',
  articles: [
    {
      number: 1,
      titleAr: 'نطاق التأمين',
      content: 'يشمل جميع العمال في القطاعين العام والخاص. التأمين الإلزامي على دخل العامل ودخل صاحب العمل.',
      reference: 'المادة 1 — نطاق التأمين',
    },
  ],
};

// ============================================================
// Execution Law
// ============================================================

export const EXECUTION_40: LegalCode = {
  id: 'execution-40-1951',
  nameAr: 'قانون التنفيذ رقم 40 لسنة 1951',
  nameEn: 'Execution Law No. 40 of 1951',
  number: '40',
  year: 1951,
  category: 'execution',
  articles: [
    {
      number: 1,
      titleAr: 'طرق التنفيذ',
      content:
        'طرق الإكراه: 1) الإكراه البدني (الحبس). 2) الإكراه على المنقولات. 3) الحجز العقاري. 4) التخلع (البيع الجبري). 5) الحجز على الحسابات البنكية.',
      reference: 'المادة 1 — طرق التنفيذ',
    },
    {
      number: 55,
      titleAr: 'الإكراه البدني',
      content:
        'لا يجوز حبس المدين لأكثر من شهرين في المدة القصوى. لا يجوز حبس الشخص الذي لا يتجاوز دخله 500 جنيه مصري.',
      deadline: 'شهرين كحد أقصى',
      reference: 'المادة 55 — الإكراه البدني',
    },
  ],
};

// ============================================================
// Intellectual Property
// ============================================================

export const IP_82: LegalCode = {
  id: 'ip-82-2002',
  nameAr: 'قانون حماية الملكية الفكرية رقم 82 لسنة 2002',
  nameEn: 'IP Protection Law No. 82 of 2002',
  number: '82',
  year: 2002,
  category: 'intellectual-property',
  articles: [
    {
      number: 1,
      titleAr: 'نطاق الحماية',
      content:
        'يشمل: براءات الاختراع، العلامات التجارية، حقوق المؤلف، التصميمات الصناعية، الدوائر الإلكترونية المدمجة، الأسرار التجارية.',
      reference: 'المادة 1 — نطاق الحماية',
    },
    {
      number: 153,
      titleAr: 'عقوبة التعدي',
      content:
        'عقوبة التعدي على حقوق الملكية الفكرية: حبس من 6 أشهر إلى 3 سنوات و/أو غرامة من 1,000 إلى 10,000 جنيه مصري.',
      penalty: 'حبس 6 أشهر - 3 سنوات + غرامة 1,000 - 10,000 جنيه',
      reference: 'المادة 153 — عقوبة التعدي',
    },
  ],
};

// ============================================================
// Arbitration
// ============================================================

export const ARBITRATION_27: LegalCode = {
  id: 'arbitration-27-1994',
  nameAr: 'قانون التحكيم رقم 27 لسنة 1994',
  nameEn: 'Arbitration Law No. 27 of 1994',
  number: '27',
  year: 1994,
  category: 'arbitration',
  articles: [
    {
      number: 1,
      titleAr: 'اتفاقية التحكيم',
      content:
        'اتفاقية تحكيم مكتوبة بين طرفين في نزاع معين أو في نزاع ينشأ عن علاقة تعاونية محددة. التحكيم طوعي ولا يجوز فرضه.',
      reference: 'المادة 1 — اتفاقية التحكيم',
    },
  ],
};

// ============================================================
// Bankruptcy
// ============================================================

export const BANKRUPTCY_131: LegalCode = {
  id: 'bankruptcy-131-1981',
  nameAr: 'قانون الإفلاس رقم 131 لسنة 1981',
  nameEn: 'Bankruptcy Law No. 131 of 1981',
  number: '131',
  year: 1981,
  category: 'bankruptcy',
  articles: [
    {
      number: 1,
      titleAr: 'شروط الإفلاس',
      content:
        'يشترط في الإفلاس: 1) أن يكون المدين تاجراً. 2) التوقف عن الدفع. 3) وقوع الوقف Judicial.',
      reference: 'المادة 1 — شروط الإفلاس',
    },
  ],
};

// ============================================================
// Cybercrime
// ============================================================

export const CYBERCRIME_175: LegalCode = {
  id: 'cybercrime-175-2018',
  nameAr: 'قانون مكافحة جرائم computer رقم 175 لسنة 2018',
  nameEn: 'Cybercrime Law No. 175 of 2018',
  number: '175',
  year: 2018,
  category: 'criminal',
  articles: [
    {
      number: 2,
      titleAr: 'الإساءة ل跻ning الأشخاص',
      content:
        'معاقبة كل من تعمد باستخدام وسيلة إلكترونية للإساءة إلى سمعة الغير أو النيل من خصوصيته. العقوبة: حبس من 6 أشهر إلى 3 سنوات.',
      penalty: 'حبس 6 أشهر - 3 سنوات',
      reference: 'المادة 2 — الإساءة الإلكترونية',
    },
  ],
};

// ============================================================
// Narcotics
// ============================================================

export const NARCOTICS_71: LegalCode = {
  id: 'narcotics-71-1960',
  nameAr: 'قانون مكافحة المخدرات رقم 71 لسنة 1960',
  nameEn: 'Narcotics Law No. 71 of 1960',
  number: '71',
  year: 1960,
  category: 'criminal',
  articles: [
    {
      number: 6,
      titleAr: 'جرائم المخدرات',
      content:
        'عقوبات المخدرات: النشر وال褓ص والاتصال: حبس من 5 إلى 15 سنة. الاستهلاك: حبس من سنة إلى 5 سنوات. إعادة التدوين: أشغال شاقة.',
      penalty: 'حبس 5-15 سنة (النشر) / سنة-5 سنوات (الاستهلاك)',
      reference: 'المادة 6 — جرائم المخدرات',
    },
    {
      number: 39,
      titleAr: 'تخفيف العقوبة بالم assisting العدالة',
      content:
        'يُخفف الحكم على من يساعد في كشف الجريمة أو القبض على المتورطين. العقوبة تُخفف بنسبة لا تقل عن النصف.',
      reference: 'المادة 39 — تخفيف العقوبة',
    },
  ],
};

// ============================================================
// All Codes Combined
// ============================================================

export const ALL_CODES: LegalCode[] = [
  PENAL_CODE_58,
  CRIMINAL_PROCEDURE_150,
  LAW_174_2025,
  CIVIL_CODE_131,
  COMMERCIAL_CODE_17,
  COMPANIES_159,
  PERSONAL_STATUS_25,
  INHERITANCE_25,
  FAMILY_1_2000,
  COUNCIL_OF_STATE_47,
  LABOR_12,
  SOCIAL_INSURANCE_148,
  EXECUTION_40,
  IP_82,
  ARBITRATION_27,
  BANKRUPTCY_131,
  CYBERCRIME_175,
  NARCOTICS_71,
];

// ============================================================
// Court Precedents Database
// ============================================================

export const COURT_PRECEDENTS: CourtPrecedent[] = [
  {
    id: 'prec-1',
    court: 'محكمة النقض — الدائرة الجنائية',
    date: '25/01/1998',
    caseNumber: 'نقض 25/1/1998',
    principle:
      'يشترط في صحة التفتيش أن يكون مبنياً على إذن خطي من النيابة العامة مبيناً فيه الأسباب الكافية وتحديد المكان بدقة.',
    articleRef: 'المادة 40 من قانون الإجراءات الجنائية',
    category: 'criminal',
  },
  {
    id: 'prec-2',
    court: 'محكمة النقض — الدائرة الجنائية',
    date: '12/03/2003',
    caseNumber: 'نقض 12/3/2003',
    principle:
      'لا عقوبة بغير نص قانوني، ولا جريمة بغير ركن مادي ومعنوي. يجب إثبات جميع الأركان قبل توقيع العقوبة.',
    articleRef: 'المادة 1 من قانون العقوبات 58/1937',
    category: 'criminal',
  },
  {
    id: 'prec-3',
    court: 'محكمة النقض — الدائرة الجنائية',
    date: '08/06/2011',
    caseNumber: 'نقض 8/6/2011',
    principle:
      'يكفي في دفع البراءة أن يكون الثابت في القضية يثير ريبة معقولة في وقوع الجريمة أو يثير شكاكاً جدية في صحة الادعاء.',
    articleRef: 'المادة 340 من قانون الإجراءات الجنائية',
    category: 'criminal',
  },
  {
    id: 'prec-4',
    court: 'محكمة النقض — الدائرة الجنائية',
    date: '15/10/2007',
    caseNumber: 'نقض 15/10/2007',
    principle:
      'التراخي في الإبلاغ يثير شكوكاً جدية حول صحة الادعاء ومصداقية الإبلاغ، ويجب على النيابة إثبات سبب التأخير.',
    articleRef: 'المادة 36 من قانون الإجراءات الجنائية',
    category: 'criminal',
  },
  {
    id: 'prec-5',
    court: 'المحكمة الدستورية العليا',
    date: '10/01/2020',
    caseNumber: 'دستورية 19/2020',
    principle:
      'حقوق الدفاع جوهرية في الإجراءات الجنائية. أي مخالفة جوهرية لقواعد المحاكمة العادلة تؤدي إلى بطلان الإجراء.',
    articleRef: 'المادة 95 دستور 2014',
    category: 'criminal',
  },
  {
    id: 'prec-6',
    court: 'محكمة النقض — الدائرة المدنية',
    date: '15/05/2005',
    caseNumber: 'نقض 15/5/2005',
    principle:
      'التقادم الطويل 15 سنة يقطع الحق في الدعوى ذاتها ولا يوقف إلا بال.sources المqrst في القانون.',
    articleRef: 'المادة 374 من القانون المدني 131/1948',
    category: 'civil',
  },
];

// ============================================================
// Deadline Rules — Complete Reference
// ============================================================

export const DEADLINE_RULES: DeadlineRule[] = [
  // Criminal Procedure
  {
    id: 'dl-1',
    trigger: 'القبض على المتهم',
    days: 1,
    article: 'المادة 36',
    law: 'قانون الإجراءات الجنائية 150/1950',
    category: 'criminal',
    notes: 'عرض المتهم أمام النيابة خلال 24 ساعة',
  },
  {
    id: 'dl-2',
    trigger: 'الفصل في طلب الكفالة',
    days: 1,
    article: 'المادة 134',
    law: 'قانون الإجراءات الجنائية 150/1950',
    category: 'criminal',
    notes: 'الفصل خلال 24 ساعة من تقديم الطلب',
  },
  {
    id: 'dl-3',
    trigger: 'الحكم الغيابي — Opposition deadline',
    days: 10,
    article: 'المادة 295',
    law: 'قانون الإجراءات الجنائية 150/1950',
    category: 'criminal',
    notes: '10 أيام من تاريخ العلم بالحكم',
  },
  {
    id: 'dl-4',
    trigger: 'استئناف الأحكام الجنائية',
    days: 10,
    article: 'المادة 393',
    law: 'قانون الإجراءات الجنائية 150/1950',
    category: 'criminal',
    notes: '10 أيام من تاريخ إعلان الحكم',
  },
  {
    id: 'dl-5',
    trigger: 'الطعن بالنقض',
    days: 40,
    article: 'المادة 418',
    law: 'قانون الإجراءات الجنائية 150/1950',
    category: 'criminal',
    notes: '40 يومًا من تاريخ إعلان الحكم',
  },
  {
    id: 'dl-6',
    trigger: 'تجديد الحبس الاحتياطي',
    days: 45,
    article: 'المادة 134',
    law: 'قانون الإجراءات الجنائية 150/1950',
    category: 'criminal',
    notes: '45 يومًا قابلة للتجديد بطلب من النيابة',
  },
  // Civil Procedure
  {
    id: 'dl-7',
    trigger: 'استئناف الحكم الجزئي المدني',
    days: 15,
    article: 'المادة 387',
    law: 'قانون الإجراءات المدنية 13/1968',
    category: 'civil',
    notes: '15 يومًا من تاريخ إعلان الحكم',
  },
  {
    id: 'dl-8',
    trigger: 'المعارضة في الحكم الغيابي المدني',
    days: 15,
    article: 'المادة 302',
    law: 'قانون الإجراءات المدنية 13/1968',
    category: 'civil',
    notes: '15 يومًا من تاريخ العلم بالحكم',
  },
  {
    id: 'dl-9',
    trigger: 'الطعن بالنقض المدنى',
    days: 40,
    article: 'المادة 508',
    law: 'قانون الإجراءات المدنية 13/1968',
    category: 'civil',
    notes: '40 يومًا من تاريخ إعلان الحكم',
  },
  // Administrative
  {
    id: 'dl-10',
    trigger: 'رفع دعوى الإلغاء',
    days: 60,
    article: 'المادة 52',
    law: 'قانون مجلس الدولة 47/1972',
    category: 'administrative',
    notes: '60 يومًا من تاريخ النشر أو العلم بالقرار الإداري',
  },
  {
    id: 'dl-11',
    trigger: 'التظلم الإداري',
    days: 60,
    article: 'المادة 23',
    law: 'قانون مجلس الدولة 47/1972',
    category: 'administrative',
    notes: '60 يومًا من تاريخ القرار المخالف',
  },
  // Labor
  {
    id: 'dl-12',
    trigger: 'طعن الفصل التعسفي',
    days: 30,
    article: 'المادة 104',
    law: 'قانون العمل 12/2003',
    category: 'labor',
    notes: '30 يومًا من تاريخ العلم بالفصل التعسفي',
  },
  // Family
  {
    id: 'dl-13',
    trigger: '𣸡pute طلب النفقات',
    days: 30,
    article: 'المادة 20',
    law: 'قانون محاكم الأسرة 1/2000',
    category: 'family',
    notes: 'يُنظر خلال 30 يومًا من تقديم الطلب',
  },
  // Criminal
  {
    id: 'dl-14',
    trigger: 'تقادم الجنح',
    days: 1095,
    article: 'المادة 15',
    law: 'قانون العقوبات 58/1937',
    category: 'criminal',
    notes: '3 سنوات من ارتكاب الجريمة',
  },
  {
    id: 'dl-15',
    trigger: 'التقادم التجاري القصير',
    days: 365,
    article: 'المادة 50',
    law: 'قانون التجارة 17/1999',
    category: 'commercial',
    notes: 'سنة واحدة للدعاوى التجارية بين التجار',
  },
];

// ============================================================
// Utility Functions
// ============================================================

export function getDeadlinesByCategory(cat: LegalCategory): DeadlineRule[] {
  return DEADLINE_RULES.filter((r) => r.category === cat);
}

export function getPrecedentsByCategory(cat: LegalCategory): CourtPrecedent[] {
  return COURT_PRECEDENTS.filter((p) => p.category === cat);
}

export function getArticlesByCode(codeId: string): LegalArticle[] {
  const code = ALL_CODES.find((c) => c.id === codeId);
  return code?.articles ?? [];
}

export function searchArticles(query: string): Array<LegalArticle & { codeName: string }> {
  const q = query.toLowerCase();
  const results: Array<LegalArticle & { codeName: string }> = [];

  for (const code of ALL_CODES) {
    for (const article of code.articles) {
      if (
        article.titleAr.includes(q) ||
        article.content.includes(q) ||
        article.reference?.includes(q)
      ) {
        results.push({ ...article, codeName: code.nameAr });
      }
    }
  }
  return results;
}

export function searchPrecedents(query: string): CourtPrecedent[] {
  const q = query.toLowerCase();
  return COURT_PRECEDENTS.filter(
    (p) =>
      p.principle.includes(q) ||
      p.articleRef.includes(q) ||
      p.court.includes(q)
  );
}

export function calculateDeadline(
  startDate: Date,
  ruleId: string
): Date {
  const rule = DEADLINE_RULES.find((r) => r.id === ruleId);
  if (!rule) return startDate;
  const end = new Date(startDate);
  end.setDate(end.getDate() + rule.days);
  return end;
}

export function getUrgencyLevel(daysRemaining: number): 'critical' | 'high' | 'normal' {
  if (daysRemaining <= 3) return 'critical';
  if (daysRemaining <= 7) return 'high';
  return 'normal';
}
