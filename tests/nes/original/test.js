var Hapi = require('hapi');
var Nes = require('./');

var server = new Hapi.Server();
server.connection();
server.register({ register: Nes, options: { auth: false } }, function (err) {

  if (err) {
    console.log(err);
  }

  server.start(function (err) {
    var client = new Nes.Client('http://localhost:' + server.info.port);
    var c = 0;
    client.onConnect = function () {
      ++c;
      client._ws.close();
      if (c === 1) {
        setTimeout(function () {
          client.disconnect();
        }, 5);
        setTimeout(function () {
          console.log(c);
          server.stop(function () { });
        }, 15);
      }
    };
    try {
      client.connect({ delay: 10 }, function () {});
    } catch (e) {
      console.log(e);
    }
  });
});
