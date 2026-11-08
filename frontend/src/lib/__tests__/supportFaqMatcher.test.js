import test from "node:test";
import assert from "node:assert/strict";
import { findMatchingSupportFaq, normalizeSupportText } from "../supportFaqMatcher.js";

const faqs = [
  {
    question: "كيف أضيف إعلاناً جديداً؟",
    keywords: ["انشر اعلان", "اضيف اعلان", "اضافة اعلان", "اضافة منتج"],
    answer: "من صفحة إضافة إعلان."
  },
  {
    question: "كيف أستعيد كلمة المرور؟",
    keywords: ["نسيت كلمة السر", "تغيير كلمة المرور"],
    answer: "استخدم خيار نسيت كلمة المرور."
  },
  {
    question: "كيف أتواصل مع البائع؟",
    keywords: ["اتواصل مع البائع", "مراسلة البائع"],
    answer: "افتح تفاصيل الإعلان."
  },
  {
    question: "من أنت؟",
    keywords: ["من انت"],
    answer: "أنا مساعد سوقك، أجيب عن الأسئلة الشائعة."
  },
  {
    question: "ما هو الشراء الآمن؟",
    keywords: ["ماهو الشراء الامن", "شراء مضمون", "كيف اشتري بأمان"],
    answer: "خدمة وساطة لمتابعة طلب الشراء."
  }
];

test("normalizes Arabic letters, diacritics, and punctuation", () => {
  assert.equal(normalizeSupportText("إِضَافَةُ إعلان!"), "اضافه اعلان");
});

test("matches supported question variants without an AI service", () => {
  assert.equal(findMatchingSupportFaq("كيف انشر اعلان", faqs), faqs[0]);
  assert.equal(findMatchingSupportFaq("نسيت كلمة السر", faqs), faqs[1]);
  assert.equal(findMatchingSupportFaq("كيف أتواصل مع البائع", faqs), faqs[2]);
});

test("does not answer an ambiguous single generic word", () => {
  assert.equal(findMatchingSupportFaq("كلمة", faqs), null);
});

test("answers a short but clear common question", () => {
  assert.equal(findMatchingSupportFaq("إضافة إعلان", faqs), faqs[0]);
});

test("matches a supported synonym", () => {
  assert.equal(findMatchingSupportFaq("انشر اعلان", faqs), faqs[0]);
});

test("matches a differently phrased Arabic question after normalization", () => {
  assert.equal(findMatchingSupportFaq("كيف أنشر الإعلانات؟", faqs), faqs[0]);
});

test("matches an exact short phrase even when its words are normally ignored", () => {
  assert.equal(findMatchingSupportFaq("من أنت", faqs), faqs[3]);
});

test("matches the secure-purchase question and its supported synonym", () => {
  assert.equal(findMatchingSupportFaq("ماهو الشراء الآمن؟", faqs), faqs[4]);
  assert.equal(findMatchingSupportFaq("الشراء المضمون", faqs), faqs[4]);
});

test("does not invent an answer for an unknown question", () => {
  assert.equal(findMatchingSupportFaq("متى تفتحون فرع صنعاء", faqs), null);
});

test("does not return an inappropriate FAQ for a weak partial match", () => {
  assert.notEqual(findMatchingSupportFaq("كلمة", faqs), faqs[1]);
  assert.notEqual(findMatchingSupportFaq("فرع صنعاء", faqs), faqs[0]);
});
