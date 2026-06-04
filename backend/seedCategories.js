
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
const carBrands = ["تويوتا", "هيونداي", "كيا", "نيسان", "لكزس", "هوندا", "فورد", "شيفروليه", "جيب", "مرسيدس", "بي إم دبليو", "جي إم سي", "دودج", "ميتسوبيشي", "مازدا", "سوزوكي", "شانجان", "جيلي", "هافال", "شيري", "إم جي", "أخرى"];
const carColors = ["أبيض", "أسود", "فضي", "رمادي", "أحمر", "أزرق", "أخضر", "بني", "ذهبي", "أصفر", "برتقالي", "أخرى"];

const carBaseAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: carBrands, required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
  { name: "year", label: "سنة الصنع", type: "number", required: false, sortOrder: 3 },
  { name: "fuel_type", label: "نوع الوقود", type: "select", options: ["بنزين", "ديزل", "غاز", "هجين", "كهربائي", "أخرى"], required: false, sortOrder: 4 },
  { name: "transmission", label: "ناقل الحركة", type: "select", options: ["عادي", "أوتوماتيك", "نصف أوتوماتيك", "أخرى"], required: false, sortOrder: 5 },
  { name: "drive_type", label: "نوع الدفع", type: "select", options: ["أمامي", "خلفي", "رباعي", "أخرى"], required: false, sortOrder: 6 },
  { name: "cylinders", label: "عدد الأسطوانات", type: "select", options: ["3", "4", "5", "6", "8", "10", "12", "أخرى"], required: false, sortOrder: 7 },
  { name: "color", label: "لون السيارة", type: "select", options: carColors, required: false, sortOrder: 8 },
  { name: "doors", label: "عدد الأبواب", type: "select", options: ["2", "3", "4", "5", "أخرى"], required: false, sortOrder: 9 },
  { name: "seats", label: "عدد المقاعد", type: "select", options: ["2", "4", "5", "7", "8", "أكثر من 8", "أخرى"], required: false, sortOrder: 10 },
  { name: "origin", label: "بلد المنشأ", type: "select", options: ["خليجي", "أمريكي", "كندي", "أوروبي", "ياباني", "كوري", "صيني", "أخرى"], required: false, sortOrder: 11 },
  { name: "engine_cc", label: "سعة المحرك (CC)", type: "number", required: false, sortOrder: 12 },
  { name: "mileage", label: "المسافة المقطوعة (كم)", type: "number", required: false, sortOrder: 13 },
  { name: "sunroof", label: "فتحة سقف", type: "boolean", required: false, sortOrder: 14 },
  { name: "rear_camera", label: "كاميرا خلفية", type: "boolean", required: false, sortOrder: 15 },
  { name: "parking_sensors", label: "حساسات ركن", type: "boolean", required: false, sortOrder: 16 },
  { name: "push_button_start", label: "تشغيل بصمة", type: "boolean", required: false, sortOrder: 17 },
  { name: "navigation", label: "نظام ملاحة", type: "boolean", required: false, sortOrder: 18 }
];

const carForRentAttributes = [
  ...carBaseAttributes,
  { name: "rental_type", label: "نوع التأجير", type: "select", options: ["يومي", "أسبوعي", "شهري", "سنوي", "أخرى"], required: false, sortOrder: 19 }
];

const carTransferAttributes = [
  ...carBaseAttributes,
  { name: "financing_entity", label: "جهة التمويل", type: "text", required: false, sortOrder: 19 },
  { name: "remaining_contract_months", label: "مدة العقد المتبقية بالأشهر", type: "number", required: false, sortOrder: 20 }
];

