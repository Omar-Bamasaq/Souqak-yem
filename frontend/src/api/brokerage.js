import { useApi } from "./axios.js";

// Custom hook for all Brokerage API calls
export function useBrokerageApi() {
  const api = useApi();

  return {
    // --- Broker Profiles ---
    getMyProfile: () => api.get("/brokerage/profiles/me"),
    activateProfile: () => api.patch("/brokerage/profiles/me/activate"),
    getProfileByUserId: (userId) =>
      api.get(`/brokerage/profiles/${userId}`),

    // --- Brokerage Campaigns ---
    createCampaign: (campaignData) =>
      api.post("/brokerage/campaigns", campaignData),
    getCampaigns: (params = {}) =>
      api.get("/brokerage/campaigns", { params }),
    getMyCampaigns: () => api.get("/brokerage/campaigns/my"),
    getCampaignById: (id) => api.get(`/brokerage/campaigns/${id}`),
    suspendCampaign: (id) =>
      api.patch(`/brokerage/campaigns/${id}/suspend`),
    updateCampaign: (id, data) => api.patch(`/brokerage/campaigns/${id}`, data),

    // --- Brokerage Memberships ---
    joinCampaign: (id) => api.post(`/brokerage/campaigns/${id}/join`),
    getMyMemberships: (params = {}) =>
      api.get("/brokerage/memberships/my", { params }),
    getCampaignMemberships: (id, params = {}) =>
      api.get(`/brokerage/campaigns/${id}/memberships`, { params }),
    approveMembership: (id) =>
      api.patch(`/brokerage/memberships/${id}/approve`),
    rejectMembership: (id, reason) =>
      api.patch(`/brokerage/memberships/${id}/reject`, { reason }),
    withdrawMembership: (id) =>
      api.patch(`/brokerage/memberships/${id}/withdraw`),

    // --- Brokerage Evidence ---
    submitEvidence: (evidenceData) =>
      api.post("/brokerage/evidence", evidenceData),
    getMembershipEvidence: (id) =>
      api.get(`/brokerage/memberships/${id}/evidence`),

    // --- Brokerage Deals ---
    createDeal: (dealData) => api.post("/brokerage/deals", dealData),
    getMyDeals: (params = {}) =>
      api.get("/brokerage/deals/my", { params }),
    getDealById: (id) => api.get(`/brokerage/deals/${id}`),
    confirmDealAsBroker: (id) =>
      api.patch(`/brokerage/deals/${id}/confirm-broker`),
    confirmDealAsBuyer: (id) =>
      api.patch(`/brokerage/deals/${id}/confirm-buyer`),

    // --- Brokerage Complaints ---
    createComplaint: (complaintData) =>
      api.post("/brokerage/complaints", complaintData),
    getMyComplaints: (params = {}) =>
      api.get("/brokerage/complaints/my", { params }),
    getAllComplaints: (params = {}) =>
      api.get("/brokerage/complaints", { params }),
    resolveComplaint: (id, resolution, moderatorNotes) =>
      api.patch(`/brokerage/complaints/${id}/resolve`, {
        resolution,
        moderatorNotes,
      }),

    // --- Brokerage Reviews ---
    createReview: (reviewData) =>
      api.post("/brokerage/reviews", reviewData),
    getUserReviews: (userId, params = {}) =>
      api.get(`/brokerage/reviews/user/${userId}`, { params }),
    moderateReview: (id, state, moderatorNotes) =>
      api.patch(`/brokerage/reviews/${id}/moderate`, {
        state,
        moderatorNotes,
      }),

    // --- Achievements & Badges ---
    getMyAchievements: () => api.get("/brokerage/achievements/my"),
    getMyBadges: () => api.get("/brokerage/badges/my"),
    getUserBadges: (userId) =>
      api.get(`/brokerage/badges/user/${userId}`),

    // --- Configuration ---
    getAllConfig: () => api.get("/brokerage/config"),
    updateConfig: (key, value, description) =>
      api.patch(`/brokerage/config/${key}`, { value, description }),

    // --- Analytics ---
    getPlatformAnalytics: () =>
      api.get("/brokerage/analytics/platform"),
    getBrokerAnalytics: (brokerProfileId) =>
      api.get(`/brokerage/analytics/broker/${brokerProfileId}`),
    getMySellerAnalytics: () =>
      api.get("/brokerage/analytics/seller/my"),
  };
}
