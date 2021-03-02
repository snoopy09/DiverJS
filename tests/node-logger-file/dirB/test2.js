var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var endpoint = require('./index');
var rolls = 0, creates = 0;
var e;
function create_req(dir, filePrefix, fileSuffix, maxFileSize, maxFileAge, maxFiles) {
    e = endpoint(true, true, true, true, dir, filePrefix, fileSuffix, maxFileSize, maxFileAge, maxFiles, function (err, e) {
        if (err) {
            S$.output('error1', err);
            return;
        }
    });
    e.on('rollFile', function (oldFile, newFile) {
        rolls += 1;
    });
    e.on('createFile', function (file) {
        creates += 1;
    });
}
function log_req() {
    if (!e)
        return;
    e.log({}, function (err) {
        if (err) {
            S$.output('error2', err);
        }
    });
}
function stop_req() {
    if (!e)
        return;
    try {
        e.stop(function (err) {
            if (err) {
                S$.output('error3', err);
            } else {
                S$.output('# of rolls', rolls);
                S$.output('# of creates', creates);
            }
        });
    } catch (err) {
        S$.output('error4', err);
    }
}
S$.registerRequest('create_request', [
    0,
    0,
    0,
    0,
    0,
    0
], create_req);
S$.registerRequest('log_request', [], log_req);
S$.registerRequest('stop_request', [], stop_req);
S$.callRequests(function () {
    S$.output('# of rolls', rolls);
    S$.output('# of creates', creates);
});