import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  console.log('Attempting to connect to:', uri.split('@')[1] || 'URL hidden for security');
  
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    });
    console.log('✅ Connection successful!');
    
    // Check database name
    console.log('Connected to database:', mongoose.connection.name);
    
    // List collections to verify access
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name).join(', ') || 'None (New Database)');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

testConnection();
