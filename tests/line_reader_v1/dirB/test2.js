var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var lineReader = require('./lib/line_reader'), assert = require('assert'), fs = require('fs'), testFilePath = __dirname + '/test/data/normal_file.txt', windowsFilePath = __dirname + '/test/data/windows_file.txt', windowsBufferOverlapFilePath = __dirname + '/test/data/windows_buffer_overlap_file.txt', unixFilePath = __dirname + '/test/data/unix_file.txt', macOs9FilePath = __dirname + '/test/data/mac_os_9_file.txt', separatorFilePath = __dirname + '/test/data/separator_file.txt', multiSeparatorFilePath = __dirname + '/test/data/multi_separator_file.txt', multibyteFilePath = __dirname + '/test/data/multibyte_file.txt', emptyFilePath = __dirname + '/test/data/empty_file.txt', oneLineFilePath = __dirname + '/test/data/one_line_file.txt', oneLineFileNoEndlinePath = __dirname + '/test/data/one_line_file_no_endline.txt', threeLineFilePath = __dirname + '/test/data/three_line_file.txt', reader;
function eachLine_testFile() {
    lineReader.eachLine(testFilePath, function (line) {
        S$.output('eachLine_testFile', line);
    }, function (err) {
        S$.output('eachLineErr_testFile', err);
    });
}
S$.registerRequest('eachLine_testFile', [], eachLine_testFile);
function eachLine_windowsFilePath() {
    lineReader.eachLine(windowsFilePath, {}, function (line) {
        S$.output('eachLine_windowsFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_windowsFilePath', err);
    });
}
S$.registerRequest('eachLine_windowsFilePath', [], eachLine_windowsFilePath);
function eachLine_windowsBufferOverlapFilePath() {
    lineReader.eachLine(windowsBufferOverlapFilePath, {}, function (line) {
        S$.output('eachLine_windowsBufferOverlapFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_windowsBufferOverlapFilePath', err);
    });
}
S$.registerRequest('eachLine_windowsBufferOverlapFilePath', [], eachLine_windowsBufferOverlapFilePath);
function eachLine_unixFilePath() {
    lineReader.eachLine(unixFilePath, {}, function (line) {
        S$.output('eachLine_unixFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_unixFilePath', err);
    });
}
S$.registerRequest('eachLine_unixFilePath', [], eachLine_unixFilePath);
function eachLine_macOs9FilePath() {
    lineReader.eachLine(macOs9FilePath, {}, function (line) {
        S$.output('eachLine_macOs9FilePath', line);
    }, function (err) {
        S$.output('eachLineErr_macOs9FilePath', err);
    });
}
S$.registerRequest('eachLine_macOs9FilePath', [], eachLine_macOs9FilePath);
function eachLine_separatorFilePath() {
    lineReader.eachLine(separatorFilePath, {}, function (line) {
        S$.output('eachLine_separatorFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_separatorFilePath', err);
    });
}
S$.registerRequest('eachLine_separatorFilePath', [], eachLine_separatorFilePath);
function eachLine_multiSeparatorFilePath() {
    lineReader.eachLine(multiSeparatorFilePath, {}, function (line) {
        S$.output('eachLine_multiSeparatorFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_multiSeparatorFilePath', err);
    });
}
S$.registerRequest('eachLine_multiSeparatorFilePath', [], eachLine_multiSeparatorFilePath);
function eachLine_multibyteFilePath() {
    lineReader.eachLine(multibyteFilePath, {}, function (line) {
        S$.output('eachLine_multibyteFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_multibyteFilePath', err);
    });
}
S$.registerRequest('eachLine_multibyteFilePath', [], eachLine_multibyteFilePath);
function eachLine_emptyFilePath() {
    lineReader.eachLine(emptyFilePath, {}, function (line) {
        S$.output('eachLine_emptyFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_emptyFilePath', err);
    });
}
S$.registerRequest('eachLine_emptyFilePath', [], eachLine_emptyFilePath);
function eachLine_oneLineFilePath() {
    lineReader.eachLine(oneLineFilePath, {}, function (line) {
        S$.output('eachLine_oneLineFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_oneLineFilePath', err);
    });
}
S$.registerRequest('eachLine_oneLineFilePath', [], eachLine_oneLineFilePath);
function eachLine_oneLineFileNoEndlinePath() {
    lineReader.eachLine(oneLineFileNoEndlinePath, {}, function (line) {
        S$.output('eachLine_oneLineFileNoEndlinePath', line);
    }, function (err) {
        S$.output('eachLineErr_oneLineFileNoEndlinePath', err);
    });
}
S$.registerRequest('eachLine_oneLineFileNoEndlinePath', [], eachLine_oneLineFileNoEndlinePath);
function eachLine_threeLineFilePath() {
    lineReader.eachLine(threeLineFilePath, {}, function (line) {
        S$.output('eachLine_threeLineFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_threeLineFilePath', err);
    });
}
S$.registerRequest('eachLine_threeLineFilePath', [], eachLine_threeLineFilePath);
S$.callRequests();