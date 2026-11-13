import test from "node:test";
import assert from "node:assert/strict";
import {
  getWalletServiceCategoryPath,
  getWalletServicesBackTarget,
  getWalletServicesPath
} from "../src/lib/walletServicesNavigation.js";

test("wallet service order returns to its category then to the catalog with query filters intact", () => {
  const filters = new URLSearchParams("serviceSearch=PUBG&source=home");
  const catalogPath = getWalletServicesPath("/wallet-services", filters);
  const categoryPath = getWalletServiceCategoryPath("game-topups", filters);
  const orderPath = getWalletServicesPath("/wallet-services/order/pubg-service", filters);

  assert.equal(catalogPath, "/wallet-services?serviceSearch=PUBG&source=home");
  assert.equal(categoryPath, "/wallet-services/category/game-topups?serviceSearch=PUBG&source=home");
  assert.equal(orderPath, "/wallet-services/order/pubg-service?serviceSearch=PUBG&source=home");

  const returnFromOrder = getWalletServiceCategoryPath("game-topups", filters);
  assert.equal(returnFromOrder, categoryPath);
  assert.equal(
    getWalletServicesBackTarget("/wallet-services/category/game-topups", filters),
    catalogPath
  );

  const directOrderReturn = getWalletServiceCategoryPath("game-topups", filters);
  assert.equal(
    getWalletServicesBackTarget(new URL(directOrderReturn, "https://souqak.local").pathname, new URL(directOrderReturn, "https://souqak.local").search),
    catalogPath
  );
});
