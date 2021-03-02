var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var endpoint = require('./index');
var rolls = 0, creates = 0;
var e = endpoint(true, true, true, true, './', 'roll_', '.txt', S$.symbol('maxFileSize', 0), S$.symbol('maxFileAge', 0), S$.symbol('maxFiles', 0), function (err) {
    if (err) {
        S$.output('error1', err);
        return;
    }
});
e.on('rollFile', function (oldFile, newFile) {
    rolls += 1;
});
function log_req() {
    e.log({}, function (err) {
        if (err) {
            S$.output('error2', err);
        }
    });
}
function stop_req() {
    e.stop(function (err) {
        if (err) {
            S$.output('error3', err);
        } else {
            S$.output('# of rolls', rolls);
        }
    });
}
S$.registerRequest('log_request', [], log_req);
S$.registerRequest('stop_request', [], stop_req);
S$.callRequests(function () {
    S$.output('# of rolls', rolls);
});