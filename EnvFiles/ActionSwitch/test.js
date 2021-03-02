class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
    this.count = 0;
  }

  select(action) {
    let input;
    this.count++;
    switch(this.count) {
      case 1:
      action = this.parent._actions[0];
      break;
      case 2:
      action = this.parent._actions[1];
      break;
      case 3:
      action = this.parent._actions[1];
      break;
      case 4:
      action = this.parent._actions[2];
      break;
    }
    switch(action) {
    case this.parent._actions[0]:
      input = this.parent._propagateCEPT();
      if (!input) input = this.parent._ASE2010();
      if (!input) input = this.parent._selectRandom();
      break;
    case this.parent._actions[1]:
      // input = this.parent._selectRandomSeq();
      input = this.parent._changeRequestSeq_diff();
      if (!input) input = this.parent._changeRequestSeq();
      if (!input) input = this.parent._selectRandomSeq();
      break;
    case this.parent._actions[2]:
      // input = this.parent._selectRandomSeq();
      input = this.parent._disabledCbOrder_diff(); // ほぼないはず
      if (!input) input = this.parent._swapCbOrder_diff();
      if (!input) input = this.parent._swapCbOrder();
      break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
