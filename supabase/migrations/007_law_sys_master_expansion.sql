-- ============================================================
-- LAW-SYS 2026 Master — Multi-Disciplinary Legal Expansion
-- Migration 007: Legal codes master, court precedents extended,
-- expanded deadline reference data
-- ============================================================

-- ---- 1. Legal Codes Master ----
CREATE TABLE IF NOT EXISTS legal_codes_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_number text NOT NULL,                   -- e.g. '150/1950'
  code_name text NOT NULL,                     -- e.g. 'قانون الإجراءات الجنائية'
  full_name text NOT NULL,                     -- full official name
  discipline text NOT NULL CHECK (discipline IN (
    'جنائي', 'مدني', 'تجاري', 'أحوال شخصية', 'إداري', 'عمل', 'أخرى'
  )),
  effective_date date,
  amendment_notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_codes_discipline ON legal_codes_master(discipline);
CREATE INDEX IF NOT EXISTS idx_legal_codes_active ON legal_codes_master(is_active);

COMMENT ON TABLE legal_codes_master IS 'Master catalog of Egyptian legal codes across all disciplines';

-- ---- 2. Legal Code Articles ----
CREATE TABLE IF NOT EXISTS legal_code_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES legal_codes_master(id) ON DELETE CASCADE,
  article_number text NOT NULL,                -- e.g. '15', '295', '134'
  title text,
  content text NOT NULL,                       -- full article text in Arabic
  chapter text,
  section text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_articles_code ON legal_code_articles(code_id);
CREATE INDEX IF NOT EXISTS idx_code_articles_number ON legal_code_articles(article_number);

