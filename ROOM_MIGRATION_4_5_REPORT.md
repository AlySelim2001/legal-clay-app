# ROOM_MIGRATION_4_5_REPORT.md — عقد الهجرة 4→5

> **التاريخ:** 2026-09-19
> **الحالة: مكتمل التحليل — اختبار جديد جاهز — جزء التنفيذ BLOCKED على أساس بنيوي**
> (لا يمكن إنتاج `5.json` إلا من KSP، وKSP لا يعمل في بيئة بلا Java/SDK — أدلة PHASE1_COMMAND_LOG §A).

---

## 1. فحص تعريف CrimSysDatabase (بند 1) — نُفِّذ فعليًا

| البند | القيمة المستخرجة من الكود |
|---|---|
| الإصدار | `version = 5` |
| exportSchema | `true` ⇒ `5.json` يُصدَّر آليًا من KSP عند أول بناء ناجح |
| الكيانات (7) | CaseEntity, HearingEntity, OfflineActionEntity, LegalSourceEntity, LegalDocumentEntity, EvidenceEntity, SyncCommandEntity |
| DAOs (7) | سليمة ومطابقة للكيانات |
| الهجرات | 1→2, 2→3, 3→4, **4→5** — كلها في companion object |

## 2. فحص MIGRATION_4_5 (بند 2) — نُفِّذ فعليًا

```kotlin
val MIGRATION_4_5: Migration = object : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS legal_documents (…)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_documents_documentType ON legal_documents(documentType)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_documents_lawNumber_articleNumber ON legal_documents(lawNumber, articleNumber)")
        db.execSQL("CREATE INDEX IF NOT EXISTS index_legal_documents_title ON legal_documents(title)")
    }
}
```

**التصنيف الاستراتيجي:** إضافي بحت (additive-only). صفر ALTER، صفر DROP، صفر RENAME ⇒
**بند 9 (استراتيجية إعادة التسمية) لا ينطبق أصلاً** — لا توجد بيانات تُنقل ولا
جدول يُعاد بناؤه. جميع العبارات `IF NOT EXISTS` ⇒ النمط يمنع تلف الترقية الجزئية.

## 3. التغيير الفعلي 4→5 (بند 3) — مشتق من الكود + 4.json، لا من التخمين

| العنصر | الدليل |
|---|---|
| جدول واحد جديد: `legal_documents` | DDL في MIGRATION_4_5 + كيان `LegalDocumentEntity` |
| ثلاثة فهارس جديدة | DDL + `@Entity(indices=…)` في الكيان |
| صفر تغيير في الجداول الستة القائمة | `4.json` فعليًا: cases, hearings, offline_actions, legal_sources, evidence, sync_commands (فحص `grep` — **0 ذكر لـ legal_documents**) |
| توافق الكيان↔DDL | مطابقة عمود-بعمود (id PK, documentType, title, lawNumber?, articleNumber?, body, sourceUrl?, publishedAtEpochDay?, updatedAtEpochMillis, verified) — Boolean↔INTEGER، Long?↔INTEGER NULL، String?↔TEXT NULL |

**تصحيح توثيقي:** README الداخلي وصف v5 بأنها "تستبدل جداول evidence الخاصة بـ v4" —
**غير دقيق**؛ الكود يثبت أن v5 إضافة كتالوج فقط ولا يلمس evidence (وأي تعديل
مستقبلي على evidence سيستلزم هجرة 5→6 جديدة، لا تعديل منشورة — بند 11).

## 4. إنتاج 5.json (بندا 4 و5) — **BLOCKED**

- KSP لا يعمل: لا `java` ولا `gradle` في البيئة (أدلة خام في PHASE1_COMMAND_LOG §A).
- 4.json سليم ويعكس الكيانات الست — لكن توليد 5.json يدويًا **ممنوع ومنتهٍ عن النقاش** (بند 4)، لأن الملف يضم identityHash يحسبه المعالج.
- **شرطا فك الحجب (أحدهما يكفي):** (أ) Run #120/121 يمرّ بمرحلة KSP ⇒ الملف يُصدَّر آليًا ويُرفع، أو (ب) بيئة JDK17+SDK36 محلية نفّذ `cd android && ./gradlew :app:kspDebugKotlin`.
- `5.json` بعد صدوره يغلف آليًا في androidTest assets عبر `sourceSets` القائم (`assets.srcDir("$projectDir/schemas")`) — لا تعديل build إضافي مطلوب.

## 5. الاختبار الجديد (بندا 7 و8) — مكتوب ومكتمل: `RoomMigration4To5Test.kt`

ثلاثة اختبارات على بنية اختبار 3→4 المعتمدة (MigrationTestHelper + validation ضد كيانات v5 الحية):

| الاختبار | يغطي |
|---|---|
| `migration4To5_preservesAllSeededData` | فتح v4 حقيقية + بذر صفوف كل الجداول الست (حدود PENDING/DEAD/sentinel + زوج dedup evidence) → تشغيل الهجرة → مطابقة byte-for-byte → أعداد COUNT صفرية للكتالوج الجديد → بقاء قيد UNIQUE(originalFileHash) |
| `migration4To5_newCatalogEnforcesItsContract` | حالة فارغة (بند 10) + صفان (nullable opt-ins + full row) + رفض PK مكرر + رفض NULL لكل عمود NOT NULL على حدة (بند 8) + تحقق قيم كاملة + وجود الفهارس الثلاثة في sqlite_master |
| `migration4To5_ddlIsIdempotentAgainstReapplication` | إعادة تطبيق DDL كاملًا فوق قاعدة مهجرة: لا استثناء، لا ازدواج، لا فقد بيانات (بند 8-أخير) |

**تحقق SQL-الفعلي (بند 6):** جزئي ساكنًا (مطابقة الكيان↔DDL↔فهارس) — الإثبات التنفيذي
يأتي مجانًا من `runMigrationsAndValidate` ضد `5.json` المُصدَّر لحظة فك الحجب.

## 6. مصفوفة الإنجاز

| بند التوجيه | الحالة |
|---|---|
| 1,2,3 فحص التعريف/الهجرة/الفارق | ✅ نُفِّذ (§1–§3) |
| 4 لا 5.json يدوي | ✅ ملتزم — حجب معلن بدل مخالفة القاعدة |
| 5 بناء KSP | ⏸️ BLOCKED (قيد بيئي — §4) |
| 6 مطابقة SQL | ◐ ساكن مكتمل؛ تنفيذي مؤجل لـ §4 |
| 7 اختبار جديد | ✅ مكتوب كاملًا (§5) |
| 8 سيناريوهات الفتح/الهجرة/التحقق | ✅ داخل الاختبار — انتظار فك الحجب للتشغيل |
| 9 استراتيجية rename/drop | N/A — الهجرة إضافية بحتة (§2) |
| 10 بيانات قديمة + فارغة | ✅ داخل الاختبار |
| 11 لا تعديل هجرة منشورة | ✅ لم يُمَس أي شيء؛ جديد فقط |
| 12 هذا التقرير | ✅ |
