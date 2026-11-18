import test from "node:test";
import assert from "node:assert/strict";
import {
  canAdvanceWalletServiceOrderStep,
  getWalletServiceOrderSteps
} from "../walletServiceOrderSteps.js";

test("package-based services begin with package selection", () => {
  assert.deepEqual(
    getWalletServiceOrderSteps({ pricingType: "PACKAGE", packages: [{ id: "basic" }] }),
    ["selection", "details", "review"]
  );
});

test("unit services with price sections begin with section selection", () => {
  assert.deepEqual(
    getWalletServiceOrderSteps({ pricingType: "UNIT", sections: [{ _id: "section-a" }] }),
    ["selection", "details", "review"]
  );
});

test("services without packages or price sections go directly to request details", () => {
  assert.deepEqual(
    getWalletServiceOrderSteps({ pricingType: "FIXED", packages: [], sections: [] }),
    ["details", "review"]
  );
});

test("step progression requires selection and details completion and stops at review", () => {
  assert.equal(canAdvanceWalletServiceOrderStep("selection", {
    selectionComplete: false,
    detailsComplete: false
  }), false);
  assert.equal(canAdvanceWalletServiceOrderStep("selection", {
    selectionComplete: true,
    detailsComplete: false
  }), true);
  assert.equal(canAdvanceWalletServiceOrderStep("details", {
    selectionComplete: true,
    detailsComplete: false
  }), false);
  assert.equal(canAdvanceWalletServiceOrderStep("details", {
    selectionComplete: true,
    detailsComplete: true
  }), true);
  assert.equal(canAdvanceWalletServiceOrderStep("review", {
    selectionComplete: true,
    detailsComplete: true
  }), false);
});
