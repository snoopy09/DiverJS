class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;

    switch(action) {
    case this.parent._actions[0]:
      if (!input) input = this.parent._propagateCEPT();
      if (!input) input = this.parent._ASE2010();
      if (!input) input = this.parent._selectRandomInput();
      break;
    case this.parent._actions[1]:
      // input = this.parent._selectRandomSeq();
      if (!input) input = this.parent._selectRequestSeq();
      if (!input) input = this.parent._selectRandomSeq();
      break;
    case this.parent._actions[2]:
      // input = this.parent._selectRandomSeq();
      if (!input) input = this.parent._selectCbOrder();
      if (!input) input = this.parent._selectRandomOrder();
      break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
