var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var Agent = require('./');
var http = require('http');
var _keepaliveAgent = new Agent({
    maxSockets: S$.symbol('maxSockets', 1),
    maxFreeSockets: S$.symbol('maxFreeSockets', 1),
    keepAliveTimeout: S$.symbol('keepAliveTimeout', 1000)
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
        S$.output('error', e);
    });
    return req;
};
S$.registerRequest('getRequest', [], getRequest);
S$.callRequests();