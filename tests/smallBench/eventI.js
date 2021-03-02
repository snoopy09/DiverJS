/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

"use strict";

var S$ = require('S$');

var out = 0;

var flag1 = 0;
var flag2 = 0;
var flag3 = 0;

var a = S$.symbol("A", 0);
var b = S$.symbol("B", 0);

var p = S$.symbol("P", 0);
var q = S$.symbol("Q", 0);
var r = S$.symbol("R", 0);
var s = S$.symbol("S", 0);
var t = S$.symbol("T", 0);


S$.registerRequest('event1', [], function () {
  if (flag3 == 0) flag1 = 1;
});

S$.registerRequest('event2', [], function () {
  if(flag1 == 1) flag2 = 1;
});

S$.registerRequest('event3', [], function () {
  if (flag1 == 1 && flag2 == 1) {
  } else {
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

  }
});







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


S$.callRequests();
