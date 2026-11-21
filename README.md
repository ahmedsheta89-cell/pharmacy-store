# One For All Good - متجر صيدلية أونلاين

متجر إلكتروني للعملاء: كتالوج منتجات، سلة مشتريات، وطلب بالدفع عند الاستلام.

## Stack
- React + TypeScript + Vite + Tailwind CSS v4 (RTL, خط Tajawal)
- Firebase Spark (الخطة المجانية): Firestore للطلبات + Firebase Hosting للنشر + Firebase Auth لدخول الإدارة

## الصفحات
- `/` المتجر: كتالوج بالبحث والأقسام، صفحات منتجات، سلة، وإتمام طلب COD
- `/admin` لوحة الطلبات: دخول بالبريد وكلمة المرور، متابعة الطلبات وتحديث حالتها

## التشغيل محليًا
```bash
pnpm install
pnpm dev
```

## النشر
النشر تلقائي من فرع main عبر Firebase Hosting GitHub integration.
بيانات اتصال Firebase (public by design) تُضبط عبر متغيرات البيئة VITE_FIREBASE_* أو تُدرج في src/lib/firebase.ts.

## Firestore rules
الملف firestore.rules: إنشاء الطلبات متاح للجميع (checkout)، والقراءة/التحديث للمدير المسجّل فقط.

## Disabled CRM foundation

Source-only staff inbox, saved human-chat client and conversation archive are documented in [docs/CRM-FOUNDATION.md](docs/CRM-FOUNDATION.md). Both CRM activation flags are false. No CRM Hosting site, saved-human-chat storefront mode, archive secret or scheduled CRM sweep is installed. Existing store Hosting configuration and order notification schedule are unchanged. Do not enable CRM before all documented activation checks pass.
