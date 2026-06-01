import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import ConversationMessage from "../models/ConversationMessage.js";
import SupportConversation from "../models/SupportConversation.js";
import SupportMessage from "../models/SupportMessage.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/suqaq";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function cleanupDeletedItems() {
  console.log("[Cleanup] Starting cleanup of soft-deleted items older than 30 days...");
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[Cleanup] Connected to MongoDB");

    const cutoffDate = new Date(Date.now() - THIRTY_DAYS_MS);
    console.log(`[Cleanup] Cutoff date: ${cutoffDate.toISOString()}`);

    let totalDeleted = 0;

    const oldConversations = await Conversation.find({
      isDeletedByAdmin: true,
      deletedByAdminAt: { $lt: cutoffDate }
    }).select("_id");
    
    if (oldConversations.length > 0) {
      const convIds = oldConversations.map(c => c._id);
      
      const deletedMessages = await ConversationMessage.deleteMany({ conversationId: { $in: convIds } });
      console.log(`[Cleanup] Deleted ${deletedMessages.deletedCount} messages from old conversations`);
      
      const deletedConvs = await Conversation.deleteMany({ _id: { $in: convIds } });
      console.log(`[Cleanup] Permanently deleted ${deletedConvs.deletedCount} conversations`);
      
      totalDeleted += deletedConvs.deletedCount;
    }

    const oldSupportConversations = await SupportConversation.find({
      deletedByAdmin: true,
      deletedByAdminAt: { $lt: cutoffDate }
    }).select("_id");
    
    if (oldSupportConversations.length > 0) {
      const supportConvIds = oldSupportConversations.map(c => c._id);
      
      const deletedSupportMessages = await SupportMessage.deleteMany({ conversationId: { $in: supportConvIds } });
      console.log(`[Cleanup] Deleted ${deletedSupportMessages.deletedCount} support messages`);
      
      const deletedSupportConvs = await SupportConversation.deleteMany({ _id: { $in: supportConvIds } });
      console.log(`[Cleanup] Permanently deleted ${deletedSupportConvs.deletedCount} support conversations`);
      
      totalDeleted += deletedSupportConvs.deletedCount;
    }

    const oldConversationMessages = await ConversationMessage.find({
      isDeleted: true,
      deletedAt: { $lt: cutoffDate }
    }).select("_id");
    
    if (oldConversationMessages.length > 0) {
      const msgIds = oldConversationMessages.map(m => m._id);
      const deletedMsgs = await ConversationMessage.deleteMany({ _id: { $in: msgIds } });
      console.log(`[Cleanup] Permanently deleted ${deletedMsgs.deletedCount} old conversation messages`);
    }

    console.log(`[Cleanup] Total items permanently deleted: ${totalDeleted}`);
    console.log("[Cleanup] Cleanup completed successfully");
  } catch (error) {
    console.error("[Cleanup] Error during cleanup:", error);
  } finally {
    await mongoose.disconnect();
    console.log("[Cleanup] Disconnected from MongoDB");
  }
}

cleanupDeletedItems();