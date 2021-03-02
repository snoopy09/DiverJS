class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select() {

    let input;

    if (!input) input = this.parent._propagateCEPT();
    if (!input) input = this.parent._ASE2010();
    if (!input) input = this.parent._selectRandom();
    // if (!input) input = this.parent._disabledCbOrder_diff();
    // if (!input) input = this.parent._disabledCbOrder();
    // if (!input) input = this.parent._swapCbOrder_diff();
    // if (!input) input = this.parent._swapCbOrder();
    // if (!input) input = this.parent._selectRandomOrder();
    if (!input) input = this.parent._selectCbOrder_diff();
    if (!input) input = this.parent._changeRequestSeq_diff();

    return input;
  }
}

module.exports = ActionSwitch;
