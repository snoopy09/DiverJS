/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

var S$ = require('S$');
var q = S$.symbol('Q', 1);
var r = S$.symbol('R', 1);

var flag = 0;
if (q == 10) {
  flag = 1;
}

for (var i=0; i<r; i++) {
  if (flag) {
    console.log("diffだよ！");
  }
}
