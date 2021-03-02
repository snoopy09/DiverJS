class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;

    switch(action) {
      case this.parent._actions[0]:
      if (!input) input = this.parent._propagateCEPT();
      break;
      case this.parent._actions[1]:
      if (!input) input = this.parent._ASE2010();
      break;
      case this.parent._actions[2]:
      if (!input) input = this.parent._selectRandomInput();
      break;
      case this.parent._actions[3]:
      if (!input) input = this.parent._selectFirstRequest();
      break;
      case this.parent._actions[4]:
      if (!input) input = this.parent._selectRequestSeq_diff();
      break;
      case this.parent._actions[5]:
      if (!input) input = this.parent._selectRequestSeq();
      break;
      case this.parent._actions[6]:
      if (!input) input = this.parent._selectRandomSeq();
      break;
      case this.parent._actions[7]:
      if (!input) input = this.parent._selectCbOrder_diff();
      break;
      case this.parent._actions[8]:
      if (!input) input = this.parent._selectCbOrder();
      break;
      case this.parent._actions[9]:
      if (!input) input = this.parent._selectRandomOrder();
      break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
