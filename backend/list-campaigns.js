
import mongoose from 'mongoose';
import BrokerageCampaign from './src/models/BrokerageCampaign.js';
import dotenv from 'dotenv';

dotenv.config();

const listCampaigns = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suqaq');
    console.log('Connected to MongoDB');

    // Find all campaigns
    const campaigns = await BrokerageCampaign.find().populate('sellerId', '_id name email');
    console.log('All campaigns:');
    campaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. _id: ${campaign._id}, title: ${campaign.adId?.title || 'N/A'}, seller: ${campaign.sellerId?.name} (${campaign.sellerId?._id})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

listCampaigns();
