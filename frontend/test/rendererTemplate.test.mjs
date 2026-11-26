import test from "node:test";
import assert from "node:assert/strict";
import { createDynamicAdRendererTemplate } from "../scripts/rendererTemplate.mjs";

test("dynamic ad renderer template preserves the built shell but is not indexable on its own", () => {
  const template = [
    "<!doctype html><html><head><meta name=\"robots\" content=\"index,follow\" /></head>",
    "<body><div id=\"root\"></div><script type=\"module\" src=\"/assets/index-a1b2.js\"></script></body></html>"
  ].join("");

  const result = createDynamicAdRendererTemplate(template);

  assert.match(result, /<div id="root"><\/div>/);
  assert.match(result, /src="\/assets\/index-a1b2\.js"/);
  assert.match(result, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(result, /content="index,follow"/);
});

test("dynamic ad renderer template rejects prerendered or incomplete Vite shells", () => {
  assert.throws(
    () => createDynamicAdRendererTemplate("<html><head></head><body><div id=\"root\">home</div></body></html>"),
    /empty application shell/
  );
});
