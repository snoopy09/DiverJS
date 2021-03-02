
var S$ = require('S$');
// var Scheduler = require("./../instrumentFile/Scheduler");
// var _scheduler = new Scheduler();

var fs = require('fs');
S$.registerAsyncTasks(fs, "fs", ["readFile", "writeFile"]);
// _scheduler.replaceModuleFunc();
S$.setAsyncHooks(require('async_hooks'));

var share = [];

// function readRequest (file) {
function readRequest () {
  // fs.readFile(file, function (err, data) {
  fs.readFile("a", function (err, data) {
    if (err) return;
    share.push(data);
    if (share.length == 3) {
      S$.output(share.join(', '));
    }
  });
}

// S$.registerRequest('read', ["a"], readRequest);
S$.registerRequest('read', [], readRequest);
S$.callRequests();
