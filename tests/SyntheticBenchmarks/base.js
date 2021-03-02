var S$ = require('S$');

var path = require('path');
S$.registerModelFuncs(path, "path", ["resolve"]);

var fs = require('fs');
S$.registerAsyncTasks(fs, "fs", ["exists", "mkdir"]);
S$.setAsyncHooks(require('async_hooks'));

// var exports = module.exports = function mkdirP (p, mode, f) {
function mkdirP (p, mode, f) {
    var cb = f || function () {};
    p = path.resolve(p);

    var ps = path.normalize(p).split('/');
    fs.exists(p, function (exists) {
        if (exists) cb(null);
        else mkdirP(ps.slice(0,-1).join('/'), mode, function (err) {
            if (err && err.code !== 'EEXIST') cb(err)
            else fs.mkdir(p, mode, function (err) {
                if (err && err.code !== 'EEXIST') cb(err)
                else cb()
            });
        });
    });
}

function callMkdirP (p, mode) {
  mkdirP(p, mode, function (err) { S$.output("error", err) });
}

// exports.mkdirp = exports.mkdirP = module.exports;
S$.registerRequest("mkdirP", ['./foo/hoge', 0], callMkdirP);
S$.callRequests();
