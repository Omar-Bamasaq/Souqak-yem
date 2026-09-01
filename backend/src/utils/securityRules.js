import crypto from 'crypto';

export function normalizePhone(value) {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return '';

  let normalized = digits;
  if (normalized.startsWith('966')) normalized = normalized.slice(3);
  if (normalized.startsWith('967')) normalized = normalized.slice(3);
  if (normalized.startsWith('0')) normalized = normalized.slice(1);

  return normalized;
}

export function isValidPhoneNumber(value) {
  const normalized = normalizePhone(value);
  return /^7\d{8}$/.test(normalized);
}

export function isValidPassword(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 8 || trimmed.length > 24) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

export function generateTemporaryPassword(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function buildPasswordResetRequestMessage(username, phone) {
  const cleanPhone = normalizePhone(phone);
  return `طلب استعادة كلمة المرور\nاسم المستخدم: ${username}\nرقم الهاتف: ${cleanPhone}\nيرجى مراجعة الحساب واتخاذ الإجراء المناسب.`;
}
