// var S$ = require('S$');
// S$.setAsyncHooks(require('async_hooks'));

var endpoint = require("./index");
var rolls = 0, creates = 0;

// 無限に呼ばれるから打ち切らないといけない？？？
// でこの打ち切りがリクエストのセットに相当する
// どういう仕様にしよう？？
endpoint(true, true, true, true, "./tmp", "rollheavy_", ".txt", 1, 60 * 60, 10, function(err, e) {
  console.log(e);
  e.on("rollFile", function(oldFile, newFile) {
  	console.log("old: "+oldFile);
		console.log("new: "+newFile);
		rolls += 1;
  });
  e.on("createFile", function(file) {
		console.log("create: "+file);
		creates += 1;
  });

	function log_req () {
		e.log({}, function(err) {
			if (err) {
				console.log(err);
			}
		});
	}

	function stop_req () {
		e.stop(function(err) {
			if (err) {
				// S$.output("error2", err);
				throw err
			} else {
				console.log(rolls);
				console.log(creates);
				// S$.output("# of rolls", rolls);
				// S$.output("# of creates", creates);
			}
		});
	}


	setTimeout(log_req, 10);
	// setTimeout(log_req, 10);
	setTimeout(stop_req, 1000);

});
