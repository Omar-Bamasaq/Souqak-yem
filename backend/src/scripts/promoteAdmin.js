import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const promoteToAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const username = "admin123";
    const phone = "Aa123456";

    // البحث عن المستخدم بالاسم أو رقم الهاتف
    let user = await User.findOne({ 
      $or: [
        { name: username },
        { phone: phone }
      ]
    });

    if (!user) {
      console.log(`User ${username} with phone ${phone} not found. Creating a new admin account...`);
      // إذا لم يكن موجوداً، نقوم بإنشائه (بكلمة مرور افتراضية 123456)
      // ملاحظة: يفضل تغيير كلمة المرور فوراً بعد الدخول
      user = new User({
        name: username,
        phone: phone,
        email: "admin123@souqak.com", // إضافة بريد إلكتروني افتراضي لتجاوز خطأ الـ Validation
        role: "admin",
        password: "123", // سيتم تشفيرها تلقائياً بواسطة الموديل
        isPhoneVerified: true
      });
      await user.save();
      console.log("Admin account created successfully.");
    } else {
      console.log(`User found: ${user.name}. Promoting to admin...`);
      user.role = "admin";
      await user.save();
      console.log("User promoted to admin successfully.");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error promoting user to admin:", error);
    process.exit(1);
  }
};

promoteToAdmin();
