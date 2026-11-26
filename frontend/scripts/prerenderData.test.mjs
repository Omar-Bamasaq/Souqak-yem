import test from "node:test";
import assert from "node:assert/strict";
import { getPrerenderData, resolvePrerenderDataSource } from "./prerenderData.mjs";

test("prerender data source must be explicit and valid", () => {
  assert.throws(() => resolvePrerenderDataSource({}), /must be explicitly set/);
  assert.throws(
    () => resolvePrerenderDataSource({ SEO_PRERENDER_DATA_SOURCE: "remote" }),
    /must be explicitly set/
  );
  assert.equal(resolvePrerenderDataSource({ SEO_PRERENDER_DATA_SOURCE: "local" }), "local");
  assert.equal(resolvePrerenderDataSource({ SEO_PRERENDER_DATA_SOURCE: "api" }), "api");
});

test("isolated prerender test mode refuses API data before invoking the loader", async () => {
  let apiCalls = 0;
  await assert.rejects(getPrerenderData({
    env: {
      SEO_PRERENDER_TEST_MODE: "true",
      SEO_PRERENDER_DATA_SOURCE: "api"
    },
    loadApiData: async () => {
      apiCalls += 1;
      return {};
    }
  }), /requires a local snapshot; no external data request was made/);
  assert.equal(apiCalls, 0);
});

test("isolated prerender test mode reads only the configured local snapshot", async () => {
  let apiCalls = 0;
  let snapshotPath;
  const data = await getPrerenderData({
    env: {
      SEO_PRERENDER_TEST_MODE: "1",
      SEO_PRERENDER_DATA_SOURCE: "local",
      SEO_PRERENDER_SNAPSHOT_PATH: "synthetic-snapshot.json",
      PUBLIC_SITE_URL: "https://souqak-yem.com"
    },
    loadApiData: async () => {
      apiCalls += 1;
      return {};
    },
    readSnapshot: async (filePath) => {
      snapshotPath = filePath;
      return {
        metadata: { source: "synthetic" },
        categories: [],
        ads: [],
        categorySsgDataBySlug: {}
      };
    }
  });

  assert.equal(snapshotPath, "synthetic-snapshot.json");
  assert.equal(data.source, "local");
  assert.equal(apiCalls, 0);
});
