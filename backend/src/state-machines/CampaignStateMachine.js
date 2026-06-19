export default class CampaignStateMachine {
  static STATES = {
    DRAFT: "DRAFT",
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    DEAL_CONFIRMED: "DEAL_CONFIRMED",
    EXPIRED: "EXPIRED",
    ARCHIVED: "ARCHIVED"
  };

  static ALLOWED_TRANSITIONS = {
    [this.STATES.DRAFT]: ["ACTIVE"],
    [this.STATES.ACTIVE]: ["SUSPENDED", "DEAL_CONFIRMED", "EXPIRED"],
    [this.STATES.SUSPENDED]: ["ACTIVE", "EXPIRED", "DEAL_CONFIRMED"],
    [this.STATES.DEAL_CONFIRMED]: ["ARCHIVED"],
    [this.STATES.EXPIRED]: ["ARCHIVED"],
    [this.STATES.ARCHIVED]: []
  };

  static canTransition(fromState, toState) {
    return this.ALLOWED_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  static transition(campaign, toState) {
    if (!this.canTransition(campaign.state, toState)) {
      throw new Error(`Cannot transition from ${campaign.state} to ${toState}`);
    }
    campaign.state = toState;
    return campaign;
  }
}
