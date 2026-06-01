import assert from "assert";
import { daysUntil, hoursUntil, formatDaysWord, formatHoursWord, formatArabicNumber } from "../expiry.js";

const now = Date.now();

{
  const in3 = new Date(now + 3 * 24 * 60 * 60 * 1000);
  assert.strictEqual(daysUntil(in3), 3);
}
{
  const past = new Date(now - 2 * 24 * 60 * 60 * 1000);
  assert.strictEqual(daysUntil(past), 0);
}
{
  const in5h = new Date(now + 5 * 60 * 60 * 1000);
  const h = hoursUntil(in5h);
  assert.ok(h === 5 || h === 6); // ceil approximation
}
{
  assert.strictEqual(formatDaysWord(0), "اليوم");
  assert.strictEqual(formatDaysWord(1), "يوم");
  assert.strictEqual(formatDaysWord(2), "يومان");
}
{
  assert.strictEqual(formatHoursWord(1), "ساعة");
  assert.strictEqual(formatHoursWord(2), "ساعتان");
  assert.strictEqual(formatHoursWord(3), "ساعات");
}
{
  const n = formatArabicNumber(1234);
  if (typeof n !== "string" || n.length === 0) throw new Error("formatArabicNumber failed");
}

console.log("expiryDays tests passed");
