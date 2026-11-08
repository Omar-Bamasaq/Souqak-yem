import { Router } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import path from "node:path";
import sharp from "sharp";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { uploadStoreOrderReceipt } from "../middleware/upload.js";
import Ad from "../models/Ad.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import StoreCart from "../models/StoreCart.js";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import User from "../models/User.js";
import {
  createStoreOrderNotification,
  createStoreOrderStatusNotification,
  sendStoreOrderEmailNotification,
  STORE_NOTIFICATION_TYPES
} from "../services/notificationService.js";
import { hasStorePlanFeature } from "../utils/storeFeatureUtils.js";
import { getStoreProductPricing } from "../utils/storeProductPricing.js";

const router = Router();
const customerRoles = ["buyer", "user", "seller"];
function sellableProductFilter() {
  return {
    status: "approved",
    adType: "sell",
    isAvailable: true,
    isVisible: { $ne: false },
    isArchived: { $ne: true },
    isDeleted: { $ne: true },
    sold: { $ne: true },
    expiresAt: { $gt: new Date() },
    priceOnContact: { $ne: true }
  };
}

function isValidId(value) {
  return mongoose.isValidObjectId(value);
}

async function getStoreFeatures(store) {
  if (!store || store.status !== "active") return { cart: false, orders: false, whatsappOrdering: false, delivery: false, discounts: false, inventory: false, notifications: false };
  const subscription = await StoreSubscription.findOne({ storeId: store._id })
    .sort({ createdAt: -1 })
    .populate("planId", "type features")
    .lean();
  if (StoreSubscription.getStoreSubscriptionStatus(subscription) !== "active") {
    return { cart: false, orders: false, whatsappOrdering: false, delivery: false, discounts: false, inventory: false, notifications: false };
  }
  return {
    cart: hasStorePlanFeature(subscription.planId, "cart"),
    orders: hasStorePlanFeature(subscription.planId, "orders"),
    whatsappOrdering: hasStorePlanFeature(subscription.planId, "whatsappOrdering"),
    delivery: hasStorePlanFeature(subscription.planId, "delivery"),
    discounts: hasStorePlanFeature(subscription.planId, "discounts"),
    inventory: hasStorePlanFeature(subscription.planId, "inventory"),
    notifications: hasStorePlanFeature(subscription.planId, "notifications")
  };
}

function requireFeature(features, feature) {
  if (!features[feature]) {
    const message = feature === "cart"
      ? "سلة المتجر غير مفعّلة في خطة هذا المتجر."
      : feature === "inventory"
        ? "إدارة مخزون المنتجات غير مفعّلة في خطة هذا المتجر."
      : "استقبال طلبات المتجر غير مفعّل في خطة هذا المتجر.";
    return message;
  }
  return null;
}

function usesInventory(product, features) {
  return features.inventory === true && product.inventoryEnabled === true;
}

function inventoryQuantityError(quantity, stockQuantity) {
  if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) {
    return "بيانات مخزون المنتج غير صالحة؛ تواصل مع المتجر.";
  }
  if (stockQuantity === 0) return "نفد المخزون.";
  if (quantity > stockQuantity) return `الكمية المطلوبة تتجاوز المخزون المتوفر (المتوفر: ${stockQuantity}).`;
  return null;
}

function bankAccountMatchesCurrency(accountCurrency, orderCurrency) {
  if (orderCurrency === "YER_ADEN" || orderCurrency === "YER_SANAA") return accountCurrency === "YER";
  return accountCurrency === orderCurrency;
}

async function convertStoreOrderReceipt(file) {
  const filename = `${randomUUID()}.webp`;
  const outputPath = path.join(process.cwd(), "uploads", "receipts", filename);
  try {
    await sharp(file.path, { failOn: "warning", limitInputPixels: 40_000_000 })
      .rotate()
      .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(outputPath);
    await fs.unlink(file.path);
    return { path: `receipts/${filename}`, absolutePath: outputPath };
  } catch (error) {
    await fs.unlink(outputPath).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") console.error("Store payment receipt cleanup error:", cleanupError);
    });
    throw error;
  }
}

