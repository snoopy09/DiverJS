
// c++まで手を出すのはあまりにも大変だと思う
// とりあえずはNode.jsの中でラッパーを書く方針で
// それぞれの関数ごとにラッパーを書くのではなく決まったパターンにしたがってまとめてほしい
// ラップするべき関数名は与えてOK(fs.read, fs.write etc...)
// コールバックの種類ごとにキューが分かれているから、その中ではある程度統一化できるのでは？
// 非同期タスク周りはパターンごとに分けて対処してもいいのかも
// ファイルI/O、ソケット通信、データベースetc...
// この辺りはどのみちモデル化の話もある
// 返り値のパターンもそれぞれある程度決まっているはず


const Log = function (str) {
	console.log("[#AsyncTask#] "+str);
};

let execCountId = 0;

class AsyncTask {

	constructor (name, base, args, callback, replaceResult, state) {
		this.state = state;
		// if (name.indexOf("baseId=") === 0) {
		// 	this.baseId = name.split(":")[0].slice("baseId=".length);
		// 	name = name.split(":").slice(1).join(":");
		// }
		this.name = name;
		this.args = args;
		this.callback = callback;
		this.replaceResult = replaceResult;

		this.completed = false;
		this.execCb = false;
		this.executing = false;

		this.asyncId = this.state.getExecutionAsyncId();

		this.id = this.getId();

		Log("オブジェクト作成 " +this.id+" "+this.asyncId);
		// Log(this.asyncId);
	}


	toString () {
		return `${this.id} asyncId: ${this.asyncId} cbAsyncId: ${this.cbAsyncId} cnExecAsyncId: ${this.cbExecAsyncId}`;
	}

	getId () {
		if (this.name.indexOf("[req]") === 0) {
			return this.name;
		}

		let parentId = "";
		if (this.asyncId === 1) {
			parentId = "main";
		} else {
			// const parent = this.state.eventRecord.filter(e => e.cbAsyncId === this.asyncId)[0]; // 1このはず
			const parent = this.state.eventRecord.filter(e => e.cbExecAsyncId === this.asyncId)[0]; // 1このはず
			if (parent) {
				parentId = parent.id;
			}
		}
		let id = parentId+"---"+this.name;
		return id + this.state.eventRecord.filter(e => e.id === id).length;
	}


	complete () {
		Log("コールバック実行できるようになった "+this.id);
		this.completed = true;
		this.cbAsyncId = this.state.getExecutionAsyncId();
		// for (let i in arguments) {
		// 	Log("引数"+i);
		// 	Log(arguments[i]);
		// }
		this.resultArgs = this._replaceResultArgs(arguments); // eid取得のあとじゃないとアカン
		// コールバックの実行時のidとずれてるのがおかしいねえ
		// this.cbTriggerAsyncId = this.state.getTriggerAsyncId();
		this.state.manageEventQueue(this);
	}


	execCallback (type) {
		const self = this;
		process.nextTick(() => {
			Log("コールバック実行 "+self.id+" ["+type+"]");
			// Log("コールバック実行 "+self.id+" type "+type+" count "+execCountId+" matchA "+this.matchA);

			self.cbExecId = execCountId++;
			self.execCb = true;
			self.executing = true;
			self.execType = type;
			self.cbExecAsyncId = self.state.getExecutionAsyncId();

			Log("asyncId "+self.asyncId+" cbAsyncId "+self.cbAsyncId+" cbExecAsyncId "+self.cbExecAsyncId);
			Log(self.callback.toString());
			for (let i in self.resultArgs) {
				Log("引数 "+i);
				Log(self.resultArgs[i]);
			}

			self.state.coverage.callCb(self.id);

			self.state.asyncTrace.push({type: "handling", id: self.cbExecAsyncId, info: "startExecCallback"});
			self.callback.apply(null, self.resultArgs);
			self.state.asyncTrace.push({type: "handling", id: self.cbExecAsyncId, info: "endExecCallback"});
		});

	}


	_replaceResultArgs (args) {
		if (this.replaceResult) {
			this.replaceResult(args);
		}
		return args;
	}
}

export default AsyncTask;
