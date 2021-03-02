/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

import Log from './Log';

/**
 * Some code is from https://gist.github.com/jdalton/5e34d890105aca44399f by John-David Dalton
 */

const toString = Object.prototype.toString;
const fnToString = Function.prototype.toString;
const reHostCtor = /^\[object .+?Constructor\]$/;
const SECRET_CACHE_STR = "__checked_isNative__before__";

var reNative = RegExp("^" +
    String(toString)
        .replace(/[.*+?^${}()|[\]\/\\]/g, "\\$&")
        .replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
);

function isNativeCore(value) {
    var type = typeof value;
    return type == "function" ? reNative.test(fnToString.call(value)) :
        (value && type == "object" && reHostCtor.test(toString.call(value))) || false;
}

function isNative(v) {
  Log.logMid('TODO: IsNative Uncached');
  //TODO: Blake: IsNative uncached - somehow v can be null?!?
  const type = typeof v;
  if (type == "function" || type == "object") {
	  return isNativeCore(v);
  } else {
		return false;
	}
}

const { PassThrough, Writable } = require('stream');
const pass = new PassThrough();
const writable = new Writable();

export {isNative};