async function removeStoreOrderReceipt(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Store payment receipt cleanup error:", error);
  }
}

async function loadSellableProduct(productId) {
  return Ad.findOne({
    _id: productId,
    ...sellableProductFilter(),
    storeProfileId: { $ne: null }
  }).lean();
}

async function loadCartItems(cart, features) {
  if (!cart || !cart.items?.length) return [];
  const productIds = cart.items.map((item) => item.productId);
  const products = await Ad.find({
    _id: { $in: productIds },
    storeProfileId: cart.storeProfileId,
    ...sellableProductFilter()
  }).lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  if (byId.size !== new Set(cart.items.map((item) => String(item.productId))).size) {
    return null;
  }
  const items = cart.items.map((entry) => {
    const product = byId.get(String(entry.productId));
    const pricing = getStoreProductPricing(product);
    const hasDiscount = features.discounts && pricing.discountEnabled;
    const unitPrice = hasDiscount ? pricing.unitPrice : pricing.originalPrice;
    const subtotal = unitPrice * entry.quantity;
    return {
      productId: product._id,
      title: product.title,
      price: unitPrice,
      originalPrice: pricing.originalPrice,
      discountEnabled: hasDiscount,
      discountType: hasDiscount ? pricing.discountType : null,
      discountValue: hasDiscount ? pricing.discountValue : 0,
      unitPrice,
      currency: product.currency,
      quantity: entry.quantity,
      subtotal,
      isAvailableForDelivery: features.delivery && product.isAvailableForDelivery === true,
      inventoryEnabled: usesInventory(product, features),
      ...(usesInventory(product, features) ? { stockQuantity: product.stockQuantity } : {}),
      images: product.images || []
    };
  });
  if (items.some((item) => !Number.isFinite(item.subtotal))) return null;
  const currencies = new Set(items.map((item) => item.currency));
  if (currencies.size > 1) return null;
  return items;
}

async function getOwnerStore(req) {
  const requestedType = String(req.query.storeType || "store");
  if (!["store", "family-production"].includes(requestedType)) return null;
  const filter = { userId: req.user.id };
  if (requestedType === "family-production") {
    filter.storeType = requestedType;
  } else {
    filter.$or = [{ storeType: "store" }, { storeType: { $exists: false } }];
  }
  return StoreProfile.findOne(filter).lean();
}

async function getOwnerStoreWithOrdersFeature(req) {
  const store = await getOwnerStore(req);
  if (!store) return { error: { status: 404, message: "لا يوجد متجر مرتبط بحسابك." } };
  const features = await getStoreFeatures(store);
  const error = requireFeature(features, "orders");
  return error ? { error: { status: 403, message: error } } : { store, features };
}

router.get("/cart", auth, requireRole(customerRoles), async (req, res) => {
  try {
    const cart = await StoreCart.findOne({ buyer: req.user.id }).lean();
    if (!cart) return res.json({ items: [], subtotal: 0, total: 0, storeProfileId: null, currency: null, bankAccounts: [] });
    const store = await StoreProfile.findById(cart.storeProfileId).select("+bankAccounts").lean();
    const featuresForCart = await getStoreFeatures(store);
    const featureError = requireFeature(featuresForCart, "cart");
    if (featureError) return res.status(403).json({ error: featureError });
    const items = await loadCartItems(cart, featuresForCart);
    if (!items) return res.status(409).json({ error: "تغيّر توفر أحد المنتجات أو عملته؛ أزل المنتجات غير المتاحة من السلة." });
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    return res.json({
      items,
      subtotal,
      total: subtotal,
      currency: items[0]?.currency || null,
      storeProfileId: cart.storeProfileId,
      bankAccounts: (store.bankAccounts || []).map((account) => ({
        _id: account._id,
        bankName: account.bankName,
        accountHolderName: account.accountHolderName,
        accountNumber: account.accountNumber,
        currency: account.currency
      })),
      store: {
        _id: store._id,
        storeName: store.storeName,
        slug: store.slug,
        whatsapp: Array.isArray(store.whatsapp) ? store.whatsapp : [],
        whatsappOrderingEnabled: featuresForCart.whatsappOrdering
      },
      ordersEnabled: featuresForCart.orders,
      whatsappOrderingEnabled: featuresForCart.whatsappOrdering
    });
  } catch (error) {
    console.error("Store cart read error:", error);
    return res.status(500).json({ error: "تعذر تحميل سلة المتجر." });
  }
});

