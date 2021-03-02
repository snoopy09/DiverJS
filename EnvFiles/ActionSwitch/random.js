class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;

    switch(action) {
    case this.parent._actions[0]:
      input = this.parent._propagateCEPT();
      if (!input) input = this.parent._ASE2010();
      if (!input) input = this.parent._selectRandom();
      break;
    case this.parent._actions[1]:
      input = this.parent._selectRandomSeq();
      break;
    case this.parent._actions[2]:
      input = this.parent._selectRandomOrder();
      break;
    // case this.parent._actions[3]:
    // 	input = this.parent._selectRandom();
    // 	break;
    // case this.parent._actions[4]:
    // 	input = this.parent._selectRandomSeq();
    // 	break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
