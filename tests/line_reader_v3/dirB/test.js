var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var lineReader = require('./lib/line_reader'), assert = require('assert'), fs = require('fs'), testFilePath = __dirname + '/test/test_file.txt', separatorFilePath = __dirname + '/test/test_separator_file.txt', emptyFilePath = __dirname + '/test/empty_file.txt', reader;
function eachLine() {
    lineReader.eachLine(testFilePath, function (line) {
        S$.output('eachLine', line);
    });
}
function eachLineSep(separator) {
    lineReader.eachLine(separatorFilePath, function (line) {
        S$.output('eachLine', line);
    }, separator);
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
S$.registerRequest('eachLine', [], eachLine);
S$.registerRequest('eachLineSep', [';'], eachLineSep);
S$.registerRequest('open', [], open);
S$.registerRequest('nextLine', [], nextLine);
S$.callRequests();
