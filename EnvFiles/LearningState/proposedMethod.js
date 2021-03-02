
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
		this._callbackSeqsA = this._infoA.callbackSeqList;
		this._callbackSeqsB = this._infoB.callbackSeqList;

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



	_nodeFeatureFuncs () {
		return [
			node => node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.execCount > 0 && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.execCount > 0 && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.execCount > 0 && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.execCount > 0 && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.execCount > 0 && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.execCount > 10 && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.execCount > 10 && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.execCount > 10 && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.execCount > 10 && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.execCount > 10 && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.execCount > 20 && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.execCount > 20 && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.execCount > 20 && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.execCount > 20 && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.execCount > 20 && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.latestExec && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.latestExec && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.latestExec && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.latestExec && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.latestExec && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.propDiff && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.propDiff && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.propDiff && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.propDiff && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.propDiff && node.diff != "unchanged", // ノードが変更されたかどうか

			node => !!node.cond && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => !!node.cond && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => !!node.cond && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => !!node.cond && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => !!node.cond && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.execT && node.execF && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.execT && node.execF && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.execT && node.execF && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.execT && node.execF && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.execT && node.execF && node.diff != "unchanged", // ノードが変更されたかどうか

			node => (node.execT || node.execF) && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => (node.execT || node.execF) && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => (node.execT || node.execF) && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => (node.execT || node.execF) && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => (node.execT || node.execF) && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.selected === 0 && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.selected === 0 && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.selected === 0 && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.selected === 0 && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.selected === 0 && node.diff != "unchanged", // ノードが変更されたかどうか

			node => node.selected >= 1 && node.distToDiff < 0, // ノードと変更箇所に到達できない
			node => node.selected >= 1 && node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.selected >= 1 && node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.selected >= 1 && node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			node => node.selected >= 1 && node.diff != "unchanged", // ノードが変更されたかどうか
		];
	}


	// readする変数の数 requestReads
	// readする変数の値の数
	// requestBrUses
	// 実行ブロックの数
	_requestFeatureFuncs () {
		return [
			req => Object.keys(req).length < 5,
			req => Object.keys(req).length < 10,
			req => Object.keys(req).length < 20,
			req => req.readNewVar, // 実行で新たな変数をreadしたか
			req => req.readNewVal, // 実行で変数の新たな値をreadしたか
		];
	}


	_cbFeatureFuncs () {
		return [
			cb => cb.execCount > 0,
			cb => cb.execCount > 10,
			cb => cb.execCount > 20,
			cb => cb.blockIdList.length > 10,
			cb => cb.blockIdList.length > 30,
			cb => cb.blockIdList.length > 50,
			cb => cb.execChange,
			cb => cb.after.length > 1,
			cb => cb.after.length > 3,
			cb => cb.after.length > 5,
		];
	}


	// 種類数うまく取れているのか謎
	_cbSeqFeatureFuncs () {
		return [
			seq => seq.length < 10, // 長さ < 10
			seq => seq.length < 30, // 長さ < 50
			seq => seq.length < 50, // 長さ < 100
			seq => seq.map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 5, // cbの種類 < 5
			seq => seq.map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 10, // cbの種類 < 15
			seq => seq.map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 20, // cbの種類 < 30
			seq => seq.filter(e => e.name.indexOf("[req]") === 0).length < 2, // リクエストの長さ <= 1
			seq => seq.filter(e => e.name.indexOf("[req]") === 0).length < 4, // リクエストの長さ <= 3
			seq => seq.filter(e => e.name.indexOf("[req]") === 0).length < 6, // リクエストの長さ <= 5
			seq => seq.filter(e => e.name.indexOf("[req]") === 0).map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 2, // リクエストの種類 <= 1
			seq => seq.filter(e => e.name.indexOf("[req]") === 0).map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 3, // リクエストの種類 <= 3
			seq => seq.filter(e => e.name.indexOf("[req]") === 0).map(e => e.arrangedCbId)
			.filter((elem, index, self) => self.indexOf(elem) === index).length < 4, // リクエストの種類 <= 5
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
		for (let id in this._nodesB) {
			let node = this._nodesB[id];
			if (!("label" in node)) continue;
			let nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in nodeFeatures) {
				features[i] += nodeFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/(Object.keys(self._nodesA).filter(id => self._nodesA[id].label).length+Object.keys(self._nodesB).filter(id => self._nodesB[id].label).length)));


		features = this._reqFeatures.map(f => 0);
		for (let name in this._requestsA) {
			let req = this._requestsA[name];
			let reqFeatures = this._reqFeatures.map(f => f(req)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in reqFeatures) {
				features[i] += reqFeatures[i];
			}
		}
		for (let name in this._requestsB) {
			let req = this._requestsB[name];
			let reqFeatures = this._reqFeatures.map(f => f(req)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in reqFeatures) {
				features[i] += reqFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/(Object.keys(self._requestsA).length+Object.keys(self._requestsB).length)));


		features = this._cbFeatures.map(f => 0);
		for (let id in this._callbackMapA) {
			let cb = this._callbackMapA[id];
			let cbFeatures = this._cbFeatures.map(f => f(cb)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in cbFeatures) {
				features[i] += cbFeatures[i];
			}
		}
		for (let id in this._callbackMapB) {
			let cb = this._callbackMapB[id];
			let cbFeatures = this._cbFeatures.map(f => f(cb)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			for (let i in cbFeatures) {
				features[i] += cbFeatures[i];
			}
		}
		ret = ret.concat(features.map(v => v === 0 ? 0 : v/(Object.keys(self._callbackMapA).length+Object.keys(self._callbackMapB).length)));


		const idxArrayA = [
			0,
			Math.round(this._callbackSeqsA.length/3),
			Math.round(this._callbackSeqsA.length/3*2),
			this._callbackSeqsA.length
		];
		const idxArrayB = [
			0,
			Math.round(this._callbackSeqsB.length/3),
			Math.round(this._callbackSeqsB.length/3*2),
			this._callbackSeqsB.length
		];

		for (let k=0; k<idxArrayA.length-1; k++) {
			features = this._cbSeqFeatures.map(f => 0);
			for (let j=idxArrayA[k]; j<idxArrayA[k+1]; j++) {
				let seqFeatures = this._cbSeqFeatures.map(f => f(self._callbackSeqsA[j])).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
				// console.log(this._callbackSeqsA[j]);
				// console.log(seqFeatures);
				for (let i in seqFeatures) {
					features[i] += seqFeatures[i];
				}
			}
			for (let j=idxArrayB[k]; j<idxArrayB[k+1]; j++) {
				let seqFeatures = this._cbSeqFeatures.map(f => f(self._callbackSeqsB[j])).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
				for (let i in seqFeatures) {
					features[i] += seqFeatures[i];
				}
			}
			ret = ret.concat(features.map(v => v === 0 ? 0 : v/(idxArrayA[k+1]-idxArrayA[k]+idxArrayB[k+1]-idxArrayB[k])))
		}

		// console.log(ret);
		return ret;
	}
}

module.exports = LearningState;
