export default class DealStateMachine {
  static STATES = {
    PENDING_BROKER_CONFIRM: "PENDING_BROKER_CONFIRM",
    PENDING_BUYER_CONFIRM: "PENDING_BUYER_CONFIRM",
    CONFIRMED: "CONFIRMED",
    REJECTED: "REJECTED",
    UNDER_DISPUTE: "UNDER_DISPUTE",
    ARCHIVED: "ARCHIVED"
  };

  static ALLOWED_TRANSITIONS = {
    [this.STATES.PENDING_BROKER_CONFIRM]: ["PENDING_BUYER_CONFIRM", "REJECTED"],
    [this.STATES.PENDING_BUYER_CONFIRM]: ["CONFIRMED", "REJECTED", "UNDER_DISPUTE"],
    [this.STATES.CONFIRMED]: ["ARCHIVED"],
    [this.STATES.REJECTED]: ["ARCHIVED"],
    [this.STATES.UNDER_DISPUTE]: ["CONFIRMED", "REJECTED", "ARCHIVED"],
    [this.STATES.ARCHIVED]: []
  };

  static canTransition(fromState, toState) {
    return this.ALLOWED_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  static transition(deal, toState) {
    if (!this.canTransition(deal.state, toState)) {
      throw new Error(`Cannot transition deal from ${deal.state} to ${toState}`);
    }
    deal.state = toState;
    return deal;
  }
}
