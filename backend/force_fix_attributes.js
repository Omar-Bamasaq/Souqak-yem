
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const REMOTE_URI = process.env.MONGODB_URI;

async function forceFix() {
  const client = new MongoClient(REMOTE_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const categories = await db.collection("categories").find().toArray();
    
    // 1. Defined standard attributes for major categories that are empty
    const furnitureAttrs = [
      { name: "material", label: "المادة", type: "select", options: ["خشب", "معدن", "بلاستيك", "زجاج", "جلد", "قماش", "أخرى"], required: false, sortOrder: 1 },
      { name: "condition", label: "الحالة", type: "select", options: ["جديد", "مستعمل بحالة ممتازة", "مستعمل بحالة جيدة", "مستعمل بحالة متوسطة"], required: false, sortOrder: 2 },
      { name: "color", label: "اللون", type: "text", required: false, sortOrder: 3 }
    ];

    const jobAttrs = [
      { name: "job_type", label: "نوع الوظيفة", type: "select", options: ["دوام كامل", "دوام جزئي", "عقد", "عمل حر", "تدريب"], required: false, sortOrder: 1 },
      { name: "experience", label: "سنوات الخبرة", type: "number", required: false, sortOrder: 2 },
      { name: "education", label: "المستوى التعليمي", type: "select", options: ["ثانوي", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"], required: false, sortOrder: 3 }
    ];

    const animalAttrs = [
      { name: "age", label: "العمر", type: "text", required: false, sortOrder: 1 },
      { name: "gender", label: "الجنس", type: "select", options: ["ذكر", "أنثى"], required: false, sortOrder: 2 },
      { name: "health", label: "الحالة الصحية", type: "text", required: false, sortOrder: 3 }
    ];

    const mapping = {
      "furniture": furnitureAttrs,
      "jobs": jobAttrs,
      "animals": animalAttrs
    };

    let totalFixed = 0;
    for (const [parentSlug, attrs] of Object.entries(mapping)) {
      const parent = categories.find(c => c.slug === parentSlug);
      if (!parent) continue;

      const children = categories.filter(c => String(c.parentId) === String(parent._id));
      for (const child of children) {
        // Check if child has attributes
        const existingCount = await db.collection("categoryattributes").countDocuments({ categoryId: child._id });
        if (existingCount === 0) {
          console.log(`Fixing ${child.name} (${child.slug})...`);
          const toInsert = attrs.map(a => ({ ...a, categoryId: child._id }));
          await db.collection("categoryattributes").insertMany(toInsert);
          totalFixed += toInsert.length;
        }
      }
    }

    console.log(`\nForce Fix Summary: Inserted ${totalFixed} standard attributes.`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
forceFix();
