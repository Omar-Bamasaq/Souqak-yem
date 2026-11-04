import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(testDirectory, "..");
const localEnvPath = path.join(backendDirectory, ".env.local");
let localUri = null;
let localUriError = "backend/.env.local does not contain a local MongoDB URI.";

if (fs.existsSync(localEnvPath)) {
  const localConfig = dotenv.parse(fs.readFileSync(localEnvPath, "utf8"));
  for (const [key, value] of Object.entries(localConfig)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  try {
    const uri = new URL(localConfig.MONGODB_URI);
    if (!["127.0.0.1", "localhost", "::1"].includes(uri.hostname)) {
      localUriError = "Refusing to run auction integration tests against a non-local database.";
    } else {
      const originalDatabase = decodeURIComponent(uri.pathname.slice(1));
      if (uri.username && !uri.searchParams.has("authSource")) {
        uri.searchParams.set("authSource", originalDatabase);
      }
      uri.pathname = `/souqak_auction_test_${process.pid}_${Date.now()}`;
      uri.searchParams.set("replicaSet", "rs0");
      localUri = uri.toString();
    }
  } catch {
    localUriError = "The local MongoDB URI is invalid.";
  }
}

const integrationTest = test(
  "real auction API and lifecycle against isolated local MongoDB replica set",
  { skip: localUri ? false : localUriError },
  async (t) => {
    const mongoose = (await import("mongoose")).default;
    mongoose.set("autoIndex", false);
    const express = (await import("express")).default;
    const sharp = (await import("sharp")).default;
    const { signAccessToken } = await import("../src/config/jwt.js");
    const User = (await import("../src/models/User.js")).default;
    const Category = (await import("../src/models/Category.js")).default;
    const Governorate = (await import("../src/models/Governorate.js")).default;
    const City = (await import("../src/models/City.js")).default;
    const Auction = (await import("../src/models/Auction.js")).default;
    const AuctionBid = (await import("../src/models/AuctionBid.js")).default;
    const AuctionAuditLog = (await import("../src/models/AuctionAuditLog.js")).default;
    const Notification = (await import("../src/models/Notification.js")).default;
    const auctionsRouter = (await import("../src/routes/auctions.js")).default;
    const adminAuctionsRouter = (await import("../src/routes/adminAuctions.js")).default;
    const { runAuctionLifecycleOnce } = await import("../src/services/auctionLifecycle.js");
    const { placeAuctionBid } = await import("../src/services/auctionBidService.js");

    const uploadedFiles = new Set();
    const uploadedPrivateDocuments = new Set();
    let server;
    let baseUrl;

    try {
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5_000 });
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      assert.equal(hello.setName, "rs0", "local MongoDB must be a replica set");
      assert.equal(hello.isWritablePrimary, true, "local replica set must have a primary");

      await Promise.all([
        Category.syncIndexes(),
        Governorate.syncIndexes(),
        City.syncIndexes(),
        Auction.syncIndexes(),
        AuctionBid.syncIndexes(),
        AuctionAuditLog.syncIndexes(),
        Notification.syncIndexes()
      ]);

      const events = [];
      const app = express();
      app.set("trust proxy", 1);
      app.set("io", {
        to(room) {
          return { emit: (event, payload) => events.push({ room, event, payload }) };
        },
        emit: (event, payload) => events.push({ event, payload })
      });
      app.use(express.json());
      app.use("/api/auctions", auctionsRouter);
      app.use("/api/admin/auctions", adminAuctionsRouter);
      server = http.createServer(app);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;

      const suffix = `${process.pid}-${Date.now()}`;
      const verifiedFields = {
        verificationStatus: "verified",
        verificationExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };
      const [owner, bidderOne, bidderTwo, administrator, disabledUser, rateLimitedUser] = await Promise.all([
        User.create({ name: `Auction Owner ${suffix}`, email: `owner-${suffix}@local.test`, password: "local-test-password", ...verifiedFields }),
        User.create({ name: `Auction Bidder A ${suffix}`, email: `bidder-a-${suffix}@local.test`, password: "local-test-password", ...verifiedFields }),
        User.create({ name: `Auction Bidder B ${suffix}`, email: `bidder-b-${suffix}@local.test`, password: "local-test-password", ...verifiedFields }),
        User.create({ name: `Auction Admin ${suffix}`, email: `admin-${suffix}@local.test`, password: "local-test-password", role: "admin" }),
        User.create({ name: `Auction Disabled ${suffix}`, email: `disabled-${suffix}@local.test`, password: "local-test-password", isDisabled: true }),
        User.create({ name: `Auction Rate Limited ${suffix}`, email: `rate-limited-${suffix}@local.test`, password: "local-test-password", ...verifiedFields })
      ]);
      const [
        unverifiedUser,
        expiredUser,
        missingExpiryUser,
        invalidExpiryUser,
        legacyVerifiedUser,
        legacySellerUser,
        emailVerifiedUser,
        deletedUser
      ] = await Promise.all([
        User.create({ name: `Auction Unverified ${suffix}`, email: `unverified-${suffix}@local.test`, password: "local-test-password" }),
        User.create({
          name: `Auction Expired ${suffix}`,
          email: `expired-${suffix}@local.test`,
          password: "local-test-password",
          verificationStatus: "verified",
          verificationExpiryDate: new Date(Date.now() - 1_000)
        }),
        User.create({
          name: `Auction Missing Expiry ${suffix}`,
          email: `missing-expiry-${suffix}@local.test`,
          password: "local-test-password",
          verificationStatus: "verified"
        }),
        User.create({
          name: `Auction Invalid Expiry ${suffix}`,
          email: `invalid-expiry-${suffix}@local.test`,
          password: "local-test-password",
          verificationStatus: "verified",
          verificationExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }),
        User.create({
          name: `Auction Legacy Verified ${suffix}`,
          email: `legacy-${suffix}@local.test`,
          password: "local-test-password",
          verified: true
        }),
        User.create({
          name: `Auction Legacy Seller ${suffix}`,
          email: `legacy-seller-${suffix}@local.test`,
          password: "local-test-password",
          isVerifiedSeller: true,
          verificationExpiresAt: verifiedFields.verificationExpiryDate
        }),
        User.create({
          name: `Auction Email Verified ${suffix}`,
          email: `email-verified-${suffix}@local.test`,
          password: "local-test-password",
          isEmailVerified: true
        }),
        User.create({
          name: `Auction Deleted ${suffix}`,
          email: `deleted-${suffix}@local.test`,
          password: "local-test-password",
          isDeleted: true,
          ...verifiedFields
        })
      ]);
      await User.collection.updateOne(
        { _id: invalidExpiryUser._id },
        { $set: { verificationExpiryDate: "not-a-date" } }
      );
      const supervisor = await User.create({
        name: `Auction Supervisor ${suffix}`,
        email: `supervisor-${suffix}@local.test`,
        password: "local-test-password",
        role: "supervisor",
        permissions: ["auctions"]
      });
      const restrictedSupervisor = await User.create({
        name: `Auction Restricted Supervisor ${suffix}`,
        email: `restricted-${suffix}@local.test`,
        password: "local-test-password",
        role: "supervisor",
        permissions: ["ads"]
      });
      const governorate = await Governorate.create({
        name: `Auction governorate ${suffix}`,
        isActive: true
      });
      const carCity = await City.create({
        name: `Auction city ${suffix}`,
        governorateId: governorate._id,
        isActive: true
      });
      const carsRoot = await Category.create({ name: `Cars ${suffix}`, slug: "cars", status: "active" });
      const carsForSale = await Category.create({
        name: `Cars for sale ${suffix}`, slug: "cars-for-sale", parentId: carsRoot._id, status: "active"
      });
      const electronicsRoot = await Category.create({ name: `Electronics ${suffix}`, slug: "electronics", status: "active" });
      const mobiles = await Category.create({
        name: `Mobiles ${suffix}`,
        slug: "mobiles",
        parentId: electronicsRoot._id,
        status: "active"
      });
      const category = mobiles;
      const [desktopComputers, laptops, cameras] = await Promise.all([
        Category.create({ name: `Desktop computers ${suffix}`, slug: "desktop-computers", parentId: electronicsRoot._id, status: "active" }),
        Category.create({ name: `Laptops ${suffix}`, slug: "laptops", parentId: electronicsRoot._id, status: "active" }),
        Category.create({ name: `Cameras ${suffix}`, slug: "cameras", parentId: electronicsRoot._id, status: "active" })
      ]);
      const realEstateRoot = await Category.create({ name: `Property ${suffix}`, slug: "real-estate", status: "active" });
      const apartment = await Category.create({ name: `Apartments ${suffix}`, slug: "apartments", parentId: realEstateRoot._id, status: "active" });
      const furnitureRoot = await Category.create({ name: `Furniture ${suffix}`, slug: "furniture", status: "active" });
      const bedroom = await Category.create({ name: `Bedrooms ${suffix}`, slug: "bedrooms", parentId: furnitureRoot._id, status: "active" });
      const appliancesRoot = await Category.create({ name: `Home appliances ${suffix}`, slug: "home-appliances", status: "active" });
      const washingMachines = await Category.create({ name: `Washing machines ${suffix}`, slug: "washing-machines", parentId: appliancesRoot._id, status: "active" });

      const tokens = new Map(
        [
          owner, bidderOne, bidderTwo, administrator, disabledUser, rateLimitedUser,
          unverifiedUser, expiredUser, missingExpiryUser, invalidExpiryUser,
          legacyVerifiedUser, legacySellerUser, emailVerifiedUser, deletedUser,
          supervisor, restrictedSupervisor
        ]
          .map((user) => [
            String(user._id),
            signAccessToken({ id: String(user._id), role: user.role })
          ])
      );
      const tokenFor = (user) => tokens.get(String(user._id));
      const request = async (route, { method = "GET", user, body } = {}) => {
        const headers = {};
        if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
        if (body !== undefined && !(body instanceof FormData)) {
          headers["Content-Type"] = "application/json";
        }
        const response = await fetch(`${baseUrl}${route}`, {
          method,
          headers,
          body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
          signal: AbortSignal.timeout(20_000)
        });
        const data = await response.json();
        return { status: response.status, data };
      };
      const requestRaw = async (route, { method = "GET", user, body } = {}) => {
        const headers = {};
        if (user) headers.Authorization = `Bearer ${tokenFor(user)}`;
        const response = await fetch(`${baseUrl}${route}`, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(20_000)
        });
        return response;
      };
      const formFor = ({
        title = `Local auction ${suffix}`,
        description = "A real item listed for a local auction integration test.",
        itemCondition = "Used, fully functional, with ordinary signs of use.",
        defectsNotes = "No known defects.",
        deliveryMethod = "pickup",
        deliveryDetails = "Pickup in the selected city, arranged with the seller.",
        startingPrice = "100",
        minimumIncrement = "10",
        durationDays = 1,
        clientFields = {},
        withImage = true,
        imageCount = withImage ? 1 : 0,
        categoryId = category._id,
        categoryDetails = {
          manufacturer: "Example",
          model: "Model X",
          storage: "128 GB",
          deviceCondition: "Used, works normally."
        },
        imageLabels = Array(imageCount).fill("actual_item"),
        cityId = String(categoryId) === String(carsForSale._id) ? carCity._id : ""
      } = {}) => {
        const form = new FormData();
        form.set("title", title);
        form.set("description", description);
        form.set("itemCondition", itemCondition);
        form.set("defectsNotes", defectsNotes);
        form.set("deliveryMethod", deliveryMethod);
        form.set("deliveryDetails", deliveryDetails);
        form.set("categoryId", String(categoryId));
        form.set("categoryDetails", JSON.stringify(categoryDetails));
        form.set("imageLabels", JSON.stringify(imageLabels));
        form.set("governorateId", String(governorate._id));
        form.set("cityId", cityId ? String(cityId) : "");
        form.set("currency", "YER_ADEN");
        form.set("startingPrice", startingPrice);
        form.set("minimumIncrement", minimumIncrement);
        form.set("durationDays", String(durationDays));
        form.set("ownerId", String(bidderOne._id));
        for (const [name, value] of Object.entries(clientFields)) {
          form.set(name, String(value));
        }
        for (let index = 0; index < imageCount; index += 1) {
          form.append(
            "images",
            new Blob([imageBuffer], { type: "image/png" }),
            `auction-${suffix}-${index}.png`
          );
        }
        return form;
      };
      const createDraft = async (user = owner, options = {}) => {
        const response = await request("/auctions", {
          method: "POST",
          user,
          body: formFor(options)
        });
        assert.equal(response.status, 201, JSON.stringify(response.data));
        for (const image of response.data.auction.images) {
          uploadedFiles.add(path.basename(image));
        }
        return response.data.auction;
      };
      const submitDraft = async (auction, user = owner, accepted = true) =>
        request(`/auctions/${auction.id}/submit`, {
          method: "POST",
          user,
          body: { accepted }
        });
      const approveAuction = async (auction) =>
        request(`/admin/auctions/${auction.id}/approve`, { method: "PATCH", user: administrator });
      const makeLive = async (auction, user = owner) => {
        const submitted = await submitDraft(auction, user);
        assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
        const approved = await approveAuction(auction);
        assert.equal(approved.status, 200, JSON.stringify(approved.data));
        await Auction.updateOne(
          { _id: auction.id },
          {
            $set: {
              startAt: new Date(Date.now() - 1_000),
              endAt: new Date(Date.now() + 10 * 60_000)
            }
          }
        );
        await runAuctionLifecycleOnce(app);
        const live = await Auction.findById(auction.id).lean();
        assert.equal(live.status, "live");
        return live;
      };
      const postBid = (auctionId, user, amount, idempotencyKey) =>
        request(`/auctions/${auctionId}/bids`, {
          method: "POST",
          user,
          body: { amount, idempotencyKey }
        });
      const imageBuffer = await sharp({
        create: { width: 800, height: 600, channels: 3, background: "#2b65d9" }
      }).png().toBuffer();
      const carDetails = {
        manufacturer: "Toyota",
        model: "Corolla",
        year: 2018,
        vehicleType: "car",
        transmission: "automatic",
        fuelType: "petrol",
        engineCapacityCc: 1800,
        mileageKm: 90_000,
        vin: "",
        vehicleCondition: "Used, drives normally.",
        engineCondition: "Runs normally.",
        transmissionCondition: "Shifts normally.",
        bodyCondition: "No visible damage.",
        registrationStatus: "valid",
        hasAccidentHistory: false,
        hasKnownDamage: false,
        hasMajorRepairs: false,
        inspectionLocation: "Sanaa city"
      };
      const carImageLabels = ["front", "rear", "left_side", "right_side", "interior", "dashboard"];

      await t.test("local transaction commit and rollback are supported", async () => {
        const committedSlug = `transaction-commit-${suffix}`;
        const rolledBackSlug = `transaction-rollback-${suffix}`;
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await Category.create(
              [{ name: `Transaction commit ${suffix}`, slug: committedSlug }],
              { session }
            );
          });
          await assert.rejects(
            session.withTransaction(async () => {
              await Category.create(
                [{ name: `Transaction rollback ${suffix}`, slug: rolledBackSlug }],
                { session }
              );
              throw new Error("intentional local transaction rollback");
            }),
            /intentional local transaction rollback/
          );
        } finally {
          await session.endSession();
        }
        assert.ok(await Category.exists({ slug: committedSlug }));
        assert.equal(await Category.exists({ slug: rolledBackSlug }), null);
      });

      let primaryAuction;
      await t.test("create, validate, persist images, and keep drafts private", async (creationTest) => {
        const unverifiedCreate = await request("/auctions", {
          method: "POST",
          user: unverifiedUser,
          body: formFor({ withImage: false })
        });

        await creationTest.test("category requirements and private car document review gate publication", async () => {
          assert.equal(
            (await request("/admin/auctions/document-policies", { user: administrator })).status >= 400,
            true
          );

          const requirementCases = [
            [carsForSale, "vehicle", true, 2],
            [realEstateRoot, "property", false, 0],
            [mobiles, "phone", true, 0],
            [desktopComputers, "computer", true, 0],
            [laptops, "computer", true, 0],
            [cameras, "camera", true, 0],
            [electronicsRoot, "electronics", true, 0],
            [furnitureRoot, "furniture", true, 0],
            [appliancesRoot, "home_appliance", true, 0]
          ];
          for (const [categoryItem, expectedType, publicEnabled, documentsRequired] of requirementCases) {
            const response = await request(`/auctions/category-requirements?categoryId=${categoryItem._id}`);
            assert.equal(response.status, 200);
            assert.equal(response.data.requirements.type, expectedType);
            assert.equal(response.data.requirements.supported, true);
            assert.equal(response.data.requirements.publicListingEnabled, publicEnabled);
            assert.equal(response.data.requirements.documentsRequired, documentsRequired);
          }
          const selectableCategories = await request("/auctions/categories");
          assert.equal(selectableCategories.status, 200);
          assert.equal(
            selectableCategories.data.items.find((item) => item.slug === "cars-for-sale")
              .requirements.documentTypes[0].key,
            "ownership"
          );
          assert.deepEqual(
            selectableCategories.data.items.find((item) => item.slug === "cars-for-sale")
              .requirements.documentTypes.map((document) => document.key),
            ["ownership", "owner-identity"]
          );
          assert.deepEqual(
            selectableCategories.data.items.map((item) => item.slug),
            [
              "cars-for-sale",
              "real-estate",
              "mobiles",
              "desktop-computers",
              "laptops",
              "cameras",
              "electronics",
              "furniture",
              "home-appliances"
            ]
          );
          assert.equal(
            selectableCategories.data.items.some((item) =>
              [carsRoot.slug, apartment.slug, bedroom.slug, washingMachines.slug].includes(item.slug)
            ),
            false
          );

          const inheritedRequirementCases = [
            apartment,
            bedroom,
            washingMachines
          ];
          for (const categoryItem of inheritedRequirementCases) {
            const response = await request(
              `/auctions/category-requirements?categoryId=${categoryItem._id}`
            );
            assert.equal(response.status, 200);
            assert.equal(response.data.requirements.type, "unsupported");
            assert.equal(response.data.requirements.supported, false);
            const childCategoryCreate = await request("/auctions", {
              method: "POST",
              user: owner,
              body: formFor({ categoryId: categoryItem._id })
            });
            assert.equal(childCategoryCreate.status, 400);
            assert.equal(childCategoryCreate.data.code, "UNSUPPORTED_AUCTION_CATEGORY");
          }
          const carsRootRequirements = await request(
            `/auctions/category-requirements?categoryId=${carsRoot._id}`
          );
          assert.equal(carsRootRequirements.data.requirements.supported, false);

          const unsupportedCategory = await Category.create({
            name: `Unsupported category ${suffix}`,
            slug: `auction-unsupported-${suffix}`,
            status: "active"
          });
          const unsupportedRequirements = await request(
            `/auctions/category-requirements?categoryId=${unsupportedCategory._id}`
          );
          assert.equal(unsupportedRequirements.status, 200);
          assert.equal(unsupportedRequirements.data.requirements.supported, false);
          const unsupportedCreate = await request("/auctions", {
            method: "POST",
            user: owner,
            body: formFor({
              categoryId: unsupportedCategory._id,
              clientFields: { category: "mobiles", slug: "mobiles" }
            })
          });
          assert.equal(unsupportedCreate.status, 400);
          assert.equal(unsupportedCreate.data.code, "UNSUPPORTED_AUCTION_CATEGORY");

          const invalidPhoneData = await request("/auctions", {
            method: "POST",
            user: owner,
            body: formFor({
              categoryId: mobiles._id,
              categoryDetails: { manufacturer: "Brand", notAValidPhoneField: "unexpected" },
              imageLabels: ["actual_item"]
            })
          });
          assert.equal(invalidPhoneData.status, 400);

          const invalidVehicleChoice = await request("/auctions", {
            method: "POST",
            user: owner,
            body: formFor({
              categoryId: carsForSale._id,
              categoryDetails: { ...carDetails, fuelType: "unlisted" },
              imageCount: carImageLabels.length,
              imageLabels: carImageLabels
            })
          });
          assert.equal(invalidVehicleChoice.status, 400);
          assert.equal(invalidVehicleChoice.data.code, "INVALID_CATEGORY_AUCTION_DATA");

          const incompleteVehicle = await createDraft(owner, {
            categoryId: carsForSale._id,
            categoryDetails: { ...carDetails, hasAccidentHistory: true },
            imageCount: carImageLabels.length,
            imageLabels: carImageLabels
          });
          const incompleteVehicleSubmit = await submitDraft(incompleteVehicle);
          assert.equal(incompleteVehicleSubmit.status, 400);
          assert.equal(incompleteVehicleSubmit.data.code, "INVALID_CATEGORY_AUCTION_DATA");

          const incompletePhone = await createDraft(owner, {
            categoryId: mobiles._id,
            categoryDetails: {},
            imageLabels: ["actual_item"]
          });
          const incompletePhoneSubmission = await submitDraft(incompletePhone);
          assert.equal(incompletePhoneSubmission.status, 400);
          assert.equal(incompletePhoneSubmission.data.code, "INVALID_CATEGORY_AUCTION_DATA");

          for (const categoryItem of [
            realEstateRoot,
            desktopComputers,
            laptops,
            cameras,
            electronicsRoot,
            furnitureRoot,
            appliancesRoot
          ]) {
            const incompleteAuction = await createDraft(owner, {
              title: `Incomplete ${categoryItem.slug} ${suffix}`,
              categoryId: categoryItem._id,
              categoryDetails: {},
              imageLabels: ["actual_item"]
            });
            const incompleteSubmission = await submitDraft(incompleteAuction);
            assert.equal(
              incompleteSubmission.status,
              400,
              `category ${categoryItem.slug} must reject empty category details`
            );
            assert.equal(incompleteSubmission.data.code, "INVALID_CATEGORY_AUCTION_DATA");
          }

          const phoneAuction = await createDraft(owner, {
            categoryId: mobiles._id,
            categoryDetails: {
              manufacturer: "Example",
              model: "Phone X",
              storage: "128 GB",
              deviceCondition: "Used, works normally.",
              imei: "356789012345678"
            },
            imageLabels: ["actual_item"]
          });
          const phoneSubmission = await submitDraft(phoneAuction);
          assert.equal(phoneSubmission.status, 200, JSON.stringify(phoneSubmission.data));
          const phoneApproval = await approveAuction(phoneAuction);
          assert.equal(phoneApproval.status, 200, JSON.stringify(phoneApproval.data));
          const publicPhone = await request(`/auctions/${phoneAuction.id}`);
          assert.equal(publicPhone.status, 200);
          assert.equal(publicPhone.data.auction.categoryDetails.manufacturer, "Example");
          assert.equal("imei" in publicPhone.data.auction.categoryDetails, false);
          assert.equal("categoryDocuments" in publicPhone.data.auction, false);

          const carAuction = await createDraft(owner, {
            title: `Car auction ${suffix}`,
            categoryId: carsForSale._id,
            categoryDetails: carDetails,
            imageCount: carImageLabels.length,
            imageLabels: carImageLabels
          });
          const missingDocumentSubmit = await submitDraft(carAuction);
          assert.equal(missingDocumentSubmit.status, 400);
          assert.equal(missingDocumentSubmit.data.code, "AUCTION_DOCUMENT_REQUIRED");

          const invalidDocument = new FormData();
          invalidDocument.set("type", "ownership");
          invalidDocument.set("document", new Blob(["not a PDF"], { type: "application/pdf" }), "invalid.pdf");
          const invalidDocumentResponse = await request(`/auctions/${carAuction.id}/documents`, {
            method: "POST",
            user: owner,
            body: invalidDocument
          });
          assert.equal(invalidDocumentResponse.status, 400);
          assert.equal(invalidDocumentResponse.data.code, "INVALID_AUCTION_DOCUMENT");

          const ownershipDocument = new FormData();
          ownershipDocument.set("type", "ownership");
          ownershipDocument.set(
            "document",
            new Blob(["%PDF-1.4\nlocal auction document test"], { type: "application/pdf" }),
            "ownership.pdf"
          );
          const uploadedDocument = await request(`/auctions/${carAuction.id}/documents`, {
            method: "POST",
            user: owner,
            body: ownershipDocument
          });
          assert.equal(uploadedDocument.status, 201, JSON.stringify(uploadedDocument.data));
          assert.equal(uploadedDocument.data.auction.categoryDocuments.status, "pending_review");
          const storedCarAuction = await Auction.findById(carAuction.id).lean();
          const storedDocument = storedCarAuction.categoryDocuments.find((entry) => entry.isCurrent);
          uploadedPrivateDocuments.add(storedDocument.storageKey);
          const privateDocumentsDirectory = path.resolve(
            backendDirectory,
            "private_uploads",
            "auction-documents"
          );
          assert.equal(
            privateDocumentsDirectory.startsWith(path.resolve(backendDirectory, "uploads") + path.sep),
            false
          );
          assert.equal(fs.existsSync(path.join(backendDirectory, "private_uploads", "auction-documents", storedDocument.storageKey)), true);
          const ownerDocumentView = await request(`/auctions/mine/${carAuction.id}`, { user: owner });
          assert.equal(ownerDocumentView.status, 200);
          assert.equal(JSON.stringify(ownerDocumentView.data).includes(storedDocument.storageKey), false);

          const missingOwnerIdentity = await submitDraft(carAuction);
          assert.equal(missingOwnerIdentity.status, 400);
          assert.equal(missingOwnerIdentity.data.code, "AUCTION_DOCUMENT_REQUIRED");
          const identityDocumentForm = new FormData();
          identityDocumentForm.set("type", "owner-identity");
          identityDocumentForm.set(
            "document",
            new Blob(["%PDF-1.4\nlocal owner identity test"], { type: "application/pdf" }),
            "owner-identity.pdf"
          );
          const identityUpload = await request(`/auctions/${carAuction.id}/documents`, {
            method: "POST",
            user: owner,
            body: identityDocumentForm
          });
          assert.equal(identityUpload.status, 201, JSON.stringify(identityUpload.data));
          const storedDocuments = (await Auction.findById(carAuction.id).lean())
            .categoryDocuments.filter((entry) => entry.isCurrent);
          const identityDocument = storedDocuments.find((entry) => entry.type === "owner-identity");
          assert.ok(identityDocument);
          uploadedPrivateDocuments.add(identityDocument.storageKey);

          await Auction.updateOne(
            { _id: carAuction.id, "categoryDocuments._id": storedDocument._id },
            { $set: { "categoryDocuments.$.policyVersion": 1 } }
          );
          const outdatedDocumentSubmission = await submitDraft(carAuction);
          assert.equal(outdatedDocumentSubmission.status, 400);
          assert.equal(outdatedDocumentSubmission.data.code, "AUCTION_DOCUMENT_REQUIRED");
          await Auction.updateOne(
            { _id: carAuction.id, "categoryDocuments._id": storedDocument._id },
            { $set: { "categoryDocuments.$.policyVersion": 2 } }
          );

          const carSubmission = await submitDraft(carAuction);
          assert.equal(carSubmission.status, 200, JSON.stringify(carSubmission.data));
          const prematureAuctionApproval = await approveAuction(carAuction);
          assert.equal(prematureAuctionApproval.status, 409);
          assert.equal(prematureAuctionApproval.data.code, "AUCTION_DOCUMENTS_NOT_APPROVED");

          const privateFilePath = `/admin/auctions/${carAuction.id}/documents/${storedDocument._id}/file`;
          assert.equal((await requestRaw(privateFilePath)).status, 401);
          assert.equal((await requestRaw(privateFilePath, { user: owner })).status, 403);
          assert.equal((await requestRaw(privateFilePath, { user: restrictedSupervisor })).status, 403);
          const supervisorDocument = await requestRaw(privateFilePath, { user: supervisor });
          assert.equal(supervisorDocument.status, 200, await supervisorDocument.text());
          const approvalWithoutComparison = await request(
            `/admin/auctions/${carAuction.id}/documents/${storedDocument._id}/review`,
            {
              method: "PATCH",
              user: administrator,
              body: { decision: "approved" }
            }
          );
          assert.equal(approvalWithoutComparison.status, 400);
          const adminDocumentReview = await request(
            `/admin/auctions/${carAuction.id}/documents/${storedDocument._id}/review`,
            {
              method: "PATCH",
              user: administrator,
              body: { decision: "approved", notes: "تمت مراجعة بيانات المركبة." }
            }
          );
          assert.equal(adminDocumentReview.status, 200, JSON.stringify(adminDocumentReview.data));
          assert.equal(adminDocumentReview.data.auction.categoryDocumentStatus, "pending_review");
          const categoryAudit = await request(`/admin/auctions/${carAuction.id}`, { user: administrator });
          assert.ok(categoryAudit.data.auditLog.some((entry) =>
            entry.action === "category_documents_approved" &&
            entry.documentId === String(storedDocument._id) &&
            entry.administrator.name &&
            entry.reason === "تمت مراجعة بيانات المركبة."
          ));
          assert.equal(
            categoryAudit.data.auction.categoryDocuments.find((entry) =>
              entry.id === String(storedDocument._id)
            ).reviewNotes,
            "تمت مراجعة بيانات المركبة."
          );

          const approvalWhileIdentityPending = await approveAuction(carAuction);
          assert.equal(approvalWhileIdentityPending.status, 409);
          assert.equal(approvalWhileIdentityPending.data.code, "AUCTION_DOCUMENTS_NOT_APPROVED");
          await Auction.updateOne(
            { _id: carAuction.id },
            { $set: { status: "live", reviewStatus: "approved", startAt: new Date(Date.now() - 1_000), endAt: new Date(Date.now() + 60_000) } }
          );
          await assert.rejects(
            placeAuctionBid({
              auctionId: carAuction.id,
              bidderId: bidderOne._id,
              amount: "110",
              idempotencyKey: `blocked-car-${suffix}`,
              app
            }),
            (error) => error.code === "AUCTION_REQUIREMENTS_NOT_MET"
          );
          assert.equal((await request(`/auctions/${carAuction.id}`)).status, 404);
          const publicAuctions = await request(`/auctions?categoryId=${carsForSale._id}`);
          assert.equal(publicAuctions.data.items.some((item) => item.id === carAuction.id), false);
          await Auction.updateOne(
            { _id: carAuction.id },
            { $set: { status: "draft", reviewStatus: "pending", approvedBy: null, approvedAt: null, startAt: null, endAt: null } }
          );
          const identityReview = await request(
            `/admin/auctions/${carAuction.id}/documents/${identityDocument._id}/review`,
            {
              method: "PATCH",
              user: administrator,
              body: { decision: "approved", notes: "تمت مطابقة بيانات المالك." }
            }
          );
          assert.equal(identityReview.status, 200, JSON.stringify(identityReview.data));
          assert.equal(identityReview.data.auction.categoryDocumentStatus, "approved");
          const approved = await approveAuction(carAuction);
          assert.equal(approved.status, 200, JSON.stringify(approved.data));
          const publicResponse = await request(`/auctions/${carAuction.id}`);
          assert.equal(publicResponse.status, 200);
          assert.equal("vin" in publicResponse.data.auction.categoryDetails, false);
          assert.equal(JSON.stringify(publicResponse.data).includes(storedDocument.storageKey), false);
          assert.equal(JSON.stringify(publicResponse.data).includes(identityDocument.storageKey), false);
          const adminEligibility = await request(
            `/admin/auctions/${carAuction.id}`,
            { user: administrator }
          );
          assert.equal(adminEligibility.data.publicationChecks.publicationEligible, true);
        });

        await creationTest.test("document rejection, replacement, and material changes reopen review", async () => {
          const carAuction = await createDraft(owner, {
            title: `Car document correction ${suffix}`,
            categoryId: carsForSale._id,
            categoryDetails: { ...carDetails, vin: "VIN-ORIGINAL-123" },
            imageCount: carImageLabels.length,
            imageLabels: carImageLabels
          });
          const uploadDocument = async (filename, type = "ownership") => {
            const form = new FormData();
            form.set("type", type);
            form.set("document", new Blob(["%PDF-1.4\nsecond local document test"], { type: "application/pdf" }), filename);
            return request(`/auctions/${carAuction.id}/documents`, {
              method: "POST",
              user: owner,
              body: form
            });
          };
          const identityUpload = await uploadDocument("owner-identity.pdf", "owner-identity");
          assert.equal(identityUpload.status, 201);
          const missingOwnership = await submitDraft(carAuction);
          assert.equal(missingOwnership.status, 400);
          assert.equal(missingOwnership.data.code, "AUCTION_DOCUMENT_REQUIRED");
          const firstUpload = await uploadDocument("ownership-first.pdf");
          assert.equal(firstUpload.status, 201);
          let saved = await Auction.findById(carAuction.id).lean();
          let currentDocument = saved.categoryDocuments.find((entry) =>
            entry.isCurrent && entry.type === "ownership"
          );
          saved.categoryDocuments.filter((entry) => entry.isCurrent).forEach((entry) =>
            uploadedPrivateDocuments.add(entry.storageKey)
          );
          assert.equal((await submitDraft(carAuction)).status, 200);

          const rejection = await request(
            `/admin/auctions/${carAuction.id}/documents/${currentDocument._id}/review`,
            {
              method: "PATCH",
              user: administrator,
              body: { decision: "rejected", reason: "لا تتطابق البيانات الظاهرة." }
            }
          );
          assert.equal(rejection.status, 200);
          assert.equal(rejection.data.auction.status, "draft");
          const afterRejection = await request(`/auctions/mine/${carAuction.id}`, { user: owner });
          assert.equal(afterRejection.data.auction.categoryDocuments.status, "rejected");
          assert.equal(
            afterRejection.data.auction.categoryDocuments.items.find((entry) =>
              entry.type === "ownership"
            ).rejectionReason,
            "لا تتطابق البيانات الظاهرة."
          );
          const rejectedDocumentSubmission = await submitDraft(carAuction);
          assert.equal(rejectedDocumentSubmission.status, 400);
          assert.equal(rejectedDocumentSubmission.data.code, "AUCTION_DOCUMENT_REJECTED");

          const replacement = await uploadDocument("ownership-replacement.pdf");
          assert.equal(replacement.status, 201);
          saved = await Auction.findById(carAuction.id).lean();
          currentDocument = saved.categoryDocuments.find((entry) =>
            entry.isCurrent && entry.type === "ownership"
          );
          uploadedPrivateDocuments.add(currentDocument.storageKey);
          assert.equal(saved.categoryDocuments.filter((entry) => entry.isCurrent).length, 2);
          const approvedDocument = await request(
            `/admin/auctions/${carAuction.id}/documents/${currentDocument._id}/review`,
            {
              method: "PATCH",
              user: administrator,
              body: { decision: "approved", notes: "تمت مقارنة بيانات المركبة." }
            }
          );
          assert.equal(approvedDocument.status, 200);
          const currentIdentityDocument = saved.categoryDocuments.find((entry) =>
            entry.isCurrent && entry.type === "owner-identity"
          );
          const approvedIdentityDocument = await request(
            `/admin/auctions/${carAuction.id}/documents/${currentIdentityDocument._id}/review`,
            {
              method: "PATCH",
              user: administrator,
              body: { decision: "approved", notes: "تمت مقارنة هوية المالك." }
            }
          );
          assert.equal(approvedIdentityDocument.status, 200);

          await Auction.updateOne(
            { _id: carAuction.id },
            {
              $set: {
                status: "scheduled",
                reviewStatus: "approved",
                approvedBy: administrator._id,
                approvedAt: new Date(),
                startAt: new Date(Date.now() + 60_000),
                endAt: new Date(Date.now() + 120_000)
              }
            }
          );
          const nonMaterialDetails = {
            ...carDetails,
            vin: "VIN-ORIGINAL-123",
            exteriorColor: "Blue"
          };
          const nonMaterialEdit = await request(`/auctions/${carAuction.id}`, {
            method: "PATCH",
            user: owner,
            body: formFor({
              title: `Car document correction ${suffix}`,
              categoryId: carsForSale._id,
              categoryDetails: nonMaterialDetails,
              imageCount: 0,
              imageLabels: carImageLabels
            })
          });
          assert.equal(nonMaterialEdit.status, 200, JSON.stringify(nonMaterialEdit.data));
          const afterNonMaterialEdit = await Auction.findById(carAuction.id).lean();
          assert.equal(afterNonMaterialEdit.categoryDocumentStatus, "approved");
          assert.equal(
            afterNonMaterialEdit.categoryDocuments.find((document) => document.isCurrent).reviewStatus,
            "approved"
          );

          const changedDetails = { ...carDetails, vin: "VIN-CHANGED-456" };
          const editForm = formFor({
            title: `Car document correction ${suffix}`,
            categoryId: carsForSale._id,
            categoryDetails: changedDetails,
            imageCount: 0,
            imageLabels: carImageLabels
          });
          const edited = await request(`/auctions/${carAuction.id}`, {
            method: "PATCH",
            user: owner,
            body: editForm
          });
          assert.equal(edited.status, 200, JSON.stringify(edited.data));
          assert.equal(edited.data.auction.status, "draft");
          assert.equal(edited.data.auction.reviewStatus, "draft");
          assert.equal(edited.data.auction.categoryDocuments.status, "pending_review");
          const reopened = await Auction.findById(carAuction.id).lean();
          assert.ok(reopened.categoryDocuments.filter((entry) => entry.isCurrent)
            .every((entry) => entry.reviewStatus === "pending_review"));
          const audit = await request(`/admin/auctions/${carAuction.id}`, { user: administrator });
          assert.ok(audit.data.auditLog.some((entry) =>
            entry.action === "category_documents_reopened" &&
            entry.actor?.name === owner.name
          ));
        });
        assert.equal(unverifiedCreate.status, 403);
        assert.equal(unverifiedCreate.data.error, "يجب أن يكون حسابك موثقًا وساري التوثيق لإنشاء مزاد.");
        assert.equal(unverifiedCreate.data.code, "AUCTION_VERIFICATION_REQUIRED");

        const spoofedVerification = formFor({ withImage: false });
        spoofedVerification.set("verificationStatus", "verified");
        spoofedVerification.set("verificationExpiryDate", new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());
        const spoofedCreate = await request("/auctions", {
          method: "POST",
          user: unverifiedUser,
          body: spoofedVerification
        });
        assert.equal(spoofedCreate.status, 403);

        const expiredCreate = await request("/auctions", {
          method: "POST",
          user: expiredUser,
          body: formFor({ withImage: false })
        });
        assert.equal(expiredCreate.status, 403);

        for (const ineligibleUser of [missingExpiryUser, invalidExpiryUser]) {
          const invalidExpiryCreate = await request("/auctions", {
            method: "POST",
            user: ineligibleUser,
            body: formFor({ withImage: false })
          });
          assert.equal(invalidExpiryCreate.status, 403);
        }

        const legacyCreate = await request("/auctions", {
          method: "POST",
          user: legacyVerifiedUser,
          body: formFor({ withImage: false })
        });
        assert.equal(legacyCreate.status, 403);

        const legacySellerCreate = await request("/auctions", {
          method: "POST",
          user: legacySellerUser,
          body: formFor({ withImage: false })
        });
        assert.equal(legacySellerCreate.status, 403);

        const emailOnlyCreate = await request("/auctions", {
          method: "POST",
          user: emailVerifiedUser,
          body: formFor({ withImage: false })
        });
        assert.equal(emailOnlyCreate.status, 403);

        const disabledCreate = await request("/auctions", {
          method: "POST",
          user: disabledUser,
          body: formFor({ withImage: false })
        });
        assert.equal(disabledCreate.status, 403);
        const deletedCreate = await request("/auctions", {
          method: "POST",
          user: deletedUser,
          body: formFor({ withImage: false })
        });
        assert.equal(deletedCreate.status, 403);

        const invalidAmount = await request("/auctions", {
          method: "POST",
          user: owner,
          body: formFor({ startingPrice: "-1", withImage: false })
        });
        assert.equal(invalidAmount.status, 400);

        const invalidDuration = await request("/auctions", {
          method: "POST",
          user: owner,
          body: formFor({ durationDays: 2, withImage: false })
        });
        assert.equal(invalidDuration.status, 400);

        const submissionRequirements = await request("/auctions/submission-requirements");
        assert.deepEqual(submissionRequirements.data.durationOptions, [
          { days: 1, label: "يوم واحد" },
          { days: 4, label: "4 أيام" },
          { days: 7, label: "أسبوع" }
        ]);

        const missingImage = await request("/auctions", {
          method: "POST",
          user: owner,
          body: formFor({ withImage: false })
        });
        assert.equal(missingImage.status, 400);

        const invalidDeliveryForm = formFor({ withImage: false });
        invalidDeliveryForm.set("deliveryMethod", "unrecognized");
        const invalidDelivery = await request("/auctions", {
          method: "POST",
          user: owner,
          body: invalidDeliveryForm
        });
        assert.equal(invalidDelivery.status, 400);

        const singleImageAuction = await createDraft(owner, {
          title: `One image ${suffix}`,
          imageCount: 1
        });
        assert.equal(singleImageAuction.images.length, 1);

        const tenImageResponse = await request("/auctions", {
          method: "POST",
          user: owner,
          body: formFor({ title: `Ten images ${suffix}`, imageCount: 10 })
        });
        assert.equal(tenImageResponse.status, 201, JSON.stringify(tenImageResponse.data));
        assert.equal(tenImageResponse.data.auction.images.length, 10);
        for (const image of tenImageResponse.data.auction.images) {
          uploadedFiles.add(path.basename(image));
        }

        const elevenImageResponse = await request("/auctions", {
          method: "POST",
          user: owner,
          body: formFor({ title: `Eleven images ${suffix}`, imageCount: 11 })
        });
        assert.equal(elevenImageResponse.status, 400);
        assert.equal(elevenImageResponse.data.code, "INVALID_AUCTION_IMAGE_UPLOAD");

        const oversizedForm = formFor({ title: `Oversized image ${suffix}`, withImage: false });
        oversizedForm.append(
          "images",
          new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }),
          "oversized.png"
        );
        const oversizedImage = await request("/auctions", {
          method: "POST",
          user: owner,
          body: oversizedForm
        });
        assert.equal(oversizedImage.status, 413);
        assert.equal(oversizedImage.data.code, "INVALID_AUCTION_IMAGE_UPLOAD");

        const unsupportedForm = formFor({ title: `Unsupported image ${suffix}`, withImage: false });
        unsupportedForm.append("images", new Blob(["not an image"], { type: "image/gif" }), "unsupported.gif");
        const unsupportedImage = await request("/auctions", {
          method: "POST",
          user: owner,
          body: unsupportedForm
        });
        assert.equal(unsupportedImage.status, 400);
        assert.equal(unsupportedImage.data.code, "INVALID_AUCTION_IMAGE_UPLOAD");

        const uploadDirectory = path.join(backendDirectory, "uploads");
        const beforeInvalidUpload = new Set(await fs.promises.readdir(uploadDirectory));
        const invalidAfterUpload = await request("/auctions", {
          method: "POST",
          user: owner,
          body: formFor({ title: "x" })
        });
        assert.equal(invalidAfterUpload.status, 400);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const filesAfterInvalidUpload = await fs.promises.readdir(uploadDirectory);
        assert.deepEqual(
          filesAfterInvalidUpload.filter((filename) => !beforeInvalidUpload.has(filename)),
          [],
          "uploaded image variants are removed after a later validation failure"
        );

        primaryAuction = await createDraft(owner, {
          clientFields: {
            category: "auction-unsupported",
            slug: "auction-unsupported",
            duration: "2",
            startAt: "2000-01-01T00:00:00.000Z",
            endAt: "2099-01-01T00:00:00.000Z",
            status: "live",
            reviewStatus: "approved"
          }
        });
        const persisted = await Auction.findById(primaryAuction.id).lean();
        assert.equal(String(persisted.ownerId), String(owner._id));
        assert.equal(persisted.status, "draft");
        assert.equal(persisted.reviewStatus, "draft");
        assert.equal(persisted.durationDays, 1);
        assert.equal(persisted.startAt, null);
        assert.equal(persisted.endAt, null);
        assert.equal(primaryAuction.status, "draft");
        assert.equal(primaryAuction.reviewStatus, "draft");
        for (const durationDays of [4, 7]) {
          const durationAuction = await createDraft(owner, {
            title: `Duration ${durationDays} ${suffix}`,
            durationDays
          });
          const durationRecord = await Auction.findById(durationAuction.id).lean();
          assert.equal(durationRecord.durationDays, durationDays);
          assert.equal(durationRecord.startAt, null);
          assert.equal(durationRecord.endAt, null);
        }
        assert.equal(persisted.startingPrice.toString(), "100");
        assert.equal(persisted.currentPrice.toString(), "100");
        assert.equal(persisted.itemCondition, "Used, fully functional, with ordinary signs of use.");
        assert.equal(persisted.defectsNotes, "No known defects.");
        assert.equal(persisted.deliveryMethod, "pickup");
        assert.equal(persisted.deliveryDetails, "Pickup in the selected city, arranged with the seller.");
        const uploadedPath = path.join(backendDirectory, "uploads", path.basename(persisted.images[0]));
        assert.equal(fs.existsSync(uploadedPath), true, "image was processed and persisted locally");

        const publicBeforeReview = await request(`/auctions/${primaryAuction.id}`);
        assert.equal(publicBeforeReview.status, 404);
        const ownerList = await request("/auctions/mine", { user: owner });
        assert.equal(ownerList.status, 200);
        assert.ok(ownerList.data.items.some((item) => item.id === primaryAuction.id));

        const acknowledgmentRequirements = await request("/auctions/submission-requirements");
        assert.equal(acknowledgmentRequirements.status, 200);
        const missingAcknowledgment = await request(`/auctions/${primaryAuction.id}/submit`, {
          method: "POST",
          user: owner
        });
        assert.equal(missingAcknowledgment.status, 400);
        const rejectedAcknowledgment = await request(`/auctions/${primaryAuction.id}/submit`, {
          method: "POST",
          user: owner,
          body: { accepted: false }
        });
        assert.equal(rejectedAcknowledgment.status, 400);

        await User.updateOne(
          { _id: owner._id },
          { $set: { verificationStatus: "pending" } }
        );
        const unverifiedSubmission = await submitDraft(primaryAuction);
        assert.equal(unverifiedSubmission.status, 403);
        assert.equal(unverifiedSubmission.data.code, "AUCTION_VERIFICATION_REQUIRED");
        await User.updateOne(
          { _id: owner._id },
          { $set: verifiedFields }
        );

        const submitted = await submitDraft(primaryAuction);
        assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
        assert.equal(submitted.data.auction.reviewStatus, "pending");
        const savedAcknowledgment = await Auction.findById(primaryAuction.id).lean();
        assert.equal(savedAcknowledgment.submissionAcknowledgments.length, 1);
        assert.equal(String(savedAcknowledgment.submissionAcknowledgments[0].acceptedBy), String(owner._id));
        assert.equal(
          savedAcknowledgment.submissionAcknowledgments[0].text,
          acknowledgmentRequirements.data.acknowledgment.text
        );
        assert.equal(
          savedAcknowledgment.submissionAcknowledgments[0].version,
          acknowledgmentRequirements.data.acknowledgment.version
        );
        assert.equal((await request("/admin/auctions", { user: bidderOne })).status, 403);
        const moderationQueue = await request("/admin/auctions", { user: administrator });
        assert.ok(moderationQueue.data.items.some((item) => item.id === primaryAuction.id));
        const primaryAudit = await request(`/admin/auctions/${primaryAuction.id}`, { user: administrator });
        assert.equal(primaryAudit.data.auditLog.length, 0);
        assert.equal((await request("/auctions", {
          method: "POST",
          body: formFor()
        })).status, 401);
      });

      await t.test("admin rejection, owner edit, and resubmission are persisted", async () => {
        const rejected = await createDraft(owner, { title: `Rejected auction ${suffix}` });
        assert.equal((await submitDraft(rejected)).status, 200);
        const deniedSupervisor = await request("/admin/auctions", { user: restrictedSupervisor });
        assert.equal(deniedSupervisor.status, 403);
        const allowedSupervisor = await request("/admin/auctions", { user: supervisor });
        assert.equal(allowedSupervisor.status, 200);
        const rejection = await request(`/admin/auctions/${rejected.id}/reject`, {
          method: "PATCH",
          user: administrator,
          body: { reason: "يرجى توضيح حالة السلعة." }
        });
        assert.equal(rejection.status, 200);
        assert.equal(rejection.data.auction.status, "rejected");
        assert.equal((await request(`/auctions/${rejected.id}`)).status, 404);

        const editForm = formFor({
          title: `Updated auction ${suffix}`,
          withImage: false,
          clientFields: {
            startAt: "2000-01-01T00:00:00.000Z",
            endAt: "2099-01-01T00:00:00.000Z",
            status: "live",
            reviewStatus: "approved"
          }
        });
        const edited = await request(`/auctions/${rejected.id}`, {
          method: "PATCH",
          user: owner,
          body: editForm
        });
        assert.equal(edited.status, 200, JSON.stringify(edited.data));
        assert.equal(edited.data.auction.title, `Updated auction ${suffix}`);
        assert.equal(edited.data.auction.status, "draft");
        assert.equal(edited.data.auction.reviewStatus, "draft");
        assert.equal((await submitDraft(edited.data.auction)).status, 200);
        const resubmittedRecord = await Auction.findById(rejected.id).lean();
        assert.equal(resubmittedRecord.startAt, null);
        assert.equal(resubmittedRecord.endAt, null);
        assert.equal((await approveAuction(edited.data.auction)).status, 200);
        const reapprovedRecord = await Auction.findById(rejected.id).lean();
        assert.equal(reapprovedRecord.startAt.toISOString(), reapprovedRecord.approvedAt.toISOString());
        assert.equal(
          reapprovedRecord.endAt.getTime() - reapprovedRecord.startAt.getTime(),
          24 * 60 * 60 * 1_000
        );
        assert.equal((await request(`/auctions/${rejected.id}`)).status, 200);
        const auditDetail = await request(`/admin/auctions/${rejected.id}`, { user: administrator });
        assert.deepEqual(
          auditDetail.data.auditLog.map((entry) => entry.action),
          ["rejected", "approved"]
        );
        assert.equal(auditDetail.data.auditLog[0].reason, "يرجى توضيح حالة السلعة.");
        assert.ok(auditDetail.data.auditLog.every((entry) => entry.administrator.name));
        await assert.rejects(
          AuctionAuditLog.deleteOne({ _id: auditDetail.data.auditLog[0].id }),
          /Auction audit log records are immutable/
        );
        assert.equal(
          (await Auction.findById(rejected.id).lean()).submissionAcknowledgments.length,
          2
        );
      });

      await t.test("approval starts auction duration at admin approval time", async () => {
        await User.updateOne(
          { _id: owner._id },
          { $set: { verificationStatus: "pending" } }
        );
        const unverifiedOwnerApproval = await approveAuction(primaryAuction);
        assert.equal(unverifiedOwnerApproval.status, 409);
        assert.equal(unverifiedOwnerApproval.data.code, "AUCTION_OWNER_VERIFICATION_REQUIRED");
        await User.updateOne(
          { _id: owner._id },
          { $set: verifiedFields }
        );

        const approved = await approveAuction(primaryAuction);
        assert.equal(approved.status, 200, JSON.stringify(approved.data));
        assert.equal(approved.data.auction.status, "live");
        const approvedStartAt = new Date(approved.data.auction.startAt);
        const approvedEndAt = new Date(approved.data.auction.endAt);
        const approvedAt = new Date(approved.data.auction.approvedAt);
        assert.equal(approvedStartAt.toISOString(), approvedAt.toISOString());
        assert.equal(
          approvedEndAt.getTime() - approvedStartAt.getTime(),
          24 * 60 * 60 * 1_000
        );
        assert.equal((await request("/auctions", {
          method: "GET"
        })).data.items.some((item) => item.id === primaryAuction.id), true);
      });

      await t.test("four- and seven-day durations are calculated at approval", async () => {
        for (const durationDays of [4, 7]) {
          const auction = await createDraft(owner, {
            title: `Approved duration ${durationDays} ${suffix}`,
            durationDays
          });
          const submission = await submitDraft(auction);
          assert.equal(submission.status, 200);
          const beforeApproval = await Auction.findById(auction.id).lean();
          assert.equal(beforeApproval.startAt, null);
          assert.equal(beforeApproval.endAt, null);
          const approval = await approveAuction(auction);
          assert.equal(approval.status, 200, JSON.stringify(approval.data));
          assert.equal(
            new Date(approval.data.auction.startAt).toISOString(),
            new Date(approval.data.auction.approvedAt).toISOString()
          );
          assert.equal(
            new Date(approval.data.auction.endAt).getTime() -
              new Date(approval.data.auction.startAt).getTime(),
            durationDays * 24 * 60 * 60 * 1_000
          );
        }
      });

      await t.test("exact decimal bids, ownership, eligibility, and idempotency", async () => {
        const ownerBid = await postBid(primaryAuction.id, owner, "110", `owner-${suffix}`);
        assert.equal(ownerBid.status, 403);
        assert.equal(ownerBid.data.code, "OWNER_CANNOT_BID");

        const unverifiedBid = await postBid(primaryAuction.id, unverifiedUser, "110", `unverified-${suffix}`);
        assert.equal(unverifiedBid.status, 403);
        assert.equal(unverifiedBid.data.error, "يجب أن يكون حسابك موثقًا وساري التوثيق للمزايدة.");
        assert.equal(unverifiedBid.data.code, "AUCTION_VERIFICATION_REQUIRED");

        const expiredBid = await postBid(primaryAuction.id, expiredUser, "110", `expired-${suffix}`);
        assert.equal(expiredBid.status, 403);
        assert.equal(expiredBid.data.code, "AUCTION_VERIFICATION_REQUIRED");

        for (const [ineligibleUser, idempotencyKey] of [
          [missingExpiryUser, `missing-expiry-${suffix}`],
          [invalidExpiryUser, `invalid-expiry-${suffix}`]
        ]) {
          const invalidExpiryBid = await postBid(primaryAuction.id, ineligibleUser, "110", idempotencyKey);
          assert.equal(invalidExpiryBid.status, 403);
          assert.equal(invalidExpiryBid.data.code, "AUCTION_VERIFICATION_REQUIRED");
        }

        const legacyBid = await postBid(primaryAuction.id, legacyVerifiedUser, "110", `legacy-${suffix}`);
        assert.equal(legacyBid.status, 403);
        assert.equal(legacyBid.data.code, "AUCTION_VERIFICATION_REQUIRED");

        const legacySellerBid = await postBid(primaryAuction.id, legacySellerUser, "110", `legacy-seller-${suffix}`);
        assert.equal(legacySellerBid.status, 403);
        assert.equal(legacySellerBid.data.code, "AUCTION_VERIFICATION_REQUIRED");

        const emailOnlyBid = await postBid(primaryAuction.id, emailVerifiedUser, "110", `email-only-${suffix}`);
        assert.equal(emailOnlyBid.status, 403);
        assert.equal(emailOnlyBid.data.code, "AUCTION_VERIFICATION_REQUIRED");

        const first = await postBid(primaryAuction.id, bidderOne, "110", `bid-one-${suffix}`);
        assert.equal(first.status, 201, JSON.stringify(first.data));
        assert.equal(first.data.bid.amount, "110");
        assert.equal(first.data.bid.sequence, 1);
        assert.equal(first.data.auction.currentPrice, "110");
        assert.equal(first.data.auction.bidCount, 1);
        const ownerNotificationsAfterFirstBid = await Notification.find({
          userId: owner._id,
          type: "auction",
          "data.auctionId": primaryAuction.id,
          "data.event": "new_bid"
        }).lean();
        assert.equal(ownerNotificationsAfterFirstBid.length, 1);
        assert.equal(ownerNotificationsAfterFirstBid[0].data.amount, "110");
        assert.equal(ownerNotificationsAfterFirstBid[0].data.sequence, 1);
        assert.match(ownerNotificationsAfterFirstBid[0].body, /110/);

        const replay = await postBid(primaryAuction.id, bidderOne, "110", `bid-one-${suffix}`);
        assert.equal(replay.status, 200);
        assert.equal(replay.data.replayed, true);
        assert.deepEqual(replay.data.bid, first.data.bid);
        assert.deepEqual(replay.data.auction, first.data.auction);
        assert.equal(
          await Notification.countDocuments({
            userId: owner._id,
            type: "auction",
            "data.auctionId": primaryAuction.id,
            "data.event": "new_bid"
          }),
          1
        );

        const keyReuse = await postBid(primaryAuction.id, bidderOne, "120", `bid-one-${suffix}`);
        assert.equal(keyReuse.status, 409);
        assert.equal(keyReuse.data.code, "IDEMPOTENCY_KEY_REUSED");

        const low = await postBid(primaryAuction.id, bidderTwo, "119.99", `bid-low-${suffix}`);
        assert.equal(low.status, 409);
        assert.equal(low.data.code, "BID_TOO_LOW");
        const second = await postBid(primaryAuction.id, bidderTwo, "120", `bid-two-${suffix}`);
        assert.equal(second.status, 201);
        const ownerBidNotifications = await Notification.find({
          userId: owner._id,
          type: "auction",
          "data.auctionId": primaryAuction.id,
          "data.event": "new_bid"
        }).sort({ "data.sequence": 1 }).lean();
        assert.equal(ownerBidNotifications.length, 2);
        assert.deepEqual(ownerBidNotifications.map(({ data }) => data.sequence), [1, 2]);
        assert.deepEqual(ownerBidNotifications.map(({ data }) => data.amount), ["110", "120"]);

        const persisted = await Auction.findById(primaryAuction.id).lean();
        assert.equal(persisted.currentPrice.toString(), "120");
        assert.equal(String(persisted.highestBidderId), String(bidderTwo._id));
        assert.equal(persisted.bidCount, 2);
        const bids = await AuctionBid.find({ auctionId: primaryAuction.id }).sort({ sequence: 1 }).lean();
        assert.deepEqual(bids.map((bid) => bid.sequence), [1, 2]);
        assert.equal(bids[0].auctionEndsAt.toISOString(), persisted.endAt.toISOString());

        const disabledAttempt = await postBid(primaryAuction.id, disabledUser, "130", `disabled-${suffix}`);
        assert.equal(disabledAttempt.status, 403);
        assert.equal(disabledAttempt.data.error, "هذا الحساب محظور من قبل الإدارة.");

        const deletedAttempt = await postBid(primaryAuction.id, deletedUser, "130", `deleted-${suffix}`);
        assert.equal(deletedAttempt.status, 403);
        assert.equal(deletedAttempt.data.error, "هذا الحساب تم حذفه.");

        const privateResponse = await request(`/auctions/${primaryAuction.id}`);
        assert.equal(privateResponse.status, 200);
        const responseText = JSON.stringify(privateResponse.data);
        assert.equal(responseText.includes("bidderId"), false);
        assert.equal(responseText.includes(String(bidderOne._id)), false);
        assert.equal(responseText.includes(String(bidderTwo._id)), false);
        assert.ok(privateResponse.data.bids.every((bid) => !("bidderId" in bid)));
      });

      await t.test("concurrent equal bids accept one and preserve one immutable sequence", async () => {
        const auction = await createDraft(owner, { title: `Equal race ${suffix}` });
        await makeLive(auction);
        const results = await Promise.all([
          postBid(auction.id, bidderOne, "110", `race-a-${suffix}`),
          postBid(auction.id, bidderTwo, "110", `race-b-${suffix}`)
        ]);
        assert.equal(results.filter((result) => result.status === 201).length, 1);
        assert.equal(results.filter((result) => result.status === 409).length, 1);
        const persisted = await Auction.findById(auction.id).lean();
        assert.equal(persisted.currentPrice.toString(), "110");
        assert.equal(persisted.bidCount, 1);
        assert.equal(await AuctionBid.countDocuments({ auctionId: auction.id }), 1);
      });

      await t.test("concurrent 110 and 120 bids leave 120 as the highest accepted offer", async () => {
        const auction = await createDraft(owner, { title: `Higher race ${suffix}` });
        await makeLive(auction);
        const results = await Promise.all([
          postBid(auction.id, bidderOne, "110", `higher-a-${suffix}`),
          postBid(auction.id, bidderTwo, "120", `higher-b-${suffix}`)
        ]);
        assert.ok(results.some((result) => result.status === 201));
        assert.ok(results.every((result) => [201, 409].includes(result.status)));
        const persisted = await Auction.findById(auction.id).lean();
        assert.equal(persisted.currentPrice.toString(), "120");
        assert.equal(String(persisted.highestBidderId), String(bidderTwo._id));
        assert.equal(persisted.bidCount, await AuctionBid.countDocuments({ auctionId: auction.id }));
        assert.ok(persisted.bidCount >= 1 && persisted.bidCount <= 2);
      });

      await t.test("bid record immutability and transaction rollback keep price and history consistent", async () => {
        const auction = await createDraft(owner, { title: `Rollback ${suffix}` });
        await makeLive(auction);
        await AuctionBid.create({
          auctionId: auction.id,
          bidderId: bidderOne._id,
          amount: mongoose.Types.Decimal128.fromString("110"),
          sequence: 1,
          auctionStatusAtAcceptance: "live",
          auctionEndsAt: new Date(Date.now() + 10 * 60_000),
          idempotencyKey: `blocker-${suffix}`
        });
        const conflict = await postBid(auction.id, bidderTwo, "110", `rollback-${suffix}`);
        assert.equal(conflict.status, 409);
        const persisted = await Auction.findById(auction.id).lean();
        assert.equal(persisted.currentPrice.toString(), "100");
        assert.equal(persisted.bidCount, 0);
        assert.equal(String(persisted.highestBidderId || ""), "");
        assert.equal(await AuctionBid.countDocuments({ auctionId: auction.id }), 1);
        await assert.rejects(
          AuctionBid.updateOne({ _id: (await AuctionBid.findOne({ auctionId: auction.id }))._id }, { $set: { amount: "999" } }),
          /immutable/
        );
      });

      await t.test("public search, filtering, pagination, and reload use stored auction data", async () => {
        const response = await request("/auctions?q=Updated&categoryId=" + category._id + "&page=1&pageSize=1");
        assert.equal(response.status, 200);
        assert.equal(response.data.pagination.page, 1);
        assert.ok(response.data.items.every((item) => !("ownerId" in item)));
        const detail = await request(`/auctions/${primaryAuction.id}`);
        assert.equal(detail.status, 200);
        assert.equal(detail.data.auction.currentPrice, "120");
        assert.equal(detail.data.auction.bidCount, 2);
      });

      await t.test("end lifecycle selects a stable winner and refuses later bids", async () => {
        await Auction.updateOne(
          { _id: primaryAuction.id },
          { $set: { status: "live", endAt: new Date(Date.now() - 1_000) } }
        );
        await runAuctionLifecycleOnce(app);
        const ended = await Auction.findById(primaryAuction.id).lean();
        assert.equal(ended.status, "ended");
        assert.equal(ended.saleStatus, "awaiting_confirmation");
        assert.equal(String(ended.winnerId), String(bidderTwo._id));
        assert.equal(String(ended.winningBidId), String(ended.highestBidId));
        const endedAt = ended.endedAt.toISOString();
        await runAuctionLifecycleOnce(app);
        assert.equal((await Auction.findById(primaryAuction.id).lean()).endedAt.toISOString(), endedAt);
        const lateBid = await postBid(primaryAuction.id, bidderOne, "130", `late-${suffix}`);
        assert.equal(lateBid.status, 409);
        assert.equal(lateBid.data.code, "AUCTION_ENDED");

        const publicEnded = await request(`/auctions/${primaryAuction.id}`);
        assert.equal(publicEnded.status, 200);
        assert.equal(publicEnded.data.auction.winner.label, "تم تحديد الفائز");
        assert.equal("winnerId" in publicEnded.data.auction, false);
        const adminDetail = await request(`/admin/auctions/${primaryAuction.id}`, { user: administrator });
        assert.equal(adminDetail.status, 200);
        assert.equal(String(adminDetail.data.auction.winner._id), String(bidderTwo._id));

        const sellerConfirmation = await request(`/auctions/${primaryAuction.id}/completion`, {
          method: "POST",
          user: owner,
          body: { action: "confirm" }
        });
        assert.equal(sellerConfirmation.status, 200);
        assert.equal(sellerConfirmation.data.auction.saleStatus, "awaiting_confirmation");
        const winnerConfirmation = await request(`/auctions/${primaryAuction.id}/completion`, {
          method: "POST",
          user: bidderTwo,
          body: { action: "confirm" }
        });
        assert.equal(winnerConfirmation.status, 200);
        assert.equal(winnerConfirmation.data.auction.saleStatus, "completed");
        assert.ok(
          (await Auction.findById(primaryAuction.id).lean()).sellerConfirmedAt
        );
        assert.ok(
          (await Auction.findById(primaryAuction.id).lean()).winnerConfirmedAt
        );
        const winnerAuctions = await request("/auctions/mine", { user: bidderTwo });
        const wonAuction = winnerAuctions.data.items.find((item) => item.id === primaryAuction.id);
        assert.equal(wonAuction.participantRole, "winner");
        assert.equal(wonAuction.saleStatus, "completed");

        const disputeAuction = await createDraft(owner, { title: `Reported sale ${suffix}` });
        await makeLive(disputeAuction);
        assert.equal(
          (await postBid(disputeAuction.id, bidderOne, "110", `dispute-bid-${suffix}`)).status,
          201
        );
        await Auction.updateOne(
          { _id: disputeAuction.id },
          { $set: { endAt: new Date(Date.now() - 1_000) } }
        );
        await runAuctionLifecycleOnce(app);
        const report = await request(`/auctions/${disputeAuction.id}/completion`, {
          method: "POST",
          user: bidderOne,
          body: { action: "report", reason: "لم يتم الاتفاق على استلام السلعة." }
        });
        assert.equal(report.status, 200);
        assert.equal(report.data.auction.saleStatus, "disputed");
        const disputeQueue = await request("/admin/auctions?status=disputed", { user: administrator });
        assert.ok(disputeQueue.data.items.some((item) => item.id === disputeAuction.id));
        const disputeAdminDetail = await request(`/admin/auctions/${disputeAuction.id}`, { user: administrator });
        assert.equal(disputeAdminDetail.data.auction.disputeReason, "لم يتم الاتفاق على استلام السلعة.");
      });

      await t.test("admin cancellation and per-account bid rate limit are enforced", async () => {
        const cancelled = await createDraft(owner, { title: `Cancelled ${suffix}` });
        await submitDraft(cancelled);
        await approveAuction(cancelled);
        const cancelResponse = await request(`/admin/auctions/${cancelled.id}/cancel`, {
          method: "PATCH",
          user: administrator,
          body: { reason: "طلب إلغاء محلي للاختبار." }
        });
        assert.equal(cancelResponse.status, 200);
        assert.equal(cancelResponse.data.auction.status, "cancelled");
        assert.equal((await request(`/auctions/${cancelled.id}`)).status, 404);
        const cancellationAudit = await AuctionAuditLog.findOne({
          auctionId: cancelled.id,
          action: "cancelled"
        }).lean();
        assert.equal(cancellationAudit.reason, "طلب إلغاء محلي للاختبار.");

        const rateAuction = await createDraft(owner, { title: `Rate limit ${suffix}` });
        await makeLive(rateAuction);
        let lastResponse;
        for (let index = 1; index <= 11; index += 1) {
          lastResponse = await postBid(
            rateAuction.id,
            rateLimitedUser,
            String(100 + index * 10),
            `rate-${suffix}-${index}`
          );
          if (index <= 10) assert.equal(lastResponse.status, 201, JSON.stringify(lastResponse.data));
        }
        assert.equal(lastResponse.status, 429);
        assert.equal(lastResponse.data.code, "AUCTION_BID_RATE_LIMITED");
      });

      await t.test("Decimal128 minimum bids add exactly without floating-point rounding", async () => {
        const auction = await createDraft(owner, {
          title: `Decimal precision ${suffix}`,
          startingPrice: "0.1",
          minimumIncrement: "0.2"
        });
        await makeLive(auction);
        const response = await postBid(
          auction.id,
          bidderOne,
          "0.3",
          `decimal-${suffix}`
        );
        assert.equal(response.status, 201, JSON.stringify(response.data));
        assert.equal(response.data.auction.currentPrice, "0.3");
        assert.equal(
          (await Auction.findById(auction.id).lean()).currentPrice.toString(),
          "0.3"
        );
        const exponent = await postBid(
          auction.id,
          bidderTwo,
          "3e-1",
          `decimal-exp-${suffix}`
        );
        assert.equal(exponent.status, 400);
      });

      assert.ok(events.some((event) => event.event === "auction:updated"));
      assert.ok(events.some((event) => event.event === "auction:status"));
    } finally {
      if (server?.listening) {
        await new Promise((resolve) => server.close(resolve));
      }
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
      for (const filename of uploadedFiles) {
        const base = filename.replace(/\.webp$/i, "");
        for (const candidate of [
          filename,
          `${base}.med.webp`,
          `${base}.thumb.webp`
        ]) {
          await fs.promises.unlink(path.join(backendDirectory, "uploads", candidate)).catch(() => {});
        }
      }
      for (const filename of uploadedPrivateDocuments) {
        await fs.promises.unlink(path.join(
          backendDirectory,
          "private_uploads",
          "auction-documents",
          filename
        )).catch(() => {});
      }
    }
  }
);

void integrationTest;