const carPartsAttributes = [
  { name: "part_type", label: "نوع القطعة", type: "select", options: ["محرك", "قير", "مكينة", "كمبيوتر", "رديتر", "بطارية", "جنوط", "إطارات", "مصابيح", "مرايا", "أبواب", "رفارف", "صدامات", "مقاعد", "مكيف", "أخرى"], required: false, sortOrder: 1 },
  { name: "suitable_brand", label: "الماركة المناسبة", type: "select", options: carBrands, required: false, sortOrder: 2 },
  { name: "suitable_model", label: "الموديل المناسب", type: "text", required: false, sortOrder: 3 },
  { name: "compatibility_year", label: "سنة التوافق", type: "text", required: false, sortOrder: 4 },
  { name: "part_origin", label: "أصل القطعة", type: "select", options: ["أصلي", "تجاري", "مستخدم", "مجدد", "أخرى"], required: false, sortOrder: 5 }
];

const specialPlatesAttributes = [
  { name: "plate_number", label: "رقم اللوحة", type: "text", required: false, sortOrder: 1 },
  { name: "plate_type", label: "نوع اللوحة", type: "select", options: ["خصوصي", "نقل", "أجرة", "مؤقتة", "أخرى"], required: false, sortOrder: 2 }
];

const motorcycleAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: ["هوندا", "ياماها", "سوزوكي", "كاواساكي", "هارلي ديفيدسون", "باجاج", "دايون", "أخرى"], required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
  { name: "year", label: "سنة الصنع", type: "number", required: false, sortOrder: 3 },
  { name: "engine_cc", label: "سعة المحرك CC", type: "number", required: false, sortOrder: 4 },
  { name: "fuel_type", label: "نوع الوقود", type: "select", options: ["بنزين", "ديزل", "غاز", "هجين", "كهربائي", "أخرى"], required: false, sortOrder: 5 },
  { name: "transmission", label: "ناقل الحركة", type: "select", options: ["عادي", "أوتوماتيك", "أخرى"], required: false, sortOrder: 6 }
];

