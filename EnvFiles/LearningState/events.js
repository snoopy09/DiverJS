
class LearningState {

	// これも別ファイルで与えた方がいい気がしてきた

	constructor (infoA, infoB, learningEnv) {
		// constructor (_nodeMapA, _nodeMapB, _cdgLenMapA, _cdgLenMapB, _changedNodesA, _changedNodesB) {
		this._infoA = infoA;
		this._infoB = infoB;
		// 順序を保証したい説あるかも
		this._nodesA = this._infoA.nodeMap;
		this._nodesB = this._infoB.nodeMap;

		this._requestsA = this._infoA.requestReads;
		this._requestsB = this._infoB.requestReads;
		// this._brUsesA = this._infoA.requestBrUses;
		// this._outUsesA = this._infoA.requestOutUses;
		// this._brUsesB = this._infoB.requestBrUses;
		// this._outUsesB = this._infoB.requestOutUses;

		this._callbackMapA = this._infoA.callbackMap;
		this._callbackMapB = this._infoB.callbackMap;
		this._callbackSeqA = this._infoA.callbackSeq ? this._infoA.callbackSeq : [];
		this._callbackSeqB = this._infoB.callbackSeq ? this._infoB.callbackSeq : [];

		// this.lenMapA = _cdgLenMapA;
		// this.lenMapB = _cdgLenMapB;
		// this.changedA = _changedNodesA;
		// this.changedB = _changedNodesB;

		this._learningEnv = learningEnv;

		// this._pathFeatures = this._pathFeatureFuncs();
		this._nodeFeatures = this._nodeFeatureFuncs();
		this._reqFeatures = this._requestFeatureFuncs();
		this._cbFeatures = this._cbFeatureFuncs();
		this._cbSeqFeatures = this._cbSeqFeatureFuncs();
	}


	// _pathFeatureFuncs () {
	// 	return [
	// 		path => path.length >= 10,
	// 	];
	// }


	_cbFeatureFuncs () {
		return [
			cb => cb.execCount > 0,
			cb => cb.execCount > 10,
			cb => cb.blockIdList.length > 10,
			cb => cb.blockIdList.length > 50,
			cb => cb.execChange,
			cb => cb.after.length > 2,
			cb => cb.after.length > 5,
		];
	}


	_cbSeqFeatureFuncs () {
		return [
			seq => seq.length < 10, // 長さ < 10
			seq => seq.length < 50, // 長さ < 50
			seq => seq.length < 100, // 長さ < 100
			seq => seq.map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 5, // cbの種類 < 5
			seq => seq.map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 15, // cbの種類 < 15
			seq => seq.map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 30, // cbの種類 < 30
			seq => seq.filter(e => e.name.indexOf("[req]")).length <= 1, // リクエストの長さ <= 1
			seq => seq.filter(e => e.name.indexOf("[req]")).length <= 3, // リクエストの長さ <= 3
			seq => seq.filter(e => e.name.indexOf("[req]")).length <= 5, // リクエストの長さ <= 5
			seq => seq.filter(e => e.name.indexOf("[req]")).map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length <= 1, // リクエストの種類 <= 1
			seq => seq.filter(e => e.name.indexOf("[req]")).map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length <= 3, // リクエストの種類 <= 3
			seq => seq.filter(e => e.name.indexOf("[req]")).map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length <= 5, // リクエストの種類 <= 5
		];
	}

	// readする変数の数 requestReads
	// readする変数の値の数
	// requestBrUses
	// 実行ブロックの数
	_requestFeatureFuncs () {
		return [
			req => Object.keys(req).length > 0,
			req => Object.keys(req).length > 5,
			req => Object.keys(req).length > 10,
			req => req.readNewVar, // 実行で新たな変数をreadしたか
			req => req.readNewVal, // 実行で変数の新たな値をreadしたか
		];
	}

