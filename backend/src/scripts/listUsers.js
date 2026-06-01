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

async function listUsers() {
  try {
    await connectDB();
    const users = await User.find({}, 'name email role isEmailVerified isVerifiedSeller createdAt').lean();
    console.log('\n=== قائمة المستخدمين المسجلين ===\n');
    console.log(`عدد المستخدمين: ${users.length}\n`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.name}`);
      console.log(`   البريد: ${u.email}`);
      console.log(`   الدور: ${u.role}`);
      console.log(`   توثيق البريد: ${u.isEmailVerified ? '✅' : '❌'}`);
      console.log(`   توثيق البائع: ${u.isVerifiedSeller ? '✅' : '❌'}`);
      console.log(`   تاريخ التسجيل: ${new Date(u.createdAt).toLocaleDateString('ar-YE')}`);
      console.log('');
    });
    process.exit(0);
  } catch (e) {
    console.error('خطأ:', e.message);
    process.exit(1);
  }
}

listUsers();
