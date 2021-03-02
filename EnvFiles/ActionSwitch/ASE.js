class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;

    input = this.parent._ASE2010();
    if (!input) {
      input = this.parent._selectRandom();
    }
    return input;
  }
}

module.exports = ActionSwitch;
