/**
 * LAW-SYS Gateway — Egyptian Legal Reference System
 *
 * Provides structured access to Egyptian legal codes,
 * Official Gazette parsing, and precedent lookup.
 * All data is locally cached for offline use.
 */

export interface LegalCode {
  id: string;
  category: 'criminal' | 'civil' | 'family' | 'administrative' | 'labor';
  codeNumber: string;
  codeName: string;
  codeNameAr: string;
  year: number;
  articles: LegalArticle[];
}

export interface LegalArticle {
  articleNumber: string;
  title: string;
  titleAr: string;
  content: string;
  amendments?: string[];
}

export interface CourtPrecedent {
  id: string;
  court: string;
  courtAr: string;
  chamber: string;
  chamberAr: string;
  rulingDate: string;
  caseNumber: string;
  principleSummary: string;
  principleSummaryAr: string;
  defenseCategory?: string;
}

// ============================================================
// Egyptian Legal Codes Database (Cached Locally)
// ============================================================
export const EGYPTIAN_LEGAL_CODES: LegalCode[] = [
  {
    id: 'crim-proc-150',
    category: 'criminal',
    codeNumber: '150',
    codeName: 'Criminal Procedure Law',
    codeNameAr: 'قانون الإجراءات الجنائية',
    year: 1950,
    articles: [
      {
        articleNumber: '15',
        title: 'Misdemeanor Prescription',
        titleAr: 'التقادم الثلاثي في الجنح',
        content: 'يُ才算 جنحة جنائية بمضي ثلاث سنوات من تاريخ ارتكابها أو من تاريخ آخر إجراء إصلاحي.',
      },
      {
        articleNumber: '36',
        title: 'Presentation to Prosecution',
        titleAr: 'عرض المتهم على النيابة',
        content: 'يجب عرض القبض عليه على النيابة العامة خلال أربع وعشرين ساعة من تاريخ القبض.',
      },
      {
        articleNumber: '40',
        title: 'Search Warrant',
        titleAr: 'إذن التفتيش',
        content: 'لا يجوز التفتيش إلا بorder من النيابة العامة أو قاضي التحقيق.',
      },
      {
        articleNumber: '41',
        title: 'Seizure Documentation',
        titleAr: 'توثيق المضبوطات',
        content: 'يجب توثيق جميع المضبوطات في محضر رسمي مع تسمية الأفراد والأوقات.',
      },
      {
        articleNumber: '44',
        title: 'Arrest Procedures',
        titleAr: 'إجراءات القبض',
        content: 'يشترط في صحة القبض أن يكون بإذن من النيابة العامة ما لم يكن في حالة تلبس.',
      },
      {
        articleNumber: '137',
        title: 'Evidence Standards',
        titleAr: 'معايير الأدلة',
        content: 'لا يجوز إدانة المتهم بناءً على اعترافه وحده دون corroborating evidence.',
      },
      {
        articleNumber: '295',
        title: 'Opposition Period',
        titleAr: 'مدة المعارضة',
        content: 'Deadline for opposition is 10 days from notification.',
      },
      {
        articleNumber: '297',
        title: 'Extended Opposition',
        titleAr: 'المعارضة الممتدة',
        content: 'Additional 5 days for co-defendants (force majeure).',
      },
      {
        articleNumber: '406',
        title: 'Appeal Period',
        titleAr: 'مدة الاستئناف',
        content: 'Deadline for appeal is 10 days from notification.',
      },
    ],
  },
  {
    id: 'civil-code-131',
    category: 'civil',
    codeNumber: '131',
    codeName: 'Civil Code',
    codeNameAr: 'القانون المدني',
    year: 1948,
    articles: [
      {
        articleNumber: '374',
        title: 'Long Prescription',
        titleAr: 'التقادم الطويل',
        content: 'تتقادم الدعاوى بخمس عشرة سنة إلا ما نص القانون على غير ذلك.',
      },
    ],
  },
  {
    id: 'admin-law-47',
    category: 'administrative',
    codeNumber: '47',
    codeName: 'State Council Law',
    codeNameAr: 'قانون مجلس الدولة',
    year: 1972,
    articles: [
      {
        articleNumber: '17',
        title: 'Cancellation Lawsuit',
        titleAr: 'دعاوى الإلغاء',
        content: 'term for cancellation lawsuit is 60 days from publication or knowledge.',
      },
    ],
  },
];

// ============================================================
// Local Cache for Offline Access
// ============================================================
const CACHE_KEY = 'law-sys-legal-codes';
const PRECEDENT_CACHE_KEY = 'law-sys-precedents';

function getLocalCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full — silently fail
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Get all legal codes, using local cache when offline.
 */
export function getLegalCodes(category?: string): LegalCode[] {
  const cached = getLocalCache<LegalCode[]>(CACHE_KEY);
  const codes = cached ?? EGYPTIAN_LEGAL_CODES;

  if (category) {
    return codes.filter((c) => c.category === category);
  }
  return codes;
}

/**
 * Find a specific article by code and article number.
 */
export function findArticle(
  codeId: string,
  articleNumber: string,
): LegalArticle | undefined {
  const codes = getLegalCodes();
  const code = codes.find((c) => c.id === codeId);
  return code?.articles.find((a) => a.articleNumber === articleNumber);
}

/**
 * Full-text search across all legal articles.
 */
export function searchLegalText(query: string): LegalArticle[] {
  const codes = getLegalCodes();
  const results: LegalArticle[] = [];
  const lower = query.toLowerCase();

  for (const code of codes) {
    for (const article of code.articles) {
      if (
        article.title.toLowerCase().includes(lower) ||
        article.titleAr.includes(query) ||
        article.content.toLowerCase().includes(lower)
      ) {
        results.push(article);
      }
    }
  }
  return results;
}

/**
 * Get precedents filtered by defense category.
 */
export function getPrecedents(defenseCategory?: string): CourtPrecedent[] {
  const cached = getLocalCache<CourtPrecedent[]>(PRECEDENT_CACHE_KEY) ?? [];
  if (defenseCategory) {
    return cached.filter((p) => p.defenseCategory === defenseCategory);
  }
  return cached;
}

/**
 * Initialize local cache from seed data.
 */
export function initializeLegalCache(): void {
  setLocalCache(CACHE_KEY, EGYPTIAN_LEGAL_CODES);
}
