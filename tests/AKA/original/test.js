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
    agent : _keepaliveAgent
};

var getRequest = function() {
    var req =  http.request(options, function(res) {
        res.on('data', function(chunk) {
            console.log('BODY: ' + chunk);
        });
        res.on('end', function() {
            console.log('END REQ');
        });
    });
    req.on('error', function(e) {
        console.log('problem with request: ', e);
    });
    return req;
};

var req = getRequest();
// Get a reference to the socket.
req.on('socket', function(sock) {
    // Listen to timeout and send another request immediately.
    sock.on('timeout', function() {
        getRequest().end();
    });
});
req.end();

setTimeout(function() {
    // Just keep the process hanging because listening to 'timeout' is not enough to keep the process spinning.
}, 2500);
