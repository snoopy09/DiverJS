class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
    this.first = true;
  }

  select(action) {

    let input;

    if (this.first) {
      this.first = false;
      input = this.parent._ASE2010();
      if (!input) {
        input = this.parent._selectRandom();
      }
    } else {
      input = this.parent._changeRequestSeq();
      if (!input) {
        input = this.parent._selectRandomSeq();
      }
    }
    return input;
  }
}

module.exports = ActionSwitch;
