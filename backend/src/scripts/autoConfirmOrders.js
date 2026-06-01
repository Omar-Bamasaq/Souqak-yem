import Order from "../models/Order.js";
import Dispute from "../models/Dispute.js";
import { releaseBalance } from "../services/walletService.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

/**
 * تأكيد استلام الطلبات تلقائياً بعد مرور 7 أيام على الشحن
 * يتم إيقاف التأكيد التلقائي في حال وجود نزاع مفتوح
 */
async function autoConfirmOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Checking for orders to auto-confirm...");

        // 7 أيام بدلاً من 48 ساعة
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const ordersToConfirm = await Order.find({
            status: "SHIPPED",
            "shippingDetails.shippedAt": { $lte: sevenDaysAgo }
        });

        console.log(`Found ${ordersToConfirm.length} orders to check for auto-confirmation.`);

        for (const order of ordersToConfirm) {
            // التحقق من وجود نزاع مفتوح مرتبط بالطلب
            const openDispute = await Dispute.findOne({
                order: order._id,
                status: "OPEN"
            });

            if (openDispute) {
                console.log(`Order #${order._id} has an open dispute. Skipping auto-confirmation.`);
                continue;
            }

            order.status = "DELIVERED";
            await order.save();

            // تحرير الرصيد للبائع
            await releaseBalance(order.seller, order.sellerAmount, order._id);

            // إشعار للبائع
            await createNotification(null, {
                userId: order.seller,
                title: "تأكيد استلام تلقائي",
                body: `تم تأكيد استلام الطلب #${order._id} تلقائياً لمرور 7 أيام على الشحن. تم نقل الرصيد لمحفظتك.`,
                type: "order",
                data: { orderId: order._id }
            });

            // إشعار للمشتري
            await createNotification(null, {
                userId: order.buyer,
                title: "تأكيد استلام تلقائي",
                body: `تم تأكيد استلام الطلب #${order._id} تلقائياً بعد مرور 7 أيام من الشحن.`,
                type: "order",
                data: { orderId: order._id }
            });

            console.log(`Order #${order._id} auto-confirmed.`);
        }

        console.log("Done.");
        process.exit(0);
    } catch (err) {
        console.error("Auto confirm error:", err);
        process.exit(1);
    }
}

autoConfirmOrders();
