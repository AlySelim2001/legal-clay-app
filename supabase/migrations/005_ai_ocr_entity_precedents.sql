-- ============================================================
-- CRIM-SYS 2026 — Migration 005: AI, OCR, Entity Resolution, Precedents
-- ============================================================

-- =================== legal_precedents ========================
CREATE TABLE public.legal_precedents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  court               text NOT NULL DEFAULT 'محكمة النقض المصرية',
  ruling_date         date NOT NULL,
  principle_summary   text NOT NULL,
  full_text           text,
  defense_category_id uuid REFERENCES public.defenses_catalog(id),
  crime_type          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_precedents_defense ON public.legal_precedents (defense_category_id);
CREATE INDEX idx_legal_precedents_crime ON public.legal_precedents (crime_type);
CREATE INDEX idx_legal_precedents_date ON public.legal_precedents (ruling_date DESC);
CREATE INDEX idx_legal_precedents_title_gin ON public.legal_precedents USING gin (to_tsvector('simple', title || ' ' || principle_summary));

ALTER TABLE public.legal_precedents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_legal_precedents"
  ON public.legal_precedents FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "assistant_select_legal_precedents"
  ON public.legal_precedents FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- =================== ocr_logs ================================
CREATE TABLE public.ocr_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id   uuid NOT NULL REFERENCES public.attachments(id),
  extracted_text  text NOT NULL,
  confidence_score numeric(5,2),
  processed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_logs_attachment ON public.ocr_logs (attachment_id);

ALTER TABLE public.ocr_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_ocr_logs"
  ON public.ocr_logs FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "assistant_crud_ocr_logs"
  ON public.ocr_logs FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- =================== entity_links ============================
CREATE TABLE public.entity_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_case_id  uuid NOT NULL REFERENCES public.cases(id),
  target_case_id  uuid NOT NULL REFERENCES public.cases(id),
  match_reason    text NOT NULL,
  confidence      numeric(5,2) DEFAULT 1.0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_case_id, target_case_id)
);

CREATE INDEX idx_entity_links_source ON public.entity_links (source_case_id);
CREATE INDEX idx_entity_links_target ON public.entity_links (target_case_id);

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_entity_links"
  ON public.entity_links FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "assistant_select_entity_links"
  ON public.entity_links FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- ============ RPC: SEARCH PRECEDENTS =========================
