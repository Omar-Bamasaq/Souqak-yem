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

async function verifyAdmin() {
  try {
    await connectDB();
    
    const admin = await User.findOneAndUpdate(
      { email: '123@souqak.com' },
      { isEmailVerified: true },
      { new: true }
    );
    
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    console.log('\n✅ تم تفعيل حساب الـ Admin بنجاح!\n');
    console.log('=============================');
    console.log('البريد: 123@souqak.com');
    console.log('حالة التوثيق: ✅ مفعل');
    console.log('=============================\n');
    
    process.exit(0);
  } catch (e) {
    console.error('خطأ:', e.message);
    process.exit(1);
  }
}

verifyAdmin();
