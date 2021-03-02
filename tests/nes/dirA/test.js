var S$ = require('S$');
S$.setAsyncHooks(require('async_hooks'));
var Hapi = require('hapi');
var Nes = require('./');
var server = new Hapi.Server();
server.connection();
server.register({
    register: Nes,
    options: { auth: false }
}, function (err) {
    if (err) {
        console.log(err);
    }
    server.start(function (err) {
        var client = new Nes.Client('http://localhost:' + server.info.port);
        var c = 0;
        client.onConnect = function () {
            client._ws.close();
        };
        client.connect({ delay: 10 }, function () {
        });
    });
});
function disconnect_req() {
    client.disconnect();
}
function stop_req() {
    server.stop(function () {
    });
}
S$.registerRequest('disconnect_request', [], disconnect_req);
S$.callRequests(stop_req);