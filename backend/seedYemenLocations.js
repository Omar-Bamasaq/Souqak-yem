
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import mongoose from "mongoose";
import Governorate from "./src/models/Governorate.js";
import City from "./src/models/City.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendEnv = join(__dirname, ".env.local");
const rootEnv = join(__dirname, "..", ".env.local");

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv, override: true });
}
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config();

const locations = [
  {
    governorate: "صنعاء",
    cities: ["صنعاء (العاصمة)", "بني مطر", "سنحان", "همدان", "الحيمة الداخلية", "الحيمة الخارجية", "أرحب", "بني حشيش", "الطيال", "مناخة"]
  },
  {
    governorate: "عدن",
    cities: ["كريتر", "المعلا", "التواهي", "خور مكسر", "الشيخ عثمان", "المنصورة", "دار سعد", "البريقة", "صيرة", "الشعب"]
  },
  {
    governorate: "تعز",
    cities: ["تعز", "المخا", "الشمايتين", "التربة", "جبل حبشي", "ماوية", "موزع", "الوازعية", "المسراخ", "صبر الموادم"]
  },
  {
    governorate: "حضرموت",
    cities: ["المكلا", "سيئون", "تريم", "الشحر", "القطن", "شبام", "الديس الشرقية", "غيل باوزير", "الريدة وقصيعر", "حجر"]
  },
  {
    governorate: "إب",
    cities: ["إب", "جبلة", "العدين", "يريم", "السدة", "الرضمة", "حبيش", "ذي السفال", "القفر", "فرع العدين"]
  },
  {
    governorate: "الحديدة",
    cities: ["الحديدة", "باجل", "زبيد", "بيت الفقيه", "الدريهمي", "التحيتا", "الخوخة", "اللحية", "المنيرة", "الصليف"]
  },
  {
    governorate: "مأرب",
    cities: ["مأرب", "صرواح", "الوادي", "مدغل", "حريب", "الجوبة", "رغوان", "ماهلية", "رحبة", "العبدية"]
  },
  {
    governorate: "الجوف",
    cities: ["الحزم", "خب والشعف", "برط العنان", "الغيل", "المتون", "المصلوب", "الزاهر", "الرجوزة", "الحزم (مركز)", "اليتمة"]
  },
  {
    governorate: "صعدة",
    cities: ["صعدة", "رازح", "باقم", "سحار", "ساقين", "حيدان", "الظاهر", "مجز", "شدا", "غمر"]
  },
  {
    governorate: "عمران",
    cities: ["عمران", "خمر", "حوث", "حرف سفيان", "ثلاء", "عيال سريح", "جبل عيال يزيد", "المدان", "القفلة", "السودة"]
  },
  {
    governorate: "ذمار",
    cities: ["ذمار", "معبر", "عنس", "وصاب العالي", "وصاب السافل", "جهران", "عتمة", "ميفعة عنس", "الحداء", "المنار"]
  },
  {
    governorate: "البيضاء",
    cities: ["البيضاء", "رداع", "ذي ناعم", "الطفة", "الزاهر", "الصومعة", "السوادية", "ناطع", "العرش", "مكيراس"]
  },
  {
    governorate: "لحج",
    cities: ["الحوطة", "تبن", "طور الباحة", "ردفان", "القبيطة", "المسيمير", "الملاح", "كرش", "المضاربة", "يافع"]
  },
  {
    governorate: "أبين",
    cities: ["زنجبار", "خنفر (جعار)", "لودر", "مودية", "أحور", "الوضيع", "المحفد", "رصد", "سباح", "سرار"]
  },
  {
    governorate: "شبوة",
    cities: ["عتق", "بيحان", "عسيلان", "نصاب", "حبان", "رضوم", "مرخة العليا", "مرخة السفلى", "الصعيد", "الطلح"]
  },
  {
    governorate: "المهرة",
    cities: ["الغيضة", "قشن", "سيحوت", "حوف", "المسيلة", "حصوين", "منعر", "شحن", "حات", "شحن الساحل"]
  },
  {
    governorate: "الضالع",
    cities: ["الضالع", "قعطبة", "الحصين", "الشعيب", "الأزارق", "جحاف", "دمت", "الحشاء", "سناح", "جبن"]
  },
  {
    governorate: "ريمة",
    cities: ["الجبين", "السلفية", "كسمة", "مزهر", "بلاد الطعام", "الجعفرية", "السخنة", "بني الضبيبي", "مزهر (مركز)", "كسمة (مناطق)"]
  },
  {
    governorate: "حجة",
    cities: ["حجة", "عبس", "كشر", "مبين", "المحابشة", "الشغادرة", "نجرة", "أسلم", "المفتاح", "أفلح الشام"]
  },
  {
    governorate: "المحويت",
    cities: ["المحويت", "الطويلة", "حفاش", "ملحان", "الرجم", "الخبت", "بني سعد", "شبام كوكبان", "مناخة", "بني مطر (جزء)"]
  },
  {
    governorate: "سقطرى",
    cities: ["حديبو", "قلنسية", "عبد الكوري", "قشين", "نوجد", "مومي", "ديكسم", "حلة", "سقطرى الساحل", "سقطرى الجبال"]
  }
];

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yemen_market";
  console.log(`Connecting to MongoDB... (URI: ${mongoUri.substring(0, 40)}...)`);
  await mongoose.connect(mongoUri, { family: 4 });

  console.log("Starting seeding of Yemen locations...");

  for (const loc of locations) {
    let gov = await Governorate.findOne({ name: loc.governorate });
    if (!gov) {
      gov = await Governorate.create({ name: loc.governorate });
      console.log(`Created Governorate: ${gov.name}`);
    } else {
      console.log(`Governorate already exists: ${gov.name}`);
    }

    for (const cityName of loc.cities) {
      let city = await City.findOne({ name: cityName, governorateId: gov._id });
      if (!city) {
        city = await City.create({ name: cityName, governorateId: gov._id });
        console.log(`  - Created City: ${city.name}`);
      } else {
        console.log(`  - City already exists: ${city.name}`);
      }
    }
  }

  console.log("Seeding complete!");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Seeding failed:", err && err.message ? err.message : err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
