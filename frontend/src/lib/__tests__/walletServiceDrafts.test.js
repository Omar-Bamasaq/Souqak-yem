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
  const { matchingDraft } = findWalletServiceDrafts([
    { _id: "store-draft", type: "store_creation", serviceId: "service-1" },
    oldVersionDraft
  ], "service-1");

  assert.equal(matchingDraft, oldVersionDraft);
});

test("a draft for another service does not block starting this service", () => {
  const otherDraft = {
    _id: "draft-2",
    type: "wallet_service_catalog",
    serviceId: "service-2"
  };
  const { matchingDraft } = findWalletServiceDrafts([
    { _id: "store-draft", type: "store_creation", serviceId: "service-1" },
    otherDraft
  ], "service-1");

  assert.equal(matchingDraft, null);
  assert.equal(otherDraft.serviceId, "service-2");
});

test("retains the selected service draft as an optional resume candidate", () => {
  const matchingDraft = {
    _id: "draft-for-service-1",
    type: "wallet_service_catalog",
    serviceId: "service-1"
  };
  const result = findWalletServiceDrafts([
    { _id: "draft-for-service-2", type: "wallet_service_catalog", serviceId: "service-2" },
    matchingDraft
  ], "service-1");

  assert.equal(result.matchingDraft, matchingDraft);
});

test("switching between services resumes each matching draft independently", () => {
  const firstServiceDraft = {
    _id: "draft-for-service-1",
    type: "wallet_service_catalog",
    serviceId: "service-1"
  };
  const secondServiceDraft = {
    _id: "draft-for-service-2",
    type: "wallet_service_catalog",
    serviceId: "service-2"
  };
  const drafts = [firstServiceDraft, secondServiceDraft];

  const firstService = findWalletServiceDrafts(drafts, "service-1");
  const secondService = findWalletServiceDrafts(drafts, "service-2");

  assert.equal(firstService.matchingDraft, firstServiceDraft);
  assert.equal(secondService.matchingDraft, secondServiceDraft);
  assert.equal(drafts.length, 2);
});
