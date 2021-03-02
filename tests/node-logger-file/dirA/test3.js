var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var endpoint = require('./index');
var rolls = 0, creates = 0;
var e;
function create_req(maxFileSize, maxFileAge, maxFiles) {
    e = endpoint(true, true, true, true, './', 'roll_', '.txt', maxFileSize, maxFileAge, maxFiles, function (err) {
        if (err) {
            S$.output('error1', err);
            return;
        }
    });
    e.on('rollFile', function (oldFile, newFile) {
        rolls += 1;
    });
}
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
S$.registerRequest('create_request', [
    0,
    0,
    0
], create_req);
S$.registerRequest('log_request', [], log_req);
S$.registerRequest('stop_request', [], stop_req);
S$.callRequests(function () {
    S$.output('# of rolls', rolls);
});