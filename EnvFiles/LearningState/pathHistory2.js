
class LearningState {

	//パスの履歴を状態とする
	constructor (infoA, infoB, learningEnv) {
		// constructor (_nodeMapA, _nodeMapB, _cdgLenMapA, _cdgLenMapB, _changedNodesA, _changedNodesB) {
		this._infoA = infoA;
		this._infoB = infoB;
		this._nodesA = this._infoA.nodeMap;
		this._nodesB = this._infoB.nodeMap;
		this._pathListA = this._infoA.pathList;
		this._pathListB = this._infoB.pathList;
		// this.lenMapA = _cdgLenMapA;
		// this.lenMapB = _cdgLenMapB;
		// this.changedA = _changedNodesA;
		// this.changedB = _changedNodesB;

		this._learningEnv = learningEnv;

		this._pathFeatures = this._pathFeatureFuncs();
		this._nodeFeatures = this._nodeFeatureFuncs();

	}

	_commandTypes (label) {
		let commands = label.split("|");
		let types = commands.map(s => s.split("[")[0].split(" ")[1]);
		return types;
	}

	_pathFeatureFuncs () {
		let ret = [
			path => path.path.length >= Object.keys(this._nodesA).length, // パスの長さがノード数以上
			path => path.path.length >= Object.keys(this._nodesA).length * 0.5, // パスの長さがノード数の半分以上
			path => path.path.reduce((crr, id) => crr || id in this._infoA.changedNodes, false), // 変更箇所を含む
			path => path.newCover, // 新たな箇所を実行
			path => path.newChangeCover, // 新たな変更箇所を実行
			path => path.file.distance <= 1, // ASEで選択されたときで距離が?以下
			path => path.file.distance <= 3, // ASEで選択されたときで距離が?以下
			path => path.file.distance <= 5, // ASEで選択されたときで距離が?以下
			path => path.file.shares >= 1, // SymJSで選択されたときで共有変数の数が?以上
			path => path.file.shares >= 3, // SymJSで選択されたときで共有変数の数が?以上
			path => path.file.shares >= 5, // SymJSで選択されたときで共有変数の数が?以上
		];
		// どの戦略だったか
		for (let i in this._learningEnv.actions) {
			let a = this._learningEnv.actions[i];
			ret.push(path => path.file.action == a);
		}
		return ret;
	}

	_nodeFeatureFuncs () {
		return [
			node => node.distToDiff >= 0, // ノードと変更箇所に到達可能か
			node => node.distToDiff >= 0 && node.distToDiff <= 3, // ノードと変更箇所の距離が3以下
			node => node.distToDiff >= 0 && node.distToDiff <= 1, // ノードと変更箇所の距離が1以下
			// node => (node.distToDiff >= 0) ? 1/(node.distToDiff+1)*10 : 0, // ノードと変更箇所の距離の逆数、10点満点
			// node => (node.distToDiff >= 0) ? Math.round(1/(node.distToDiff+1)*10) : 0, // ノードと変更箇所の距離の逆数、10点満点
			node => node.execCount > 0, // ノードが実行済かどうか
			node => node.execCount < 3, // ノードの実行回数が3以下
			// node => node.execCount, // ノードの実行回数
			node => node.diff != "unchanged", // ノードが変更されたかどうか
			node => this._commandTypes(node.label).indexOf("if") >= 0, // if文を含むかどうか
			node => this._commandTypes(node.label).indexOf("read-variable") >= 0, // readを含むかどうか
			node => this._commandTypes(node.label).indexOf("write-variable") >= 0, // writeを含むかどうか
			node => this._commandTypes(node.label).indexOf("call") >= 0, // 関数呼び出しを含むかどうか
			node => node.selected - node.failNegate > 3, // 反転した回数
			node => node.selected - node.failNegate > 0, // 反転した回数
			// node => node.selected - node.failNegate, // 反転した回数
			node => node.failNegate > 10, // ブランチの反転に失敗した回数が10回以上
			node => node.failNegate > 0, // ブランチの反転に失敗したことがある
			// node => node.failNegate, // ブランチの反転に失敗した回数
			node => node.propDiff > 3, // 差分の伝搬をした回数
			node => node.propDiff > 0, // 差分の伝搬をした回数
			// node => node.propDiff, // 差分の伝搬をした回数
			node => node.failUseProp > 10, // 使用箇所への誘導に失敗した回数
			node => node.failCondProp > 10, // 条件式での差分伝搬に失敗した回数
			node => node.failWriteProp > 10, // 転送条件の解決に失敗した回数
			node => node.failUseProp > 0, // 使用箇所への誘導に失敗した回数
			node => node.failCondProp > 0, // 条件式での差分伝搬に失敗した回数
			node => node.failWriteProp > 0, // 転送条件の解決に失敗した回数
			// node => node.failUseProp, // 使用箇所への誘導に失敗した回数
			// node => node.failCondProp, // 条件式での差分伝搬に失敗した回数
			// node => node.failWriteProp, // 転送条件の解決に失敗した回数
			node => node.latestExec, // 最近実行したかどうか
			node => node.execT && node.execF, // 条件分岐でブランチが両方実行されているか
			node => node.execT || node.execF, // 条件分岐でブランチが片方だけ実行されているか
		];
	}

	get() {

		let ret = [];

		for (let id in this._nodesA) {
			// エントリーノードとかは除外
			let node = this._nodesA[id];
			if (!("label" in node)) continue;
			let nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			ret = ret.concat(nodeFeatures);
		}

		for (let i=1; i<=this._learningEnv.stateConsts.histryLen; i++) {
			let path = this._pathListA[this._pathListA.length-i];
			let pathFeatures;
			if (path) {
				pathFeatures = this._pathFeatures.map(f => f(path)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			} else {
				pathFeatures = this._pathFeatures.map(f => 0);
			}
			ret = ret.concat(pathFeatures);

			// for (let j=1; j<=this._learningEnv.stateConsts.pathLen; j++) {
			// 	if (path) {
			// 		let nodes = path.path.filter(id => "label" in this._nodesA[id]); // エントリーノードとかは除外
			// 		let id = nodes[nodes.length-j];
			// 		let node = this._nodesA[id];
			// 		let nodeFeatures;
			// 		if (node) {
			// 			nodeFeatures = this._nodeFeatures.map(f => f(node)).map(v => typeof v === "boolean" ?  (v ? 1 : 0) : v);
			// 		} else {
			// 			nodeFeatures = this._nodeFeatures.map(f => 0);
			// 		}
			// 		ret = ret.concat(nodeFeatures);
			// 	} else {
			// 		let nodeFeatures = this._nodeFeatures.map(f => 0);
			// 		ret = ret.concat(nodeFeatures);
			// 	}
			// }
		}

		// console.log(ret.filter(n => n!=0 && n!=1));
		return ret;
	}

}

module.exports = LearningState;
