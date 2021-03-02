class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;
    if (!input) input = this.parent._propagateCEPT();
    if (!input) input = this.parent._probabiliticalGuideToDiff(0.5);
    if (!input) input = this.parent._selectFirstRequest();
    if (!input) input = this.parent._selectRandomInput();
    if (!input) input = this.parent._exploreEvent();
    if (!input) input = this.parent._selectRandom();
    return input;
  }
}

module.exports = ActionSwitch;
