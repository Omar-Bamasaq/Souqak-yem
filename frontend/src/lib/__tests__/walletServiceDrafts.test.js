import test from "node:test";
import assert from "node:assert/strict";
import { findWalletServiceDrafts } from "../walletServiceDrafts.js";

test("finds the existing catalog draft for the selected service", () => {
  const oldVersionDraft = {
    _id: "draft-1",
    type: "wallet_service_catalog",
    serviceId: "service-1",
    data: { serviceVersion: 1 }
  };
  const { matchingDraft, otherDraft } = findWalletServiceDrafts([
    { _id: "store-draft", type: "store_creation", serviceId: "service-1" },
    oldVersionDraft
  ], "service-1");

  assert.equal(matchingDraft, oldVersionDraft);
  assert.equal(otherDraft, null);
});

test("does not mistake another service draft for a matching draft", () => {
  const otherDraft = {
    _id: "draft-2",
    type: "wallet_service_catalog",
    serviceId: "service-2"
  };
  const { matchingDraft, otherDraft: conflict } = findWalletServiceDrafts([
    { _id: "store-draft", type: "store_creation", serviceId: "service-1" },
    otherDraft
  ], "service-1");

  assert.equal(matchingDraft, null);
  assert.equal(conflict, otherDraft);
});
