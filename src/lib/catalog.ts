export type Category = {
  id: string;
  name: string;
  icon: string;
};

export type { StoreProduct as Product } from "./firebase";
import type { StoreProduct as Product } from "./firebase";

export const CATEGORIES: Category[] = [
  { id: "all", name: "الكل", icon: "grid" },
  { id: "uncategorized", name: "غير مصنف", icon: "grid" },
  { id: "medicine", name: "أدوية ومسكنات", icon: "pill" },
  { id: "cold", name: "برد وحساسية", icon: "thermometer" },
  { id: "vitamins", name: "فيتامينات ومكملات", icon: "sparkles" },
  { id: "skincare", name: "عناية بالبشرة", icon: "drop" },
  { id: "haircare", name: "عناية بالشعر", icon: "comb" },
  { id: "baby", name: "الأم والطفل", icon: "baby" },
  { id: "devices", name: "أجهزة طبية", icon: "device" },
  { id: "hygiene", name: "مطهرات ووقاية", icon: "shield" },
];

export const PRODUCTS: Product[] = [
  { id: "panadol-extra", name: "بانادول إكسترا 24 قرص", nameEn: "Panadol Extra", category: "medicine", price: 60, unit: "علبة", badge: "الأكثر طلبًا", description: "مسكن فعال للصداع وآلام الجسم، آمن عند الالتزام بالجرعة." },
  { id: "brufen-400", name: "بروفين 400 مجم 30 قرص", nameEn: "Brufen 400", category: "medicine", price: 48, unit: "علبة", description: "مضاد التهاب ومسكن للآلام والالتهابات." },
  { id: "cataflam-50", name: "كتافلام 50 مجم 20 قرص", nameEn: "Cataflam", category: "medicine", price: 42, unit: "علبة", description: "مسكن سريع المفعول للآلام الحادة." },
  { id: "aspocid-75", name: "أسبوسيد 75 مجم 20 قرص", nameEn: "Aspocid", category: "medicine", price: 12, unit: "علبة", description: "أسبرين واقي للقلب بجرعة منخفضة حسب إرشاد الطبيب." },
  { id: "nexium-40", name: "نيكسيوم 40 مجم 14 قرص", nameEn: "Nexium", category: "medicine", price: 120, unit: "علبة", description: "لعلاج الحموضة وارتجاع المريء." },
  { id: "antinal-12", name: "أنتينال 12 كبسولة", nameEn: "Antinal", category: "medicine", price: 24, unit: "علبة", badge: "وفر 20%", oldPrice: 30, description: "مضاد للإسهال والعدوى المعوية." },
  { id: "strepsils-honey", name: "ستريبسلز عسل وليمون 24 قرص استحلاب", nameEn: "Strepsils", category: "cold", price: 45, unit: "علبة", description: "مهدئ لالتهاب الحلق بنكهة العسل والليمون." },
  { id: "telfast-180", name: "تلفاست 180 مجم 20 قرص", nameEn: "Telfast", category: "cold", price: 95, unit: "علبة", description: "مضاد حساسية لا يسبب النعاس، فعال 24 ساعة." },
  { id: "zyrtec-10", name: "زيرتك 10 مجم 20 قرص", nameEn: "Zyrtec", category: "cold", price: 65, unit: "علبة", description: "لعلاج أعراض الحساسية والعطاس والحكة." },
  { id: "congestal-20", name: "كونجستال 20 قرص", nameEn: "Congestal", category: "cold", price: 36, unit: "علبة", badge: "الأكثر طلبًا", description: "لتخفيف أعراض البرد والزكام." },
  { id: "otrivin-spray", name: "أوتريفين بخاخ أنف 0.1%", nameEn: "Otrivin", category: "cold", price: 40, unit: "زجاجة", description: "لاحتقان الأنف وسهولة التنفس." },
  { id: "vitamin-c-1000", name: "فيتامين سي 1000 مجم 20 قرص فوار", nameEn: "Vitamin C 1000", category: "vitamins", price: 55, unit: "علبة", badge: "الأكثر طلبًا", description: "دعم المناعة اليومي بفيتامين سي الفوار." },
  { id: "vidrop-d3", name: "فيدروب فيتامين د3 نقط 15 مل", nameEn: "Vidrop", category: "vitamins", price: 38, unit: "زجاجة", description: "فيتامين د للأطفال والكبار لصحة العظام." },
  { id: "omega3-plus", name: "أوميجا 3 بلس 30 كبسولة", nameEn: "Omega 3 Plus", category: "vitamins", price: 140, unit: "علبة", description: "زيت السمك لصحة القلب والتركيز." },
  { id: "centrum-30", name: "سنتروم ملتي فيتامين 30 قرص", nameEn: "Centrum", category: "vitamins", price: 220, oldPrice: 260, unit: "علبة", badge: "عرض خاص", description: "ملتي فيتامين شامل للطاقة والمناعة." },
  { id: "ferrotron-30", name: "فيروترون 30 كبسولة", nameEn: "Ferrotron", category: "vitamins", price: 75, unit: "علبة", description: "حديد وفيتامينات لعلاج الأنيميا." },
  { id: "calcium-d3", name: "كالسيوم + فيتامين د3 30 قرص", nameEn: "Calcium D3", category: "vitamins", price: 60, unit: "علبة", description: "لصحة العظام والأسنان." },
  { id: "cerave-cleanser", name: "سيرافي غسول مرطب 236 مل", nameEn: "CeraVe Cleanser", category: "skincare", price: 450, unit: "زجاجة", badge: "الأكثر طلبًا", description: "غسول لطيف بالسيراميد للبشرة الجافة والعادية." },
  { id: "laroche-sunscreen", name: "لاروش بوزيه واقي شمس SPF50+ 50 مل", nameEn: "La Roche-Posay", category: "skincare", price: 850, unit: "عبوة", description: "حماية عالية من الشمس بملمس خفيف غير دهني." },
  { id: "bepanthen-cream", name: "بيبانثين كريم مرطب 30 جم", nameEn: "Bepanthen", category: "skincare", price: 95, unit: "أنبوبة", description: "كريم ترطيب وإصلاح للبشرة الجافة والمتشققة." },
  { id: "eveline-serum", name: "سيروم فيتامين سي للوجه 30 مل", nameEn: "Vitamin C Serum", category: "skincare", price: 180, oldPrice: 240, unit: "زجاجة", badge: "وفر 25%", description: "سيروم لتفتيح وتوحيد لون البشرة." },
  { id: "vaseline-lotion", name: "فازلين لوشن الجسم 400 مل", nameEn: "Vaseline", category: "skincare", price: 165, unit: "زجاجة", description: "ترطيب عميق يدوم 24 ساعة." },
  { id: "pantene-shampoo", name: "بانتين شامبو ضد التساقط 400 مل", nameEn: "Pantene", category: "haircare", price: 145, unit: "زجاجة", description: "شامبو لتقوية الشعر وتقليل التساقط." },
  { id: "ogx-argan-oil", name: "أو جي إكس زيت الأرغان للشعر 100 مل", nameEn: "OGX Argan Oil", category: "haircare", price: 320, unit: "زجاجة", description: "زيت مغذي للشعر الجاف والمتقصف." },
  { id: "headshoulders", name: "هيد آند شولدرز شامبو ضد القشرة 400 مل", nameEn: "Head & Shoulders", category: "haircare", price: 155, unit: "زجاجة", badge: "الأكثر طلبًا", description: "الحل الأول للقشرة وحكة فروة الرأس." },
  { id: "hairback-lotion", name: "هير باك لوشن للشعر 120 مل", nameEn: "Hair Back", category: "haircare", price: 210, unit: "زجاجة", description: "لوشن موضعي لدعم نمو الشعر." },
  { id: "pampers-s4", name: "حفاضات بامبرز مقاس 4 (58 قطعة)", nameEn: "Pampers", category: "baby", price: 480, unit: "عبوة", badge: "الأكثر طلبًا", description: "حفاضات مريحة بامتصاص عالٍ للأطفال 9-14 كجم." },
  { id: "sudocrem", name: "سودو كريم 60 جم", nameEn: "Sudocrem", category: "baby", price: 110, unit: "عبوة", description: "كريم التهابات الحفاض والحروق البسيطة." },
  { id: "johnson-shampoo", name: "جونسون بيبي شامبو 500 مل", nameEn: "Johnson's Baby", category: "baby", price: 135, unit: "زجاجة", description: "شامبو أطفال لطيف لا يسبب الدموع." },
  { id: "nan-optipro-2", name: "نان أوبتيبرو 2 حليب أطفال 400 جم", nameEn: "NAN Optipro", category: "baby", price: 520, unit: "علبة", description: "حليب صناعي للأطفال من 6-12 شهرًا." },
  { id: "baby-bottle", name: "رضاعة أطفال 250 مل ضد المغص", nameEn: "Baby Bottle", category: "baby", price: 145, unit: "قطعة", description: "رضاعة بتصميم مضاد للمغص وسهلة التنظيف." },
  { id: "thermometer-digital", name: "مقياس حرارة ديجيتال", nameEn: "Digital Thermometer", category: "devices", price: 120, unit: "قطعة", badge: "الأكثر طلبًا", description: "قياس سريع ودقيق للحرارة خلال 10 ثوانٍ." },
  { id: "oximeter", name: "جهاز قياس الأكسجين بالإصبع", nameEn: "Pulse Oximeter", category: "devices", price: 450, unit: "قطعة", description: "قياس نسبة الأكسجين والنبض بشاشة ملونة." },
  { id: "bp-monitor", name: "جهاز قياس ضغط الدم الذراع", nameEn: "BP Monitor", category: "devices", price: 950, unit: "قطعة", badge: "عرض خاص", oldPrice: 1150, description: "قياس دقيق للضغط مع ذاكرة للقراءات." },
  { id: "glucometer", name: "جهاز قياس السكر + 25 شريط", nameEn: "Glucometer", category: "devices", price: 620, unit: "طقم", description: "متابعة سكر الدم بسهولة في المنزل." },
  { id: "dettol-500", name: "ديتول مطهر 500 مل", nameEn: "Dettol", category: "hygiene", price: 95, unit: "زجاجة", description: "مطهر متعدد الاستخدامات للجروح والأسطح." },
  { id: "hand-sanitizer", name: "جل معقم لليدين 250 مل", nameEn: "Hand Sanitizer", category: "hygiene", price: 45, unit: "زجاجة", description: "تعقيم فوري لليدين بكحول 70%." },
  { id: "face-masks-50", name: "كمامات طبية 3 طبقات (50 قطعة)", nameEn: "Face Masks", category: "hygiene", price: 85, unit: "علبة", badge: "وفر 30%", oldPrice: 120, description: "كمامات واقية بثلاث طبقات للاستخدام اليومي." },
  { id: "alcohol-70", name: "كحول إيثيلي 70% 500 مل", nameEn: "Ethyl Alcohol", category: "hygiene", price: 35, unit: "زجاجة", description: "للتطهير والتعقيم العام." },
  { id: "sterile-gauze", name: "شاش معقم + لاصق طبي", nameEn: "Sterile Gauze", category: "hygiene", price: 25, unit: "طقم", description: "أساسيات الإسعافات الأولية للجروح." },
];

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ar-EG")} ج.م`;
}

export function categoryName(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}
