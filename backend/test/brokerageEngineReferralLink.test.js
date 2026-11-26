import test from "node:test";
import assert from "node:assert/strict";
import BrokerageEngine from "../src/engines/BrokerageEngine.js";
import AuditEngine from "../src/engines/AuditEngine.js";
import BrokerageCampaign from "../src/models/BrokerageCampaign.js";
import BrokerageMembership from "../src/models/BrokerageMembership.js";
import BrokerProfile from "../src/models/BrokerProfile.js";
import ConfigEngine from "../src/engines/ConfigEngine.js";
import ReputationEngine from "../src/engines/ReputationEngine.js";

const AD_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const USER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

test("brokerage referral links use the canonical ad route without changing attribution data", async () => {
  const originals = {
    checkEnabled: BrokerageEngine.checkEnabled,
    brokerProfileFindOne: BrokerProfile.findOne,
    campaignFindOne: BrokerageCampaign.findOne,
    membershipFindOne: BrokerageMembership.findOne,
    membershipCreate: BrokerageMembership.create,
    configGet: ConfigEngine.get,
    reputation: ReputationEngine.calculateReputation,
    auditLog: AuditEngine.log
  };
  const createdMemberships = [];
  let membershipLookup = 0;
  const reactivatedMembership = {
    state: "WITHDRAWN",
    referralCode: null,
    async save() {}
  };

  BrokerageEngine.checkEnabled = async () => true;
  BrokerProfile.findOne = async () => ({ _id: "synthetic-broker-profile" });
  BrokerageCampaign.findOne = async () => ({
    _id: "synthetic-campaign",
    type: "AUTO_JOIN"
  });
  BrokerageMembership.findOne = async () => (
    membershipLookup++ === 0 ? null : reactivatedMembership
  );
  BrokerageMembership.create = async (membership) => {
    createdMemberships.push(membership);
    return membership;
  };
  ConfigEngine.get = async () => 100;
  ReputationEngine.calculateReputation = async () => ({ score: 100 });
  AuditEngine.log = async () => {};

  try {
    const first = await BrokerageEngine.joinCampaign(AD_ID, USER_ID);
    const firstUrl = new URL(first.referralLink);
    assert.equal(firstUrl.pathname, `/ad/${AD_ID}`);
    assert.equal(firstUrl.searchParams.get("ref"), first.referralCode);
    assert.equal(first.state, "AUTO_ACTIVE");

    const reactivated = await BrokerageEngine.joinCampaign(AD_ID, USER_ID);
    const reactivatedUrl = new URL(reactivated.referralLink);
    assert.equal(reactivatedUrl.pathname, `/ad/${AD_ID}`);
    assert.equal(reactivatedUrl.searchParams.get("ref"), reactivated.referralCode);
    assert.equal(reactivated.state, "AUTO_ACTIVE");
    assert.equal(createdMemberships.length, 1);
    assert.equal(reactivatedMembership.referralCode, reactivatedUrl.searchParams.get("ref"));
  } finally {
    BrokerageEngine.checkEnabled = originals.checkEnabled;
    BrokerProfile.findOne = originals.brokerProfileFindOne;
    BrokerageCampaign.findOne = originals.campaignFindOne;
    BrokerageMembership.findOne = originals.membershipFindOne;
    BrokerageMembership.create = originals.membershipCreate;
    ConfigEngine.get = originals.configGet;
    ReputationEngine.calculateReputation = originals.reputation;
    AuditEngine.log = originals.auditLog;
  }
});