const truckEquipmentAttributes = [
  { name: "vehicle_type", label: "نوع المركبة", type: "select", options: ["شاحنة", "قلاب", "وايت ماء", "شيول", "حفار", "رافعة", "بلدوزر", "قاطرة", "أخرى"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: carBrands, required: false, sortOrder: 2 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 3 },
  { name: "year", label: "سنة الصنع", type: "number", required: false, sortOrder: 4 },
  { name: "fuel_type", label: "نوع الوقود", type: "select", options: ["بنزين", "ديزل", "غاز", "هجين", "كهربائي", "أخرى"], required: false, sortOrder: 5 },
  { name: "capacity_tons", label: "الحمولة (طن)", type: "number", required: false, sortOrder: 6 },
  { name: "axles_count", label: "عدد المحاور", type: "number", required: false, sortOrder: 7 }
];

const otherCarsAttributes = [
  { name: "vehicle_type", label: "نوع المركبة", type: "text", required: false, sortOrder: 1 }
];

const apartmentAttributes = [
  { name: "area", label: "المساحة بالمتر", type: "number", required: false, sortOrder: 1 },
  { name: "rooms", label: "عدد الغرف", type: "number", required: false, sortOrder: 2 },
  { name: "halls", label: "عدد الصالات", type: "number", required: false, sortOrder: 3 },
  { name: "bathrooms", label: "عدد الحمامات", type: "number", required: false, sortOrder: 4 },
  { name: "floor", label: "الطابق", type: "number", required: false, sortOrder: 5 },
  { name: "age", label: "عمر العقار", type: "number", required: false, sortOrder: 6 },
  { name: "furnished", label: "مفروشة", type: "boolean", required: false, sortOrder: 7 },
  { name: "elevator", label: "مصعد", type: "boolean", required: false, sortOrder: 8 },
  { name: "parking", label: "موقف سيارة", type: "boolean", required: false, sortOrder: 9 },
  { name: "water_tank", label: "خزان ماء", type: "boolean", required: false, sortOrder: 10 },
  { name: "gov_electricity", label: "كهرباء حكومية", type: "boolean", required: false, sortOrder: 11 },
  { name: "commercial_electricity", label: "كهرباء تجارية", type: "boolean", required: false, sortOrder: 12 },
  { name: "balcony", label: "بلكونة", type: "boolean", required: false, sortOrder: 13 }
];

const landAttributes = [
  { name: "area", label: "مساحة الأرض", type: "number", required: false, sortOrder: 1 },
  { name: "land_type", label: "نوع الأرض", type: "select", options: ["سكنية", "تجارية", "زراعية", "استثمارية", "صناعية", "أخرى"], required: false, sortOrder: 2 },
  { name: "through_street", label: "شارع نافذ", type: "boolean", required: false, sortOrder: 3 },
  { name: "corner", label: "زاوية", type: "boolean", required: false, sortOrder: 4 },
  { name: "one_face", label: "واجهة واحدة", type: "boolean", required: false, sortOrder: 5 },
  { name: "two_faces", label: "واجهتان", type: "boolean", required: false, sortOrder: 6 },
  { name: "three_faces", label: "ثلاث واجهات", type: "boolean", required: false, sortOrder: 7 },
  { name: "fenced", label: "مسورة", type: "boolean", required: false, sortOrder: 8 }
];

const villaAttributes = [
  { name: "area", label: "المساحة", type: "number", required: false, sortOrder: 1 },
  { name: "floors", label: "عدد الطوابق", type: "number", required: false, sortOrder: 2 },
  { name: "rooms", label: "عدد الغرف", type: "number", required: false, sortOrder: 3 },
  { name: "bathrooms", label: "عدد الحمامات", type: "number", required: false, sortOrder: 4 },
  { name: "halls", label: "عدد الصالات", type: "number", required: false, sortOrder: 5 },
  { name: "majlis", label: "مجلس", type: "boolean", required: false, sortOrder: 6 },
  { name: "annex", label: "ملحق", type: "boolean", required: false, sortOrder: 7 },
  { name: "yard", label: "حوش", type: "boolean", required: false, sortOrder: 8 },
  { name: "pool", label: "مسبح", type: "boolean", required: false, sortOrder: 9 },
  { name: "garden", label: "حديقة", type: "boolean", required: false, sortOrder: 10 },
  { name: "parking", label: "موقف سيارات", type: "boolean", required: false, sortOrder: 11 },
  { name: "ground_tank", label: "خزان أرضي", type: "boolean", required: false, sortOrder: 12 },
  { name: "top_tank", label: "خزان علوي", type: "boolean", required: false, sortOrder: 13 }
];

const shopAttributes = [
  { name: "area", label: "المساحة", type: "number", required: false, sortOrder: 1 },
  { name: "faces_count", label: "عدد الواجهات", type: "number", required: false, sortOrder: 2 },
  { name: "warehouse", label: "مستودع", type: "boolean", required: false, sortOrder: 3 },
  { name: "toilet", label: "دورة مياه", type: "boolean", required: false, sortOrder: 4 },
  { name: "main_street", label: "على شارع رئيسي", type: "boolean", required: false, sortOrder: 5 }
];

const officeAttributes = [
  { name: "area", label: "المساحة", type: "number", required: false, sortOrder: 1 },
  { name: "rooms", label: "عدد الغرف", type: "number", required: false, sortOrder: 2 },
  { name: "bathrooms", label: "عدد الحمامات", type: "number", required: false, sortOrder: 3 },
  { name: "furnished", label: "مفروش", type: "boolean", required: false, sortOrder: 4 },
  { name: "elevator", label: "مصعد", type: "boolean", required: false, sortOrder: 5 },
  { name: "parking", label: "موقف سيارة", type: "boolean", required: false, sortOrder: 6 }
];

const loungeAttributes = [
  { name: "area", label: "المساحة", type: "number", required: false, sortOrder: 1 },
  { name: "rooms", label: "عدد الغرف", type: "number", required: false, sortOrder: 2 },
  { name: "bathrooms", label: "عدد الحمامات", type: "number", required: false, sortOrder: 3 },
  { name: "pool", label: "مسبح", type: "boolean", required: false, sortOrder: 4 },
  { name: "playground", label: "ملعب", type: "boolean", required: false, sortOrder: 5 },
  { name: "outdoor_seating", label: "جلسات خارجية", type: "boolean", required: false, sortOrder: 6 },
  { name: "kitchen", label: "مطبخ", type: "boolean", required: false, sortOrder: 7 },
  { name: "water_well", label: "بئر ماء", type: "boolean", required: false, sortOrder: 8 }
];

const mobileBrands = ["آبل", "سامسونج", "شاومي", "ريدمي", "بوكو", "أوبو", "فيفو", "هواوي", "هونر", "ريلمي", "نوكيا", "موتورولا", "تكنو", "إنفينيكس", "أخرى"];
const storageOptions = ["16 جيجابايت", "32 جيجابايت", "64 جيجابايت", "128 جيجابايت", "256 جيجابايت", "512 جيجابايت", "1 تيرابايت", "أخرى"];
const ramOptions = ["1 جيجابايت", "2 جيجابايت", "3 جيجابايت", "4 جيجابايت", "6 جيجابايت", "8 جيجابايت", "12 جيجابايت", "16 جيجابايت", "أخرى"];

const mobileAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: mobileBrands, required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
  { name: "storage", label: "سعة التخزين", type: "select", options: storageOptions, required: false, sortOrder: 3 },
  { name: "ram", label: "حجم الرام", type: "select", options: ramOptions, required: false, sortOrder: 4 },
  { name: "os", label: "نظام التشغيل", type: "select", options: ["أندرويد", "iOS", "أخرى"], required: false, sortOrder: 5 },
  { name: "screen_size", label: "حجم الشاشة (بوصة)", type: "number", required: false, sortOrder: 6 },
  { name: "support_5g", label: "يدعم 5G", type: "boolean", required: false, sortOrder: 7 },
  { name: "fingerprint", label: "بصمة", type: "boolean", required: false, sortOrder: 8 },
  { name: "face_id", label: "Face ID / التعرف على الوجه", type: "boolean", required: false, sortOrder: 9 },
  { name: "dual_sim", label: "شريحتين", type: "boolean", required: false, sortOrder: 10 }
];

