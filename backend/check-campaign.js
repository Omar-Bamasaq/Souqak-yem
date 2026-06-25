
import mongoose from 'mongoose';
import BrokerageCampaign from './src/models/BrokerageCampaign.js';
import dotenv from 'dotenv';

dotenv.config();

const checkCampaign = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/suqaq');
    console.log('Connected to MongoDB');

    // Check the specific campaign
    const campaignId = '6a3cf0803944cfe415a3d58a';
    const campaign = await BrokerageCampaign.findById(campaignId).populate('sellerId', '_id name email');

    if (!campaign) {
      console.log(`Campaign with ID ${campaignId} not found!`);
    } else {
      console.log('Campaign found:', {
        _id: campaign._id,
        state: campaign.state,
        seller: campaign.sellerId ? `${campaign.sellerId.name} (${campaign.sellerId._id})` : 'N/A'
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkCampaign();
