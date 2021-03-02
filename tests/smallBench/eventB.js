/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

"use strict";

var S$ = require('S$');

var flag1 = 0;
var flag2 = 0;
var flag3 = 0;
var flag4 = 0;
var flag5 = 0;
var event_out = '';

S$.registerRequest('event1', [], function () {
  if (flag5 == 1) flag1 = 1;
});

S$.registerRequest('event2', [], function () {
  if(flag1 == 1) flag2 = 1;
});

S$.registerRequest('event3', [], function () {
  if (flag1 == 1 && flag2 == 1) flag3 = 1;
});

S$.registerRequest('event4', [], function () {
  if (flag1 == 0) flag4 = 1;
  if (flag3 == 1) event_out += "!!!"
});

S$.registerRequest('event5', [], function () {
  if (flag4 == 1) flag5 = 1;
});

S$.registerRequest('event_out', [], function () {
  S$.output("out", event_out);
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

  }

} else {
	console.log('NOT THEN SOME');
}




S$.callRequests();