const computerBrands = ["HP", "Dell", "Lenovo", "Asus", "Acer", "MSI", "Apple", "أخرى"];
const processorOptions = ["Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9", "Xeon", "أخرى"];
const storageTypeOptions = ["HDD", "SSD", "NVMe SSD", "أخرى"];
const osOptions = ["ويندوز 10", "ويندوز 11", "لينكس", "ماك أو إس", "أخرى"];

const computerAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: computerBrands, required: false, sortOrder: 1 },
  { name: "processor", label: "المعالج", type: "select", options: processorOptions, required: false, sortOrder: 2 },
  { name: "ram", label: "الرام", type: "select", options: ramOptions, required: false, sortOrder: 3 },
  { name: "storage", label: "التخزين", type: "select", options: storageOptions, required: false, sortOrder: 4 },
  { name: "storage_type", label: "نوع التخزين", type: "select", options: storageTypeOptions, required: false, sortOrder: 5 },
  { name: "gpu", label: "كرت الشاشة", type: "text", required: false, sortOrder: 6 },
  { name: "os", label: "نظام التشغيل", type: "select", options: osOptions, required: false, sortOrder: 7 }
];

const laptopAttributes = [
  ...computerAttributes,
  { name: "screen_size", label: "حجم الشاشة", type: "number", required: false, sortOrder: 8 },
  { name: "touch_screen", label: "شاشة لمس", type: "boolean", required: false, sortOrder: 9 },
  { name: "backlit_keyboard", label: "لوحة مفاتيح مضيئة", type: "boolean", required: false, sortOrder: 10 },
  { name: "fingerprint", label: "بصمة", type: "boolean", required: false, sortOrder: 11 }
];

