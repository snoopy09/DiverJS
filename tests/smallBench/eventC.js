/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

"use strict";

var S$ = require('S$');

S$.registerRequest('event1', [0, 0], function (lo, hi) {

    var flag = false;

    if (lo > 0) {
      flag = true;
    }

    console.log("Inputs: Hi:", hi, "Lo:", lo);

    var result = lo * 42;

    if (lo > 4) {
        console.log("Branch A-then");
        result -= lo;
    } else {
        console.log("Branch A-else");
        if (hi == 777) {
            result = -result;
            if (flag) {
              result = 1;
            }
        }
    }

    if (hi > 0) {
        console.log("Branch B-then");
    } else {
        console.log("Branch B-else");
    }

    console.log("Low output:", result);

    return result;
});

S$.registerRequest('event2', [0, 0], function (lo, hi) {

    var flag = false;

    if (lo > 0) {
      flag = true;
    }

    console.log("Inputs: Hi:", hi, "Lo:", lo);

    var result = lo * 42;

    if (lo > 4) {
        console.log("Branch A-then");
        result -= lo;
    } else {
        console.log("Branch A-else");
        if (hi == 777) {
            result = -result;
            if (flag) {
              result = 1;
            }
        }
    }

    if (hi > 0) {
        console.log("Branch B-then");
    } else {
        console.log("Branch B-else");
    }

    console.log("Low output:", result);

    return result;
});




var out = 0;

var a = S$.symbol("A", 0);
var b = S$.symbol("B", 0);

var p = S$.symbol("P", 0);
var q = S$.symbol("Q", 0);
var r = S$.symbol("R", 0);
var s = S$.symbol("S", 0);
var t = S$.symbol("T", 0);
if (a === -1) {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }

} else {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }
}

if (a === -1) {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }

} else {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }
}

if (a === -1) {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }

} else {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }
}

if (a === -1) {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }

} else {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }
}

if (a === -1) {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }

} else {
  if (p > 10 && p <= 100) {
    if (r+s == 10) {
      if (t *50 / p + q == 2) {
        if (b === 100) {
          out += 1
        }
      }
    }
  } else {
    if (p == 100) {
      if (q < 0) {
        if (t == 10) {
          console.log('hoge');
        }
      } else {
        if (q < 5) {
          console.log('fuga');
        }
      }
    }
  }
}

if (a == 1) {
  S$.output("out", out);
}

S$.callRequests();