router.post("/cart/items", auth, requireRole(customerRoles), async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body || {};
    if (!isValidId(productId) || !Number.isSafeInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "المنتج والكمية غير صالحين." });
    }
    const product = await loadSellableProduct(productId);
    if (!product || !product.storeProfileId || !Number.isFinite(product.price) || product.price < 0) {
      return res.status(400).json({ error: "المنتج غير متاح للبيع في المتجر." });
    }
    if (String(product.userId) === String(req.user.id)) {
      return res.status(400).json({ error: "لا يمكنك طلب منتجات متجرك." });
    }
    const store = await StoreProfile.findOne({ _id: product.storeProfileId, status: "active" }).lean();
    const features = await getStoreFeatures(store);
    const featureError = requireFeature(features, "cart");
    if (featureError) return res.status(403).json({ error: featureError });

    let cart = await StoreCart.findOne({ buyer: req.user.id });
    if (cart && cart.items.length && String(cart.storeProfileId) !== String(store._id)) {
      return res.status(409).json({ error: "لا يمكن جمع منتجات من متاجر مختلفة في السلة نفسها." });
    }
    if (!cart) cart = new StoreCart({ buyer: req.user.id, storeProfileId: store._id, items: [] });
    if (!cart.items.length) cart.storeProfileId = store._id;
    const existingItem = cart.items.find((item) => String(item.productId) === String(product._id));
    if (usesInventory(product, features)) {
      const requestedQuantity = quantity + (existingItem?.quantity || 0);
      const inventoryError = inventoryQuantityError(requestedQuantity, product.stockQuantity);
      if (inventoryError) return res.status(409).json({ error: inventoryError });
    }
    if (cart.items.length && !existingItem) {
      const existingProducts = await Ad.find({
        _id: { $in: cart.items.map((item) => item.productId) },
        storeProfileId: store._id,
        ...sellableProductFilter()
      }).lean();
      if (existingProducts.some((entry) => entry.currency !== product.currency)) {
        return res.status(409).json({ error: "لا يمكن جمع منتجات بعملات مختلفة في السلة." });
      }
    }
    if (existingItem && !Number.isSafeInteger(existingItem.quantity + quantity)) {
      return res.status(400).json({ error: "الكمية المطلوبة كبيرة جدًا." });
    }
    if (existingItem) existingItem.quantity += quantity;
    else cart.items.push({ productId: product._id, quantity });
    await cart.save();
    return res.status(200).json({ ok: true, itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0) });
  } catch (error) {
    console.error("Store cart add error:", error);
    return res.status(500).json({ error: "تعذر إضافة المنتج إلى السلة." });
  }
});

router.patch("/cart/items/:productId", auth, requireRole(customerRoles), async (req, res) => {
  try {
    const quantity = req.body?.quantity;
    if (!isValidId(req.params.productId) || !Number.isSafeInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "المنتج والكمية غير صالحين." });
    }
    const cart = await StoreCart.findOne({ buyer: req.user.id });
    if (!cart) return res.status(404).json({ error: "السلة غير موجودة." });
    const store = await StoreProfile.findById(cart.storeProfileId).lean();
    const featureError = requireFeature(await getStoreFeatures(store), "cart");
    if (featureError) return res.status(403).json({ error: featureError });
    const item = cart.items.find((entry) => String(entry.productId) === req.params.productId);
    if (!item) return res.status(404).json({ error: "المنتج غير موجود في السلة." });
    const product = await Ad.findOne({
      _id: item.productId,
      storeProfileId: cart.storeProfileId,
      ...sellableProductFilter()
    }).lean();
    if (!product) return res.status(400).json({ error: "المنتج لم يعد متاحًا للبيع." });
    const features = await getStoreFeatures(store);
    if (usesInventory(product, features)) {
      const inventoryError = inventoryQuantityError(quantity, product.stockQuantity);
      if (inventoryError) return res.status(409).json({ error: inventoryError });
    }
    item.quantity = quantity;
    await cart.save();
    return res.json({ ok: true });
  } catch (error) {
    console.error("Store cart quantity update error:", error);
    return res.status(500).json({ error: "تعذر تحديث كمية المنتج." });
  }
});

