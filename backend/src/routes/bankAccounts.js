import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { uploadBankLogo } from "../middleware/upload.js";
import Bank from "../models/Bank.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const banks = await Bank.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json(banks);
  } catch (error) {
    console.error("Error fetching banks:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

router.get("/all", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const banks = await Bank.find().sort({ order: 1 }).lean();
    res.json(banks);
  } catch (error) {
    console.error("Error fetching all banks:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

router.post("/", auth, requireRole(["admin"]), uploadBankLogo, async (req, res) => {
  try {
    console.log("POST /api/bank-accounts - Request received");
    let { bankName, accountOwner, accounts } = req.body || {};
    
    // Log incoming body for debugging
    console.log("POST /bank-accounts body:", req.body);
    console.log("POST /bank-accounts file:", req.file);

    if (!bankName || !accountOwner) {
      console.log("Validation failed: Missing bankName or accountOwner");
      return res.status(400).json({ error: "Missing fields" });
    }
    
    let accountsArray = [];
    if (typeof accounts === "string") {
      try {
        accountsArray = JSON.parse(accounts);
        console.log("Parsed accounts string:", accountsArray);
      } catch (err) {
        console.error("Error parsing accounts JSON:", err);
        accountsArray = [];
      }
    } else if (Array.isArray(accounts)) {
      accountsArray = accounts;
      console.log("Accounts is already an array:", accountsArray);
    } else {
      console.log("Accounts field is missing or invalid type:", typeof accounts);
    }

    if (accountsArray.length === 0) {
      console.log("Validation failed: accountsArray is empty");
      // Optional: return error if you want to require at least one account
    }

    const bankData = { 
      bankName, 
      accountOwner, 
      accounts: accountsArray
    };

    if (req.file) {
      bankData.logo = `/uploads/logos/${req.file.filename}`;
      console.log("Logo file added:", bankData.logo);
    }

    console.log("Attempting to create Bank with data:", JSON.stringify(bankData, null, 2));
    const bank = await Bank.create(bankData);
    console.log("Bank created successfully:", bank._id);
    res.status(201).json(bank);
  } catch (error) {
    console.error("CRITICAL ERROR in POST /bank-accounts:", error);
    res.status(500).json({ 
      error: "Server error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details: error.errors // Include Mongoose validation errors if any
    });
  }
});

router.patch("/:id", auth, requireRole(["admin"]), uploadBankLogo, async (req, res) => {
  try {
    let { bankName, accountOwner, accounts, isActive, order } = req.body || {};
    const update = {};
    if (bankName != null) update.bankName = bankName;
    if (accountOwner != null) update.accountOwner = accountOwner;
    
    if (accounts != null) {
      if (typeof accounts === "string") {
        try {
          update.accounts = JSON.parse(accounts);
        } catch (err) {
          console.error("Error parsing accounts JSON in patch:", err);
        }
      } else {
        update.accounts = accounts;
      }
    }

    if (isActive != null) update.isActive = isActive;
    if (order != null) update.order = order;

    if (req.file) {
      update.logo = `/uploads/logos/${req.file.filename}`;
    }
    
    const bank = await Bank.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!bank) return res.status(404).json({ error: "Not found" });
    res.json(bank);
  } catch (error) {
    console.error("Error updating bank account:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

router.delete("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const bank = await Bank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
