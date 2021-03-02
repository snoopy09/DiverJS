var mkdirP = require('./index.js');
function callMkdirP(p) {
    mkdirP(p, "0777", function (err) {
        console.log(err);
    });
}
callMkdirP("./foo/bar");
