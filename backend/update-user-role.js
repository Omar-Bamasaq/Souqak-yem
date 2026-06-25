
import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const updateUserRole = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suqaq');
    console.log('Connected to MongoDB');

    // Replace with your user's _id (from list-users.js output)
    const userId = '6a1dd03582050a0745ded1e8'; // UPDATE THIS TO YOUR USER ID
    const newRole = 'seller';

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true }
    );

    if (!updatedUser) {
      console.log('User not found!');
    } else {
      console.log('Updated user:', {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateUserRole();
