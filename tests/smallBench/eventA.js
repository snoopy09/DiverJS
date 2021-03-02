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

var q = S$.symbol('Q', 10);

if (q < 10) {
	var j = 0;

	for (var i = 0; i < q; i++) {
		j++;
	}

	console.log('Done ' + j);
}

var a = S$.symbol("A", 'hello');

if (a === "goodbye") {
	console.log('PASS');
} else {
	console.log('FAIL');
}

if (a === "derp") {
	console.log('AND THEN SOME');

  var out = 0;
  var q = S$.symbol('Q', 10);
  var r = S$.symbol('R', 1);

  if (q < 10) {
  	var j = 0;

  	for (var i = 0; i < q; i++) {
  		j++;
  		for (var k = 0; k < r; k++) {
  			if (i + k == 10) {
  				out = 1;
  			}
  		}
  	}

  	S$.output("out", out);
  }

} else {
	console.log('NOT THEN SOME');
}




S$.callRequests();
