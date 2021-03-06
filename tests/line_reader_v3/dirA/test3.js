var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var lineReader = require('./lib/line_reader'), assert = require('assert'), fs = require('fs'), testFilePath = __dirname + '/test/data/normal_file.txt', windowsFilePath = __dirname + '/test/data/windows_file.txt', windowsBufferOverlapFilePath = __dirname + '/test/data/windows_buffer_overlap_file.txt', unixFilePath = __dirname + '/test/data/unix_file.txt', macOs9FilePath = __dirname + '/test/data/mac_os_9_file.txt', separatorFilePath = __dirname + '/test/data/separator_file.txt', multiSeparatorFilePath = __dirname + '/test/data/multi_separator_file.txt', multibyteFilePath = __dirname + '/test/data/multibyte_file.txt', emptyFilePath = __dirname + '/test/data/empty_file.txt', oneLineFilePath = __dirname + '/test/data/one_line_file.txt', oneLineFileNoEndlinePath = __dirname + '/test/data/one_line_file_no_endline.txt', threeLineFilePath = __dirname + '/test/data/three_line_file.txt', reader;
function eachLine_testFilePath(sep, enc, buf) {
    lineReader.eachLine(testFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_testFile', line);
    }, function (err) {
        S$.output('eachLineErr_testFile', err);
    });
}
S$.registerRequest('eachLine_testFile', [
    ';',
    'utf8',
    2
], eachLine_testFilePath);
function eachLine_windowsFilePath(sep, enc, buf) {
    lineReader.eachLine(windowsFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_windowsFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_windowsFilePath', err);
    });
}
S$.registerRequest('eachLine_windowsFilePath', [
    ';',
    'utf8',
    2
], eachLine_windowsFilePath);
function eachLine_windowsBufferOverlapFilePath(sep, enc, buf) {
    lineReader.eachLine(windowsBufferOverlapFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_windowsBufferOverlapFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_windowsBufferOverlapFilePath', err);
    });
}
S$.registerRequest('eachLine_windowsBufferOverlapFilePath', [
    ';',
    'utf8',
    2
], eachLine_windowsBufferOverlapFilePath);
function eachLine_unixFilePath(sep, enc, buf) {
    lineReader.eachLine(unixFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_unixFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_unixFilePath', err);
    });
}
S$.registerRequest('eachLine_unixFilePath', [
    ';',
    'utf8',
    2
], eachLine_unixFilePath);
function eachLine_macOs9FilePath(sep, enc, buf) {
    lineReader.eachLine(macOs9FilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_macOs9FilePath', line);
    }, function (err) {
        S$.output('eachLineErr_macOs9FilePath', err);
    });
}
S$.registerRequest('eachLine_macOs9FilePath', [
    ';',
    'utf8',
    2
], eachLine_macOs9FilePath);
function eachLine_separatorFilePath(sep, enc, buf) {
    lineReader.eachLine(separatorFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_separatorFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_separatorFilePath', err);
    });
}
S$.registerRequest('eachLine_separatorFilePath', [
    ';',
    'utf8',
    2
], eachLine_separatorFilePath);
function eachLine_multiSeparatorFilePath(sep, enc, buf) {
    lineReader.eachLine(multiSeparatorFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_multiSeparatorFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_multiSeparatorFilePath', err);
    });
}
S$.registerRequest('eachLine_multiSeparatorFilePath', [
    ';',
    'utf8',
    2
], eachLine_multiSeparatorFilePath);
function eachLine_multibyteFilePath(sep, enc, buf) {
    lineReader.eachLine(multibyteFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_multibyteFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_multibyteFilePath', err);
    });
}
S$.registerRequest('eachLine_multibyteFilePath', [
    ';',
    'utf8',
    2
], eachLine_multibyteFilePath);
function eachLine_emptyFilePath(sep, enc, buf) {
    lineReader.eachLine(emptyFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_emptyFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_emptyFilePath', err);
    });
}
S$.registerRequest('eachLine_emptyFilePath', [
    ';',
    'utf8',
    2
], eachLine_emptyFilePath);
function eachLine_oneLineFilePath(sep, enc, buf) {
    lineReader.eachLine(oneLineFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_oneLineFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_oneLineFilePath', err);
    });
}
S$.registerRequest('eachLine_oneLineFilePath', [
    ';',
    'utf8',
    2
], eachLine_oneLineFilePath);
function eachLine_oneLineFileNoEndlinePath(sep, enc, buf) {
    lineReader.eachLine(oneLineFileNoEndlinePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_oneLineFileNoEndlinePath', line);
    }, function (err) {
        S$.output('eachLineErr_oneLineFileNoEndlinePath', err);
    });
}
S$.registerRequest('eachLine_oneLineFileNoEndlinePath', [
    ';',
    'utf8',
    2
], eachLine_oneLineFileNoEndlinePath);
function eachLine_threeLineFilePath(sep, enc, buf) {
    lineReader.eachLine(threeLineFilePath, {
        separator: sep,
        encoding: enc,
        bufferSize: buf
    }, function (line) {
        S$.output('eachLine_threeLineFilePath', line);
    }, function (err) {
        S$.output('eachLineErr_threeLineFilePath', err);
    });
}
S$.registerRequest('eachLine_threeLineFilePath', [
    ';',
    'utf8',
    2
], eachLine_threeLineFilePath);
S$.callRequests();