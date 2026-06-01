import { Router } from "express";
import UserBankAccount from "../models/UserBankAccount.js";
import auth from "../middleware/auth.js";

const router = Router();

// جلب كافة حسابات المستخدم البنكية
router.get("/", auth, async (req, res) => {
  try {
    const accounts = await UserBankAccount.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في جلب الحسابات البنكية" });
  }
});

// إضافة حساب بنكي جديد
router.post("/", auth, async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, accountCurrency } = req.body;
    if (!bankName || !accountName || !accountNumber || !accountCurrency) {
      return res.status(400).json({ error: "يرجى إكمال كافة الحقول" });
    }
    const account = await UserBankAccount.create({
      user: req.user.id,
      bankName,
      accountName,
      accountNumber,
      accountCurrency
    });
    res.status(201).json(account);
  } catch (err) {
    res.status(400).json({ error: "فشل إضافة الحساب البنكي" });
  }
});

// حذف حساب بنكي
router.delete("/:id", auth, async (req, res) => {
  try {
    const account = await UserBankAccount.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!account) return res.status(404).json({ error: "الحساب غير موجود" });
    res.json({ message: "تم حذف الحساب بنجاح" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ أثناء الحذف" });
  }
});

export default router;
