/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

var S$ = require('S$');
var q = S$.symbol('Q', 1);
var r = S$.symbol('R', 1);

var a = complex_diff1(q, r);
var b = complex_diff2(q, r);
var c = complex_diff3(q, r);

out(c);
