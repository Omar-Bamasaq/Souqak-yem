import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import storeCommerceRouter from "../src/routes/storeCommerce.js";
import Ad from "../src/models/Ad.js";
import Order from "../src/models/Order.js";
import Notification from "../src/models/Notification.js";
import StoreCart from "../src/models/StoreCart.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import User from "../src/models/User.js";
import { createStoreOrderNotification } from "../src/services/notificationService.js";

const BUYER_ID = "111111111111111111111111";
const OWNER_ID = "222222222222222222222222";
const STORE_ID = "333333333333333333333333";
const OTHER_STORE_ID = "444444444444444444444444";
const PRODUCT_ID = "555555555555555555555555";
const ORDER_ID = "666666666666666666666666";

function query(value) {
  return {
    sort() { return this; },
    populate() { return this; },
    select() { return this; },
    session() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

function getHandler(method, path) {
  const layer = storeCommerceRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} route exists`);
  return layer.route.stack.at(-1).handle;
}

async function invoke(handler, req) {
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler(req, res);
  return result;
}

async function withCommerceMocks(options, run) {
  const defaults = {
    features: { cart: true, orders: true, delivery: false, discounts: false, inventory: false },
    store: { _id: STORE_ID, userId: OWNER_ID, status: "active", storeType: "store", bankAccounts: [] },
    subscription: {
      status: "active",
      endDate: new Date(Date.now() + 86400000),
      planId: { type: "store", features: { cart: true, orders: true } }
    },
    product: {
      _id: PRODUCT_ID,
      title: "منتج",
      price: 125,
      currency: "YER_ADEN",
      userId: OWNER_ID,
      storeProfileId: STORE_ID,
      status: "approved",
      adType: "sell",
      isAvailable: true,
      isAvailableForDelivery: false,
      inventoryEnabled: false,
      stockQuantity: 0,
      discountEnabled: false,
      discountType: "percentage",
      discountValue: 1,
      expiresAt: new Date(Date.now() + 86400000)
    }
  };
  const config = { ...defaults, ...options };
  const originals = {
    adFindOne: Ad.findOne,
    adFind: Ad.find,
    orderCreate: Order.create,
    notificationCreate: Notification.create,
    notificationFindOne: Notification.findOne,
    notificationCountDocuments: Notification.countDocuments,
    notificationUpdateMany: Notification.updateMany,
    userFindById: User.findById,
    adFindOneAndUpdate: Ad.findOneAndUpdate,
    startSession: mongoose.startSession,
    orderFind: Order.find,
    orderFindOne: Order.findOne,
    cartFindOne: StoreCart.findOne,
    cartSave: StoreCart.prototype.save,
    storeFindOne: StoreProfile.findOne,
    storeFindById: StoreProfile.findById,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus
  };
  const createdOrders = [];
  const createdNotifications = [];

  Ad.findOne = () => query(config.product);
  Ad.find = () => query(config.products || [config.product]);
  Order.create = async (documents) => {
    const data = Array.isArray(documents) ? documents[0] : documents;
    createdOrders.push(data);
    return [{ _id: ORDER_ID, ...data }];
  };
  Notification.findOne = (filter) => query(createdNotifications.find((notification) =>
    notification.type === filter.type && String(notification.relatedOrderId) === String(filter.relatedOrderId)
  ) || null);
  Notification.create = async (data) => {
    createdNotifications.push(data);
    return { _id: "777777777777777777777777", ...data, toObject() { return this; } };
  };
  User.findById = () => query({ name: "اسم العميل" });
  Ad.findOneAndUpdate = async (filter, update) => {
    const product = (config.products || [config.product]).find((item) => String(item._id) === String(filter._id));
    if (!product || (filter.inventoryEnabled === true && product.inventoryEnabled !== true)
      || (filter.stockQuantity?.$gte !== undefined && product.stockQuantity < filter.stockQuantity.$gte)) return null;
    product.stockQuantity += update.$inc.stockQuantity;
    return product;
  };
  mongoose.startSession = async () => ({
    async withTransaction(callback) { await callback(); },
    async endSession() {}
  });
  StoreProfile.findById = () => query(config.store);
  StoreProfile.findOne = () => query(config.store);
  StoreSubscription.findOne = () => ({
    ...query({
      ...config.subscription,
      planId: { type: "store", features: config.features }
    }),
    sort() { return this; }
  });

  try {
    await run({ config, createdOrders, createdNotifications });
  } finally {
    Ad.findOne = originals.adFindOne;
    Ad.find = originals.adFind;
    Order.create = originals.orderCreate;
    Notification.create = originals.notificationCreate;
    Notification.findOne = originals.notificationFindOne;
    Notification.countDocuments = originals.notificationCountDocuments;
    Notification.updateMany = originals.notificationUpdateMany;
    User.findById = originals.userFindById;
    Ad.findOneAndUpdate = originals.adFindOneAndUpdate;
    mongoose.startSession = originals.startSession;
    Order.find = originals.orderFind;
    Order.findOne = originals.orderFindOne;
    StoreCart.findOne = originals.cartFindOne;
    StoreCart.prototype.save = originals.cartSave;
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findById = originals.storeFindById;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
  }
}

function createCart() {
  return {
    buyer: BUYER_ID,
    storeProfileId: STORE_ID,
    items: [{ productId: PRODUCT_ID, quantity: 2 }],
    async save() {}
  };
}

test("cart feature disabled rejects adding a store product", async () => {
  await withCommerceMocks({ features: { cart: false, orders: true } }, async () => {
    StoreCart.findOne = () => query(null);
    StoreCart.prototype.save = async function save() {};
    const result = await invoke(getHandler("post", "/cart/items"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { productId: PRODUCT_ID, quantity: 1 }
    });
    assert.equal(result.statusCode, 403);
    assert.match(result.body.error, /سلة المتجر غير مفعّلة/);
  });
});

test("valid store product is added using the authenticated buyer id", async () => {
  await withCommerceMocks({}, async () => {
    let savedCart;
    StoreCart.findOne = () => query(null);
    StoreCart.prototype.save = async function save() { savedCart = this; };
    const result = await invoke(getHandler("post", "/cart/items"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { productId: PRODUCT_ID, quantity: 2, buyer: OWNER_ID, storeProfileId: OTHER_STORE_ID }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(String(savedCart.buyer), BUYER_ID);
    assert.equal(String(savedCart.storeProfileId), STORE_ID);
    assert.equal(String(savedCart.items[0].productId), PRODUCT_ID);
    assert.equal(savedCart.items[0].quantity, 2);
  });
});

test("inventory allows quantities up to stock and rejects requests above current stock", async () => {
  await withCommerceMocks({
    features: { cart: true, orders: true, inventory: true },
    product: { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 5 }
  }, async () => {
    let savedCart;
    StoreCart.findOne = () => query(null);
    StoreCart.prototype.save = async function save() { savedCart = this; };
    const added = await invoke(getHandler("post", "/cart/items"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { productId: PRODUCT_ID, quantity: 5 }
    });
    assert.equal(added.statusCode, 200);
    assert.equal(savedCart.items[0].quantity, 5);
  });

  await withCommerceMocks({
    features: { cart: true, orders: true, inventory: true },
    product: { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 3 }
  }, async () => {
    StoreCart.findOne = () => query(createCart());
    const added = await invoke(getHandler("post", "/cart/items"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { productId: PRODUCT_ID, quantity: 2 }
    });
    assert.equal(added.statusCode, 409);
    assert.match(added.body.error, /المتوفر: 3/);
  });
});

test("inventory quantity updates cannot exceed available stock", async () => {
  await withCommerceMocks({
    features: { cart: true, orders: true, inventory: true },
    product: { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 2 }
  }, async () => {
    StoreCart.findOne = () => query(createCart());
    const result = await invoke(getHandler("patch", "/cart/items/:productId"), {
      user: { id: BUYER_ID, role: "buyer" },
      params: { productId: PRODUCT_ID },
      body: { quantity: 3 }
    });
    assert.equal(result.statusCode, 409);
    assert.match(result.body.error, /المتوفر: 2/);
  });
});

test("zero inventory prevents adding a product to the cart", async () => {
  await withCommerceMocks({
    features: { cart: true, orders: true, inventory: true },
    product: { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 0 }
  }, async () => {
    StoreCart.findOne = () => query(null);
    const result = await invoke(getHandler("post", "/cart/items"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { productId: PRODUCT_ID, quantity: 1 }
    });
    assert.equal(result.statusCode, 409);
    assert.match(result.body.error, /نفد المخزون/);
  });
});

test("cart rejects products belonging to a different store", async () => {
  await withCommerceMocks({
    store: { _id: OTHER_STORE_ID, userId: OWNER_ID, status: "active", storeType: "store" },
    product: {
      _id: PRODUCT_ID,
      title: "منتج",
      price: 125,
      currency: "YER_ADEN",
      userId: OWNER_ID,
      storeProfileId: OTHER_STORE_ID,
      status: "approved",
      adType: "sell",
      isAvailable: true,
      expiresAt: new Date(Date.now() + 86400000)
    }
  }, async () => {
    StoreCart.findOne = () => query(createCart());
    const result = await invoke(getHandler("post", "/cart/items"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { productId: PRODUCT_ID, quantity: 1 }
    });
    assert.equal(result.statusCode, 409);
    assert.match(result.body.error, /متاجر مختلفة/);
  });
});

test("orders feature disabled rejects checkout even with cart enabled", async () => {
  await withCommerceMocks({ features: { cart: true, orders: false } }, async ({ createdOrders }) => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);
    const result = await invoke(getHandler("post", "/checkout"), { user: { id: BUYER_ID, role: "buyer" } });
    assert.equal(result.statusCode, 403);
    assert.match(result.body.error, /طلبات المتجر.*غير مفعّل/);
    assert.equal(createdOrders.length, 0);
    assert.equal(cart.items.length, 1);
  });
});

test("checkout rejects an active-status subscription whose end date has passed", async () => {
  const cart = createCart();
  await withCommerceMocks({
    subscription: {
      status: "active",
      endDate: new Date(Date.now() - 1000),
      planId: { type: "store", features: { cart: true, orders: true } }
    }
  }, async ({ createdOrders }) => {
    StoreCart.findOne = () => query(cart);
    const result = await invoke(getHandler("post", "/checkout"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(result.statusCode, 403);
    assert.match(result.body.error, /سلة المتجر غير مفعّلة/);
    assert.equal(createdOrders.length, 0);
    assert.equal(cart.items.length, 1);
  });
});

test("checkout creates an order from current product pricing and clears the cart", async () => {
  await withCommerceMocks({}, async ({ createdOrders }) => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);
    const result = await invoke(getHandler("post", "/checkout"), { user: { id: BUYER_ID, role: "buyer" } });
    assert.equal(result.statusCode, 201);
    assert.equal(createdOrders.length, 1);
    assert.equal(createdOrders[0].orderType, "store");
    assert.equal(String(createdOrders[0].storeProfileId), STORE_ID);
    assert.equal(String(createdOrders[0].buyer), BUYER_ID);
    assert.equal(createdOrders[0].items[0].title, "منتج");
    assert.equal(createdOrders[0].items[0].price, 125);
    assert.equal(createdOrders[0].items[0].quantity, 2);
    assert.equal(createdOrders[0].items[0].subtotal, 250);
    assert.equal(createdOrders[0].items[0].isAvailableForDelivery, false);
    assert.equal(createdOrders[0].total, 250);
    assert.equal(result.body.status, "new");
    assert.equal(cart.items.length, 0);
  });

  test("cart includes the store bank accounts for payment", async () => {
    const bankAccount = {
      _id: new mongoose.Types.ObjectId(),
      bankName: "بنك تجريبي",
      accountHolderName: "مالك المتجر",
      accountNumber: "123456",
      currency: "YER"
    };
    await withCommerceMocks({ store: { _id: STORE_ID, userId: OWNER_ID, status: "active", bankAccounts: [bankAccount] } }, async () => {
      StoreCart.findOne = () => query(createCart());
      const result = await invoke(getHandler("get", "/cart"), { user: { id: BUYER_ID, role: "buyer" } });
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body.bankAccounts, [bankAccount]);
    });
  });

  test("checkout requires a matching bank account and receipt when the store has accounts", async () => {
    const bankAccount = {
      _id: new mongoose.Types.ObjectId(),
      bankName: "بنك تجريبي",
      accountHolderName: "مالك المتجر",
      accountNumber: "123456",
      currency: "YER"
    };
    await withCommerceMocks({ store: { _id: STORE_ID, userId: OWNER_ID, status: "active", bankAccounts: [bankAccount] } }, async ({ createdOrders }) => {
      const cart = createCart();
      StoreCart.findOne = () => query(cart);
      const result = await invoke(getHandler("post", "/checkout"), {
        user: { id: BUYER_ID, role: "buyer" },
        body: { bankAccountId: String(bankAccount._id) }
      });
      assert.equal(result.statusCode, 400);
      assert.match(result.body.error, /ارفع صورة سند التحويل/);
      assert.equal(createdOrders.length, 0);
      assert.equal(cart.items.length, 1);
    });
  });

  test("checkout stores the selected bank account and converts its receipt to WebP", async () => {
    const bankAccount = {
      _id: new mongoose.Types.ObjectId(),
      bankName: "بنك تجريبي",
      accountHolderName: "مالك المتجر",
      accountNumber: "123456",
      currency: "YER"
    };
    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "store-order-receipt-"));
    const sourcePath = path.join(tempDirectory, "receipt.png");
    await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toFile(sourcePath);
    let savedReceiptPath;

    try {
      await withCommerceMocks({
        store: { _id: STORE_ID, userId: OWNER_ID, status: "active", bankAccounts: [bankAccount] }
      }, async ({ createdOrders }) => {
        const cart = createCart();
        StoreCart.findOne = () => query(cart);
        const result = await invoke(getHandler("post", "/checkout"), {
          user: { id: BUYER_ID, role: "buyer" },
          body: { bankAccountId: String(bankAccount._id) },
          file: { path: sourcePath }
        });
        assert.equal(result.statusCode, 201);
        const paymentDetails = createdOrders[0].storePaymentDetails;
        assert.equal(String(paymentDetails.bankAccountId), String(bankAccount._id));
        assert.equal(paymentDetails.bankName, bankAccount.bankName);
        assert.match(paymentDetails.receiptImage, /^receipts\/.+\.webp$/);
        savedReceiptPath = path.join(process.cwd(), "uploads", paymentDetails.receiptImage);
        assert.ok((await fs.stat(savedReceiptPath)).isFile());
      });
    } finally {
      if (savedReceiptPath) await fs.rm(savedReceiptPath, { force: true });
      await fs.rm(tempDirectory, { recursive: true, force: true });
    }
  });

    test("checkout ignores client pricing and quantity fields and reads current product values", async () => {
    const product = { ...withProductDefaults(), price: 125 };
    const cart = createCart();
    product.price = 250;
    product.discountEnabled = true;
    product.discountType = "percentage";
    product.discountValue = 20;
    await withCommerceMocks({
      features: { cart: true, orders: true, discounts: true },
      product
    }, async ({ createdOrders }) => {
      StoreCart.findOne = () => query(cart);
      const result = await invoke(getHandler("post", "/checkout"), {
        user: { id: BUYER_ID, role: "buyer" },
        body: {
          finalPrice: 1,
          unitPrice: 1,
          originalPrice: 1,
          discountValue: 99,
          quantity: 999,
          subtotal: 1
        }
      });
      assert.equal(result.statusCode, 201);
      assert.equal(createdOrders[0].items[0].originalPrice, 250);
      assert.equal(createdOrders[0].items[0].unitPrice, 200);
      assert.equal(createdOrders[0].items[0].discountValue, 20);
      assert.equal(createdOrders[0].items[0].quantity, 2);
      assert.equal(createdOrders[0].items[0].subtotal, 400);
      assert.equal(createdOrders[0].total, 400);
    });
  });

  test("checkout rejects inventory changed by a concurrent purchase at the atomic decrement", async () => {
    const product = { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 5 };
    await withCommerceMocks({
      features: { cart: true, orders: true, inventory: true },
      product
    }, async () => {
      const cart = createCart();
      StoreCart.findOne = () => query(cart);
      Ad.findOneAndUpdate = async () => {
        product.stockQuantity = 1;
        return null;
      };
      const result = await invoke(getHandler("post", "/checkout"), {
        user: { id: BUYER_ID, role: "buyer" }
      });
      assert.equal(result.statusCode, 409);
      assert.match(result.body.error, /تغيّرت كمية المخزون/);
      assert.equal(product.stockQuantity, 1);
      assert.equal(cart.items.length, 1);
    });
  });

  test("checkout rejects stale quantities and leaves the cart and stock unchanged", async () => {
    const product = { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 1 };
    await withCommerceMocks({
      features: { cart: true, orders: true, inventory: true },
      product
    }, async ({ createdOrders }) => {
      const cart = createCart();
      StoreCart.findOne = () => query(cart);
      const result = await invoke(getHandler("post", "/checkout"), { user: { id: BUYER_ID, role: "buyer" } });
      assert.equal(result.statusCode, 409);
      assert.match(result.body.error, /المتوفر: 1/);
      assert.equal(createdOrders.length, 0);
      assert.equal(product.stockQuantity, 1);
      assert.equal(cart.items.length, 1);
    });
  });

  test("successful checkout decrements stock atomically and snapshots its pre-purchase quantity", async () => {
    const product = { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 5 };
    await withCommerceMocks({
      features: { cart: true, orders: true, inventory: true },
      product
    }, async ({ createdOrders }) => {
      const cart = createCart();
      StoreCart.findOne = () => query(cart);
      const result = await invoke(getHandler("post", "/checkout"), { user: { id: BUYER_ID, role: "buyer" } });
      assert.equal(result.statusCode, 201);
      assert.equal(product.stockQuantity, 3);
      assert.equal(createdOrders[0].items[0].inventoryEnabled, true);
      assert.equal(createdOrders[0].items[0].stockQuantityAtPurchase, 5);
      assert.equal(cart.items.length, 0);
    });
  });

  test("notifications feature creates an in-app notification for the owning store after checkout", async () => {
    await withCommerceMocks({
      features: {
        cart: true,
        orders: true,
        notifications: true,
        whatsappOrdering: true,
        discounts: true,
        inventory: true
      },
      product: {
        ...withProductDefaults(),
        price: 125,
        discountEnabled: true,
        discountType: "percentage",
        discountValue: 10,
        inventoryEnabled: true,
        stockQuantity: 5
      }
    }, async ({ config, createdOrders, createdNotifications }) => {
      const cart = createCart();
      StoreCart.findOne = () => query(cart);
      const emitted = [];
      const app = {
        get() {
          return {
            to(room) {
              assert.equal(room, `user:${OWNER_ID}`);
              return { emit(event, payload) { emitted.push({ event, payload }); } };
            }
          };
        }
      };
      const result = await invoke(getHandler("post", "/checkout"), {
        user: { id: BUYER_ID, role: "buyer" },
        app
      });
      assert.equal(result.statusCode, 201);
      assert.equal(createdOrders[0].total, 226);
      assert.equal(createdOrders[0].items[0].unitPrice, 113);
      assert.equal(config.product.stockQuantity, 3);
      assert.equal(cart.items.length, 0);
      assert.equal(createdNotifications.length, 1);
      assert.equal(String(createdNotifications[0].userId), OWNER_ID);
      assert.equal(String(createdNotifications[0].storeProfileId), STORE_ID);
      assert.equal(String(createdNotifications[0].relatedOrderId), ORDER_ID);
      assert.equal(createdNotifications[0].type, "store_order_new");
      assert.match(createdNotifications[0].body, /اسم العميل/);
      assert.ok(createdNotifications[0].body.includes(Number(226).toLocaleString("ar")));
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].event, "notification:new");

      await createStoreOrderNotification(app, {
        store: { _id: STORE_ID, userId: OWNER_ID },
        order: { _id: ORDER_ID, total: 250, currency: "YER_ADEN" },
        buyerName: "اسم العميل"
      });
      assert.equal(createdNotifications.length, 1);
      assert.equal(emitted.length, 1);
    });
  });

  test("notifications disabled on the active store plan does not create a store notification", async () => {
    await withCommerceMocks({
      features: { cart: true, orders: true, notifications: false }
    }, async ({ createdNotifications }) => {
      StoreCart.findOne = () => query(createCart());
      const result = await invoke(getHandler("post", "/checkout"), {
        user: { id: BUYER_ID, role: "buyer" }
      });
      assert.equal(result.statusCode, 201);
      assert.equal(createdNotifications.length, 0);
    });
  });

  test("products without enabled inventory retain unlimited cart and checkout behavior", async () => {
    const product = { ...withProductDefaults(), inventoryEnabled: false, stockQuantity: 0 };
    await withCommerceMocks({
      features: { cart: true, orders: true, inventory: true },
      product
    }, async ({ createdOrders }) => {
      const cart = createCart();
      StoreCart.findOne = () => query(cart);
      const result = await invoke(getHandler("post", "/checkout"), { user: { id: BUYER_ID, role: "buyer" } });
      assert.equal(result.statusCode, 201);
      assert.equal(createdOrders[0].items[0].inventoryEnabled, false);
      assert.equal(createdOrders[0].items[0].stockQuantityAtPurchase, null);
      assert.equal(product.stockQuantity, 0);
    });
  });
});

test("cart and order retain delivery availability only while the store plan enables it", async () => {
  await withCommerceMocks({
    product: {
      _id: PRODUCT_ID,
      title: "منتج",
      price: 125,
      currency: "YER_ADEN",
      userId: OWNER_ID,
      storeProfileId: STORE_ID,
      status: "approved",
      adType: "sell",
      isAvailable: true,
      isAvailableForDelivery: true,
      expiresAt: new Date(Date.now() + 86400000)
    }
  }, async () => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);
    const result = await invoke(getHandler("get", "/cart"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(result.body.items[0].isAvailableForDelivery, false);
  });

  await withCommerceMocks({
    features: { cart: true, orders: true, delivery: true, inventory: false },
    product: {
      _id: PRODUCT_ID,
      title: "منتج",
      price: 125,
      currency: "YER_ADEN",
      userId: OWNER_ID,
      storeProfileId: STORE_ID,
      status: "approved",
      adType: "sell",
      isAvailable: true,
      isAvailableForDelivery: true,
      expiresAt: new Date(Date.now() + 86400000)
    }
  }, async ({ createdOrders }) => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);

    const cartResult = await invoke(getHandler("get", "/cart"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(cartResult.statusCode, 200);
    assert.equal(cartResult.body.items[0].isAvailableForDelivery, true);

    const orderResult = await invoke(getHandler("post", "/checkout"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(orderResult.statusCode, 201);
    assert.equal(createdOrders[0].items[0].isAvailableForDelivery, true);
  });
});

test("cart and checkout recalculate discounted prices from the current database product", async () => {
  const product = {
    _id: PRODUCT_ID,
    title: "منتج مخفض",
    price: 100000,
    currency: "YER_ADEN",
    userId: OWNER_ID,
    storeProfileId: STORE_ID,
    status: "approved",
    adType: "sell",
    isAvailable: true,
    discountEnabled: true,
    discountType: "percentage",
    discountValue: 10,
    expiresAt: new Date(Date.now() + 86400000)
  };
  await withCommerceMocks({
    features: { cart: true, orders: true, delivery: false, discounts: false },
    product
  }, async ({ createdOrders }) => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);
    const cartResult = await invoke(getHandler("get", "/cart"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(cartResult.body.items[0].discountEnabled, false);
    assert.equal(cartResult.body.items[0].price, 100000);
    assert.equal(cartResult.body.items[0].subtotal, 200000);

    const orderResult = await invoke(getHandler("post", "/checkout"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(orderResult.statusCode, 201);
    assert.equal(createdOrders[0].items[0].originalPrice, 100000);
    assert.equal(createdOrders[0].items[0].unitPrice, 100000);
    assert.equal(createdOrders[0].items[0].discountValue, 0);
  });

  await withCommerceMocks({
    features: { cart: true, orders: true, delivery: false, discounts: true },
    product
  }, async ({ createdOrders }) => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);
    const cartResult = await invoke(getHandler("get", "/cart"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(cartResult.body.items[0].originalPrice, 100000);
    assert.equal(cartResult.body.items[0].price, 90000);
    assert.equal(cartResult.body.items[0].unitPrice, 90000);
    assert.equal(cartResult.body.items[0].subtotal, 180000);

    const checkout = await invoke(getHandler("post", "/checkout"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { unitPrice: 1, originalPrice: 1, discountValue: 99 }
    });
    assert.equal(checkout.statusCode, 201);
    const savedItem = createdOrders[0].items[0];
    assert.equal(savedItem.originalPrice, 100000);
    assert.equal(savedItem.unitPrice, 90000);
    assert.equal(savedItem.discountType, "percentage");
    assert.equal(savedItem.discountValue, 10);
    assert.equal(savedItem.price, 90000);
    assert.equal(savedItem.subtotal, 180000);

    product.discountValue = 50;
    product.price = 200000;
    assert.equal(savedItem.originalPrice, 100000);
    assert.equal(savedItem.unitPrice, 90000);
    assert.equal(savedItem.discountValue, 10);
  });
});

test("fixed store discounts determine cart and order prices from the database snapshot", async () => {
  const product = {
    ...withProductDefaults(),
    price: 1000,
    discountEnabled: true,
    discountType: "fixed",
    discountValue: 250
  };
  await withCommerceMocks({
    features: { cart: true, orders: true, discounts: true },
    product
  }, async ({ createdOrders }) => {
    const cart = createCart();
    StoreCart.findOne = () => query(cart);
    const cartResult = await invoke(getHandler("get", "/cart"), {
      user: { id: BUYER_ID, role: "buyer" }
    });
    assert.equal(cartResult.body.items[0].discountType, "fixed");
    assert.equal(cartResult.body.items[0].discountValue, 250);
    assert.equal(cartResult.body.items[0].originalPrice, 1000);
    assert.equal(cartResult.body.items[0].price, 750);
    assert.equal(cartResult.body.items[0].subtotal, 1500);

    const orderResult = await invoke(getHandler("post", "/checkout"), {
      user: { id: BUYER_ID, role: "buyer" },
      body: { unitPrice: 1, discountValue: 99 }
    });
    assert.equal(orderResult.statusCode, 201);
    assert.equal(createdOrders[0].items[0].discountType, "fixed");
    assert.equal(createdOrders[0].items[0].discountValue, 250);
    assert.equal(createdOrders[0].items[0].originalPrice, 1000);
    assert.equal(createdOrders[0].items[0].unitPrice, 750);
    assert.equal(createdOrders[0].items[0].subtotal, 1500);
    assert.equal(createdOrders[0].total, 1500);
  });
});

test("store owner cannot read an order belonging to another store", async () => {
  await withCommerceMocks({}, async () => {
    StoreProfile.findOne = () => query({ ...defaultsStore(), _id: STORE_ID });
    Order.findOne = (filter) => {
      assert.equal(String(filter.storeProfileId), STORE_ID);
      assert.equal(String(filter._id), ORDER_ID);
      return query(null);
    };
    const result = await invoke(getHandler("get", "/owner/orders/:orderId"), {
      user: { id: OWNER_ID, role: "seller" },
      params: { orderId: ORDER_ID },
      query: { storeType: "store" }
    });
    assert.equal(result.statusCode, 404);
  });
});

test("store owner notification counts and read updates are scoped to the owned active store", async () => {
  await withCommerceMocks({
    features: { cart: true, orders: true, notifications: true }
  }, async () => {
    Order.find = (filter) => {
      assert.equal(String(filter.storeProfileId), STORE_ID);
      return query([]);
    };
    Notification.countDocuments = (filter) => {
      assert.equal(String(filter.userId), OWNER_ID);
      assert.equal(String(filter.storeProfileId), STORE_ID);
      assert.deepEqual(filter.type, { $in: ["store_order", "store_order_new"] });
      assert.equal(filter.isRead, false);
      return Promise.resolve(2);
    };
    const list = await invoke(getHandler("get", "/owner/orders"), {
      user: { id: OWNER_ID, role: "seller" },
      query: { storeType: "store" }
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.body.newCount, 2);
    assert.equal(list.body.notificationsEnabled, true);

    Notification.updateMany = (filter, update) => {
      assert.equal(String(filter.userId), OWNER_ID);
      assert.equal(String(filter.storeProfileId), STORE_ID);
      assert.deepEqual(filter.type, { $in: ["store_order", "store_order_new"] });
      assert.equal(filter.isRead, false);
      assert.deepEqual(update, { $set: { isRead: true } });
      return Promise.resolve({ modifiedCount: 2 });
    };
    const read = await invoke(getHandler("patch", "/owner/notifications/read"), {
      user: { id: OWNER_ID, role: "seller" },
      query: { storeType: "store" }
    });
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.body, { ok: true });
  });
});

test("store owner can move an owned order from new to processing", async () => {
  await withCommerceMocks({}, async () => {
    StoreProfile.findOne = () => query(defaultsStore());
    const order = {
      _id: ORDER_ID,
      orderType: "store",
      storeProfileId: STORE_ID,
      status: "new",
      async save() {}
    };
    Order.findOne = () => query(order);
    const result = await invoke(getHandler("patch", "/owner/orders/:orderId/status"), {
      user: { id: OWNER_ID, role: "seller" },
      params: { orderId: ORDER_ID },
      query: { storeType: "store" },
      body: { status: "processing" }
    });
    assert.equal(result.statusCode, 200);
    assert.equal(order.status, "processing");
  });
});

test("cancelling an inventory order returns stock once, and repeated cancellation does not add it again", async () => {
  const product = { ...withProductDefaults(), inventoryEnabled: true, stockQuantity: 3 };
  const order = {
    _id: ORDER_ID,
    orderType: "store",
    storeProfileId: STORE_ID,
    status: "new",
    items: [{ productId: PRODUCT_ID, quantity: 2, inventoryEnabled: true }],
    async save() {}
  };
  await withCommerceMocks({
    features: { cart: true, orders: true, inventory: true },
    product
  }, async () => {
    StoreProfile.findOne = () => query(defaultsStore());
    Order.findOne = () => query(order);
    const request = {
      user: { id: OWNER_ID, role: "seller" },
      params: { orderId: ORDER_ID },
      query: { storeType: "store" },
      body: { status: "cancelled" }
    };
    const cancelled = await invoke(getHandler("patch", "/owner/orders/:orderId/status"), request);
    assert.equal(cancelled.statusCode, 200);
    assert.equal(product.stockQuantity, 5);

    const repeated = await invoke(getHandler("patch", "/owner/orders/:orderId/status"), request);
    assert.equal(repeated.statusCode, 400);
    assert.equal(product.stockQuantity, 5);
  });
});

function defaultsStore() {
  return { _id: STORE_ID, userId: OWNER_ID, status: "active", storeType: "store" };
}

function withProductDefaults() {
  return {
    _id: PRODUCT_ID,
    title: "منتج",
    price: 125,
    currency: "YER_ADEN",
    userId: OWNER_ID,
    storeProfileId: STORE_ID,
    status: "approved",
    adType: "sell",
    isAvailable: true,
    expiresAt: new Date(Date.now() + 86400000)
  };
}
