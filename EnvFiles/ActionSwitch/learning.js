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
      if (!input) input = this.parent._selectExausitiveInput();
      // if (!input) input = this.parent._selectHighRewardsInput();
      break;
    case this.parent._actions[1]:
      if (!input) input = this.parent._selectFirstRequest();
      if (!input) input = this.parent._selectRequestSeq_diff();
      if (!input) input = this.parent._selectRequestSeq();
      break;
    case this.parent._actions[2]:
      if (!input) input = this.parent._selectCbOrder_diff();
      if (!input) input = this.parent._selectCbOrder();
      break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