	_nodeFeatureFuncs () {
		return [
			node => node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.diff != "unchanged", // ノードが変更されたかどうか
			node => !!node.cond, // if文を含むかどうか
			node => node.read && node.read.length > 0, // readを含むかどうか
			node => node.write && node.write.length > 0, // writeを含むかどうか
			node => node.commands.indexOf("call") >= 0, // 関数呼び出しを含むかどうか
			node => node.execCount > 0, // ノードが実行済かどうか
			node => node.execCount > 10, // ノードの実行回数が10より多い
			node => node.latestExec, // 最近実行したかどうか
			node => node.execT && node.execF, // 条件分岐でブランチが両方実行されているか
			node => node.execT || node.execF, // 条件分岐でブランチが片方だけ実行されているか
			node => node.selected > 3, // 反転した回数
			node => node.selected > 0, // 反転した回数
			node => node.failNegate > 10, // ブランチの反転に失敗した回数が10回以上
			node => node.failNegate > 0, // ブランチの反転に失敗したことがある
			node => node.propDiff, // 差分の伝搬しているか
			node => node.useProp > 0, // 使用箇所への誘導の回数
			node => node.condProp > 0, // 条件式での差分伝搬の回数
			node => node.writeProp > 0, // 転送条件の回数
			node => node.failUseProp > 0, // 使用箇所への誘導に失敗した回数
			node => node.failCondProp > 0, // 条件式での差分伝搬に失敗した回数
			node => node.failWriteProp > 0, // 転送条件の解決に失敗した回数
		];
	}


	get() {
		const self = this;
		//  ノードの特徴をただの和にしてみたら？
		let ret = [];
		let features = [];

		// 2つのプログラムのノード情報は集約？
		features = this._nodeFeatures.map(f => 0);
		for (let id in this._nodesA) {
			let node = this._nodesA[id];
			if (!("label" in node)) continue;
			let nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in nodeFeatures) {
				features[i] += nodeFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/Object.keys(self._nodesA).filter(id => self._nodesA[id].label).length));
		features = this._nodeFeatures.map(f => 0);
		for (let id in this._nodesB) {
			let node = this._nodesB[id];
			if (!("label" in node)) continue;
			let nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in nodeFeatures) {
				features[i] += nodeFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/Object.keys(self._nodesB).filter(id => self._nodesB[id].label).length));


		features = this._reqFeatures.map(f => 0);
		for (let name in this._requestsA) {
			let req = this._requestsA[name];
			let reqFeatures = this._reqFeatures.map(f => f(req)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in reqFeatures) {
				features[i] += reqFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/Object.keys(self._requestsA).length));
		features = this._reqFeatures.map(f => 0);
		for (let name in this._requestsB) {
			let req = this._requestsB[name];
			let reqFeatures = this._reqFeatures.map(f => f(req)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in reqFeatures) {
				features[i] += reqFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/Object.keys(self._requestsB).length));


		features = this._cbFeatures.map(f => 0);
		for (let id in this._callbackMapA) {
			let cb = this._callbackMapA[id];
			let cbFeatures = this._cbFeatures.map(f => f(cb)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in cbFeatures) {
				features[i] += cbFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/Object.keys(self._callbackMapA).length));
		features = this._cbFeatures.map(f => 0);
		for (let id in this._callbackMapB) {
			let cb = this._callbackMapB[id];
			let cbFeatures = this._cbFeatures.map(f => f(cb)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in cbFeatures) {
				features[i] += cbFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/Object.keys(self._callbackMapB).length));

		// features = this._cbFeatures.map(f => 0);
		// for (let j in this.callbackSeqA) {
		// 	let cb = this.callbackSeqA[j];
		// 	let cbFeatures = this._cbFeatures.map(f => f(cb)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
		// 	for (let i in cbFeatures) {
		// 		features[i] += cbFeatures[i];
		// 	}
		// }
		// ret.concat(features.map(v => v === 0 ? 0 : v/self.callbackSeqA.length));
		// features = this._cbFeatures.map(f => 0);
		// for (let j in this.callbackSeqB) {
		// 	let cb = this.callbackSeqB[j];
		// 	let cbFeatures = this._cbFeatures.map(f => f(cb)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
		// 	for (let i in cbFeatures) {
		// 		features[i] += cbFeatures[i];
		// 	}
		// }
		// ret.concat(features.map(v => v === 0 ? 0 : v/self.callbackSeqB.length));

		features = this._cbSeqFeatures.map(f => f(self._callbackSeqA)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
		ret = ret.concat(features);
		features = this._cbSeqFeatures.map(f => f(self._callbackSeqB)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
		ret = ret.concat(features);

		// console.log(ret);
		return ret;
	}
}

module.exports = LearningState;