router.delete("/cart/items/:productId", auth, requireRole(customerRoles), async (req, res) => {
  try {
    if (!isValidId(req.params.productId)) return res.status(400).json({ error: "معرّف المنتج غير صالح." });
    const cart = await StoreCart.findOne({ buyer: req.user.id });
    if (!cart) return res.status(404).json({ error: "السلة غير موجودة." });
    const store = await StoreProfile.findById(cart.storeProfileId).lean();
    const featureError = requireFeature(await getStoreFeatures(store), "cart");
    if (featureError) return res.status(403).json({ error: featureError });
    cart.items = cart.items.filter((entry) => String(entry.productId) !== req.params.productId);
    if (!cart.items.length) cart.storeProfileId = store._id;
    await cart.save();
    return res.json({ ok: true });
  } catch (error) {
    console.error("Store cart remove error:", error);
    return res.status(500).json({ error: "تعذر حذف المنتج من السلة." });
  }
});

router.post("/checkout", auth, requireRole(customerRoles), uploadStoreOrderReceipt, async (req, res) => {
  let session;
  let notificationStore = null;
  let orderEmailStore = null;
  let uploadedReceiptPath = req.file?.path || null;
  let processedReceiptPath = null;
  let checkoutSucceeded = false;
  try {
    let receiptImage = null;
    if (req.file) {
      const processedReceipt = await convertStoreOrderReceipt(req.file);
      receiptImage = processedReceipt.path;
      processedReceiptPath = processedReceipt.absolutePath;
    }
    session = await mongoose.startSession();
    let order;
    await session.withTransaction(async () => {
      const cart = await StoreCart.findOne({ buyer: req.user.id }).session(session);
      if (!cart?.items?.length) {
        const error = new Error("السلة فارغة.");
        error.code = "STORE_CART_EMPTY";
        throw error;
      }
      const store = await StoreProfile.findById(cart.storeProfileId)
        .select("+notificationEmail +bankAccounts")
        .session(session)
        .lean();
      if (!store) {
        const error = new Error("المتجر المرتبط بالسلة غير متاح.");
        error.code = "STORE_PRODUCT_UNAVAILABLE";
        throw error;
      }
      const features = await getStoreFeatures(store);
      const cartFeatureError = requireFeature(features, "cart");
      if (cartFeatureError) {
        const error = new Error(cartFeatureError);
        error.code = "STORE_FEATURE_DISABLED";
        throw error;
      }
      const ordersFeatureError = requireFeature(features, "orders");
      if (ordersFeatureError) {
        const error = new Error(ordersFeatureError);
        error.code = "STORE_FEATURE_DISABLED";
        throw error;
      }
      if (String(store.userId) === String(req.user.id)) {
        const error = new Error("لا يمكنك إرسال طلب إلى متجرك.");
        error.code = "STORE_ORDER_INVALID";
        throw error;
      }

      const products = await Ad.find({
        _id: { $in: cart.items.map((item) => item.productId) },
        storeProfileId: store._id,
        ...sellableProductFilter()
      }).session(session).lean();
      const productById = new Map(products.map((product) => [String(product._id), product]));
      if (productById.size !== new Set(cart.items.map((item) => String(item.productId))).size) {
        const error = new Error("أحد المنتجات لم يعد متاحًا للبيع. حدّث السلة ثم حاول مجددًا.");
        error.code = "STORE_PRODUCT_UNAVAILABLE";
        throw error;
      }

      const quantitiesByProduct = new Map();
      for (const entry of cart.items) {
        quantitiesByProduct.set(
          String(entry.productId),
          (quantitiesByProduct.get(String(entry.productId)) || 0) + entry.quantity
        );
      }
      for (const [productId, quantity] of quantitiesByProduct) {
        const product = productById.get(productId);
        if (!usesInventory(product, features)) continue;
        const inventoryError = inventoryQuantityError(quantity, product.stockQuantity);
        if (inventoryError) {
          const error = new Error(inventoryError);
          error.code = "STORE_INVENTORY_UNAVAILABLE";
          throw error;
        }
      }

      const items = cart.items.map((entry) => {
        const product = productById.get(String(entry.productId));
        const pricing = getStoreProductPricing(product);
        const hasDiscount = features.discounts && pricing.discountEnabled;
        const unitPrice = hasDiscount ? pricing.unitPrice : pricing.originalPrice;
        const subtotal = unitPrice * entry.quantity;
        const inventoryEnabled = usesInventory(product, features);
        return {
          productId: product._id,
          title: product.title,
          originalPrice: pricing.originalPrice,
          discountType: hasDiscount ? pricing.discountType : null,
          discountValue: hasDiscount ? pricing.discountValue : 0,
          unitPrice,
          price: unitPrice,
          currency: product.currency,
          quantity: entry.quantity,
          subtotal,
          isAvailableForDelivery: features.delivery && product.isAvailableForDelivery === true,
          inventoryEnabled,
          stockQuantityAtPurchase: inventoryEnabled ? product.stockQuantity : null
        };
      });
      if (items.some((item) => !Number.isFinite(item.price) || item.price < 0
        || !Number.isSafeInteger(item.quantity) || !Number.isFinite(item.subtotal))) {
        const error = new Error("بيانات أحد المنتجات أو الكمية غير صالحة للطلب.");
        error.code = "STORE_ORDER_INVALID";
        throw error;
      }
      const currencies = new Set(items.map((item) => item.currency));
      if (currencies.size !== 1) {
        const error = new Error("يجب أن تكون عملة جميع منتجات السلة واحدة.");
        error.code = "STORE_ORDER_INVALID";
        throw error;
      }
      const bankAccounts = store.bankAccounts || [];
      const requestedBankAccountId = String(req.body?.bankAccountId || "");
      let selectedBankAccount = null;
      if (bankAccounts.length) {
        const matchingAccounts = bankAccounts.filter((account) => bankAccountMatchesCurrency(account.currency, items[0].currency));
        if (!matchingAccounts.length) {
          const error = new Error("لا يوجد حساب بنكي للمتجر بعملة هذا الطلب.");
          error.code = "STORE_BANK_ACCOUNT_UNAVAILABLE";
          throw error;
        }
        selectedBankAccount = matchingAccounts.find((account) => String(account._id) === requestedBankAccountId);
        if (!selectedBankAccount) {
          const error = new Error("اختر حسابًا بنكيًا صالحًا بعملة الطلب.");
          error.code = "STORE_BANK_ACCOUNT_INVALID";
          throw error;
        }
        if (!receiptImage) {
          const error = new Error("ارفع صورة سند التحويل قبل إرسال الطلب.");
          error.code = "STORE_RECEIPT_REQUIRED";
          throw error;
        }
      } else if (requestedBankAccountId || receiptImage) {
        const error = new Error("لا توجد حسابات بنكية مفعّلة لهذا المتجر.");
        error.code = "STORE_BANK_ACCOUNT_INVALID";
        throw error;
      }
      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      if (!Number.isFinite(total)) {
        const error = new Error("إجمالي الطلب غير صالح.");
        error.code = "STORE_ORDER_INVALID";
        throw error;
      }
      const createdOrders = await Order.create([{
        orderType: "store",
        storeProfileId: store._id,
        buyer: req.user.id,
        seller: store.userId,
        ad: null,
        items,
        total,
        amount: total,
        totalAmount: total,
        currency: items[0].currency,
        status: "new",
        ...(selectedBankAccount ? {
          storePaymentDetails: {
            bankAccountId: selectedBankAccount._id,
            bankName: selectedBankAccount.bankName,
            accountHolderName: selectedBankAccount.accountHolderName,
            accountNumber: selectedBankAccount.accountNumber,
            currency: selectedBankAccount.currency,
            receiptImage,
            submittedAt: new Date()
          }
        } : {})
      }], { session });
      order = createdOrders[0];
      orderEmailStore = store;
      if (features.notifications) notificationStore = store;

      for (const [productId, quantity] of quantitiesByProduct) {
        const product = productById.get(productId);
        if (!usesInventory(product, features)) continue;
        const updatedProduct = await Ad.findOneAndUpdate(
          {
            _id: product._id,
            storeProfileId: store._id,
            inventoryEnabled: true,
            stockQuantity: { $gte: quantity }
          },
          { $inc: { stockQuantity: -quantity } },
          { new: true, session }
        );
        if (!updatedProduct) {
          const error = new Error("تغيّرت كمية المخزون أثناء إرسال الطلب. حدّث السلة وحاول مجددًا.");
          error.code = "STORE_INVENTORY_UNAVAILABLE";
          throw error;
        }
      }
      cart.items = [];
      await cart.save({ session });
    });
    checkoutSucceeded = true;
    if (notificationStore) {
      try {
        const buyer = await User.findById(req.user.id).select("name").lean();
        await createStoreOrderNotification(req.app, {
          store: notificationStore,
          order,
          buyerName: buyer?.name
        });
      } catch (notificationError) {
        console.error("Failed to notify store owner about new order:", notificationError);
      }
    }
    if (orderEmailStore) {
      sendStoreOrderEmailNotification(orderEmailStore, order).catch((emailError) => {
        console.error("Failed to send store owner order email:", {
          orderId: String(order._id),
          storeProfileId: String(orderEmailStore._id),
          error: emailError?.message
        });
      });
    }
    return res.status(201).json({
      _id: order._id,
      status: order.status,
      total: order.total,
      currency: order.currency
    });
  } catch (error) {
    if (!checkoutSucceeded) {
      await removeStoreOrderReceipt(processedReceiptPath);
      await removeStoreOrderReceipt(uploadedReceiptPath);
    }
    if (error.code === "STORE_CART_EMPTY") return res.status(400).json({ error: error.message });
    if (error.code === "STORE_FEATURE_DISABLED") return res.status(403).json({ error: error.message });
    if (error.code === "STORE_ORDER_INVALID") return res.status(400).json({ error: error.message });
    if (["STORE_BANK_ACCOUNT_UNAVAILABLE", "STORE_BANK_ACCOUNT_INVALID", "STORE_RECEIPT_REQUIRED"].includes(error.code)) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "STORE_PRODUCT_UNAVAILABLE" || error.code === "STORE_INVENTORY_UNAVAILABLE") {
      return res.status(409).json({ error: error.message });
    }
    console.error("Store order checkout error:", error);
    return res.status(500).json({ error: "تعذر إرسال طلب المتجر." });
  } finally {
    if (session) await session.endSession();
  }
});