const screenBrands = ["سامسونج", "LG", "سوني", "TCL", "هايسنس", "شاومي", "تورنيدو", "أخرى"];
const screenTypeOptions = ["LED", "OLED", "QLED", "LCD", "أخرى"];
const resolutionOptions = ["HD", "Full HD", "2K", "4K", "8K", "أخرى"];

const screenAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: screenBrands, required: false, sortOrder: 1 },
  { name: "size", label: "حجم الشاشة", type: "number", required: false, sortOrder: 2 },
  { name: "screen_type", label: "نوع الشاشة", type: "select", options: screenTypeOptions, required: false, sortOrder: 3 },
  { name: "resolution", label: "الدقة", type: "select", options: resolutionOptions, required: false, sortOrder: 4 },
  { name: "smart", label: "سمارت", type: "boolean", required: false, sortOrder: 5 },
  { name: "hdmi", label: "HDMI", type: "boolean", required: false, sortOrder: 6 },
  { name: "usb", label: "USB", type: "boolean", required: false, sortOrder: 7 }
];

const cameraBrands = ["كانون", "نيكون", "سوني", "فوجي فيلم", "باناسونيك", "GoPro", "أخرى"];
const cameraTypeOptions = ["DSLR", "Mirrorless", "كاميرا فيديو", "أكشن كام", "مراقبة", "أخرى"];
const cameraResolutionOptions = ["12MP", "16MP", "20MP", "24MP", "32MP", "48MP", "أخرى"];

const cameraAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: cameraBrands, required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
  { name: "camera_type", label: "نوع الكاميرا", type: "select", options: cameraTypeOptions, required: false, sortOrder: 3 },
  { name: "resolution", label: "دقة التصوير", type: "select", options: cameraResolutionOptions, required: false, sortOrder: 4 },
  { name: "video_4k", label: "تصوير فيديو 4K", type: "boolean", required: false, sortOrder: 5 },
  { name: "wifi", label: "واي فاي", type: "boolean", required: false, sortOrder: 6 }
];

const gamingConsoleCompanies = ["سوني", "مايكروسوفت", "نينتندو", "أخرى"];
const gamingConsoleModels = ["PlayStation 4", "PlayStation 4 Pro", "PlayStation 5", "PlayStation 5 Slim", "Xbox One", "Xbox Series S", "Xbox Series X", "Nintendo Switch", "Nintendo Switch OLED", "أخرى"];

const gamingConsoleAttributes = [
  { name: "company", label: "الشركة", type: "select", options: gamingConsoleCompanies, required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "select", options: gamingConsoleModels, required: false, sortOrder: 2 },
  { name: "storage", label: "سعة التخزين", type: "select", options: storageOptions, required: false, sortOrder: 3 },
  { name: "controllers_count", label: "عدد وحدات التحكم", type: "number", required: false, sortOrder: 4 },
  { name: "internet_support", label: "يدعم الإنترنت", type: "boolean", required: false, sortOrder: 5 }
];

const computerAccessoryBrands = ["Logitech", "Redragon", "Razer", "HyperX", "SteelSeries", "Corsair", "MSI", "Asus", "HP", "Dell", "أخرى"];

