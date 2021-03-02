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
        break;
      case this.parent._actions[1]:
        if (!input) input = this.parent._selectFirstRequest();
        if (!input) input = this.parent._selectRequestSeq_diff();
        break;
      case this.parent._actions[2]:
        if (!input) input = this.parent._selectCbOrder_diff();
        break;
      case this.parent._actions[3]:
      if (!input) input = this.parent._propagateCEPT();
        if (!input) input = this.parent._selectHighRewardsInput();
        break;
      case this.parent._actions[4]:
        if (!input) input = this.parent._selectFirstRequest();
        if (!input) input = this.parent._selectHighRewardsSeq();
        break;
      case this.parent._actions[5]:
        if (!input) input = this.parent._selectHighRewardsOrder();
        break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