router.get("/owner/orders", auth, requireRole(["user", "seller", "buyer"]), async (req, res) => {
  try {
    const result = await getOwnerStoreWithOrdersFeature(req);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    const orders = await Order.find({ orderType: "store", storeProfileId: result.store._id, isDeleted: { $ne: true } })
      .populate("buyer", "name phone")
      .sort({ createdAt: -1 })
      .lean();
    const newCount = result.features.notifications
      ? await Notification.countDocuments({
        userId: req.user.id,
        storeProfileId: result.store._id,
        type: { $in: ["store_order", STORE_NOTIFICATION_TYPES.ORDER_NEW] },
        isRead: false
      })
      : 0;
    return res.json({
      orders,
      newCount,
      notificationsEnabled: result.features.notifications
    });
  } catch (error) {
    console.error("Store owner order list error:", error);
    return res.status(500).json({ error: "تعذر تحميل طلبات المتجر." });
  }
});

router.patch("/owner/notifications/read", auth, requireRole(["user", "seller", "buyer"]), async (req, res) => {
  try {
    const result = await getOwnerStoreWithOrdersFeature(req);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    if (!result.features.notifications) {
      return res.status(403).json({ error: "إشعارات المتجر غير مفعّلة في خطة هذا المتجر." });
    }
    await Notification.updateMany(
      {
        userId: req.user.id,
        storeProfileId: result.store._id,
        type: { $in: ["store_order", STORE_NOTIFICATION_TYPES.ORDER_NEW] },
        isRead: false
      },
      { $set: { isRead: true } }
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error("Store order notifications read error:", error);
    return res.status(500).json({ error: "تعذر تحديث إشعارات طلبات المتجر." });
  }
});

router.get("/owner/orders/:orderId", auth, requireRole(["user", "seller", "buyer"]), async (req, res) => {
  try {
    if (!isValidId(req.params.orderId)) return res.status(400).json({ error: "معرّف الطلب غير صالح." });
    const result = await getOwnerStoreWithOrdersFeature(req);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    const order = await Order.findOne({
      _id: req.params.orderId,
      orderType: "store",
      storeProfileId: result.store._id,
      isDeleted: { $ne: true }
    }).populate("buyer", "name phone").lean();
    if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
    return res.json(order);
  } catch (error) {
    console.error("Store owner order detail error:", error);
    return res.status(500).json({ error: "تعذر تحميل تفاصيل الطلب." });
  }
});

router.patch("/owner/orders/:orderId/status", auth, requireRole(["user", "seller", "buyer"]), async (req, res) => {
  let session;
  try {
    if (!isValidId(req.params.orderId)) return res.status(400).json({ error: "معرّف الطلب غير صالح." });
    const result = await getOwnerStoreWithOrdersFeature(req);
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    session = await mongoose.startSession();
    let order;
    await session.withTransaction(async () => {
      order = await Order.findOne({
        _id: req.params.orderId,
        orderType: "store",
        storeProfileId: result.store._id,
        isDeleted: { $ne: true }
      }).session(session);
      if (!order) {
        const error = new Error("الطلب غير موجود.");
        error.code = "STORE_ORDER_NOT_FOUND";
        throw error;
      }
      const nextStatus = req.body?.status;
      const allowedTransitions = {
        new: ["processing", "cancelled"],
        processing: ["completed", "cancelled"],
        completed: [],
        cancelled: []
      };
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        const error = new Error("انتقال حالة الطلب غير مسموح.");
        error.code = "STORE_ORDER_INVALID_TRANSITION";
        throw error;
      }
      if (nextStatus === "cancelled") {
        for (const item of order.items || []) {
          if (item.inventoryEnabled !== true || !item.productId) continue;
          const restoredProduct = await Ad.findOneAndUpdate(
            { _id: item.productId, storeProfileId: result.store._id },
            { $inc: { stockQuantity: item.quantity } },
            { new: true, session }
          );
          if (!restoredProduct) {
            const error = new Error("تعذر إعادة مخزون أحد المنتجات؛ لم يتم إلغاء الطلب.");
            error.code = "STORE_INVENTORY_RESTORE_FAILED";
            throw error;
          }
        }
      }
      order.status = nextStatus;
      await order.save({ session });
    });
    if (result.features.notifications) {
      try {
        await createStoreOrderStatusNotification(req.app, {
          store: result.store,
          order
        });
      } catch (notificationError) {
        console.error("Failed to notify store order buyer:", notificationError);
      }
    }
    return res.json(order);
  } catch (error) {
    if (error.code === "STORE_ORDER_NOT_FOUND") return res.status(404).json({ error: error.message });
    if (error.code === "STORE_ORDER_INVALID_TRANSITION") return res.status(400).json({ error: error.message });
    if (error.code === "STORE_INVENTORY_RESTORE_FAILED") return res.status(409).json({ error: error.message });
    console.error("Store owner order status update error:", error);
    return res.status(500).json({ error: "تعذر تحديث حالة الطلب." });
  } finally {
    if (session) await session.endSession();
  }
});

export default router;
