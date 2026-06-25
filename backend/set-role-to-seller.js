
import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const setUserRoleToSeller = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suqaq');
    console.log('Connected to MongoDB');

    // Find the first user (adjust the query if you know your email or name)
    const user = await User.findOne(); // Or use User.findOne({ email: 'your-email@example.com' });
    if (!user) {
      console.log('No user found!');
      return;
    }

    console.log('Current user:', { _id: user._id, name: user.name, email: user.email, role: user.role });

    // Update role to seller
    user.role = 'seller';
    await user.save();

    console.log('Updated user role to "seller":', { _id: user._id, name: user.name, email: user.email, role: user.role });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

setUserRoleToSeller();
