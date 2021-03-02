var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var Agent = require('./');
var http = require('http');
var _keepaliveAgent = new Agent({
    maxSockets: 1,
    maxFreeSockets: 1,
    keepAliveTimeout: 1000
});
var options = {
    hostname: 'www.google.com',
    port: 80,
    path: '/',
    method: 'GET',
    agent: _keepaliveAgent
};
var getRequest = function () {
    var req = http.request(options);
    req.on('error', function (e) {
        console.log('problem with request: ', e);
        S$.output('error', e);
    });
    return req;
};
var req = getRequest();
req.on('socket', function (sock) {
    sock.on('timeout', function () {
        getRequest().end();
    });
});
req.end();
