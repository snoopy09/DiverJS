/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

var S$ = require('S$');
var q = S$.symbol('Q', 1);
var r = S$.symbol('R', 1);

var changed = 1;
var flag = 0;

for (var i=0; i<r; i++) {
  if (i == 10) {
    flag = 1;
  }
}

if (q == 10) {
  changed = 10; // diff
}

console.log(r * changed * flag); // 出力とする
