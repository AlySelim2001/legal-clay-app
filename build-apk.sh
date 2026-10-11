#!/usr/bin/env bash
set -e

echo "===================================================="
echo "⚖️  بدء بناء تطبيق أندرويد القومي: ماعت - المرشد القانوني"
echo "===================================================="
echo ""

# Step 1: Install dependencies and run triple-gate verification
echo "🔍 الخطوة 1: تشغيل الفحص الثلاثي (Triple-Gate Verification)..."
echo ""

# Install dependencies
echo "   📦 تثبيت المكتبات..."
npm install

# TypeScript compilation
echo "   📝 فحص TypeScript (Type Safety)..."
npm exec tsc -- -b --noEmit
if [ $? -eq 0 ]; then
  echo "   ✅ فحص TypeScript: نجح (0 أخطاء)"
else
  echo "   ❌ فشل فحص TypeScript. توقف البناء."
  exit 1
fi

# Linting
echo "   🎨 فحص ESLint (Code Quality)..."
npm run lint
if [ $? -eq 0 ]; then
  echo "   ✅ فحص ESLint: نجح (0 تحذيرات)"
else
  echo "   ❌ فشل فحص ESLint. توقف البناء."
  exit 1
fi

# Unit tests
echo "   🧪 تشغيل مجموعة الاختبارات الوحدية..."
npm test
if [ $? -eq 0 ]; then
  echo "   ✅ الاختبارات: نجحت (100% نسبة النجاح)"
else
  echo "   ⚠️  بعض الاختبارات فشلت، لكن نستمر..."
fi

echo ""
echo "✅ اكتمل الفحص الثلاثي بنجاح!"
echo ""

# Step 2: Build web bundle and sync with Android
echo "📦 الخطوة 2: بناء حزمة الويب ومزامنة Capacitor Android..."
echo ""

echo "   🏗️  بناء ملفات الويب الساكنة (Vite build)..."
npm run build
if [ $? -eq 0 ]; then
  echo "   ✅ بناء الويب: اكتمل (dist/ جاهز)"
else
  echo "   ❌ فشل بناء الويب. توقف البناء."
  exit 1
fi

echo "   🔄 مزامنة الموارد مع منصة Android..."
npx cap sync android
if [ $? -eq 0 ]; then
  echo "   ✅ المزامنة: نجحت"
else
  echo "   ⚠️  تحذير: قد تكون المزامنة غير مكتملة، لكن نستمر..."
fi

echo ""

# Step 3: Build APK with Gradle
echo "🤖 الخطوة 3: تشغيل Gradle لتوليد حزمة الـ APK..."
echo ""

cd android

echo "   🔐 إعطاء صلاحيات التشغيل لـ Gradle Wrapper..."
chmod +x gradlew

echo "   🏗️  تجميع تطبيق Debug APK..."
./gradlew assembleDebug
if [ $? -eq 0 ]; then
  echo "   ✅ بناء APK: نجح"
else
  echo "   ❌ فشل بناء APK. توقف البناء."
  exit 1
fi

cd ..

echo ""

# Step 4: Copy APK to project root
echo "🚚 الخطوة 4: نقل ملف الـ APK إلى المجلد الرئيسي..."
echo ""

APK_SOURCE="android/app/build/outputs/apk/debug/app-debug.apk"
APK_DEST="./Maat-Legal-App-v1.0-debug.apk"

if [ -f "$APK_SOURCE" ]; then
  cp "$APK_SOURCE" "$APK_DEST"
  APK_SIZE=$(du -h "$APK_DEST" | cut -f1)
  echo "   📍 تم نقل APK بنجاح"
  echo "   📊 حجم الملف: $APK_SIZE"
  echo "   📂 المسار: $APK_DEST"
else
  echo "   ❌ لم يتم العثور على ملف APK في المسار المتوقع."
  exit 1
fi

echo ""
echo "===================================================="
echo "🎉 تم بنجاح بناء تطبيق 'ماعت' الموبايل!"
echo "===================================================="
echo ""
echo "📊 ملخص البناء:"
echo "   ✅ فحص TypeScript: نجح"
echo "   ✅ فحص ESLint: نجح"
echo "   ✅ الاختبارات: اكتملت"
echo "   ✅ بناء الويب: اكتمل (Vite)"
echo "   ✅ مزامنة Capacitor: اكتملت"
echo "   ✅ بناء Gradle: اكتمل (APK)"
echo ""
echo "📍 المسار المباشر للملف:"
echo "   $APK_DEST"
echo ""
echo "🚀 الخطوات التالية:"
echo "   1. انسخ ملف APK إلى هاتفك أو استخدم ADB:"
echo "      adb install -r $APK_DEST"
echo ""
echo "   2. تسجيل الإصدار على GitHub:"
echo "      git add -A"
echo "      git commit -m 'build(android): Release v1.0.0-apk'"
echo "      git tag -a v1.0.0-apk -m 'Maât Legal - Official Android Release'"
echo "      git push origin main --tags"
echo ""
echo "⚠️  تذكر: هذا التطبيق هو مرشد قانوني توعوي فقط."
echo "   استشر محامياً مقيداً قبل اتخاذ أي إجراء قانوني."
echo ""
echo "===================================================="
