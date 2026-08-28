import Order from "../models/Order.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

/**
 * إلغاء الطلبات التي لم يتم دفعها خلال 12 ساعة
 */
async function autoCancelUnpaidOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Checking for unpaid orders to auto-cancel...");

        // 12 ساعة كحد أقصى للدفع بعد موافقة البائع
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        const ordersToCancel = await Order.find({
            status: "AWAITING_PAYMENT",
            updatedAt: { $lte: twelveHoursAgo }
        });

        console.log(`Found ${ordersToCancel.length} orders to cancel.`);

        for (const order of ordersToCancel) {
            order.status = "CANCELLED";
            order.notes = (order.notes || "") + " [إلغاء تلقائي لعدم الدفع خلال المهلة]";
            await order.save();

            // إشعار للمشتري
            await createNotification(null, {
                userId: order.buyer,
                title: "تم إلغاء الطلب",
                body: `تم إلغاء طلبك #${order._id} تلقائياً لعدم إتمام عملية الدفع خلال المهلة المحددة (12 ساعة).`,
                type: "order",
                data: { orderId: order._id }
            });

            // إشعار للبائع
            await createNotification(null, {
                userId: order.seller,
                title: "تم إلغاء طلب شراء",
                body: `تم إلغاء الطلب #${order._id} تلقائياً لأن المشتري لم يقم بالدفع خلال المهلة المحددة.`,
                type: "order",
                data: { orderId: order._id }
            });

            console.log(`Order #${order._id} auto-cancelled.`);
        }

        console.log("Done.");
        process.exit(0);
    } catch (err) {
        console.error("Auto cancel error:", err);
        process.exit(1);
    }
}

autoCancelUnpaidOrders();