CREATE OR REPLACE FUNCTION public.search_precedents(
  p_defense_category_id uuid DEFAULT NULL,
  p_crime_type text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  court text,
  ruling_date date,
  principle_summary text,
  defense_name text,
  crime_type text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    lp.id, lp.title, lp.court, lp.ruling_date, lp.principle_summary,
    dc.name AS defense_name,
    lp.crime_type
  FROM public.legal_precedents lp
  LEFT JOIN public.defenses_catalog dc ON dc.id = lp.defense_category_id
  WHERE (p_defense_category_id IS NULL OR lp.defense_category_id = p_defense_category_id)
    AND (p_crime_type IS NULL OR lp.crime_type ILIKE '%' || p_crime_type || '%')
    AND (p_query IS NULL OR to_tsvector('simple', lp.title || ' ' || lp.principle_summary) @@ plainto_tsquery('simple', p_query))
  ORDER BY lp.ruling_date DESC
  LIMIT 20;
$$;

-- ============ RPC: SUGGEST PRECEDENTS FOR CASE ===============
CREATE OR REPLACE FUNCTION public.suggest_precedents(p_case_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  ruling_date date,
  principle_summary text,
  relevance_reason text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    lp.id, lp.title, lp.ruling_date, lp.principle_summary,
    CASE
      WHEN lp.defense_category_id = c.primary_defense_id THEN 'مطابق للدفاع الأساسي'
      WHEN lp.crime_type ILIKE '%' || c.tactical_classification || '%' THEN 'مطابق لنوع الجريمة'
      ELSE 'مرتبط عمومًا'
    END AS relevance_reason
  FROM public.legal_precedents lp
  JOIN public.cases c ON c.id = p_case_id
  WHERE lp.defense_category_id = c.primary_defense_id
     OR lp.crime_type ILIKE '%' || COALESCE(c.tactical_classification, '') || '%'
  ORDER BY
    CASE WHEN lp.defense_category_id = c.primary_defense_id THEN 0 ELSE 1 END,
    lp.ruling_date DESC
  LIMIT 10;
$$;

-- ============ RPC: FIND ENTITY LINKS FOR CLIENT ==============
CREATE OR REPLACE FUNCTION public.get_client_entity_links(p_client_id uuid)
RETURNS TABLE (
  source_case_code text,
  source_case_no text,
  target_case_code text,
  target_case_no text,
  match_reason text,
  target_court text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c1.case_code AS source_case_code, c1.case_no AS source_case_no,
    c2.case_code AS target_case_code, c2.case_no AS target_case_no,
    el.match_reason,
    c2.court_name AS target_court
  FROM public.entity_links el
  JOIN public.cases c1 ON c1.id = el.source_case_id
  JOIN public.cases c2 ON c2.id = el.target_case_id
  WHERE c1.client_id = p_client_id
     OR c2.client_id = p_client_id
  ORDER BY el.created_at DESC;
$$;

-- ============ RPC: AUTO-FIND DUPLICATE ENTITIES ==============
CREATE OR REPLACE FUNCTION public.find_duplicate_entities()
RETURNS TABLE (
  client_a_id uuid,
  client_a_name text,
  client_b_id uuid,
  client_b_name text,
  match_reason text
)
LANGUAGE sql
STABLE
AS $$
  -- Match by National ID
  SELECT
    c1.id, c1.full_name, c2.id, c2.full_name,
    'نفس الرقم القومي'::text
  FROM public.clients c1
  JOIN public.clients c2 ON c1.national_id = c2.national_id AND c1.id < c2.id

  UNION ALL

  -- Match by phone
  SELECT
    c1.id, c1.full_name, c2.id, c2.full_name,
    'نفس رقم الهاتف'::text
  FROM public.clients c1
  JOIN public.clients c2 ON c1.phone = c2.phone AND c1.id < c2.id AND c1.phone IS NOT NULL

  UNION ALL

  -- Match by full name (exact)
  SELECT
    c1.id, c1.full_name, c2.id, c2.full_name,
    'نفس الاسم الكامل'::text
  FROM public.clients c1
  JOIN public.clients c2 ON c1.full_name = c2.full_name AND c1.id < c2.id;
$$;

-- ============ RPC: EXTRACT OCR DATA ==========================
CREATE OR REPLACE FUNCTION public.process_ocr_result(
  p_attachment_id uuid,
  p_extracted_text text,
  p_confidence numeric
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  national_id_match text;
  case_no_match text;
  bail_amount_match text;
  judge_name_match text;
BEGIN
  -- Insert OCR log
  INSERT INTO public.ocr_logs (attachment_id, extracted_text, confidence_score)
  VALUES (p_attachment_id, p_extracted_text, p_confidence);

  -- Extract National ID (14 digits)
  SELECT regexp_match(p_extracted_text, '(\d{14})') INTO national_id_match;
  IF national_id_match IS NOT NULL THEN
    result := result || jsonb_build_object('national_id', national_id_match[1]);
  END IF;

  -- Extract Case No (patterns like: جنايات/1234/2026 or ج/2026/1234)
  SELECT regexp_match(p_extracted_text, '(جنايات|ج\/?\s*\d{4})\s*\/\s*(\d{1,5})\s*\/\s*(\d{4})') INTO case_no_match;
  IF case_no_match IS NOT NULL THEN
    result := result || jsonb_build_object('case_no', case_no_match[0]);
  END IF;

  -- Extract Bail Amount (numbers followed by ج.م or جنيهاً)
  SELECT regexp_match(p_extracted_text, '(\d[\d,\.]+)\s*(?:ج\.م|جنيهاً|جنيه)') INTO bail_amount_match;
  IF bail_amount_match IS NOT NULL THEN
    result := result || jsonb_build_object('bail_amount', REPLACE(bail_amount_match[1], ',', ''));
  END IF;

  -- Extract Judge Name (patterns like: المحكمه / أحمد فتحي)
  SELECT regexp_match(p_extracted_text, 'المحكم[هة]\s*/\s*([^\n\d]+)') INTO judge_name_match;
  IF judge_name_match IS NOT NULL THEN
    result := result || jsonb_build_object('judge_name', TRIM(judge_name_match[1]));
  END IF;

  RETURN result;
END;
$$;

-- ============ SEED: Sample Legal Precedents ===================
INSERT INTO public.legal_precedents (title, court, ruling_date, principle_summary, defense_category_id, crime_type) VALUES
  ('طعن رقم 1156 لسنة 2024 — بطلان الإجراءات الاستنادية',
   'محكمة النقض المصرية', '2024-06-15',
   'أكدت المحكمة أن بطلان الإجراءات الاستنادية يمتد إلى جميع الأفعال التي تمت بناءً عليها، وأن المحكمة ملزمة برفض أي دليل تم الحصول عليه بطريقة غير قانونية.',
   (SELECT id FROM public.defenses_catalog WHERE code = 'DF-01'), 'اختلاس'),

  ('طعن رقم 892 لسنة 2023 — عبء الإثبات على النيابة',
   'محكمة النقض المصرية', '2023-09-20',
   ' reverted that the burden of proof lies entirely with the prosecution, and the accused is presumed innocent until proven guilty beyond reasonable doubt.',
   (SELECT id FROM public.defenses_catalog WHERE code = 'DF-02'), 'تزوير'),

  ('جنايات 2024/3341 — الضرورة القصوى كمبرر',
   'محكمة جنايات القاهرة', '2024-03-10',
   'أكدت المحكمة أن الضرورة القصوى تُعد مبررًا قانونيًا للسلوك الإجرامي إذا توافرت شروطها القانونية الثلاثة: الخطر الوشيك، عدم إمكانية التفادى بوسيلة أخرى، وال比例 في رد الفعل.',
   (SELECT id FROM public.defenses_catalog WHERE code = 'DF-03'), 'شروع في القتل'),

  ('طعن رقم 201 لسنة 2025 — نقص الصلاحية',
   'محكمة النقض المصرية', '2025-01-25',
   'أفادت المحكمة أن نقص صلاحية الجهة المختصة يُعد دفعًا جوهريًا يجب أن تudiant المحكمة من تلقاء نفسها، ولا يجوز لجانب الدفاع التنازل عنه.',
   (SELECT id FROM public.defenses_catalog WHERE code = 'DF-04'), 'أخرى'),

  ('جنايات 2024/5567 — أدلة البراءة الدامغة',
   'محكمة جنايات الإسكندرية', '2024-08-05',
   'أكدت المحكمة أن وجود فيديو يثبت تواجد المتهم في مكان آخر وقت ارتكاب الجريمة يُعد دليلًا دامغًا للبراءة لا يقبل اعتراضًا.',
   (SELECT id FROM public.defenses_catalog WHERE code = 'DF-05'), 'سرقة'),

  ('طعن رقم 789 لسنة 2024 — تقادم الجريمة',
   'محكمة النقض المصرية', '2024-11-12',
   'أفادت المحكمة أن مرور مدة التقادم الثلاثي على الجريمة الجنحية يسقط الحق في مقاضاة المتهم، وليس للمحكمة quyền بحث ذلك من تلقاء نفسها إلا إذا ثبت لها من캇 التقادم.',
   (SELECT id FROM public.defenses_catalog WHERE code = 'DF-06'), 'جنحة');