const computerAccessoryAttributes = [
  { name: "accessory_type", label: "نوع الملحق", type: "select", options: ["ماوس", "كيبورد", "سماعات كمبيوتر", "ميكروفون", "ويب كام", "هارد خارجي", "SSD", "RAM", "كرت شاشة", "مزود طاقة", "لوحة أم", "كرسي ألعاب", "أخرى"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: computerAccessoryBrands, required: false, sortOrder: 2 },
  { name: "wireless", label: "الاتصال لاسلكي", type: "boolean", required: false, sortOrder: 3 },
  { name: "rgb", label: "RGB", type: "boolean", required: false, sortOrder: 4 }
];

const networkBrands = ["TP-Link", "Huawei", "ZTE", "D-Link", "MikroTik", "Cisco", "Tenda", "أخرى"];

const networkAttributes = [
  { name: "device_type", label: "نوع الجهاز", type: "select", options: ["راوتر", "مودم", "مقوي شبكة", "سويتش", "نقطة وصول", "كاميرات مراقبة شبكية"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: networkBrands, required: false, sortOrder: 2 },
  { name: "support_5g", label: "يدعم 5G", type: "boolean", required: false, sortOrder: 3 },
  { name: "support_wifi6", label: "يدعم Wi-Fi 6", type: "boolean", required: false, sortOrder: 4 },
  { name: "ports_count", label: "عدد المنافذ", type: "number", required: false, sortOrder: 5 }
];

const audioBrands = ["JBL", "Sony", "Bose", "Apple", "Samsung", "Anker", "Xiaomi", "أخرى"];

const audioAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["سماعات رأس", "سماعات أذن", "سماعات بلوتوث", "مكبرات صوت", "ميكروفونات"], required: false, sortOrder: 1 },
  { name: "brand", label: "الماركة", type: "select", options: audioBrands, required: false, sortOrder: 2 },
  { name: "bluetooth", label: "بلوتوث", type: "boolean", required: false, sortOrder: 3 },
  { name: "noise_cancelling", label: "عزل ضوضاء", type: "boolean", required: false, sortOrder: 4 }
];

const printerBrands = ["HP", "Canon", "Epson", "Brother", "Xerox", "أخرى"];

const printerScannerAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: printerBrands, required: false, sortOrder: 1 },
  { name: "type", label: "النوع", type: "select", options: ["طابعة", "ماسح ضوئي", "طابعة متعددة الوظائف", "أخرى"], required: false, sortOrder: 2 },
  { name: "color", label: "ملونة", type: "boolean", required: false, sortOrder: 3 },
  { name: "wifi", label: "واي فاي", type: "boolean", required: false, sortOrder: 4 }
];

const tabletBrands = ["Apple iPad", "Samsung Galaxy Tab", "Huawei MatePad", "Xiaomi Pad", "Lenovo Tab", "أخرى"];

const tabletAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: tabletBrands, required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
  { name: "storage", label: "التخزين", type: "select", options: storageOptions, required: false, sortOrder: 3 },
  { name: "ram", label: "الرام", type: "select", options: ramOptions, required: false, sortOrder: 4 },
  { name: "sim_support", label: "يدعم الشريحة", type: "boolean", required: false, sortOrder: 5 }
];

const smartWatchAttributes = [
  { name: "brand", label: "الماركة", type: "select", options: ["Apple", "Samsung", "Huawei", "Xiaomi", "Garmin", "أخرى"], required: false, sortOrder: 1 },
  { name: "model", label: "الموديل", type: "text", required: false, sortOrder: 2 },
  { name: "gps", label: "GPS", type: "boolean", required: false, sortOrder: 3 },
  { name: "heart_rate", label: "قياس نبضات القلب", type: "boolean", required: false, sortOrder: 4 },
  { name: "water_resistant", label: "مقاومة للماء", type: "boolean", required: false, sortOrder: 5 }
];

const bedroomAttributes = [
  { name: "room_type", label: "نوع الغرفة", type: "select", options: ["غرفة نوم رئيسية", "غرفة أطفال", "غرفة شباب", "أخرى"], required: false, sortOrder: 1 },
  { name: "material", label: "المادة", type: "select", options: ["خشب طبيعي", "MDF", "خشب مضغوط", "معدن", "أخرى"], required: false, sortOrder: 2 },
  { name: "pieces_count", label: "عدد القطع", type: "number", required: false, sortOrder: 3 },
  { name: "wardrobe", label: "دولاب ملابس", type: "boolean", required: false, sortOrder: 4 },
  { name: "dressing_table", label: "تسريحة", type: "boolean", required: false, sortOrder: 5 },
  { name: "nightstand", label: "كومودينة", type: "boolean", required: false, sortOrder: 6 }
];

