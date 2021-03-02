var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var lineReader = require('./lib/line_reader'), assert = require('assert'), fs = require('fs'), testFilePath = __dirname + '/test/data/normal_file.txt', separatorFilePath = __dirname + '/test/data/separator_file.txt', emptyFilePath = __dirname + '/test/data/empty_file.txt', reader;
function eachLine(sep, enc, buf) {
    lineReader.eachLine(testFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine', line);
    }, function (err) {
        S$.output('eachLineErr', err);
    });
}
function eachLineSep() {
    lineReader.eachLine(separatorFilePath, { separator: ';' }, function (line) {
        S$.output('eachLineSep', line);
    }, function (err) {
        S$.output('eachLineSepErr', err);
    });
}
function open() {
    lineReader.open(testFilePath, function (r) {
        reader = r;
    });
}
function nextLine() {
    if (reader.hasNextLine()) {
        reader.nextLine(function (line) {
            S$.output('nextLine', line);
        });
    } else {
        try {
            reader.nextLine(function () {
            });
        } catch (e) {
            S$.output('error', e);
        }
    }
}
S$.registerRequest('eachLine', [
    ';',
    'utf8',
    2
], eachLine);
S$.callRequests();