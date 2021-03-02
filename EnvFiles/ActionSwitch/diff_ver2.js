class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;
    if (!input) input = this.parent._guideToDiff();
    if (!input) input = this.parent._exploreEvent();
    // if (!input) input = this.parent._guideToOut();
    if (!input) input = this.parent._selectRandom();
    return input;
  }
}

module.exports = ActionSwitch;