const majalisAttributes = [
  { name: "majlis_type", label: "نوع المجلس", type: "select", options: ["مجلس عربي", "مجلس مودرن", "مجلس ملكي", "أخرى"], required: false, sortOrder: 1 },
  { name: "seats_count", label: "عدد المقاعد", type: "number", required: false, sortOrder: 2 },
  { name: "arabic", label: "عربي", type: "boolean", required: false, sortOrder: 3 },
  { name: "floor_seating", label: "أرضي", type: "boolean", required: false, sortOrder: 4 }
];

const kitchenFurnitureAttributes = [
  { name: "kitchen_type", label: "نوع المطبخ", type: "select", options: ["ألمنيوم", "خشب", "PVC", "ستيل", "أخرى"], required: false, sortOrder: 1 },
  { name: "material", label: "المادة", type: "select", options: ["ألمنيوم", "خشب", "PVC", "ستيل", "أخرى"], required: false, sortOrder: 2 },
  { name: "cabinets_count", label: "عدد الخزائن", type: "number", required: false, sortOrder: 3 }
];

const tableChairAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["طاولة طعام", "طاولة مكتب", "طاولة قهوة", "كرسي مكتب", "كرسي طعام", "أخرى"], required: false, sortOrder: 1 },
  { name: "material", label: "المادة", type: "select", options: ["خشب", "معدن", "بلاستيك", "أخرى"], required: false, sortOrder: 2 },
  { name: "seats_count", label: "عدد المقاعد", type: "number", required: false, sortOrder: 3 },
  { name: "foldable", label: "قابل للطي", type: "boolean", required: false, sortOrder: 4 }
];

