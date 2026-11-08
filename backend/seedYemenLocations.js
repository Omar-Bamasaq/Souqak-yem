
import { fileURLToPath } from "url";
import path from "path";
import mongoose from "mongoose";
import Governorate from "./src/models/Governorate.js";
import City from "./src/models/City.js";
import {
  connectPrelaunchDatabase,
  requireReferenceDataApproval,
  resolvePrelaunchTarget,
  safeErrorSummary
} from "./src/lib/prelaunchDatabase.js";

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

export async function seedYemenLocations({
  GovernorateModel = Governorate,
  CityModel = City,
  locationData = locations,
  env = process.env
} = {}) {
  resolvePrelaunchTarget(env);
  requireReferenceDataApproval(env);
  const results = { governorates: 0, cities: 0 };
  for (const loc of locationData) {
    let gov = await GovernorateModel.findOne({ name: loc.governorate });
    if (!gov) {
      try {
        gov = await GovernorateModel.create({ name: loc.governorate });
        results.governorates += 1;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        gov = await GovernorateModel.findOne({ name: loc.governorate });
        if (!gov) throw error;
      }
    }

    for (const cityName of loc.cities) {
      try {
        const result = await CityModel.updateOne(
          { name: cityName, governorateId: gov._id },
          { $setOnInsert: { name: cityName, governorateId: gov._id, isActive: true } },
          { upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        if (result.upsertedCount > 0 || result.upsertedId) {
          results.cities += 1;
        }
      } catch (error) {
        if (error?.code !== 11000) throw error;
        const city = await CityModel.findOne({ name: cityName, governorateId: gov._id });
        if (!city) throw error;
      }
    }
  }

  return results;
}

export async function run() {
  const env = process.env;
  resolvePrelaunchTarget(env);
  requireReferenceDataApproval(env);
  await connectPrelaunchDatabase(env);
  try {
    await Governorate.createIndexes();
    await City.createIndexes();
    const result = await seedYemenLocations({ env });
    console.log(`Reference location seed complete. New governorates: ${result.governorates}; new cities: ${result.cities}.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    console.error("Reference location seed failed.", safeErrorSummary(error));
    process.exitCode = 1;
  });
}
