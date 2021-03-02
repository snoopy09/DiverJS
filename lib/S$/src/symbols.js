/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

"use strict";

const fs = require('fs');

/**
 * If this method is passed a single argument it wraps in a WrappedValue,
 * If this message is passed two arguments (name, concrete) it creates a new symbol
 */
let AssertToolkit = {};

/**
 * A bin of existing symbols
 */
AssertToolkit.existing = {};

/**
 * If a symbol name isn't unique (Has been used already) rename it with _n
 */
AssertToolkit.rename = function(name) {
    if (!AssertToolkit.existing[name]) {
        AssertToolkit.existing[name] = 1;
        return name;
    } else {
        AssertToolkit.existing[name]++;
        return name + '_' + AssertToolkit.existing[name];
    }
}

AssertToolkit.assume = function(val) {
    if (!val) {
        throw new AssertToolkit.NotAnErrorException();
    }
}

/**
 * Create a new symbol with a given name and initial concrete value
 * TODO: Note: _ in name are disallowed due to name resolution and should be validated (In tropigate possibly rather than here)
 */
AssertToolkit.symbol = function(name, c) {
    if (typeof(c) !== 'undefined') {
        return Object._expose.makeSymbolic(AssertToolkit.rename(name), c);
    } else {
        return AssertToolkit.pureSymbol(name);
    }
}

AssertToolkit.pureSymbol = function(name) {
    return Object._expose.pureSymbol(AssertToolkit.rename(name));
}

/**
 * Expose the annotations to the tests
 */
AssertToolkit.NotAnErrorException = Object._expose.notAnError();

/**
 * Immediately fail the running script for a given reason
 */
AssertToolkit.fail = function(reason) {
    throw reason;
}

/**
 * If supplied a single argument the method runs _constructAssertion to generate an object with is, equals and doesntEqual methods
 * If supplied two arguments the method asserts that the first is truthy and if it isn't fails with reason desc
 */
AssertToolkit.assert = function(value, desc) {
   if (!value) {
       if (desc instanceof Function) {
           desc = desc();
       }
       AssertToolkit.fail(desc);
   }
}

// Object._exposeはanalyserのmodelsのところにあるよ
AssertToolkit.output = Object._expose.checkOutput;
AssertToolkit.registerRequest = Object._expose.registerRequest;
AssertToolkit.callRequests = Object._expose.callRequests;
AssertToolkit.setAsyncHooks = Object._expose.setAsyncHooks;

export default AssertToolkit;
module.exports = exports["default"];
