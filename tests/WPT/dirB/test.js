/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var Tapable = require("./lib/Tapable");

function makeTestPlugin(arr, index) {
	var last;
	var f = function() {
		f.shouldNotBeCalled();
		var args = Array.prototype.slice.call(arguments);
		args.unshift(index);
		last = args;
		arr.push(args);
	};
	f.issue = function() {
		f.shouldBeCalled();
		last.pop().apply(null, arguments);
		last = null;
	};
	f.shouldNotBeCalled = function() {
		if(last) throw new Error("Plugin " + index + " was called, but shouldn't be.");
	};
	f.shouldBeCalled = function() {
		if(!last) throw new Error("Plugin " + index + " was not called, but should be.");
	};
	f.shouldBeCalledAsyncWith = function() {
		f.shouldBeCalled();
		var args = Array.prototype.slice.call(arguments);
		console.log(args);
		console.log(last);
	};
	return f;
}

		// var tapable = new Tapable();
		// var log = [];
		// var p1 = makeTestPlugin(log, 1);
		// var p2 = makeTestPlugin(log, 2);
		// var p3 = makeTestPlugin(log, 3);
		// var p4 = makeTestPlugin(log, 4);
		// var result = makeTestPlugin(log, 0);
		// tapable.plugin("test", p1);
		// tapable.plugin("test", p2);
		// tapable.plugin("xxxx", p3);
		// tapable.plugin("test", p4);
		// tapable.applyPluginsParallelBailResult("test", 1, 2, result);
		// p1.shouldBeCalledAsyncWith(1, 2);
		// p2.shouldBeCalledAsyncWith(1, 2);
		// p3.shouldNotBeCalled();
		// p4.shouldBeCalledAsyncWith(1, 2);
		// p1.issue();
		// p2.issue(null, "ok");
		// p4.issue(null, "fail");
		// console.log(log);

		// var tapable = new Tapable();
		// var log = [];
		// var p1 = makeTestPlugin(log, 1);
		// var p2 = makeTestPlugin(log, 2);
		// var p3 = makeTestPlugin(log, 3);
		// tapable.plugin("test", p1);
		// tapable.plugin("test", p2);
		// tapable.plugin("test", p3);
		// var result = makeTestPlugin(log, 0);
		// tapable.applyPluginsParallelBailResult("test", "a", result);
		// p3.issue(null, "fail");
		// p2.issue(null, "ok");
		// p1.issue();
		// console.log(log);
		//
		// var tapable = new Tapable();
		// var log = [];
		// var p1 = makeTestPlugin(log, 1);
		// var p2 = makeTestPlugin(log, 2);
		// var p3 = makeTestPlugin(log, 3);
		// tapable.plugin("test", p1);
		// tapable.plugin("test", p2);
		// tapable.plugin("test", p3);
		// var result = makeTestPlugin(log, 0);
		// tapable.applyPluginsParallelBailResult("test", "a", result);
		// p1.issue(null, "ok");
		// p2.issue(new Error("fail"));
		// p3.issue();
		// console.log(log);
		//
		var tapable = new Tapable();
		var log = [];
		var p1 = makeTestPlugin(log, 1);
		var p2 = makeTestPlugin(log, 2);
		var p3 = makeTestPlugin(log, 3);
		tapable.plugin("test", p1);
		tapable.plugin("test", p2);
		tapable.plugin("test", p3);
		var result = makeTestPlugin(log, 0);
		tapable.applyPluginsParallelBailResult("test", "a", result);
		p1.issue("ok");
		p2.issue();
		p3.issue(null, "fail");
		console.log(log);
