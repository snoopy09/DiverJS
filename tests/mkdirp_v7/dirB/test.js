var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var mkdirP = require('./');
function callMkdirP(p) {
    mkdirP(p, '0777', function (err) {
        S$.output('error', err);
    });
}
S$.registerRequest('mkdirP', [''], callMkdirP);
S$.callRequests();