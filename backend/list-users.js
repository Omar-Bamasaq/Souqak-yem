
import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const listAllUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suqaq');
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find().select('_id name email role');
    console.log('All users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. _id: ${user._id}, name: ${user.name}, email: ${user.email}, role: ${user.role}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

listAllUsers();
