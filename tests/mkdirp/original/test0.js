var mkdirP = require('./index0.js');
function callMkdirP(p) {
    mkdirP(p, '0777', function (err) {
        console.log(err);
    });
}
callMkdirP("./foo/bar");
