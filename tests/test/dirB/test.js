var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var share = false;
function f1(x) {
    var y = 0;
    if (share && x > 0) {
        y = 20;
    }
    if (x === 10 && y === 10) {
        S$.output('x', x);
    }
}
function f2() {
    share = true;
}
S$.registerRequest('f1', [1], f1);
S$.registerRequest('f2', [], f2);
S$.callRequests();