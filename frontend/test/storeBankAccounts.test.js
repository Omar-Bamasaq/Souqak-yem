import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "MyStore.jsx"),
  "utf8"
);

test("bank accounts management is inside active customization-gated store form", () => {
  assert.match(source, /const supportsCustomization = store\?\.status === "active" && subscriptionStatus === "active"/);
  assert.match(source, /\{supportsCustomization \? \(/);
  assert.match(source, /الحسابات البنكية/);
  assert.match(source, /لا توجد حسابات بنكية مضافة/);
});

test("bank account UI supports adding, editing, deleting, and selecting the three currencies", () => {
  assert.match(source, /إضافة حساب بنكي/);
  assert.match(source, /startBankAccountDraft\(index\)/);
  assert.match(source, /removeBankAccount\(index\)/);
  assert.match(source, /حفظ تعديل الحساب/);
  assert.match(source, /<option value="YER">ريال يمني<\/option>/);
  assert.match(source, /<option value="SAR">ريال سعودي<\/option>/);
  assert.match(source, /<option value="USD">دولار أمريكي<\/option>/);
});

test("bank account array is loaded from and saved through the owner customization API", () => {
  assert.match(source, /setBankAccounts\(Array\.isArray\(nextStore\?\.bankAccounts\) \? nextStore\.bankAccounts : \[\]\)/);
  assert.match(source, /payload\.append\("bankAccounts", JSON\.stringify\(bankAccounts\)\)/);
  assert.match(source, /api\.patch\("\/stores\/me", payload/);
});

test("store customization section is collapsible and closed by default", () => {
  assert.match(source, /<details className="group rounded-\[2rem\] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" dir="rtl">/);
  assert.match(source, /<summary className="flex cursor-pointer list-none/);
  assert.doesNotMatch(source, /<details[^>]*\sopen(?:\s|>)/);
});
