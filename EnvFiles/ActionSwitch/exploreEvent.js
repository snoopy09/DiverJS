class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;
    if (!input) input = this.parent._propagateCEPT();
    if (!input) input = this.parent._selectExausitiveInput();
    if (!input) input = this.parent._selectFirstRequest();
    if (!input) input = this.parent._exploreEvent();
    return input;
  }
}

module.exports = ActionSwitch;
