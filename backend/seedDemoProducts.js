/*
How to run:
  node seedDemoProducts.js
*/
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";
import Product from "./src/models/Product.js";

async function ensureSeller() {
  let seller = await User.findOne({ role: "seller" });
  if (seller) return seller;
  const hash = await bcrypt.hash("Seller123!", 10);
  seller = await User.create({
    name: "بائع تجريبي",
    email: "demo-seller@suqak.com",
    password: hash,
    role: "seller",
    phone: "771234567",
    isPhoneVerified: true
  });
  return seller;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/yemen_market";
  await mongoose.connect(mongoUri);
  const seller = await ensureSeller();

  const locations = ["صنعاء", "عدن", "تعز", "الحديدة", "إب", "حضرموت", "مأرب"];

  const catalog = [
    {
      category: "سيارات",
      title: "تويوتا كورولا 2018 حالة ممتازة",
      price: 3800,
      currency: "USD",
      description: "سيارة نظيفة، فحص شامل، لا تحتاج مصاريف.",
      image: "placeholder-car.svg"
    },
    {
      category: "سيارات",
      title: "هيونداي سوناتا 2016 كاملة المواصفات",
      price: 3200,
      description: "مكيف بارد، جنوط، شاشة، قيادة مريحة.",
      image: "placeholder-car.svg"
    },
    {
      category: "عقارات",
      title: "شقة سكنية 3 غرف في صنعاء",
      price: 25000,
      description: "شقة واسعة بالقرب من الخدمات، تشطيبات ممتازة.",
      image: "placeholder-home.svg"
    },
    {
      category: "عقارات",
      title: "منزل مستقل في الحديدة",
      price: 18000,
      description: "بيت مستقل مع فناء واسع، قريب من السوق.",
      image: "placeholder-home.svg"
    },
    {
      category: "إلكترونيات",
      title: "لابتوب ديل i7 رام 16GB",
      price: 450,
      description: "جهاز قوي للعمل والدراسة، بطارية جيدة.",
      image: "placeholder-electronics.svg"
    },
    {
      category: "إلكترونيات",
      title: "تلفاز سامسونج 55 بوصة 4K",
      price: 600,
      description: "جودة صورة عالية، ذكي، يدعم التطبيقات.",
      image: "placeholder-electronics.svg"
    },
    {
      category: "جوالات",
      title: "آيفون 12 برو مستعمل نظيف",
      price: 700,
      description: "جهاز نظيف، بدون خدوش، بطارية جيدة.",
      image: "placeholder-phone.svg"
    },
    {
      category: "جوالات",
      title: "سامسونج S22 شبه جديد",
      price: 550,
      description: "كاميرا ممتازة، شاشة رائعة، استخدام بسيط.",
      image: "placeholder-phone.svg"
    },
    {
      category: "أثاث",
      title: "غرفة نوم خشب زان مستخدم",
      price: 300,
      description: "خشب متين، دولاب واسع، بحالة جيدة.",
      image: "placeholder-furniture.svg"
    },
    {
      category: "أثاث",
      title: "صالون مودرن 5 قطع",
      price: 400,
      description: "تصميم عصري، إسفنج مريح، قماش نظيف.",
      image: "placeholder-furniture.svg"
    },
    {
      category: "وظائف",
      title: "مطلوب محاسب خبرة 3 سنوات",
      price: 1,
      description: "فرصة عمل بدوام كامل، راتب مجزي.",
      image: "placeholder-jobs.svg"
    },
    {
      category: "وظائف",
      title: "فرصة عمل مندوب مبيعات",
      price: 1,
      description: "العمل ميداني، عمولات ممتازة، تدريب متوفر.",
      image: "placeholder-jobs.svg"
    }
  ];

  let created = 0;
  for (const item of catalog) {
    const exists = await Product.findOne({ title: item.title }).lean();
    if (exists) continue;
    await Product.create({
      seller: seller._id,
      title: item.title,
      description: item.description,
      price: item.price,
      category: item.category,
      location: pick(locations),
      images: [item.image],
      status: "approved"
    });
    created++;
  }

  console.log(`Demo products created: ${created}`);
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