const officeFurnitureAttributes = [
  { name: "type", label: "النوع", type: "select", options: ["مكتب", "كرسي مكتبي", "خزانة ملفات", "طاولة اجتماعات", "أخرى"], required: false, sortOrder: 1 },
  { name: "material", label: "المادة", type: "select", options: ["خشب", "معدن", "بلاستيك", "أخرى"], required: false, sortOrder: 2 },
  { name: "drawers", label: "أدراج", type: "boolean", required: false, sortOrder: 3 },
  { name: "adjustable", label: "قابل للتعديل", type: "boolean", required: false, sortOrder: 4 }
];

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
      { name: "سيارات للبيع", slug: "cars-for-sale", sortOrder: 1, attributes: carBaseAttributes },
      { name: "سيارات للإيجار", slug: "cars-for-rent", sortOrder: 2, attributes: carForRentAttributes },
      { name: "سيارات للتنازل", slug: "cars-transfer", sortOrder: 3, attributes: carTransferAttributes },
      { name: "قطع غيار", slug: "car-parts", sortOrder: 4, attributes: carPartsAttributes },
      { name: "لوحات مميزة", slug: "special-plates", sortOrder: 5, attributes: specialPlatesAttributes },
      { name: "دراجات نارية", slug: "motorcycles", sortOrder: 6, attributes: motorcycleAttributes },
      { name: "شاحنات ومعدات ثقيلة", slug: "trucks-heavy-equipment", sortOrder: 7, attributes: truckEquipmentAttributes },
      { name: "أخرى", slug: "other-cars", sortOrder: 999, attributes: otherCarsAttributes }
    ]
  },
  {
    name: "العقارات",
    slug: "real-estate",
    sortOrder: 2,
    description: "قسم شامل لعرض جميع أنواع العقارات في اليمن، سواء للبيع أو الإيجار.",
    subcategories: [
      { name: "شقق للبيع", slug: "apartments-for-sale", sortOrder: 1, attributes: apartmentAttributes },
      { name: "شقق للإيجار", slug: "apartments-for-rent", sortOrder: 2, attributes: apartmentAttributes },
      { name: "أراضي", slug: "lands", sortOrder: 3, attributes: landAttributes },
      { name: "فلل", slug: "villas", sortOrder: 4, attributes: villaAttributes },
      { name: "محلات تجارية", slug: "shops", sortOrder: 5, attributes: shopAttributes },
      { name: "مكاتب", slug: "offices", sortOrder: 6, attributes: officeAttributes },
      { name: "استراحات", slug: "lounges", sortOrder: 7, attributes: loungeAttributes },
      { name: "أخرى", slug: "other-real-estate", sortOrder: 999, attributes: [{ name: "property_type", label: "نوع العقار", type: "text" }] }
    ]
  },
  {
    name: "الإلكترونيات",
    slug: "electronics",
    sortOrder: 3,
    description: "قسم مخصص لبيع وشراء الأجهزة الإلكترونية بمختلف أنواعها.",
    subcategories: [
      { name: "جوالات", slug: "mobiles", sortOrder: 1, attributes: mobileAttributes },
      { name: "أجهزة كمبيوتر مكتبية", slug: "desktop-computers", sortOrder: 2, attributes: computerAttributes },
      { name: "لابتوبات", slug: "laptops", sortOrder: 3, attributes: laptopAttributes },
      { name: "شاشات", slug: "screens", sortOrder: 4, attributes: screenAttributes },
      { name: "كاميرات", slug: "cameras", sortOrder: 5, attributes: cameraAttributes },
      { name: "أجهزة ألعاب إلكترونية", slug: "gaming-consoles", sortOrder: 6, attributes: gamingConsoleAttributes },
      { name: "ملحقات الكمبيوتر", slug: "computer-accessories", sortOrder: 7, attributes: computerAccessoryAttributes },
      { name: "الشبكات والاتصالات", slug: "networks-communications", sortOrder: 8, attributes: networkAttributes },
      { name: "الصوتيات", slug: "audio-devices", sortOrder: 9, attributes: audioAttributes },
      { name: "الطابعات والماسحات", slug: "printers-scanners", sortOrder: 10, attributes: printerScannerAttributes },
      { name: "الساعات الذكية", slug: "smart-watches", sortOrder: 11, attributes: smartWatchAttributes },
      { name: "الأجهزة اللوحية (تابلت)", slug: "tablets", sortOrder: 12, attributes: tabletAttributes },
      { name: "أخرى", slug: "other-electronics", sortOrder: 999, attributes: [{ name: "device_type", label: "نوع الجهاز", type: "text" }] }
    ]
  },
  {
    name: "الأثاث",
    slug: "furniture",
    sortOrder: 4,
    description: "قسم لعرض وبيع الأثاث المنزلي والمكتبي.",
    subcategories: [
      { name: "غرف نوم", slug: "bedrooms", sortOrder: 1, attributes: bedroomAttributes },
      { name: "مجالس", slug: "majalis", sortOrder: 2, attributes: majalisAttributes },
      { name: "مطابخ", slug: "kitchens", sortOrder: 3, attributes: kitchenFurnitureAttributes },
      { name: "طاولات وكراسي", slug: "tables-chairs", sortOrder: 4, attributes: tableChairAttributes },
      { name: "أثاث مكتبي", slug: "office-furniture", sortOrder: 5, attributes: officeFurnitureAttributes },
      { name: "أخرى", slug: "other-furniture", sortOrder: 999, attributes: [{ name: "furniture_type", label: "نوع الأثاث", type: "text" }] }
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
  // await CategoryAttribute.deleteMany({});
  // await Category.deleteMany({});
  // console.log("Cleared existing categories and attributes.");

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
