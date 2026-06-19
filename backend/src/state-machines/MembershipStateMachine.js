export default class MembershipStateMachine {
  static STATES = {
    REQUEST_SENT: "REQUEST_SENT",
    AUTO_ACTIVE: "AUTO_ACTIVE",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    WITHDRAWN: "WITHDRAWN",
    BANNED: "BANNED",
    EXPIRED: "EXPIRED",
    ARCHIVED: "ARCHIVED"
  };

  static ALLOWED_TRANSITIONS = {
    [this.STATES.REQUEST_SENT]: ["APPROVED", "REJECTED", "EXPIRED"],
    [this.STATES.AUTO_ACTIVE]: ["ACTIVE", "EXPIRED"],
    [this.STATES.APPROVED]: ["ACTIVE", "EXPIRED"],
    [this.STATES.REJECTED]: ["EXPIRED", "ARCHIVED"],
    [this.STATES.ACTIVE]: ["INACTIVE", "WITHDRAWN", "BANNED", "EXPIRED"],
    [this.STATES.INACTIVE]: ["ACTIVE", "EXPIRED", "WITHDRAWN"],
    [this.STATES.WITHDRAWN]: ["EXPIRED", "ARCHIVED"],
    [this.STATES.BANNED]: ["EXPIRED", "ARCHIVED"],
    [this.STATES.EXPIRED]: ["ARCHIVED"],
    [this.STATES.ARCHIVED]: []
  };

  static canTransition(fromState, toState) {
    return this.ALLOWED_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  static transition(membership, toState) {
    if (!this.canTransition(membership.state, toState)) {
      throw new Error(`Cannot transition membership from ${membership.state} to ${toState}`);
    }
    membership.state = toState;
    return membership;
  }
}
