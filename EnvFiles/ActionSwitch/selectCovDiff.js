class ActionSwitch {

  constructor(parent) {
    this.parent = parent;
  }

  select(action) {
    let input;

    switch(action) {
      case this.parent._actions[0]:
        if (!input) input = this.parent._selectFirstRequest();
        if (!input) input = this.parent._selectRandomInput();
        if (!input) input = this.parent._exploreEvent();
        if (!input) input = this.parent._selectRandom();
        // if (!input) input = this.parent._selectExausitiveInput();
        // if (!input) input = this.parent._selectFirstRequest();
        // if (!input) input = this.parent._exploreEvent();
        break;
      case this.parent._actions[1]:
        if (!input) input = this.parent._propagateCEPT();
        if (!input) input = this.parent._guideToDiff();
        if (!input) input = this.parent._selectFirstRequest();
        if (!input) input = this.parent._selectRandomInput();
        if (!input) input = this.parent._exploreEvent();
        if (!input) input = this.parent._selectRandom();
        // if (!input) input = this.parent._selectExausitiveInput();
        // if (!input) input = this.parent._selectFirstRequest();
        // if (!input) input = this.parent._exploreEvent();
        break;
    }
    return input;
  }
}

module.exports = ActionSwitch;
