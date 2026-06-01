import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const backendEnv = path.join(process.cwd(), ".env.local");
const rootEnv = path.join(process.cwd(), "..", ".env.local");

// Load backend .env.local first as it's more specific
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv, override: true });
}
// Then load root .env.local for shared config
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
// Load .env file
dotenv.config();
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import messageRoutes from "./routes/messages.js";
import emailRoutes from "./routes/email.js";
import orderRoutes from "./routes/orders.js";
import chatRoutes from "./routes/chats.js";
import commentAdminRoutes from "./routes/comments.js";
import planRoutes from "./routes/plans.js";
import purchaseRoutes from "./routes/purchaseRequests.js";
import bankAccountRoutes from "./routes/bankAccounts.js";
import userBankAccountRoutes from "./routes/userBankAccounts.js";
import adminPlansRoutes from "./routes/adminPlans.js";
import adminMessagesRoutes from "./routes/adminMessages.js";
import verificationRequestsRoutes from "./routes/verificationRequests.js";
import tagRoutes from "./routes/tags.js";
import commissionsRoutes from "./routes/commissions.js";
import { connectDB as connectLocal } from "./lib/mongodb.js";
import adminAdsRoutes from "./routes/adminAds.js";
import adminSettingsRoutes from "./routes/adminSettings.js";
import conversationsRoutes from "./routes/conversations.js";
import notificationsRoutes from "./routes/notifications.js";
import blocksRoutes from "./routes/blocks.js";
import favoritesRoutes from "./routes/favorites.js";
import followsRoutes from "./routes/followsUsers.js";
import attributesRoutes from "./routes/attributes.js";
import governorateRoutes from "./routes/governorates.js";
import cityRoutes from "./routes/cities.js";
import sellersRoutes from "./routes/sellers.js";
import adsRoutes from "./routes/ads.js";
import categoryRoutes from "./routes/categories.js";
import categoryAttributeRoutes from "./routes/categoryAttributes.js";
import supportRoutes from "./routes/support.js";
import platformReviewRoutes from "./routes/platformReviews.js";
import resellRoutes from "./routes/resell.js";
import reviewRoutes from "./routes/reviews.js";
import walletRoutes from "./routes/wallets.js";
import adminEscrowRoutes from "./routes/adminEscrow.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";
import sellerAnalyticsRoutes from "./routes/sellerAnalytics.js";
import User from "./models/User.js";
import Ad from "./models/Ad.js";
import Order from "./models/Order.js";
import Dispute from "./models/Dispute.js";
import Notification from "./models/Notification.js";
import { releaseBalance } from "./services/walletService.js";
import { createNotification } from "./services/notificationService.js";
import http from "http";
import { Server } from "socket.io";
import * as Sentry from "@sentry/node";
import logger from "./lib/logger.js";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = [
  "https://souqak-beta.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    // Allow any Vercel deployment of this project
    if (allowedOrigins.includes(origin) || origin.includes("vercel.app")) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Suqaq API Documentation",
      version: "1.0.0",
      description: "API Documentation for Suqaq Marketplace Platform",
      contact: {
        name: "Suqaq Support",
      },
    },
    servers: [
      {
        url: process.env.BACKEND_URL || "http://localhost:5000",
        description: "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const ALLOWED_ORIGINS = allowedOrigins;
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  app.use(Sentry.Handlers.requestHandler());
}
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const WS_URL = BACKEND_URL.replace(/^http/, "ws");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "http:", "https:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", BACKEND_URL, WS_URL, "http://localhost:5000", "ws://localhost:5000", "http://127.0.0.1:5000", "ws://127.0.0.1:5000"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
  })
);
app.use(compression());
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 240,
    skip: (req) => {
      if (req.method === "OPTIONS") return true;
      const p = req.path || req.originalUrl || "";
      // Allow high-frequency GETs for public catalog/payment info
      if (req.method === "GET" && /^\/api\/(bank-accounts|plans|categories|governorates|cities|tags|ads(\/|$))/.test(p)) {
        return true;
      }
      return false;
    }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

connectLocal()
  .then(() => {
    const maskedUri = process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + "..." : "NONE";
    logger.info({ event: "db_connected", uri: maskedUri });
  })
  .catch((err) => {
    logger.error({
      event: "db_connection_failed",
      message: "Critical: Database connection failed during startup!",
      uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + "..." : "NONE",
      error: err.message,
      code: err.code
    });
  });

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir, { etag: true, maxAge: "30d", immutable: true, cacheControl: true }));

