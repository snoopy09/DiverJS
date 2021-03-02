class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }
  select(action) {
    let input;
    if (!input) input = this.parent._propagateCEPT();
    // if (!input) input = this.parent._probabiliticalSelectRandom(0.1);
    // if (!input) input = this.parent._probabiliticalGuideToDiff(0.5);
    if (!input) input = this.parent._selectFirstRequest();
    if (!input) input = this.parent._selectRandomInput();
    if (!input) input = this.parent._guideToDiff();
    // if (!input) input = this.parent._exploreUnseenEvent();
    // if (!input) input = this.parent._changeUnseenRequestSeq();
    if (!input) input = this.parent._exploreEvent();
    // if (!input) input = this.parent._guideToOut();
    // if (!input) input = this.parent._selectCbOrder_diff();
    // if (!input) input = this.parent._selectCbOrder();
    // if (!input) input = this.parent._selectRequestSeq_diff();
    // if (!input) input = this.parent._selectRequestSeq();
    if (!input) input = this.parent._selectRandom();
    return input;
  }
}

module.exports = ActionSwitch;
