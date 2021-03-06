
var S$ = require('S$');
var Scheduler = require("./../instrumentFile/Scheduler");
var _scheduler = new Scheduler();

var fs = require('fs');
_scheduler.replaceModuleFunc(fs, "fs", ["readFile", "writeFile"]);

var count = 0;

function writeRequest (data) {
  count++; // コールバックの完了を待たずにカウントアップ
  fs.writeFile("out", data, function (err) {
    if (err) return;
    if (count == 3) {
      checkResult();
    }
  });
}

function checkResult () {
  fs.readFile("out", function (err, data) {
    if (err) return;
    S$.output(data);
  }
}

S$.registerRequest('write', ["a", "hoge"], writeRequest);
S$.callRequests();