app.get("/api/health", async (req, res) => {
  try {
    await connectLocal();
    res.json({ message: "Database Connected" });
  } catch {
    res.status(500).json({ error: "DB connection failed" });
  }
});
app.get("/api/health/liveness", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
app.get("/api/health/readiness", async (req, res) => {
  try {
    await User.findOne().select("_id").lean();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/resell", resellRoutes); // Moved up
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/admin/escrow", adminEscrowRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/seller/analytics", sellerAnalyticsRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/comments", commentAdminRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/purchase-requests", purchaseRoutes);
app.use("/api/bank-accounts", bankAccountRoutes);
app.use("/api/user-bank-accounts", userBankAccountRoutes);
app.use("/api/admin/plans", adminPlansRoutes);
app.use("/api/admin-messages", adminMessagesRoutes);
app.use("/api/verification-requests", verificationRequestsRoutes);
app.use("/api/attributes", attributesRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/admin/ads", adminAdsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/blocks", blocksRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/follows", followsRoutes);
app.use("/api/governorates", governorateRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/sellers", sellersRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/category-attributes", categoryAttributeRoutes);
app.use("/api/commissions", commissionsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/platform-reviews", platformReviewRoutes);
app.use("/api/support", supportRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  res.status(status).json({
    error: status === 500 ? "Internal Server Error" : "Validation Error",
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

app.get("/robots.txt", (req, res) => {
  const host = req.headers.host || "localhost:5000";
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: http://${host}/sitemap.xml`);
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const host = req.headers.host || "localhost:5000";
    const ads = await Ad.find({ status: "approved", isArchived: { $ne: true }, sold: { $ne: true } })
      .select("title updatedAt")
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean();
    const slugify = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9\u0600-\u06FF\-]+/g, "")
        .replace(/\-+/g, "-")
        .replace(/^\-+|\-+$/g, "");
    const urls = ads
      .map((a) => {
        const slug = slugify(a.title) || "ad";
        const loc = `http://${host}/ad/${a._id}/${slug}`;
        const lastmod = new Date(a.updatedAt || Date.now()).toISOString();
        return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`;
      })
      .join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      `<url><loc>http://${host}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>` +
      urls +
      `</urlset>`;
    res.type("application/xml").send(xml);
  } catch {
    res.status(500).type("text/plain").send("error");
  }
});

// Notification Retention Policy: Delete notifications older than 30 days every 24 hours
setInterval(async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await Notification.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
    if (result.deletedCount > 0) {
      logger.info({ event: "notifications_cleanup", deletedCount: result.deletedCount });
    }
  } catch (err) {
    logger.error({ event: "notifications_cleanup_failed", error: err.message });
  }
}, 24 * 60 * 60 * 1000);

const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
});
io.on("connection", (socket) => {
  socket.on("join", ({ productId }) => {
    if (productId) socket.join(`chat:${productId}`);
  });
  socket.on("join_user", async ({ userId }) => {
    if (userId) {
      socket.join(`user:${userId}`);
      socket.userId = userId;
      try {
        const user = await User.findById(userId);
        if (user?.role === "admin") {
          socket.join("role:admin");
        }
        const now = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: true, socketId: socket.id, lastSeen: now });
        socket.broadcast.emit("user:status", { userId, isOnline: true, lastSeen: now });
      } catch {}
    }
  });
  socket.on("join_conversation", ({ conversationId }) => {
    if (conversationId) socket.join(`conv:${conversationId}`);
  });
  socket.on("conversation:typing", ({ conversationId, from }) => {
    if (conversationId) socket.to(`conv:${conversationId}`).emit("conversation:typing", { conversationId, from });
  });
  socket.on("message:delivered", async ({ messageId, conversationId, senderId }) => {
    try {
      const msg = await ConversationMessage.findOneAndUpdate(
        { _id: messageId, status: "sent" },
        { $set: { status: "delivered" } },
        { new: true }
      );
      if (msg) {
        io.to(`user:${senderId}`).emit("message:status_update", { messageId, conversationId, status: "delivered" });
      }
    } catch {}
  });
  socket.on("disconnect", async () => {
    if (socket.userId) {
      try {
        const now = new Date();
        // Atomically update user to offline, but only if the disconnecting socket is the one on record.
        // This prevents a race condition where a quick reconnect is incorrectly marked as offline.
        const updatedUser = await User.findOneAndUpdate(
          { _id: socket.userId, socketId: socket.id },
          { $set: { isOnline: false, lastSeen: now } }
        );

        // If a user was found and updated, broadcast the offline status.
        // If `updatedUser` is null, another socket has already connected, so we do nothing.
        if (updatedUser) {
          socket.broadcast.emit("user:status", { userId: socket.userId, isOnline: false, lastSeen: now });
        }
      } catch {}
    }
  });
});
app.set("io", io);
server.listen(port, () => { console.log("listening", port); });
server.on("listening", () => logger.info({ event: "server_listening", port }));

setInterval(async () => {
  try {
    const now = new Date();
    
    // Auto-approve scheduled ads
    const toApprove = await Ad.find({ status: "pending", scheduledPublishAt: { $lte: now } }).lean();
    if (toApprove.length > 0) {
      const ids = toApprove.map(a => a._id);
      await Ad.updateMany({ _id: { $in: ids } }, { $set: { status: "approved", publishedAt: now, scheduledPublishAt: null } });
      
      for (const a of toApprove) {
        try {
          await createNotification(app, {
            userId: a.userId,
            type: "ad_status",
            title: "تم نشر إعلانك",
            body: `تمت الموافقة على إعلانك ونشره بنجاح: ${a.title}`,
            data: { adId: a._id, status: "approved" }
          });
        } catch {}
      }
    }

    // Existing checks below (some can run less frequently, but every minute is fine for now)
    
    // Expire verification
    await User.updateMany(
      { isVerifiedSeller: true, verificationExpiresAt: { $lte: now } },
      { $set: { isVerifiedSeller: false, verified: false } }
    );
    // Unfeature expired
    await Ad.updateMany(
      { 
        featured: true, 
        $or: [
          { featuredUntil: { $lte: now } },
          { featuredExpiresAt: { $lte: now } }
        ]
      },
      { $set: { featured: false, featuredUntil: null, featuredExpiresAt: null } }
    );
    // Backfill publishedAt/expiresAt for legacy approved ads
    const legacy = await Ad.find({ status: "approved", $or: [{ publishedAt: { $exists: false } }, { publishedAt: null }] })
      .select("_id createdAt")
      .lean();
    if (legacy.length > 0) {
      const bulk = legacy.map((a) => ({
        updateOne: {
          filter: { _id: a._id },
          update: {
            $set: {
              publishedAt: a.createdAt || now,
              expiresAt: new Date(((a.createdAt || now).getTime ? (a.createdAt || now).getTime() : new Date(a.createdAt || now).getTime()) + 40 * 24 * 60 * 60 * 1000),
              expireReminderSent: false
            }
          }
        }
      }));
      if (bulk.length > 0) await Ad.bulkWrite(bulk);
    }
    // Mark ads as expired
    const toExpire = await Ad.find({ status: "approved", expiresAt: { $lte: now } }).lean();
    if (toExpire.length > 0) {
      const ids = toExpire.map((a) => a._id);
      await Ad.updateMany({ _id: { $in: ids } }, { $set: { status: "expired", featured: false } });
      for (const a of toExpire) {
        try {
          await createNotification(app, {
            userId: a.userId,
            type: "ad_status",
            title: "انتهى إعلانك",
            body: `انتهت صلاحية إعلان: ${a.title}`,
            data: { adId: a._id, status: "expired" }
          });
        } catch {}
      }
    }
    // Remind two days before expiry
    const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const remind = await Ad.find({ status: "approved", expiresAt: { $gt: now, $lte: inTwoDays }, expireReminderSent: { $ne: true } }).lean();
    for (const a of remind) {
      try {
        await createNotification(app, {
          userId: a.userId,
          type: "ad_status",
          title: "تنبيه انتهاء الإعلان",
          body: `سينتهي إعلانك "${a.title}" بعد يومين.`,
          data: { adId: a._id, status: "approved" }
        });
        await Ad.updateOne({ _id: a._id }, { $set: { expireReminderSent: true } });
      } catch {}
    }

    // Auto-confirm orders after 7 days of shipping if not confirmed by buyer
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const ordersToConfirm = await Order.find({
      status: "SHIPPED",
      "shippingDetails.shippedAt": { $lte: sevenDaysAgo }
    });

    for (const order of ordersToConfirm) {
      try {
        // التحقق من وجود نزاع مفتوح مرتبط بالطلب
        const openDispute = await Dispute.findOne({
          order: order._id,
          status: "OPEN"
        });

        if (openDispute) {
          logger.info({ event: "auto_confirm_skipped_dispute", orderId: order._id });
          continue;
        }

        order.status = "DELIVERED";
        order.notes = (order.notes || "") + "\nتم التأكيد تلقائياً من النظام بعد مرور 7 أيام على الشحن.";
        await order.save();

        // Release Balance to Seller
        const amountToRelease = Number(order.sellerAmount) || 0;
        if (amountToRelease > 0) {
          await releaseBalance(order.seller, amountToRelease, order._id, order.currency, "PRODUCT");
        }
        if (order.shippingFee > 0 && order.shippingPayer === "buyer") {
          await releaseBalance(order.seller, order.shippingFee, order._id, order.shippingCurrency, "SHIPPING");
        }

        // Notification to seller
        await createNotification(app, {
          userId: order.seller,
          title: "تم استلام الطلب (تلقائياً)",
          body: `تم تأكيد استلام الطلب #${order._id} تلقائياً بعد مرور 7 أيام. تم نقل الرصيد لمحفظتك.`,
          type: "order",
          data: { orderId: order._id }
        });
        
        // Notification to buyer
        await createNotification(app, {
          userId: order.buyer,
          title: "اكتمال الطلب تلقائياً",
          body: `تم إغلاق الطلب #${order._id} وتأكيد الاستلام تلقائياً لعدم وجود شكاوى خلال 7 أيام من الشحن.`,
          type: "order",
          data: { orderId: order._id }
        });
      } catch (err) {
        logger.error({ event: "auto_confirm_order_error", orderId: order._id, message: err.message });
      }
    }
  } catch (e) { logger.error({ event: "cron_error", message: e.message }); if (process.env.SENTRY_DSN) Sentry.captureException(e); }
}, 60 * 1000); // Changed from 1h to 1m for auto-approval support

app.use((err, req, res, next) => {
  logger.error({ event: "http_error", route: req.originalUrl, method: req.method, message: err.message });
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({ error: "Server error" });
});
