var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var Agent = require('./');
var http = require('http');
function makeOptions(maxSockets, maxFreeSockets) {
    var _keepaliveAgent = new Agent({
        maxSockets: maxSockets,
        maxFreeSockets: maxFreeSockets,
        keepAliveTimeout: 1000
    });
    var options = {
        hostname: 'www.google.com',
        port: 80,
        path: '/',
        method: 'GET',
        agent: _keepaliveAgent
    };
    return options;
}
var getRequest = function (maxSockets, maxFreeSockets) {
    var options = makeOptions(maxSockets, maxFreeSockets);
    var req = http.request(options);
    req.on('error', function (e) {
        S$.output('error', e);
    });
    setTimeout(function () {
        req.end();
    }, 10);
    return req;
};
S$.registerRequest('getRequest', [
    0,
    0
], getRequest);
S$.callRequests();