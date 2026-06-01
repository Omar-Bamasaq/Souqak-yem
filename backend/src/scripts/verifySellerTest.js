import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(__dirname, '..', '..', '..', '.env.local');
const backendEnv = join(__dirname, '..', '..', '.env.local');

if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });

import { connectDB } from '../lib/mongodb.js';
import User from '../models/User.js';

async function verifySellerTest() {
  try {
    await connectDB();
    
    const seller = await User.findOneAndUpdate(
      { email: 'seller@yemenmarket.com' },
      { isEmailVerified: true },
      { new: true }
    );
    
    if (!seller) {
      console.log('❌ Seller Test user not found');
      process.exit(1);
    }
    
    console.log('\n✅ تم تخطي توثيق البريد لـ Seller Test بنجاح!\n');
    console.log('=============================');
    console.log('الاسم: ' + seller.name);
    console.log('البريد: seller@yemenmarket.com');
    console.log('حالة توثيق البريد: ✅ مفعل (تم التخطي)');
    console.log('=============================\n');
    
    process.exit(0);
  } catch (e) {
    console.error('خطأ:', e.message);
    process.exit(1);
  }
}

verifySellerTest();
