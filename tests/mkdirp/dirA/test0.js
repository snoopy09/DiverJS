var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var mkdirP = require('./');
function callMkdirP(p) {
    mkdirP(p, '0777', function (err) {
        S$.output('error', err);
    });
}
S$.registerRequest('mkdirP/foo', ['./'], callMkdirP);
S$.registerRequest('mkdirP/foo', ['./foo'], callMkdirP);
S$.registerRequest('mkdirP/bar', ['./bar'], callMkdirP);
S$.registerRequest('mkdirP/baz', ['./baz'], callMkdirP);
S$.registerRequest('mkdirP/foo/bar', ['./foo/bar'], callMkdirP);
S$.registerRequest('mkdirP/foo/baz', ['./foo/baz'], callMkdirP);
S$.registerRequest('mkdirP/bar/foo', ['./bar/foo'], callMkdirP);
S$.registerRequest('mkdirP/bar/baz', ['./bar/baz'], callMkdirP);
S$.registerRequest('mkdirP/baz/foo', ['./baz/foo'], callMkdirP);
S$.registerRequest('mkdirP/baz/bar', ['./baz/bar'], callMkdirP);
S$.callRequests();