
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config(); // Loads from .env in the current directory (backend/)

import mongoose from "mongoose";
import Category from "./src/models/Category.js";
import CategoryAttribute from "./src/models/CategoryAttribute.js";

// Common attributes for multiple categories
const sportsAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["جهاز مشي", "دراجة رياضية", "أوزان حديد", "بساط يوغا", "أدوات لياقة", "مكملات غذائية"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: ["Nike", "Adidas", "Decathlon", "Optimum Nutrition", "MuscleTech"], required: false, sortOrder: 2 },
  { name: "size_weight", label: "الحجم / الوزن", type: "select", options: ["خفيف", "متوسط", "ثقيل"], required: false, sortOrder: 3 }
];

const healthBeautyAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["كريم", "عطر", "شامبو", "مكياج", "زيت"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: ["L'Oréal", "Nivea", "Dove", "Garnier", "Maybelline"], required: false, sortOrder: 2 },
  { name: "skin_type", label: "نوع البشرة", type: "select", options: ["دهنية", "جافة", "مختلطة"], required: false, sortOrder: 3 }
];

const bookAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["كتاب", "مجلة"], required: false, sortOrder: 1 },
  { name: "language", label: "اللغة", type: "select", options: ["عربي", "إنجليزي"], required: false, sortOrder: 2 },
  { name: "cover", label: "الغلاف", type: "select", options: ["ورقي", "إلكتروني"], required: false, sortOrder: 3 }
];

const musicalInstrumentAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["جيتار", "عود", "بيانو", "أورغ", "طبول", "كمان"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: ["Yamaha", "Fender", "Roland", "Casio"], required: false, sortOrder: 2 },
  { name: "level", label: "المستوى", type: "select", options: ["مبتدئ", "متوسط", "محترف"], required: false, sortOrder: 3 }
];

const foodAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["أرز", "دقيق", "سكر", "زيت", "خضروات", "فواكه", "لحوم"], required: false, sortOrder: 1 },
  { name: "condition", label: "الحالة", type: "select", options: ["طازج", "مجمد", "معلب"], required: false, sortOrder: 2 },
  { name: "origin", label: "بلد المنشأ", type: "select", options: ["اليمن", "السعودية", "الإمارات", "مصر", "الهند"], required: false, sortOrder: 3 },
  { name: "sale_method", label: "طريقة البيع", type: "select", options: ["تجزئة", "جملة"], required: false, sortOrder: 4 }
];

const homeApplianceBrands = ["سامسونج", "LG", "هاير", "ميديا", "توشيبا", "باناسونيك", "هيتاشي", "بوش", "أريستون", "نيكاي", "بيسك", "جنرال", "Gree", "Sharp", "أخرى"];

const refrigeratorAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 1 },
  { name: "capacity_liters", label: "السعة باللتر", type: "number", required: false, sortOrder: 2 },
  { name: "fridge_type", label: "نوع الثلاجة", type: "select", options: ["باب واحد", "بابين", "بابين متقابلين", "أربعة أبواب", "فريزر علوي", "فريزر سفلي", "أخرى"], required: false, sortOrder: 3 },
  { name: "doors_count", label: "عدد الأبواب", type: "select", options: ["1", "2", "3", "4", "أكثر"], required: false, sortOrder: 4 },
  { name: "ice_maker", label: "صانع ثلج", type: "boolean", required: false, sortOrder: 5 },
  { name: "water_dispenser", label: "موزع مياه", type: "boolean", required: false, sortOrder: 6 },
  { name: "no_frost", label: "تقنية No Frost", type: "boolean", required: false, sortOrder: 7 }
];

const washingMachineAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 1 },
  { name: "capacity_kg", label: "السعة بالكيلو", type: "number", required: false, sortOrder: 2 },
  { name: "machine_type", label: "نوع الغسالة", type: "select", options: ["أوتوماتيك", "نصف أوتوماتيك", "حوضين", "تعبئة أمامية", "تعبئة علوية", "أخرى"], required: false, sortOrder: 3 },
  { name: "built_in_dryer", label: "مجفف مدمج", type: "boolean", required: false, sortOrder: 4 },
  { name: "front_load", label: "تعبئة أمامية", type: "boolean", required: false, sortOrder: 5 }
];

const airConditionerAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 1 },
  { name: "ac_type", label: "نوع المكيف", type: "select", options: ["سبليت", "شباك", "دولابي", "متنقل", "مركزي", "أخرى"], required: false, sortOrder: 2 },
  { name: "capacity_btu", label: "القدرة (BTU)", type: "select", options: ["12000", "18000", "24000", "30000", "36000", "أخرى"], required: false, sortOrder: 3 },
  { name: "inverter", label: "انفرتر", type: "boolean", required: false, sortOrder: 4 },
  { name: "cool_only", label: "بارد فقط", type: "boolean", required: false, sortOrder: 5 },
  { name: "cool_heat", label: "بارد / حار", type: "boolean", required: false, sortOrder: 6 }
];

const ovenMicrowaveAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["فرن غاز", "فرن كهربائي", "ميكروويف", "فرن مدمج", "أخرى"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 2 },
  { name: "capacity_liters", label: "السعة باللتر", type: "number", required: false, sortOrder: 3 },
  { name: "grill", label: "شواية", type: "boolean", required: false, sortOrder: 4 }
];

const kitchenApplianceAttributes = [
  { name: "appliance_type", label: "نوع الجهاز", type: "select", options: ["خلاط", "عصارة", "محضرة طعام", "قلاية هوائية", "ماكينة قهوة", "غلاية ماء", "ماكينة خبز", "أخرى"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 2 },
  { name: "power_watts", label: "القدرة بالواط", type: "number", required: false, sortOrder: 3 }
];

const smallApplianceAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["مكواة", "مجفف شعر", "مروحة", "ماكينة حلاقة", "ماكينة خياطة", "أخرى"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 2 }
];

const vacuumCleanerAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 1 },
  { name: "type", label: "النوع", type: "select", options: ["عادية", "روبوت", "عمودية", "مائية", "أخرى"], required: false, sortOrder: 2 },
  { name: "cordless", label: "بدون سلك", type: "boolean", required: false, sortOrder: 3 },
  { name: "tank_capacity", label: "سعة الخزان", type: "number", required: false, sortOrder: 4 }
];

const waterHeaterAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: homeApplianceBrands, required: false, sortOrder: 1 },
  { name: "type", label: "النوع", type: "select", options: ["كهربائي", "غاز", "شمسي", "فوري", "أخرى"], required: false, sortOrder: 2 },
  { name: "capacity_liters", label: "السعة باللتر", type: "number", required: false, sortOrder: 3 }
];

