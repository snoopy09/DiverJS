var fs = require('fs');
var exports = module.exports = function mkdirP(p, mode, f) {
    var cb = f || function () {
    };
    if (p !== '' && p.charAt(0) != '/') {
        cb(new Error('Relative path'));
        return;
    }
    var ps = p.split('/');
    fs.exists(p, function (exists) {
        if (exists)
            cb(null);
        else
            mkdirP(ps.slice(0, -1).join('/'), mode, function (err) {
                if (err && err.errno != process.EEXIST)
                    cb(err);
                else
                    fs.mkdir(p, mode, function (err) {
                        if (err && err.errno != process.EEXIST)
                            cb(err);
                        else
                            cb(null);
                    });
            });
    });
};
exports.mkdirp = exports.mkdirP = module.exports;