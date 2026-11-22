// Firebase intentionally accepts password-reset requests for unknown addresses
// when email-enumeration protection is enabled. Acceptance is not delivery.
export const RESET_REQUEST_ACCEPTED = "تم استلام طلب الاستعادة. لو البريد مسجّل في المتجر، راجع الوارد والرسائل غير المرغوب فيها للبحث عن رابط إعادة تعيين كلمة السر. تأكد من كتابة نفس بريد حساب المتجر. قبول الطلب لا يؤكد إرسال الإيميل أو وصوله.";

export function passwordResetErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "auth/too-many-requests") return "تم تقييد المحاولات مؤقتًا. انتظر قليلًا قبل طلب رابط جديد، ثم حاول مرة أخرى.";
  if (code === "auth/network-request-failed") return "تعذّر الاتصال بخدمة استعادة كلمة السر. راجع اتصال الإنترنت ثم حاول مرة أخرى.";
  if (code === "auth/invalid-email") return "صيغة البريد الإلكتروني غير صحيحة. راجع العنوان المكتوب ثم حاول مرة أخرى.";
  return "تعذّر إكمال طلب استعادة كلمة السر. حاول مرة أخرى لاحقًا. لم نتمكن من تأكيد إرسال رسالة.";
}
