import test from "node:test";
import assert from "node:assert/strict";
import { confirmUntrustedExternalLink, getExternalLinkHost } from "../untrustedExternalLink.js";

test("external link host displays only HTTP or HTTPS hostnames", () => {
  assert.equal(getExternalLinkHost("https://example.com/path?q=private"), "example.com");
  assert.equal(getExternalLinkHost("http://xn--e1afmkfd.example"), "xn--e1afmkfd.example");
  assert.equal(getExternalLinkHost("javascript:alert(1)"), "");
  assert.equal(getExternalLinkHost("https://user:password@example.com"), "");
  assert.equal(getExternalLinkHost("not-a-url"), "");
});

test("untrusted link navigation requires confirmation and blocks unsupported destinations", () => {
  const previousWindow = globalThis.window;
  let confirmedMessage = "";
  globalThis.window = {
    confirm(message) {
      confirmedMessage = message;
      return false;
    }
  };

  try {
    let prevented = false;
    confirmUntrustedExternalLink({
      currentTarget: { href: "https://example.com/path" },
      preventDefault() { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.match(confirmedMessage, /example\.com/);

    prevented = false;
    confirmUntrustedExternalLink({
      currentTarget: { href: "javascript:alert(1)" },
      preventDefault() { prevented = true; }
    });
    assert.equal(prevented, true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
