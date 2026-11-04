import crypto from "crypto";

export const PHONE_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

function getPhoneVerificationSecret() {
  const secret = process.env.PHONE_VERIFICATION_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    const error = new Error("Phone verification HMAC secret is not configured");
    error.code = "PHONE_VERIFICATION_SECRET_MISSING";
    throw error;
  }
  return secret;
}

export function generatePhoneVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashPhoneVerificationCode({ requestId, userId, phone, code }) {
  return crypto
    .createHmac("sha256", getPhoneVerificationSecret())
    .update(`${requestId}:${userId}:${phone}:${code}`, "utf8")
    .digest("hex");
}

export function phoneVerificationCodeMatches(input, expectedHash, identity) {
  const actualHash = hashPhoneVerificationCode({ ...identity, code: input });
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function buildPhoneVerificationWhatsAppLink(phone, code) {
  const message = `رمز توثيق رقم هاتفك في سوقك هو: ${code}\nصالح لمدة 10 دقائق، ولا تشاركه مع أي شخص.`;
  return `https://wa.me/967${phone}?text=${encodeURIComponent(message)}`;
}
