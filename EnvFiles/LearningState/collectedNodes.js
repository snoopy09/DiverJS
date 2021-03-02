
class LearningState {

	// これも別ファイルで与えた方がいい気がしてきた

	constructor (infoA, infoB, learningEnv) {
		// constructor (_nodeMapA, _nodeMapB, _cdgLenMapA, _cdgLenMapB, _changedNodesA, _changedNodesB) {
		this._infoA = infoA;
		this._infoB = infoB;
		// 順序を保証したい説あるかも
		this._nodesA = this._infoA.nodeMap;
		this._nodesB = this._infoB.nodeMap;
		// this.lenMapA = _cdgLenMapA;
		// this.lenMapB = _cdgLenMapB;
		// this.changedA = _changedNodesA;
		// this.changedB = _changedNodesB;

		this._learningEnv = learningEnv;

		// this._pathFeatures = this._pathFeatureFuncs();
		this._nodeFeatures = this._nodeFeatureFuncs();
	}


	// _pathFeatureFuncs () {
	// 	return [
	// 		path => path.length >= 10,
	// 	];
	// }

	_nodeFeatureFuncs () {
		return [
			node => node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			// node => (node.distToDiff >= 0) ? 1/(node.distToDiff+1)*10 : 0, // ノードと変更箇所の距離の逆数、10点満点
			// node => (node.distToDiff >= 0) ? Math.round(1/(node.distToDiff+1)*10) : 0, // ノードと変更箇所の距離の逆数、10点満点
			node => node.diff != "unchanged", // ノードが変更されたかどうか
			node => !!node.cond, // if文を含むかどうか
			node => node.read && node.read.length > 0, // readを含むかどうか
			node => node.write && node.write.length > 0, // writeを含むかどうか
			node => node.commands.indexOf("call") >= 0, // 関数呼び出しを含むかどうか
			node => node.execCount > 0, // ノードが実行済かどうか
			node => node.execCount < 10, // ノードの実行回数が10以下
			node => node.latestExec, // 最近実行したかどうか
			node => node.execT && node.execF, // 条件分岐でブランチが両方実行されているか
			node => node.execT || node.execF, // 条件分岐でブランチが片方だけ実行されているか
			// node => node.execCount, // ノードの実行回数
			node => node.selected > 3, // 反転した回数
			node => node.selected > 0, // 反転した回数
			node => node.failNegate > 10, // ブランチの反転に失敗した回数が10回以上
			node => node.failNegate > 0, // ブランチの反転に失敗したことがある
			// node => node.failNegate, // ブランチの反転に失敗した回数
			// node => node.propDiff > 3, // 差分の伝搬をした回数
			// node => node.propDiff > 0, // 差分の伝搬をした回数
			node => node.propDiff, // 差分の伝搬しているか
			// node => node.failUseProp > 10, // 使用箇所への誘導に失敗した回数
			// node => node.failCondProp > 10, // 条件式での差分伝搬に失敗した回数
			// node => node.failWriteProp > 10, // 転送条件の解決に失敗した回数
			node => node.useProp > 0, // 使用箇所への誘導の回数
			node => node.condProp > 0, // 条件式での差分伝搬の回数
			node => node.writeProp > 0, // 転送条件の回数
			node => node.failUseProp > 0, // 使用箇所への誘導に失敗した回数
			node => node.failCondProp > 0, // 条件式での差分伝搬に失敗した回数
			node => node.failWriteProp > 0, // 転送条件の解決に失敗した回数
			// node => node.failUseProp, // 使用箇所への誘導に失敗した回数
			// node => node.failCondProp, // 条件式での差分伝搬に失敗した回数
			// node => node.failWriteProp, // 転送条件の解決に失敗した回数
		];
	}


	get() {
		// console.log(this._nodesA);
		let ret = this._nodeFeatures.map(f => 0);
		let nodeCount = 0;
		for (let id in this._nodesA) {
			// エントリーノードとかは除外
			let node = this._nodesA[id];
			if (!("label" in node)) continue;
			let nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			// let features = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : -1) : v);
			// console.log(nodeFeatures);
			for (let i in nodeFeatures) {
				ret[i] += nodeFeatures[i];
			}
			nodeCount++;
		}
		for (let id in this._nodesB) {
			// エントリーノードとかは除外
			let node = this._nodesB[id];
			if (!("label" in node)) continue;
			let nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			// let features = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : -1) : v);
			// console.log(nodeFeatures);
			for (let i in nodeFeatures) {
				ret[i] += nodeFeatures[i];
			}
			nodeCount++;
		}

		ret = ret.map(v => nodeCount === 0 ? 0 : v/nodeCount);
		// console.log(ret);
		return ret;
	}
}

module.exports = LearningState;
