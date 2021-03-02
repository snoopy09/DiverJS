var S$ = require('S$');

var path = require('path');
S$.registerModelFuncs(path, "path", ["resolve"]);

var fs = require('fs');
S$.registerAsyncTasks(fs, "fs", ["exists", "mkdir"]);
S$.setAsyncHooks(require('async_hooks'));

// var exports = module.exports = function mkdirP (p, mode, f) {
function mkdirP (p, mode, tmp, f) {
    var cb = f || function () {};
    p = path.resolve(p);

    // if (mode === 0) {
    //   mode += 1;
    // }
    if (tmp !== 0) {
      if (tmp === 1) {
        tmp += 1;
      } else {
        if (tmp === 2) {
          p = path.resolve("");
        }
      }
    }

    var ps = path.normalize(p).split('/');
    fs.exists(p, function (exists) {
        if (exists) cb(null);
        else mkdirP(ps.slice(0,-1).join('/'), mode, tmp, function (err) {
            if (err && err.errno != process.EEXIST) cb(err)
            // else if (mode !== 1) cb(mode)
            else fs.mkdir(p, mode, cb);
        });
    });
}

function callMkdirP (p, mode, tmp) {
  mkdirP(p, mode, tmp, function (err) { S$.output("error", err) });
}

// exports.mkdirp = exports.mkdirP = module.exports;
S$.registerRequest("mkdirP", ['./foo/hoge', 0, 0], callMkdirP);
S$.callRequests();
