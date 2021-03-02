var io = require('./');

var manager = io.Manager();
var socket1 = manager.socket('/foo');
socket1.on('connect', function() {
  console.log("繋がった");
  var socket2 = manager.socket('/asd');
  socket2.on('connect');
  socket1.disconnect();
  socket1.open();
  socket1.destroy();
  socket2.open();
  socket2.destroy();

});


// var url = "localhost:3000";
// var options = {
//     // 'force new connection':true,
//     // port:3000,
//     autoConnect: false
// };

// try {
//   var Manager = require('./lib/manager');
//   // var manager = new Manager();
//   var manager = new Manager(url, options);
//   manager.open();
//   var socket1 = manager.socket('/');
//   var socket2 = manager.socket('/foo');
//   // socket1.on('connect', () => {console.log('connect1');});
//   // socket2.on('connect', () => {console.log('connect2');});
//   // socket1.on('connecting', () => {console.log('connecting1');});
//   // socket2.on('connecting', () => {console.log('connecting2');});
//
//   // この4つを非同期な処理にしちゃう？
//   // ソケットがopenするとconnectingイベントが同期的に発火される仕様
//   // managerはconnectingイベントで追加処理してる
//   // この順序はまずいはず
//   socket1.open();
//   socket1.destroy();
//   socket2.open();
//   socket2.destroy();
//
//   // ここで追加終わってる
//   // setTimeout(() => { socket1.open(); }, 100); // 追加？
//   // setTimeout(() => { manager.destroy(socket1); }, 200);
//   // setTimeout(() => { socket2.open(); }, 1000);　// 追加？
//   // setTimeout(() => { manager.destroy(socket2); }, 1000);
// } catch (e) {
//   console.log(e);
// }
