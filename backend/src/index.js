import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";
import requestIp from "request-ip";
import addRequestId from "express-request-id";
import { securityHeaders, csrfProtection, botDetection } from "./middleware/security.js";
import { logSecurityEvent } from "./utils/logger.js";
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
import filesRoutes from "./routes/files.js";
import governorateRoutes from "./routes/governorates.js";
import cityRoutes from "./routes/cities.js";
import sellersRoutes from "./routes/sellers.js";
import adsRoutes from "./routes/ads.js";
import categoryRoutes from "./routes/categories.js";
import categoryAttributeRoutes from "./routes/categoryAttributes.js";
import supportRoutes from "./routes/support.js";
import platformReviewRoutes from "./routes/platformReviews.js";
import reviewRoutes from "./routes/reviews.js";
import walletRoutes from "./routes/wallets.js";
import adminEscrowRoutes from "./routes/adminEscrow.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";
import sellerAnalyticsRoutes from "./routes/sellerAnalytics.js";
import brokerageRoutes from "./routes/brokerage.js";
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
import { verifyEmailAccounts } from "./utils/emailSender.js";
import expireWelcomePromotions from "./scripts/expireWelcomePromotions.js";

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = [
  "https://souqak-beta.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174"
];

app.use(addRequestId());
app.use(requestIp.mw());

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Enhanced CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isVercel = origin.includes("vercel.app");
    const isLocal = origin.includes("localhost");
    if (allowedOrigins.includes(origin) || isVercel || isLocal) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback to allow during debug
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token"],
  exposedHeaders: ["Set-Cookie"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight globally

// Global Security Middleware
app.use(securityHeaders);
app.use(botDetection);
// app.use(csrfProtection); // تعطيل مؤقت لحل مشكلة Invalid CSRF Token أثناء الدخول من Vercel

app.get("/api/version", (req, res) => {
  res.json({ version: "1.0.1", patch_fix: true, timestamp: new Date().toISOString() });
});

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

// تمت إزالة helmet المكرر هنا لأنه يتم تطبيقه في securityHeaders بالأعلى مع إعدادات CSP المتقدمة

// Security Middlewares
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss()); // Prevent Basic XSS
app.use(hpp()); // Prevent Parameter Pollution

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 240,
    skip: (req) => {
      if (req.method === "OPTIONS") return true;
      const p = req.path || req.originalUrl || "";
      // Allow high-frequency GETs for public catalog/payment info, notifications, admin settings and messages
      if (req.method === "GET" && /^\/api\/(bank-accounts|plans|categories|governorates|cities|tags|ads|notifications|admin-messages|admin\/settings|admin|conversations)(\/|$)/.test(p)) {
        return true;
      }
      // Skip auth endpoints entirely
      if (/^\/api\/auth/.test(p)) {
        return true;
      }
      return false;
    }
  })
);
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

const uploadDir = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Fallback for missing images in /uploads
app.use("/uploads", filesRoutes); // إضافة حماية للملفات الحساسة
app.use("/uploads", (req, res, next) => {
  // منع الوصول المباشر للمجلدات الحساسة (إذا فشل الـ middleware أعلاه أو تم تجاوز auth)
  const sensitiveFolders = ["ids", "kyc", "documents", "receipts"];
  const requestedFolder = req.path.split("/")[1];
  
  if (sensitiveFolders.includes(requestedFolder)) {
    return res.status(403).json({ error: "Access denied to sensitive documents. Use the protected API instead." });
  }

  const filePath = path.join(uploadDir, req.path);
  if (!fs.existsSync(filePath)) {
    const isCategory = req.path.includes("categories") || req.path.includes("category-");
    const isAvatar = req.path.includes("avatars") || req.path.includes("avatar-");
    
    if (isCategory) {
      return res.sendFile(path.join(uploadDir, "category-placeholder.svg"));
    }
    return res.sendFile(path.join(uploadDir, "placeholder.svg"));
  }
  next();
});

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

// Debug SMTP Connectivity
app.get("/api/debug/smtp", async (req, res) => {
  const targetHost = "74.125.69.108";
  const ports = [465, 587];
  const results = [];
  
  const net = await import("net");
  
  for (const port of ports) {
    const socket = new net.Socket();
    const promise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ port, status: "TIMEOUT", error: "5s timeout exceeded" });
      }, 5000);

      socket.connect(port, targetHost, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ port, status: "OPEN" });
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        resolve({ port, status: "CLOSED", error: err.message });
      });
    });
    results.push(await promise);
  }

  res.json({
    host: targetHost,
    results,
    advice: results.find(r => r.status === "OPEN") 
      ? `Port ${results.find(r => r.status === "OPEN").port} is available. Use it.`
      : "All ports are blocked by Render. You must use a specialized service like Resend or SendGrid."
  });
});

app.use("/api/sellers", sellersRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/category-attributes", categoryAttributeRoutes);
app.use("/api/commissions", commissionsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/platform-reviews", platformReviewRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/brokerage", brokerageRoutes);

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

// Verify Email Accounts on Startup
verifyEmailAccounts().catch(err => {
  console.error("[EMAIL SYSTEM] Startup verification failed:", err.message);
});

const io = new Server(server, {
  cors: corsOptions
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
    if (remind.length > 0) {
      const ids = remind.map((a) => a._id);
      await Ad.updateMany({ _id: { $in: ids } }, { $set: { expireReminderSent: true } });
      for (const a of remind) {
        try {
          await createNotification(app, {
            userId: a.userId,
            type: "ad_status",
            title: "تنبيه بانتهاء إعلانك",
            body: `سينتهي إعلانك "${a.title}" خلال 48 ساعة. هل تم بيعه؟`,
            data: { adId: a._id, action: "renew_or_sold" }
          });
        } catch {}
      }
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

    // Expire Welcome Promotions
    try {
      await expireWelcomePromotions();
    } catch (err) {
      logger.error({ event: "expire_welcome_promotions_error", message: err.message });
    }
  } catch (e) { logger.error({ event: "cron_error", message: e.message }); if (process.env.SENTRY_DSN) Sentry.captureException(e); }
}, 60 * 1000);

app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  
  logger.error({ 
    event: "unhandled_error", 
    route: req.originalUrl, 
    method: req.method, 
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    ip: req.clientIp || req.ip,
    requestId: req.id
  });

  if (process.env.SENTRY_DSN) Sentry.captureException(err);

  // Generic error message in production, detailed in development
  res.status(err.status || 500).json({ 
    error: isProduction ? "حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً." : err.message 
  });
});
