
class CEPT {
	constructor (id, readDiff, writeDiff, test) {
		this.root = {id: id, child: [], readDiff: readDiff, writeDiff: writeDiff, testInfos: test};
		this.nodeMap = {};
		this.nodeMap[id] = this.root;
	}

	propagete (childId, parentId, readDiff, writeDiff, test) {
		if (childId in this.nodeMap) {
			// 親も含めてマージする
			this.mergeNode(childId, parentId, readDiff, writeDiff, test);
		} else {
			let child = {id: childId, parentId: [parentId], child: [], readDiff: readDiff, writeDiff: writeDiff, testInfos: test};
			this.nodeMap[childId] = child;
			this.nodeMap[parentId].child.push(child);
		}
	}

	mergeNode (childId, parentId, readDiff, writeDiff, test) {
		// 異なる親から同じ子供を指す可能性もある
		let child = this.nodeMap[childId];
		if (parentId && this.nodeMap[parentId].child.indexOf(child) == -1) {
			this.nodeMap[parentId].child.push(child);
			child.parentId.push(parentId);
		}
		readDiff.forEach(id => {
			if (child.readDiff.indexOf(id) == -1) {
				child.readDiff.push(id);
			}
		});
		writeDiff.forEach(id => {
			if (child.writeDiff.indexOf(id) == -1) {
				child.writeDiff.push(id);
			}
		});
		test.forEach(id => {
			if (child.testInfos.indexOf(id) == -1) {
				child.testInfos.push(id);
			}
		});
	}

	getLeaves () {
		let ret = [];
		for (let id in this.nodeMap) {
			if (this.nodeMap[id].child.length == 0) {
				ret.push(id);
			}
		}
		return ret;
	}

	getNode (id) {
		return this.nodeMap[id];
	}

	getAllNodeId () {
		return Object.keys(this.nodeMap);
	}

	searchTree (root, task) {
		// DFSで探索、一度見たノードは見ない、各ノードに対してtaskを実行
		let serched = [];
		function searchChild (parent, task) {
			if (parent.id in serched) return;
			task(parent);
			serched.push(parent.id);
			parent.child.forEach(n => searchChild(n, task));
		}
		searchChild(root, task);
	}
}

class CEPTList {

	constructor(info_main, info_sub, rewardsOpt) {
		this._info_main = info_main;
		this._info_sub = info_sub;
		this._rewardsOpt = rewardsOpt;
		this._list = {};
	}

	getRoots() {
		return Object.keys(this._list);
	}

	getTree(rootKey) {
		return this._list[rootKey];
	}

