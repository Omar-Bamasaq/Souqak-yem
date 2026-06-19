export default class EvidenceStateMachine {
  static STATES = {
    CREATED: "CREATED",
    VERIFIED: "VERIFIED",
    REJECTED: "REJECTED",
    USED_IN_DEAL: "USED_IN_DEAL",
    ARCHIVED: "ARCHIVED"
  };

  static ALLOWED_TRANSITIONS = {
    [this.STATES.CREATED]: ["VERIFIED", "REJECTED"],
    [this.STATES.VERIFIED]: ["USED_IN_DEAL", "ARCHIVED"],
    [this.STATES.REJECTED]: ["ARCHIVED"],
    [this.STATES.USED_IN_DEAL]: ["ARCHIVED"],
    [this.STATES.ARCHIVED]: []
  };

  static canTransition(fromState, toState) {
    return this.ALLOWED_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  static transition(evidence, toState) {
    if (!this.canTransition(evidence.state, toState)) {
      throw new Error(`Cannot transition evidence from ${evidence.state} to ${toState}`);
    }
    evidence.state = toState;
    return evidence;
  }
}
