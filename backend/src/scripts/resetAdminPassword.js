import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(__dirname, '..', '..', '..', '.env.local');
const backendEnv = join(__dirname, '..', '..', '.env.local');

if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });

import { connectDB } from '../lib/mongodb.js';
import User from '../models/User.js';

const NEW_PASSWORD = '123';

async function resetAdminPassword() {
  try {
    await connectDB();
    
    // Find admin user
    const admin = await User.findOne({ email: '123@souqak.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
    
    // Update password
    admin.password = hashedPassword;
    await admin.save();
    
    console.log('\n✅ تم إعادة تعيين كلمة مرور الـ Admin بنجاح!\n');
    console.log('=============================');
    console.log('البريد: 123@souqak.com');
    console.log('كلمة المرور: ' + NEW_PASSWORD);
    console.log('=============================\n');
    
    process.exit(0);
  } catch (e) {
    console.error('خطأ:', e.message);
    process.exit(1);
  }
}

resetAdminPassword();
