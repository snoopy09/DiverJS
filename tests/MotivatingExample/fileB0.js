
var S$ = require('S$');
var Scheduler = require("./../instrumentFile/Scheduler");
var _scheduler = new Scheduler();

var fs = require('fs');
_scheduler.replaceModuleFunc(fs, "fs", ["readFile", "writeFile"]);

var count = 0;

function readRequest (file) {
  fs.readFile(file, function (err, data) {
    if (err) return;
    data += "\n";
    fs.writeFile("out", data, function (err) {
      if (err) return;
      count++;
      if (count == 3) {
        checkResult();
      }
    });
  });
}

function checkResult () {
  fs.readFile("out", function (err, data) {
    if (err) return;
    S$.output(data);
  }
}

S$.registerRequest('read', ["a"], readRequest);
S$.callRequests();
