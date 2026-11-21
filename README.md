# صيدلية الحواري - El Hawary Pharmacy Store

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