const categoriesData = [
  {
    name: "السيارات",
    slug: "cars",
    sortOrder: 1,
    description: "منصة متكاملة لعرض وشراء وبيع جميع أنواع المركبات في اليمن، بما يشمل السيارات الخاصة، الشاحنات، الدراجات النارية وقطع الغيار.",
    subcategories: [
      { name: "سيارات للبيع", slug: "cars-for-sale", sortOrder: 1, attributes: [
        { name: "brand", label: "الماركة", type: "select", options: ["تويوتا", "نيسان", "هيونداي", "كيا", "لكزس", "شيفروليه", "فورد", "جيب", "مرسيدس", "BMW", "MG", "جيلي"], required: false, sortOrder: 1 },
        { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
        { name: "year", label: "سنة الصنع", type: "number", required: false, sortOrder: 3 },
        { name: "mileage", label: "العداد (كم)", type: "number", required: false, sortOrder: 4 },
        { name: "fuel_type", label: "نوع الوقود", type: "select", options: ["بنزين", "ديزل", "هجين", "كهرباء"], required: false, sortOrder: 5 },
        { name: "transmission", label: "ناقل الحركة", type: "select", options: ["عادي", "أوتوماتيك"], required: false, sortOrder: 6 },
        { name: "color", label: "اللون", type: "text", required: false, sortOrder: 7 },
        { name: "doors", label: "عدد الأبواب", type: "number", required: false, sortOrder: 8 },
        { name: "ac", label: "مكيف", type: "boolean", required: false, sortOrder: 9 },
        { name: "rear_camera", label: "كاميرا خلفية", type: "boolean", required: false, sortOrder: 10 },
        { name: "center_lock", label: "سنتر لوك", type: "boolean", required: false, sortOrder: 11 },
        { name: "bluetooth", label: "بلوتوث", type: "boolean", required: false, sortOrder: 12 },
        { name: "sunroof", label: "فتحة سقف", type: "boolean", required: false, sortOrder: 13 },
        { name: "warranty", label: "يوجد ضمان", type: "boolean", required: false, sortOrder: 14 },
        { name: "negotiable", label: "قابل للتفاوض", type: "boolean", required: false, sortOrder: 15 }
      ]},
      { name: "سيارات للإيجار", slug: "cars-for-rent", sortOrder: 2 },
      { name: "سيارات للتنازل", slug: "cars-transfer", sortOrder: 3 },
      { name: "قطع غيار", slug: "car-parts", sortOrder: 4 },
      { name: "لوحات مميزة", slug: "special-plates", sortOrder: 5 },
      { name: "دراجات نارية", slug: "motorcycles", sortOrder: 6 },
      { name: "شاحنات ومعدات ثقيلة", slug: "trucks-heavy-equipment", sortOrder: 7 },
      { name: "أخرى", slug: "other-cars", sortOrder: 999 }
    ]
  },
  {
    name: "العقارات",
    slug: "real-estate",
    sortOrder: 2,
    description: "قسم شامل لعرض جميع أنواع العقارات في اليمن، سواء للبيع أو الإيجار.",
    subcategories: [
      { name: "شقق للبيع", slug: "apartments-for-sale", sortOrder: 1, attributes: [
        { name: "property_type", label: "نوع العقار", type: "select", options: ["شقة", "فيلا", "أرض", "محل", "مكتب", "استراحة"], required: false, sortOrder: 1 },
        { name: "purpose", label: "الغرض", type: "select", options: ["للبيع", "للإيجار"], required: false, sortOrder: 2 },
        { name: "area", label: "المساحة (متر)", type: "number", required: false, sortOrder: 3 },
        { name: "rooms", label: "عدد الغرف", type: "number", required: false, sortOrder: 4 },
        { name: "bathrooms", label: "عدد الحمامات", type: "number", required: false, sortOrder: 5 },
        { name: "floor", label: "الدور", type: "number", required: false, sortOrder: 6 },
        { name: "age", label: "عمر العقار", type: "number", required: false, sortOrder: 7 },
        { name: "neighborhood", label: "الحي", type: "text", required: false, sortOrder: 8 },
        { name: "street", label: "الشارع", type: "text", required: false, sortOrder: 9 },
        { name: "furnished", label: "مفروش", type: "boolean", required: false, sortOrder: 10 },
        { name: "parking", label: "موقف سيارة", type: "boolean", required: false, sortOrder: 11 },
        { name: "elevator", label: "مصعد", type: "boolean", required: false, sortOrder: 12 },
        { name: "security", label: "حارس", type: "boolean", required: false, sortOrder: 13 },
        { name: "electricity", label: "كهرباء", type: "boolean", required: false, sortOrder: 14 },
        { name: "water", label: "ماء", type: "boolean", required: false, sortOrder: 15 }
      ]},
      { name: "شقق للإيجار", slug: "apartments-for-rent", sortOrder: 2 },
      { name: "أراضي", slug: "lands", sortOrder: 3 },
      { name: "فلل", slug: "villas", sortOrder: 4 },
      { name: "محلات تجارية", slug: "shops", sortOrder: 5 },
      { name: "مكاتب", slug: "offices", sortOrder: 6 },
      { name: "استراحات", slug: "lounges", sortOrder: 7 },
      { name: "أخرى", slug: "other-real-estate", sortOrder: 999 }
    ]
  },
  {
    name: "الإلكترونيات",
    slug: "electronics",
    sortOrder: 3,
    description: "قسم مخصص لبيع وشراء الأجهزة الإلكترونية بمختلف أنواعها.",
    subcategories: [
      { name: "جوالات", slug: "mobiles", sortOrder: 1, attributes: [
        { name: "brand", label: "الماركة", type: "select", options: ["سامسونج", "آيفون", "شاومي", "هواوي", "أوبو"], required: false, sortOrder: 1 },
        { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
        { name: "storage", label: "سعة التخزين", type: "select", options: ["64GB", "128GB", "256GB", "512GB", "1TB"], required: false, sortOrder: 3 },
        { name: "ram", label: "الرام", type: "select", options: ["4GB", "6GB", "8GB", "12GB", "16GB"], required: false, sortOrder: 4 },
        { name: "color", label: "اللون", type: "text", required: false, sortOrder: 5 },
        { name: "support_5g", label: "يدعم 5G", type: "boolean", required: false, sortOrder: 6 }
      ]},
      { name: "أجهزة كمبيوتر", slug: "computers", sortOrder: 2 },
      { name: "لابتوبات", slug: "laptops", sortOrder: 3 },
      { name: "شاشات", slug: "screens", sortOrder: 4 },
      { name: "كاميرات", slug: "cameras", sortOrder: 5 },
      { name: "أجهزة ألعاب إلكترونية", slug: "gaming-consoles", sortOrder: 6 },
      { name: "أخرى", slug: "other-electronics", sortOrder: 999 }
    ]
  },
  {
    name: "الأثاث",
    slug: "furniture",
    sortOrder: 4,
    description: "قسم لعرض وبيع الأثاث المنزلي والمكتبي.",
    subcategories: [
      { name: "غرف نوم", slug: "bedrooms", sortOrder: 1, attributes: [
        { name: "type", label: "النوع", type: "text", required: false, sortOrder: 1 },
        { name: "material", label: "المادة", type: "select", options: ["خشب", "معدن", "بلاستيك"], required: false, sortOrder: 2 },
        { name: "color", label: "اللون", type: "text", required: false, sortOrder: 3 },
        { name: "negotiable", label: "قابل للتفاوض", type: "boolean", required: false, sortOrder: 4 }
      ]},
      { name: "مجالس", slug: "majalis", sortOrder: 2 },
      { name: "مطابخ", slug: "kitchens", sortOrder: 3 },
      { name: "طاولات وكراسي", slug: "tables-chairs", sortOrder: 4 },
      { name: "أثاث مكتبي", slug: "office-furniture", sortOrder: 5 },
      { name: "أخرى", slug: "other-furniture", sortOrder: 999 }
    ]
  },
  {
    name: "الوظائف",
    slug: "jobs",
    sortOrder: 5,
    description: "قسم لنشر الوظائف الشاغرة والبحث عن فرص عمل.",
    subcategories: [
      { name: "وظائف خاصة", slug: "private-jobs", sortOrder: 1, attributes: [
        { name: "job_title", label: "المسمى الوظيفي", type: "text", required: false, sortOrder: 1 },
        { name: "job_type", label: "نوع الوظيفة", type: "select", options: ["دوام كامل", "جزئي", "عن بعد"], required: false, sortOrder: 2 },
        { name: "salary", label: "الراتب", type: "number", required: false, sortOrder: 3 },
        { name: "experience", label: "الخبرة المطلوبة", type: "number", required: false, sortOrder: 4 },
        { name: "qualification", label: "المؤهل", type: "select", options: ["ثانوي", "دبلوم", "بكالوريوس"], required: false, sortOrder: 5 },
        { name: "location", label: "الموقع", type: "text", required: false, sortOrder: 6 }
      ]},
      { name: "وظائف حكومية", slug: "government-jobs", sortOrder: 2 },
      { name: "وظائف عن بعد", slug: "remote-jobs", sortOrder: 3 },
      { name: "وظائف جزئية", slug: "part-time-jobs", sortOrder: 4 },
      { name: "أخرى", slug: "other-jobs", sortOrder: 999 }
    ]
  },
  {
    name: "حيوانات",
    slug: "animals",
    sortOrder: 6,
    description: "قسم مخصص لبيع وشراء الحيوانات ومستلزماتها.",
    subcategories: [
      { name: "أغنام", slug: "sheep", sortOrder: 1, attributes: [
        { name: "type", label: "النوع", type: "text", required: false, sortOrder: 1 },
        { name: "age", label: "العمر", type: "number", required: false, sortOrder: 2 },
        { name: "gender", label: "الجنس", type: "select", options: ["ذكر", "أنثى"], required: false, sortOrder: 3 },
        { name: "health_status", label: "الحالة الصحية", type: "select", options: ["ممتازة", "جيدة"], required: false, sortOrder: 4 }
      ]},
      { name: "إبل", slug: "camels", sortOrder: 2 },
      { name: "أبقار", slug: "cows", sortOrder: 3 },
      { name: "طيور", slug: "birds", sortOrder: 4 },
      { name: "حيوانات أليفة", slug: "pets", sortOrder: 5 },
      { name: "أخرى", slug: "other-animals", sortOrder: 999 }
    ]
  },
  {
    name: "ملابس وأزياء",
    slug: "fashion",
    sortOrder: 7,
    description: "قسم لعرض الملابس الرجالية والنسائية والأطفال والإكسسوارات.",
    subcategories: [
      { name: "رجالي", slug: "mens-wear", sortOrder: 1, attributes: [
        { name: "size", label: "المقاس", type: "select", options: ["S", "M", "L", "XL"], required: false, sortOrder: 1 },
        { name: "color", label: "اللون", type: "text", required: false, sortOrder: 2 },
        { name: "brand", label: "الماركة", type: "text", required: false, sortOrder: 3 }
      ]},
      { name: "نسائي", slug: "womens-wear", sortOrder: 2 },
      { name: "أطفال", slug: "kids-wear", sortOrder: 3 },
      { name: "أحذية", slug: "shoes", sortOrder: 4 },
      { name: "إكسسوارات", slug: "accessories", sortOrder: 5 },
      { name: "أخرى", slug: "other-fashion", sortOrder: 999 }
    ]
  },
  {
    name: "ألعاب وترفيه",
    slug: "games-entertainment",
    sortOrder: 8,
    description: "قسم مخصص للألعاب الإلكترونية والأجهزة الترفيهية والهوايات.",
    subcategories: [
      { name: "ألعاب فيديو", slug: "video-games", sortOrder: 1, attributes: [
        { name: "type", label: "النوع", type: "text", required: false, sortOrder: 1 },
        { name: "platform", label: "المنصة", type: "select", options: ["PlayStation", "Xbox", "PC"], required: false, sortOrder: 2 }
      ]},
      { name: "أجهزة ترفيه", slug: "gaming-devices", sortOrder: 2 },
      { name: "ألعاب أطفال", slug: "kids-games", sortOrder: 3 },
      { name: "هوايات", slug: "hobbies", sortOrder: 4 },
      { name: "أخرى", slug: "other-games", sortOrder: 999 }
    ]
  },
  {
    name: "خدمات",
    slug: "services",
    sortOrder: 9,
    description: "قسم لعرض الخدمات المختلفة مثل الصيانة والنقل والتصميم.",
    subcategories: [
      { name: "خدمات منزلية", slug: "home-services", sortOrder: 1, attributes: [
        { name: "service_type", label: "نوع الخدمة", type: "text", required: false, sortOrder: 1 },
        { name: "location", label: "الموقع", type: "text", required: false, sortOrder: 2 },
        { name: "available_24h", label: "متاح 24 ساعة", type: "boolean", required: false, sortOrder: 3 }
      ]},
      { name: "صيانة", slug: "maintenance", sortOrder: 2 },
      { name: "نقل", slug: "transportation", sortOrder: 3 },
      { name: "تصميم", slug: "design", sortOrder: 4 },
      { name: "خدمات تعليمية", slug: "educational-services", sortOrder: 5 },
      { name: "أخرى", slug: "other-services", sortOrder: 999 }
    ]
  },
  {
    name: "الأدوات والمعدات",
    slug: "tools-equipment",
    sortOrder: 10,
    description: "قسم لبيع وشراء الأدوات الكهربائية والميكانيكية والمعدات المنزلية أو الصناعية.",
    subcategories: [
      { name: "أدوات كهربائية", slug: "electric-tools", sortOrder: 1, attributes: [
        { name: "type", label: "النوع", type: "select", options: ["مثقاب", "منشار", "كمبروسر", "مولد كهرباء", "مضخة ماء", "ماكينة لحام", "مفكات وأدوات يدوية", "معدات زراعية", "أدوات تنظيف"], required: false, sortOrder: 1 },
        { name: "brand", label: "الماركة", type: "select", options: ["Bosch", "Makita", "DeWalt", "Hitachi", "Hyundai", "Total", "Ingco", "Stanley"], required: false, sortOrder: 2 },
        { name: "power", label: "القوة / القدرة", type: "select", options: ["أقل من 500 واط", "500 - 1000 واط", "1000 - 2000 واط", "أكثر من 2000 واط"], required: false, sortOrder: 3 }
      ]},
      { name: "أدوات ميكانيكية", slug: "mechanical-tools", sortOrder: 2 },
      { name: "معدات منزلية", slug: "home-equipment", sortOrder: 3 },
      { name: "معدات صناعية", slug: "industrial-equipment", sortOrder: 4 },
      { name: "أدوات الحدائق", slug: "garden-tools", sortOrder: 5 },
      { name: "أخرى", slug: "other-tools", sortOrder: 999 }
    ]
  },
  {
    name: "المركبات الخاصة",
    slug: "special-vehicles",
    sortOrder: 11,
    description: "قسم خاص للمركبات غير التقليدية مثل الدراجات النارية والقوارب.",
    subcategories: [
      { name: "دراجات نارية خاصة", slug: "special-motorcycles", sortOrder: 1, attributes: [
        { name: "type", label: "النوع", type: "select", options: ["دراجة نارية", "قارب", "جرار زراعي", "دباب (ATV)", "سكوتر كهربائي", "دراجة هوائية"], required: false, sortOrder: 1 },
        { name: "brand", label: "الماركة", type: "select", options: ["Yamaha", "Honda", "Suzuki", "Kawasaki", "KTM"], required: false, sortOrder: 2 }
      ]},
      { name: "قوارب", slug: "boats", sortOrder: 2 },
      { name: "مركبات زراعية", slug: "agricultural-vehicles", sortOrder: 3 },
      { name: "مركبات كهربائية", slug: "electric-vehicles", sortOrder: 4 },
      { name: "أخرى", slug: "other-vehicles", sortOrder: 999 }
    ]
  },
  {
    name: "السفر والسياحة",
    slug: "travel-tourism",
    sortOrder: 12,
    description: "قسم يقدم خدمات السفر والسياحة بما يشمل عروض السفر والفنادق.",
    subcategories: [
      { name: "رحلات سياحية", slug: "tourism-trips", sortOrder: 1, attributes: [
        { name: "service_type", label: "نوع الخدمة", type: "select", options: ["رحلة سياحية", "حجز فندق", "تذكرة طيران", "نقل سياحي", "نشاط ترفيهي"], required: false, sortOrder: 1 },
        { name: "location", label: "الموقع", type: "select", options: ["عدن", "صنعاء", "تعز", "حضرموت", "إب", "الحديدة", "مأرب", "سقطرى"], required: false, sortOrder: 2 },
        { name: "available_date", label: "تاريخ متاح", type: "text", required: false, sortOrder: 3 },
        { name: "is_available_now", label: "متاح الآن", type: "boolean", required: false, sortOrder: 4 }
      ]},
      { name: "حجوزات فنادق", slug: "hotel-bookings", sortOrder: 2 },
      { name: "تذاكر سفر", slug: "travel-tickets", sortOrder: 3 },
      { name: "أنشطة ترفيهية", slug: "leisure-activities", sortOrder: 4 },
      { name: "أخرى", slug: "other-travel", sortOrder: 999 }
    ]
  },
  {
    name: "الأدوات المكتبية واللوازم المدرسية",
    slug: "stationery-school",
    sortOrder: 13,
    description: "قسم لبيع الأدوات المكتبية واللوازم المدرسية لجميع الأعمار.",
    subcategories: [
      { name: "أقلام ودفاتر", slug: "pens-notebooks", sortOrder: 1, attributes: [
        { name: "type", label: "النوع", type: "select", options: ["أقلام", "دفاتر", "كتب", "أدوات رسم", "آلة حاسبة", "طابعات", "مستلزمات مكتبية", "حقائب مدرسية"], required: false, sortOrder: 1 },
        { name: "brand", label: "الماركة", type: "select", options: ["Faber-Castell", "Stabilo", "Pilot", "Casio", "HP", "Canon"], required: false, sortOrder: 2 },
        { name: "target_age", label: "العمر المستهدف", type: "select", options: ["أطفال", "ابتدائي", "إعدادي", "ثانوي", "جامعي"], required: false, sortOrder: 3 }
      ]},
      { name: "أدوات مكتبية", slug: "office-supplies", sortOrder: 2 },
      { name: "لوازم مدرسية", slug: "school-supplies", sortOrder: 3 },
      { name: "حقائب وشنط", slug: "bags-cases", sortOrder: 4 },
      { name: "أخرى", slug: "other-stationery", sortOrder: 999 }
    ]
  },
  {
    name: "المستلزمات الرياضية",
    slug: "sports-equipment",
    sortOrder: 14,
    description: "قسم مخصص لبيع وشراء الأدوات والمعدات الرياضية والملابس الخاصة بالرياضة.",
    subcategories: [
      { name: "أجهزة رياضية", slug: "sports-devices", sortOrder: 1, attributes: sportsAttributes },
      { name: "معدات رياضية", slug: "sports-gear", sortOrder: 2, attributes: sportsAttributes },
      { name: "ملابس رياضية", slug: "sports-clothing", sortOrder: 3, attributes: sportsAttributes },
      { name: "مكملات غذائية", slug: "food-supplements", sortOrder: 4, attributes: sportsAttributes },
      { name: "مستلزمات كمال أجسام", slug: "bodybuilding-supplies", sortOrder: 5, attributes: sportsAttributes },
      { name: "أخرى", slug: "other-sports", sortOrder: 999, attributes: sportsAttributes }
    ]
  },
  {
    name: "الصحة والجمال",
    slug: "health-beauty",
    sortOrder: 15,
    description: "قسم شامل لمنتجات العناية الشخصية والتجميل.",
    subcategories: [
      { name: "مستحضرات تجميل", slug: "cosmetics", sortOrder: 1, attributes: healthBeautyAttributes },
      { name: "عناية بالبشرة", slug: "skin-care", sortOrder: 2, attributes: healthBeautyAttributes },
      { name: "عناية بالشعر", slug: "hair-care", sortOrder: 3, attributes: healthBeautyAttributes },
      { name: "عطور", slug: "perfumes", sortOrder: 4, attributes: healthBeautyAttributes },
      { name: "أدوات تجميل", slug: "beauty-tools", sortOrder: 5, attributes: healthBeautyAttributes },
      { name: "أخرى", slug: "other-beauty", sortOrder: 999, attributes: healthBeautyAttributes }
    ]
  },
  {
    name: "الكتب والمجلات",
    slug: "books-magazines",
    sortOrder: 16,
    description: "قسم لبيع وشراء الكتب والمجلات بمختلف أنواعها.",
    subcategories: [
      { name: "كتب تعليمية", slug: "educational-books", sortOrder: 1, attributes: bookAttributes },
      { name: "كتب دينية", slug: "religious-books", sortOrder: 2, attributes: bookAttributes },
      { name: "كتب أدبية", slug: "literary-books", sortOrder: 3, attributes: bookAttributes },
      { name: "مجلات", slug: "magazines", sortOrder: 4, attributes: bookAttributes },
      { name: "كتب أطفال", slug: "kids-books", sortOrder: 5, attributes: bookAttributes },
      { name: "أخرى", slug: "other-books", sortOrder: 999, attributes: bookAttributes }
    ]
  },
  {
    name: "آلات موسيقية",
    slug: "musical-instruments",
    sortOrder: 17,
    description: "قسم مخصص لبيع وشراء الآلات الموسيقية ومستلزماتها.",
    subcategories: [
      { name: "آلات وترية", slug: "string-instruments", sortOrder: 1, attributes: musicalInstrumentAttributes },
      { name: "آلات نفخ", slug: "wind-instruments", sortOrder: 2, attributes: musicalInstrumentAttributes },
      { name: "آلات إيقاعية", slug: "percussion-instruments", sortOrder: 3, attributes: musicalInstrumentAttributes },
      { name: "بيانو وأورغ", slug: "piano-keyboard", sortOrder: 4, attributes: musicalInstrumentAttributes },
      { name: "ملحقات موسيقية", slug: "musical-accessories", sortOrder: 5, attributes: musicalInstrumentAttributes },
      { name: "أخرى", slug: "other-music", sortOrder: 999, attributes: musicalInstrumentAttributes }
    ]
  },
  {
    name: "المواد الغذائية",
    slug: "foodstuffs",
    sortOrder: 18,
    description: "قسم لبيع المواد الغذائية المختلفة.",
    subcategories: [
      { name: "مواد غذائية جافة", slug: "dry-foods", sortOrder: 1, attributes: foodAttributes },
      { name: "خضروات وفواكه", slug: "vegetables-fruits", sortOrder: 2, attributes: foodAttributes },
      { name: "لحوم ودواجن", slug: "meat-poultry", sortOrder: 3, attributes: foodAttributes },
      { name: "منتجات ألبان", slug: "dairy-products", sortOrder: 4, attributes: foodAttributes },
      { name: "مواد بالجملة", slug: "wholesale-foods", sortOrder: 5, attributes: foodAttributes },
      { name: "أخرى", slug: "other-food", sortOrder: 999, attributes: foodAttributes }
    ]
  },
  {
    name: "الأجهزة المنزلية",
    slug: "home-appliances",
    sortOrder: 19,
    description: "قسم مخصص لبيع وشراء الأجهزة المنزلية الجديدة والمستعملة.",
    subcategories: [
      { name: "ثلاجات", slug: "refrigerators", sortOrder: 1, attributes: refrigeratorAttributes },
      { name: "غسالات", slug: "washing-machines", sortOrder: 2, attributes: washingMachineAttributes },
      { name: "مكيفات", slug: "air-conditioners", sortOrder: 3, attributes: airConditionerAttributes },
      { name: "أفران وميكروويف", slug: "ovens-microwaves", sortOrder: 4, attributes: ovenMicrowaveAttributes },
      { name: "أجهزة مطبخ", slug: "kitchen-appliances", sortOrder: 5, attributes: kitchenApplianceAttributes },
      { name: "أجهزة كهربائية صغيرة", slug: "small-appliances", sortOrder: 6, attributes: smallApplianceAttributes },
      { name: "مكانس كهربائية", slug: "vacuum-cleaners", sortOrder: 7, attributes: vacuumCleanerAttributes },
      { name: "سخانات مياه", slug: "water-heaters", sortOrder: 8, attributes: waterHeaterAttributes },
      { name: "أخرى", slug: "other-appliances", sortOrder: 999 }
    ]
  },
  {
    name: "طلبات الشراء",
    slug: "purchase-orders",
    sortOrder: 20,
    description: "قسم مخصص لطلبات الشراء.",
    subcategories: [
      { name: "طلب منتج", slug: "order-product", sortOrder: 1 }
    ]
  },
  {
    name: "أخرى",
    slug: "other-main",
    sortOrder: 999,
    description: "أقسام وأصناف أخرى متنوعة.",
    subcategories: [
      { name: "أخرى", slug: "other-other", sortOrder: 999 }
    ]
  }
];

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yemen_market";
  await mongoose.connect(mongoUri, { family: 4 });
  console.log("Connected to DB:", mongoose.connection.name);
  console.log("DB Host:", mongoose.connection.host);
  console.log("DB Port:", mongoose.connection.port);

  console.log("Starting seeding of categories and attributes...");

  // Clear existing categories and attributes to ensure a fresh start matching the report exactly
  // This is required to remove old/duplicated categories and reset all attributes.
  await CategoryAttribute.deleteMany({});
  await Category.deleteMany({});
  console.log("Cleared existing categories and attributes.");

  for (const catData of categoriesData) {
    let mainCat = await Category.findOne({ slug: catData.slug });
    if (!mainCat) {
      mainCat = await Category.create({
        name: catData.name,
        slug: catData.slug,
        description: catData.description,
        sortOrder: catData.sortOrder || 0,
        status: "active"
      });
      console.log(`Created Main Category: ${mainCat.name} (slug: ${mainCat.slug})`);
    } else {
      mainCat.name = catData.name;
      mainCat.description = catData.description;
      mainCat.sortOrder = catData.sortOrder || 0;
      await mainCat.save();
      console.log(`Updated Main Category: ${mainCat.name}`);
    }

    if (catData.subcategories) {
      for (const subCatData of catData.subcategories) {
        let subCat = await Category.findOne({ slug: subCatData.slug });
        if (!subCat) {
          subCat = await Category.create({
            name: subCatData.name,
            slug: subCatData.slug,
            parentId: mainCat._id,
            sortOrder: subCatData.sortOrder || 0,
            status: "active"
          });
          console.log(`  - Created Subcategory: ${subCat.name}`);
        } else {
          subCat.name = subCatData.name;
          subCat.parentId = mainCat._id;
          subCat.sortOrder = subCatData.sortOrder || 0;
          await subCat.save();
          console.log(`  - Updated Subcategory: ${subCat.name}`);
        }

        const currentAttrNames = (subCatData.attributes || []).map(a => a.name);

        // Delete attributes that are no longer in the definition for this subcategory
        await CategoryAttribute.deleteMany({
          categoryId: subCat._id,
          name: { $nin: currentAttrNames }
        });

        if (subCatData.attributes) {
          for (const attrData of subCatData.attributes) {
            let attr = await CategoryAttribute.findOne({ 
              categoryId: subCat._id, 
              name: attrData.name 
            });
            if (!attr) {
              await CategoryAttribute.create({
                categoryId: subCat._id,
                ...attrData,
                required: false // Ensure it's optional
              });
              console.log(`    * Created Attribute: ${attrData.label} for ${subCat.name}`);
            } else {
              Object.assign(attr, attrData);
              attr.required = false; // Ensure it's optional
              await attr.save();
              console.log(`    * Updated Attribute: ${attrData.label} for ${subCat.name}`);
            }
          }
        }
      }
    }
  }

  console.log("Seeding complete!");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Seeding failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