-- ---- 3. Court Precedents Extended ----
CREATE TABLE IF NOT EXISTS court_precedents_extended (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  court_name text NOT NULL,                    -- e.g. 'محكمة النقض', 'المحكمة الإدارية العليا'
  chamber text CHECK (chamber IN (
    'الدائرة الجنائية', 'الدائرة المدنية', 'الأحوال الشخصية',
    'الدائرة التجارية', 'الدائرة الإدارية', 'المحكمة الإدارية العليا',
    'الدوائر المنظمة', 'أخرى'
  )),
  ruling_number text,
  ruling_date date NOT NULL,
  principle_summary text NOT NULL,
  full_text text,
  discipline text NOT NULL CHECK (discipline IN (
    'جنائي', 'مدني', 'تجاري', 'أحوال شخصية', 'إداري', 'عمل', 'أخرى'
  )),
  defense_category_id uuid REFERENCES defenses_catalog(id),
  crime_type text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_precedents_extended_court ON court_precedents_extended(court_name);
CREATE INDEX IF NOT EXISTS idx_precedents_extended_chamber ON court_precedents_extended(chamber);
CREATE INDEX IF NOT EXISTS idx_precedents_extended_discipline ON court_precedents_extended(discipline);
CREATE INDEX IF NOT EXISTS idx_precedents_extended_date ON court_precedents_extended(ruling_date);
CREATE INDEX IF NOT EXISTS idx_precedents_extended_tags ON court_precedents_extended USING GIN(tags);

-- ---- 4. Agent Knowledge Base ----
CREATE TABLE IF NOT EXISTS agent_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type text NOT NULL CHECK (agent_type IN (
    'criminal', 'civil', 'family', 'administrative', 'labor'
  )),
  topic text NOT NULL,
  keywords text[] DEFAULT '{}',
  content text NOT NULL,
  legal_basis text,                            -- e.g. 'المادة 15 من قانون العقوبات 58/1937'
  discipline text NOT NULL CHECK (discipline IN (
    'جنائي', 'مدني', 'تجاري', 'أحوال شخصية', 'إداري', 'عمل', 'أخرى'
  )),
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_kb_type ON agent_knowledge_base(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_kb_keywords ON agent_knowledge_base USING GIN(keywords);

-- ---- 5. RLS Policies ----

-- legal_codes_master: admin full, assistant read-only
ALTER TABLE legal_codes_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_legal_codes" ON legal_codes_master
  FOR ALL USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

CREATE POLICY "assistant_read_legal_codes" ON legal_codes_master
  FOR SELECT USING (true);

-- legal_code_articles: admin full, assistant read-only
ALTER TABLE legal_code_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_code_articles" ON legal_code_articles
  FOR ALL USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

CREATE POLICY "assistant_read_code_articles" ON legal_code_articles
  FOR SELECT USING (true);

-- court_precedents_extended: admin full, assistant read-only
ALTER TABLE court_precedents_extended ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_precedents_ext" ON court_precedents_extended
  FOR ALL USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

CREATE POLICY "assistant_read_precedents_ext" ON court_precedents_extended
  FOR SELECT USING (true);

-- agent_knowledge_base: admin full, assistant read-only
ALTER TABLE agent_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_agent_kb" ON agent_knowledge_base
  FOR ALL USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );

CREATE POLICY "assistant_read_agent_kb" ON agent_knowledge_base
  FOR SELECT USING (true);

-- ---- 6. Seed: Legal Codes Master ----
INSERT INTO legal_codes_master (code_number, code_name, full_name, discipline, effective_date) VALUES
  ('150/1950', 'قانون الإجراءات الجنائية', 'قانون الإجراءات الجنائية رقم 150 لسنة 1950 وتعديلاته', 'جنائي', '1950-07-22'),
  ('58/1937', 'قانون العقوبات', 'قانون العقوبات رقم 58 لسنة 1937 وتعديلاته', 'جنائي', '1937-03-15'),
  ('174/2025', 'قانون استئناف الحكم الغيابي', 'قانون رقم 174 لسنة 2025 بشأن استئناف الحكم الغيابي في الجنح', 'جنائي', '2025-01-01'),
  ('131/1948', 'القانون المدني', 'القانون المدني رقم 131 لسنة 1948 وتعديلاته', 'مدني', '1948-10-15'),
  ('13/1968', 'قانون المرافعات المدنية والتجارية', 'قانون المرافعات المدنية والتجارية رقم 13 لسنة 1968', 'مدني', '1968-06-01'),
  ('17/1999', 'قانون التجارة', 'قانون التجارة رقم 17 لسنة 1999 وتعديلاته', 'تجاري', '1999-10-01'),
  ('25/1920', 'قانون الأحوال الشخصية', 'قانون الأحوال الشخصية رقم 25 لسنة 1920', 'أحوال شخصية', '1920-01-29'),
  ('25/1929', 'قانون الإرث', 'قانون الإرث رقم 25 لسنة 1929', 'أحوال شخصية', '1929-06-22'),
  ('1/2000', 'قانون الأسرة', 'قانون الأحوال الشخصية للمسيحيين رقم 1 لسنة 2000', 'أحوال شخصية', '2000-10-01'),
  ('47/1972', 'قانون مجلس الدولة', 'قانون تنظيم مجلس الدولة رقم 47 لسنة 1972 وتعديلاته', 'إداري', '1972-07-01'),
  ('12/2003', 'قانون العمل', 'قانون العمل رقم 12 لسنة 2003 وتعديلاته', 'عمل', '2003-03-01'),
  ('148/2019', 'قانون التأمينات الاجتماعية', 'قانون التأمينات الاجتماعية والمعاشات رقم 148 لسنة 2019', 'عمل', '2019-12-01')
ON CONFLICT DO NOTHING;

-- ---- 7. Seed: Legal Deadlines for All Disciplines ----
INSERT INTO legal_deadlines_reference (code, procedure_name, duration_value, duration_unit, legal_basis, editable_by_role) VALUES
  -- Criminal (existing + expanded)
  ('DL-09', 'جواز الطعن بالنقض في الأحكام الجنائية', 40, 'يوم', 'المادة 418 من قانون الإجراءات الجنائية 150/1950', 'admin'),
  ('DL-10', 'مدة الحبس الاحتياطي القصوى', 45, 'يوم', 'المادة 134 من قانون الإجراءات الجنائية 150/1950', 'admin'),
  -- Civil
  ('DL-11', 'الميعاد القانوني للاستئناف في الأحكام الصادرة من المحكمة الابتدائية', 40, 'يوم', 'المادة 40 من قانون المرافعات المدنية والتجارية 13/1968', 'admin'),
  ('DL-12', 'الميعاد القانوني للاستئناف في الأحكام الصادرة في الدعاوى المستعجلة', 15, 'يوم', 'المادة 44 من قانون المرافعات المدنية والتجارية 13/1968', 'admin'),
  ('DL-13', 'التقادم الطويل في الدعاوى المدنية', NULL, NULL, 'المادة 375 من القانون المدني 131/1948', 'admin'),
  ('DL-14', 'التقادم القصير في الدعاوى التجارية', NULL, NULL, 'المادة 501 من القانون المدني 131/1948', 'admin'),
  ('DL-15', 'موعد رفع دعوى الت荐يع (التعويض)', 3, 'سنة', 'المادة 357 من القانون المدني 131/1948', 'admin'),
  -- Administrative
  ('DL-16', 'موعد رفع دعوى الإلغاء', 60, 'يوم', 'المادة 52 من قانون مجلس الدولة 47/1972', 'admin'),
  ('DL-17', 'موعد تقديم الطعن الإداري', 30, 'يوم', 'المادة 23 من قانون مجلس الدولة 47/1972', 'admin'),
  -- Family
  ('DL-18', 'مدة الاستئناف في أحكام الأحوال الشخصية', 40, 'يوم', 'المادة 24 من قانون المرافعات المدنية والتجارية 13/1968', 'admin'),
  ('DL-19', 'موعد تقديم دعوى تغيير النظير', NULL, NULL, 'القانون 25/1920 وقانون 1/2000', 'admin'),
  -- Labor
  ('DL-20', 'موعد تقديم دعوى التعويض عن الفصل التعسفي', 1, 'سنة', 'المادة 94 من قانون العمل 12/2003', 'admin'),
  ('DL-21', 'الميعاد القانوني للاستئناف في أحكام مجامع الفصل في منازعات العمل', 45, 'يوم', 'المادة 90 من قانون العمل 12/2003', 'admin'),
  ('DL-22', 'موعد الطعن النقضي في أحكام الج对面 العمل', NULL, NULL, 'المادة 90 من قانون العمل 12/2003', 'admin')
ON CONFLICT DO NOTHING;

-- ---- 8. RPC: Unified Search Across Disciplines ----
CREATE OR REPLACE FUNCTION search_all_precedents(
  p_discipline text DEFAULT NULL,
  p_chamber text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  court_name text,
  chamber text,
  ruling_date date,
  principle_summary text,
  discipline text
) AS $$
BEGIN
  RETURN QUERY
  SELECT cpe.id, cpe.title, cpe.court_name, cpe.chamber,
         cpe.ruling_date, cpe.principle_summary, cpe.discipline
  FROM court_precedents_extended cpe
  WHERE (p_discipline IS NULL OR cpe.discipline = p_discipline)
    AND (p_chamber IS NULL OR cpe.chamber = p_chamber)
    AND (p_query IS NULL OR cpe.title ILIKE '%' || p_query || '%'
         OR cpe.principle_summary ILIKE '%' || p_query || '%')
  ORDER BY cpe.ruling_date DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- 9. RPC: Search Legal Code Articles ----
CREATE OR REPLACE FUNCTION search_legal_articles(
  p_code_id uuid DEFAULT NULL,
  p_article_number text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  code_id uuid,
  article_number text,
  title text,
  content text,
  discipline text
) AS $$
BEGIN
  RETURN QUERY
  SELECT lca.id, lca.code_id, lca.article_number, lca.title, lca.content,
         lcm.discipline
  FROM legal_code_articles lca
  JOIN legal_codes_master lcm ON lcm.id = lca.code_id
  WHERE (p_code_id IS NULL OR lca.code_id = p_code_id)
    AND (p_article_number IS NULL OR lca.article_number = p_article_number)
    AND (p_query IS NULL OR lca.content ILIKE '%' || p_query || '%'
         OR lca.title ILIKE '%' || p_query || '%')
  ORDER BY lca.article_number
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- 10. RPC: Extended Deadline Calculator ----
CREATE OR REPLACE FUNCTION compute_deadline_extended(
  start_date date,
  deadline_code text
)
RETURNS TABLE (
  deadline_date date,
  procedure_name text,
  legal_basis text,
  duration_value integer,
  duration_unit text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN ldr.duration_value IS NULL THEN NULL
      WHEN ldr.duration_unit = 'يوم' THEN start_date + (ldr.duration_value || ' days')::interval
      WHEN ldr.duration_unit = 'شهر' THEN start_date + (ldr.duration_value || ' months')::interval
      WHEN ldr.duration_unit = 'سنة' THEN start_date + (ldr.duration_value || ' years')::interval
      ELSE NULL
    END AS deadline_date,
    ldr.procedure_name,
    ldr.legal_basis,
    ldr.duration_value,
    ldr.duration_unit
  FROM legal_deadlines_reference ldr
  WHERE ldr.code = deadline_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---- 11. RPC: Get Agent Knowledge Base ----
CREATE OR REPLACE FUNCTION get_agent_knowledge(p_agent_type text)
RETURNS TABLE (
  id uuid,
  topic text,
  keywords text[],
  content text,
  legal_basis text
) AS $$
BEGIN
  RETURN QUERY
  SELECT akb.id, akb.topic, akb.keywords, akb.content, akb.legal_basis
  FROM agent_knowledge_base akb
  WHERE akb.agent_type = p_agent_type
  ORDER BY akb.priority DESC, akb.topic;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
