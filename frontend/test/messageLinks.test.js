import test from "node:test";
import assert from "node:assert/strict";
import { splitMessageText } from "../src/utils/messageLinks.js";

test("keeps ordinary URLs as plain message text", () => {
  const parts = splitMessageText("راجع https://example.com/path?ref=chat و www.example.org");

  assert.deepEqual(parts, [
    { text: "راجع https://example.com/path?ref=chat و www.example.org" }
  ]);
});

test("links supported map providers while preserving surrounding text and punctuation", () => {
  const parts = splitMessageText(
    "موقعي: https://www.google.com/maps/search/?api=1&query=14,49. https://maps.app.goo.gl/abc"
  );

  assert.deepEqual(parts, [
    { text: "موقعي: " },
    { text: "https://www.google.com/maps/search/?api=1&query=14,49", url: "https://www.google.com/maps/search/?api=1&query=14,49" },
    { text: ". " },
    { text: "https://maps.app.goo.gl/abc", url: "https://maps.app.goo.gl/abc" }
  ]);
});

test("does not treat lookalike domains as map providers", () => {
  const parts = splitMessageText("https://google.com.attacker.example/maps?q=1");

  assert.deepEqual(parts, [{ text: "https://google.com.attacker.example/maps?q=1" }]);
});