	update(testId, readWriteVars_main, readWriteVars_sub) {

		// 2つのプログラムでidが一致しない可能性が高そう(スコープとか)
		// スコープ周りの情報は排除する？
		function notMatchValues(vars_main, vars_sub) {
			let notMatch = [];
			let idMap = {};
			vars_main.forEach(v => {
				const id = v.id.slice(v.id.indexOf("]")+1);
				if (!(id in idMap)) {
					idMap[id] = {main: [], sub: []};
				}
				idMap[id].main.push(v.val_c);
			});
			vars_sub.forEach(v => {
				const id = v.id.slice(v.id.indexOf("]")+1);
				if (!(id in idMap)) {
					idMap[id] = {main: [], sub: []};
				}
				idMap[id].sub.push(v.val_c);
			});

			for (let id in idMap) {
				let vals = idMap[id];
				if (vals.main.length != vals.sub.length) {
					notMatch.push(id);
				} else {
					for (let i in vals.main) {
						if (vals.main[i] !== vals.sub[i]) {
							notMatch.push(id);
							break;
						}
					}
				}
			}
			return notMatch;
		}

		let rewards = 0;

		// ノードのシーケンスの形に変換
		let nodeSeq_main = [];
		for(let i=0;i<readWriteVars_main.length;i++){
			let v_main = readWriteVars_main[i];
			if(v_main.type == "read") {
				let id_main = this._info_main.getReadBlockId(v_main.iid, v_main.location);
				if (nodeSeq_main.length != 0 && id_main == nodeSeq_main[nodeSeq_main.length-1].id) {
					nodeSeq_main[nodeSeq_main.length-1].readVars.push(v_main);
				}	else {
					nodeSeq_main.push({id: id_main, readVars: [v_main], writeVars: []});
				}
			} else if(v_main.type == "write") {
				let id_main = this._info_main.getWriteBlockId(v_main.iid, v_main.location);
				if (nodeSeq_main.length != 0 && id_main == nodeSeq_main[nodeSeq_main.length-1].id) {
					nodeSeq_main[nodeSeq_main.length-1].writeVars.push(v_main);
				}	else {
					nodeSeq_main.push({id: id_main, readVars: [], writeVars: [v_main]});
				}
			}
		}

		let nodeSeq_sub = [];
		for(let i=0;i<readWriteVars_sub.length;i++){
			let v_sub = readWriteVars_sub[i];
			if (v_sub.type == "read") {
				let id_sub = this._info_sub.getReadBlockId(v_sub.iid, v_sub.location);
				if (nodeSeq_sub.length != 0 && id_sub == nodeSeq_sub[nodeSeq_sub.length-1].id) {
					nodeSeq_sub[nodeSeq_sub.length-1].readVars.push(v_sub);
				}	else {
					nodeSeq_sub.push({id: id_sub, readVars: [v_sub], writeVars: []});
				}
			} else if (v_sub.type == "write") {
				let id_sub = this._info_sub.getWriteBlockId(v_sub.iid, v_sub.location);
				if (nodeSeq_sub.length != 0 && id_sub == nodeSeq_sub[nodeSeq_sub.length-1].id) {
					nodeSeq_sub[nodeSeq_sub.length-1].writeVars.push(v_sub);
				}	else {
					nodeSeq_sub.push({id: id_sub, readVars: [], writeVars: [v_sub]});
				}
			}
		}
		// console.log(nodeSeq_main);

		let preNodeSeq_main = [];
		let preNodeSeq_sub = [];

		// 変更箇所までのノード列を削除
		while (nodeSeq_main.length > 0 && nodeSeq_sub.length > 0) {
			let id_main = nodeSeq_main[0].id;
			if (this._info_main.changedNodes.indexOf(id_main) >= 0) break;
			preNodeSeq_main.push(nodeSeq_main.shift());
			preNodeSeq_sub.push(nodeSeq_sub.shift());
		}
		// なんかうまくいっていない説あるかも？
		if (nodeSeq_main.length == 0 || nodeSeq_sub.length == 0) return rewards;

		// console.log(nodeSeq_main);
		// 変更ノードまで（変更ノード含む）に通過するノード列
		preNodeSeq_main.push(nodeSeq_main[0]);
		preNodeSeq_sub.push(nodeSeq_sub[0]);

		let root = nodeSeq_main[0].id;
		let readVars_main = nodeSeq_main[0].readVars;
		let readVars_sub = nodeSeq_sub[0].id === this._info_main.nodeMap[root].mapped ? nodeSeq_sub[0].readVars : [];
		let writeVars_main = nodeSeq_main[0].writeVars;
		let writeVars_sub = nodeSeq_sub[0].id === this._info_main.nodeMap[root].mapped ? nodeSeq_sub[0].writeVars : [];

		// とりあえずそれぞれの実行パスについて木を作って最後にマージする
		let testInfo = {id: testId, nodeSeq_main: preNodeSeq_main, nodeSeq_sub: preNodeSeq_sub};
		let tree = new CEPT(root, notMatchValues(readVars_main, readVars_sub), notMatchValues(writeVars_main, writeVars_sub), [testInfo]);

		// アラインメントが難しいどうしよ、いいツールないかな、今はテキトーに実装
		let i = 0;
		let j = 0;
		while (i<nodeSeq_main.length || j<nodeSeq_sub.length) {
			// console.log(nodeSeq_sub[j]);
			if (j<nodeSeq_sub.length && this._info_sub.nodeMap[nodeSeq_sub[j].id] && this._info_sub.nodeMap[nodeSeq_sub[j].id].diff == "added") {
				j++;
				continue;
			}
			let id_main = nodeSeq_main[i]? nodeSeq_main[i].id : undefined;
			let id_sub = nodeSeq_sub[j]? nodeSeq_sub[j].id : undefined;

			// データ/コントロール依存かチェック
			for (let id in tree.nodeMap) {
				// バックワードって入れるんだっけ？
				// 直近の依存関係しかチェックできてないから修正が必要
				// 複数箇所該当しないか要注意
				if (this._info_main.nodeMap[id].affected && id_main == this._info_main.nodeMap[id].affected.id) {
					if (this._info_main.nodeMap[id_main].mapped == id_sub) { //subにmainに対応したノードが存在するとき
						// 使用変数の値が一緒かどうかチェック
						let readDiff = notMatchValues(nodeSeq_main[i].readVars, nodeSeq_sub[j].readVars);
						if (readDiff.length > 0) {
							let writeDiff = notMatchValues(nodeSeq_main[i].writeVars, nodeSeq_sub[j].writeVars);
							let testInfo = {id: testId, nodeSeq_main: preNodeSeq_main.concat(nodeSeq_main.slice(1, i+1)), nodeSeq_sub: preNodeSeq_sub.concat(nodeSeq_sub.slice(1, j+1))};
							tree.propagate(id_main, id, readDiff, writeDiff, [testInfo]);
							rewards += this._rewardsOpt.prop;
							break;
						}
					} else {
						// 対応するノードが存在しない場合
						let testInfo = {id: testId, nodeSeq_main: preNodeSeq_main.concat(nodeSeq_main.slice(1, i+1)), nodeSeq_sub: preNodeSeq_sub.concat(nodeSeq_sub.slice(1, j+1))};
						tree.propagate(id_main, id, notMatchValues(nodeSeq_main[i].readVars, []), notMatchValues(nodeSeq_main[i].writeVars, []), [testInfo]);
						rewards += this._rewardsOpt.prop;
						break;
					}
				}
			}
			if (this._info_main.nodeMap[id_main] && this._info_main.nodeMap[id_main].diff == "added") {
				i++;
			} else {
				i++;
				j++;
			}
		}
		// console.log(tree);

		//ツリーをマージする
		if (root in this._list) {
			let chief = this._list[root];
			tree.searchTree(tree.root, n => {
				if (n.id in chief.nodeMap) {
					// 元々のツリーにノードがある場合
					chief.mergeNode(n.id, n.parentId, n.readDiff, n.writeDiff, n.testInfos);
				} else {
					// ないときは伝搬させる
					// 親は必ずいるはず
					chief.propagate(n.id, n.parentId, n.readDiff, n.writeDiff, n.testInfos);
				}
			});
		} else {
			this._list[root] = tree;
		}
		// console.log(this._list[root]);
		return rewards;
	}

	getContained() {
		let ret = [];
		for(let root in this._list) {
			this._list[root].getAllNodeId().forEach(id => {
				if (ret.indexOf(id) == -1) ret.push(id);
			});
		}
		return ret;
	}
}

export default CEPTList;
