var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var endpoint = require('./index');
var rolls = 0, creates = 0;
var log = {
    level: 'debug',
    date: new Date(),
    pid: 123,
    origin: 'script',
    message: 'test',
    metadata: { a: 1 },
    fullOrigin: {
        file: 'test.js',
        line: 123,
        fn: 'testfn'
    }
};
var e = endpoint(true, true, true, true, './', 'rollheavy_', '.txt', 1, 60 * 60, 10, function (err, e) {
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
function log_req() {
    e.log({}, function (err) {
        if (err) {
            S$.output('error2', err);
        }
    });
}
function stop_req() {
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
S$.registerRequest('log_request', [], log_req);
S$.callRequests(function () {
    S$.output('# of rolls', rolls);
    S$.output('# of creates', creates);
});