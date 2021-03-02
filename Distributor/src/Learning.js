
// const PythonShell = require("python-shell");
const {PythonShell} = require("python-shell");

class Learning {

	constructor (options, infoA, infoB, center) {

		this.options = options;
		this.env = this.options.learningEnv.consts;
		this.actions = this.options.learningEnv.actions;
		// this.constFilePath = this.options.logDir + "/const.json";
		// this.constList = JSON.parse(fs.readFileSync(this.constFilePath));
		// seedrandom(this.options.learningEnv.seed, { global: true });

		this._infoA = infoA;
		this._infoB = infoB;

		const LearningState = require(this.options.logDir + "/LearningState.js");
		this.state = new LearningState(this._infoA, this._infoB, this.options.learningEnv);

		this.center = center;

		this.logs = [];
	}

	start () {

		this.networkFile = "./Distributor/src/Network.py";

		let options = {
			mode: "text",
			pythonPath: "/Users/ena/.pyenv/shims/python",
			pythonOptions: ["-u"], // get print results in real-time
			// scriptPath: this.networkFile,
			// args: ['value1', 'value2', 'value3']
		};

		this.pyshell = new PythonShell(this.networkFile, options);
		const self = this;
		this.pyshell.on("message", msg => {
			self.read_message(msg);
		});

		const json = {
			tag: "consts",
			env: this.options.learningEnv,
			log_dir: this.options.logDir
		};
		const env_msg = JSON.stringify(json);
		this.send_message(env_msg);

	}


	read_message(msg) {
		// console.log("read: "+msg.slice(0, 30));
		try {
			msg = JSON.parse(msg);
		} catch (e) {
			console.log(msg);
			return;
		}
		// switch文の中だとvarしか使えないかも
		const tag = msg.tag;
		switch(tag) {
		case "RESET":
			var state = this.state.get();
			var send_msg = JSON.stringify({state: state});
			// console.log(send_msg);
			this.send_message(send_msg);
			break;

		case "STEP":
			var action = this.actions[msg.action];
			// console.log(action);
			var info = this.center.moveStep(action);
			// console.log(stop);
			if (info.cancel) {
				var send_msg2 = JSON.stringify({cancel: true});
				this.send_message(send_msg2);
			}
			if(info.notFind) {
				var send_msg3 = JSON.stringify({notFind: true});
				this.send_message(send_msg3);
			}
			break;

		case "CANCEL":
			this.center.cancel();
			break;

		case "FINISH":
			this.center._finishedTesting();
			break;

		default:
			console.log("なにそれ "+msg);
		}
	}


	send_message(msg) {
		// 状態をjsonの文字列とか何かで送る
		// console.log("send: "+msg.slice(0, 30));
		// console.log(msg);
		this.pyshell.send(msg);
	}


	update(reward, finish) {
		const new_state = this.state.get();
		const msg = JSON.stringify({n_state: new_state, reward: reward, done: finish});
		this.send_message(msg);

		// // if文この形でいいのか謎
		// if (finish) {
		// 	let msg = JSON.stringify({finish: true});
		// 	this.send_message(msg);
		// }
	}


}

export default Learning;
