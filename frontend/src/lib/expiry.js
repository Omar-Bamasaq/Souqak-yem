export function daysUntil(date) {
  if (!date) return 0;
  const end = new Date(date).getTime();
  if (!isFinite(end)) return 0;
  const ms = end - Date.now();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return Math.max(0, d);
}

export function hoursUntil(date) {
  if (!date) return 0;
  const end = new Date(date).getTime();
  if (!isFinite(end)) return 0;
  const ms = end - Date.now();
  const h = Math.ceil(ms / (60 * 60 * 1000));
  return Math.max(0, h);
}

export function formatArabicNumber(n) {
  try {
    return new Intl.NumberFormat("ar-EG").format(n);
  } catch {
    return String(n);
  }
}

export function formatDaysWord(n) {
  if (n === 0) return "اليوم";
  if (n === 1) return "يوم";
  if (n === 2) return "يومان";
  if (n >= 3 && n <= 10) return "أيام";
  return "يوم";
}

export function formatHoursWord(n) {
  if (n === 0 || n === 1) return "ساعة";
  if (n === 2) return "ساعتان";
  if (n >= 3 && n <= 10) return "ساعات";
  return "ساعة";
}
