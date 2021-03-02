
const fs = require("fs");
const jsnx = require("jsnetworkx");

import JalangiUtils from "./JalangiUtils";

class Informations {

	constructor (options, coverage, id) {
		if (id !== "A" && id !== "B") throw new Error("idが違うよ！！" + id);

		this.coverage = coverage;
		this.id = id;
		this._utils = new JalangiUtils();

		this.options = options;
		this._rewardsOpt = this.options.learningEnv.rewards;

		this.nodeMap = {};
		this.changedNodes = [];

		// // うまいこと実行パスを取りたい
		// this.pathList = [];

		this.requestReads = {};
		this.requestBrUses = {};
		this.requestOutUses = {};
		this.requestUsePlaceMaps = {};

		this.callbackMap = {};
		this.callbackSeqList = [];
		this.requestMap = {};
		this.requestSeqList = [];

		this._updateGraphs();

	}


	_updateGraphs () {
		// CFG, CDGを読み込む

		const newNodeMap = JSON.parse(fs.readFileSync(this.options.logDir+"/interGraphs/nodeMap_"+this.id+".json"));
		const newEdgeList = JSON.parse(fs.readFileSync(this.options.logDir+"/interGraphs/edgeList_"+this.id+".json"));
		this.cdg = new jsnx.DiGraph();
		this.cdg.addNodesFrom(Object.keys(newNodeMap));
		this.cdg.addEdgesFrom(newEdgeList.filter(o => o.data.weight === 1).map(o => [o.from, o.to]), {weight: 1});
		this.cdg.addEdgesFrom(newEdgeList.filter(o => o.data.weight === 0).map(o => [o.from, o.to]), {weight: 0});


		this._distCash = {}; // グラフ作り直すたびに白紙に戻す

		const newNodeIds = Object.keys(newNodeMap).filter(id => !(id in this.nodeMap));
		newNodeIds.sort(); // これで順番が一定になってくれることを期待

		for (let i in newNodeIds) {
			let id = newNodeIds[i];
			this.nodeMap[id] = newNodeMap[id];
			this.nodeMap[id].execCount = 0;
			this.nodeMap[id].selected = 0;
			this.nodeMap[id].failNegate = 0;
			this.nodeMap[id].propDiff = false;
			this.nodeMap[id].useProp = 0;
			this.nodeMap[id].condProp = 0;
			this.nodeMap[id].writeProp = 0;
			this.nodeMap[id].failUseProp = 0;
			this.nodeMap[id].failCondProp = 0;
			this.nodeMap[id].failWriteProp = 0;
			this.nodeMap[id].exec = false;
			this.nodeMap[id].execT = false;
			this.nodeMap[id].execF = false;
			this.nodeMap[id].latestExec = false;
			this.nodeMap[id].iidList = [];
			this.nodeMap[id].commands = this._commandTypes(this.nodeMap[id].label); // この各コマンドにlocが結びついてる
		}

		this.changedNodes = Object.keys(this.nodeMap).filter(id => this.nodeMap[id].diff == "added" || this.nodeMap[id].diff == "changed");

		for (let id in this.nodeMap) {
			let dists = this.changedNodes.map(id2 => this.getCDGdist(id, id2)).filter(d => d != -1);
			this.nodeMap[id].distToDiff = dists.length? dists.reduce((a,b)=>Math.min(a,b)) : -1;
			// if (this.nodeMap[id].distToDiff !== -1) console.log(id+": "+this.nodeMap[id].distToDiff);
		}
	}


	getCDGdist (from, to) {
		if (this._distCash[from] && this._distCash[from][to]) return this._distCash[from][to];
		let dist;
		try {
			dist = jsnx.dijkstraPathLength(this.cdg, {source: from, target: to});
		} catch (e) {
			dist = -1;
		}
		if (!this._distCash[from]) this._distCash[from] = {};
		this._distCash[from][to] = dist;
		return dist;
	}


	_commandTypes (label) {
		if (!label) return [];
		return label.split("|").map(s => s.split("[")[0].split(" ")[1]);
	}


	// // iidとノードのつながり両方見た方が良さそう
	// // ここでiidとブロックの対応が正しく取れると仮定すると全てiidとその時の実行idでブロックとの対応付けができるようになりそう
	// // それはだいぶオイシイ
	// _getPath(iidList) {
	//
	// 	iidList = iidList.map(n => String(n));
	// 	// console.log(iidList);
	// 	fs.writeFileSync(this.options.logDir+"/candIdLog", iidList.map(iid => Object.keys(this.nodeMap).filter(id => this.nodeMap[id].iidList.indexOf(iid)>=0)).join("\n"));
	//
	// 	// デバッグ用
	// 	if (iidList) return [];
	//
	// 	let path = [];
	// 	let next = undefined;
	// 	// let last = undefined;
	// 	let last = "BB_entry0";
	// 	let iid = iidList.shift();
	// 	// while (!last && iidList.length > 0) {
	// 	// 	// console.log(iid);
	// 	// 	for (let id in this.nodeMap) {
	// 	// 		// console.log(this.nodeMap[id].iidList);
	// 	// 		if (this.nodeMap[id].iidList.indexOf(iid) >= 0) {
	// 	// 			last = this.nodeMap[id].entry;
	// 	// 			// console.log(last);
	// 	// 			break;
	// 	// 		}
	// 	// 	}
	// 	// 	iid = iidList.shift();
	// 	// }
	//
	// 	let loop = true;
	// 	while (loop) {
	// 		// iidListの先頭はnextのうちのどれかを指しているはず？
	//
	// 		path.push(last);
	// 		next = this.nodeMap[last].next;
	// 		// exceptional-returnを無視したいかも？
	// 		// next = this.nodeMap[last].next.filter(id => this.nodeMap[id].label.indexOf("exceptional-return") == -1);
	// 		// console.log(path);
	//
	// 		console.log(next);
	// 		if (next.length == 0) {
	// 			// 次のノードがない時(exitだけ？)
	// 			// これでいいのか？
	// 			break;
	// 		} else if (next.length == 1) {
	// 			// 1択の時
	// 			last = next[0];
	// 			while (this.nodeMap[last].iidList.indexOf(iid) >= 0) {
	// 				iid = iidList.shift();
	// 			}
	// 		} else {
	// 			// 2択以上の時
	// 			if (this.nodeMap[last].types.indexOf("call") >= 0) {
	// 				// 関数呼び出しの時
	// 				let entries = next.filter(id => id.indexOf("entry") >= 0);
	// 				if (entries.length == 1) {
	// 					// 呼び出される関数が特定できている時
	// 					last = entries[0];
	// 				} else {
	// 					// なにが呼び出されているかわからないとき
	// 					let nextIid = iidList[1]; //ほんとか？
	// 					for (let id in this.nodeMap) {
	// 						// console.log(this.nodeMap[id].iidList);
	// 						if (this.nodeMap[id].iidList.indexOf(nextIid) >= 0) {
	// 							last = this.nodeMap[id].entry;
	// 							if (entries.indexOf(last) >= 0) {
	// 								// console.log(last);
	// 								break;
	// 							} else {
	// 								console.log(last+"じゃないの？");
	// 							}
	// 						}
	// 					}
	// 				}
	// 			} else {
	// 				// 関数呼び出しじゃない（おそらく条件分岐の）とき
	// 				let cand = [];
	// 				while (cand.length == 0) {
	// 					if (iidList.length == 0) throw new Error("パスがうまく取れない！");
	// 					for (let i in next) {
	// 						let id = next[i];
	// 						if (this.nodeMap[id].iidList.indexOf(iid) >= 0) {
	// 							cand.push(id);
	// 						}
	// 					}
	// 					iid = iidList.shift();
	// 				}
	// 				if (cand.length == 1) {
	// 					last = cand[0];
	// 				} else {
	// 					console.log("cand: "+cand);
	// 				}
	// 			}
	// 			console.log(last+"を選んだよ");
	// 		}
	// 	}
	// 	return path;
	// }


	// 変更ノードについてのカバレッジ情報をチェックしてアップデート
	// イベントのカバレッジもとりたい
	// updateCoverage(iidSeq, iidCommandMap) {
	updateCoverage(iidSeq, iidCommandMap, eventRecord) {

		this._updateGraphs();

		// let pathObj = {path: this._getPath(coverage.path), file: file};
		// // console.log(pathObj.path);
		// pathObj.newCover = pathObj.path.reduce((crr, id) => crr || this.nodeMap[id].execCount == 0, false);
		// pathObj.newChangeCover = pathObj.path.reduce((crr, id) => crr || (this.nodeMap[id].execCount == 0 && id in this.changedNodes), false);
		// this.pathList.push(pathObj);
		// // console.log(this.pathList);


		let rewards = 0;

		const self = this;
		iidSeq.forEach(o => {
			if (o.type === "touch") o.file = self._parseLoc(o.loc).file;
		});

		for (let file in this.coverage._current) {
			let coverage = this.coverage._current[file];
			for (let iid in coverage.branches) {
				let id = this._getBlockIdFromIid(file, coverage.smap[iid], iidCommandMap[iid]);
				if (!id && iidCommandMap[iid] === "conditional") {
					id = this._getCondBlockIdFromIid(file, coverage.smap[iid]);
					// if (!id) console.log(file+coverage.smap[iid]+"が見つからない");
				}
				if (!id) {
					continue; // とりあえず無視
				}

				iidSeq.forEach(o => {
					if (o.type === "touch" && o.file === file && o.iid == iid) {
						o.blockId = id;
					}
				});

				this.nodeMap[id].cov |= coverage.branches[iid];
				if (this.nodeMap[id].iidList.filter(o => o.file === file && o.iid === iid).length === 0) {
					this.nodeMap[id].iidList.push({file: file, iid: iid});
				}
			}
		}


		for (let i in iidSeq) {
			let id = iidSeq[i].blockId;
			if (id) {
				this.nodeMap[id].latestExec = true;
				if (this.nodeMap[id].diff === "added") {
					// console.log(id+"を実行");
					rewards += this._rewardsOpt["execChange"] * 2;
				} else if (this.nodeMap[id].diff === "changed") {
					// console.log(id+"を実行");
					rewards += this._rewardsOpt["execChange"];
				}
			}
		}


		for (let id in this.nodeMap) {
			if (this.nodeMap[id].cov % 2 == 1) {
				this.nodeMap[id].exec = true;
				if (this.nodeMap[id].cov == 3 || this.nodeMap[id].cov == 7) {
					// console.log("cover True branch "+id);
					if (!this.nodeMap[id].execT) {
						rewards += this._rewardsOpt["coverTBranch"];
					}
					this.nodeMap[id].execT = true;
				}
				if (this.nodeMap[id].cov == 5 || this.nodeMap[id].cov == 7) {
					// console.log("cover False branch "+id);
					if (!this.nodeMap[id].execF) {
						rewards += this._rewardsOpt["coverFBranch"];
					}
					this.nodeMap[id].execF = true;
				}
			}

			if (this.nodeMap[id].latestExec) {
				if (this.nodeMap[id].execCount === 0) {
					// console.log("cover new "+id);
					// console.log("add cover " + id);
					rewards += this._rewardsOpt["cover"];
					if (this.nodeMap[id].diff === "added") {
						// console.log("add coverChange");
						rewards += this._rewardsOpt["coverChange"] * 2;
					} else if (this.nodeMap[id].diff === "changed") {
						// console.log("add coverChange");
						rewards += this._rewardsOpt["coverChange"];
					}
				}
				this.nodeMap[id].execCount++; // 何回の実行で実行されているか(1パスでの複数回実行はカウントせず)
			}
		}

		let callbackSeq = [{id: "main", name: "main"}].concat(eventRecord);
		callbackSeq.forEach(e => {
			e.blockIdList = [];
			e.arrangedCbId = self._arrangeCallbackId(e.id);
		});
		let look = callbackSeq[0];
		for (let i in iidSeq) {
			if (iidSeq[i].type === "call") {
				look = callbackSeq.filter(e => e.id === iidSeq[i].id)[0];
			} else if (iidSeq[i].blockId) {
				if (look.blockIdList.indexOf(iidSeq[i].blockId) === -1) {
					look.blockIdList.push(iidSeq[i].blockId);
				}
			}
		}

		for (let i=0; i<callbackSeq.length; i++) {
			let e = callbackSeq[i];
			let cbId = e.arrangedCbId;

			if (!(cbId in this.callbackMap)) {
				this.callbackMap[cbId] = {execCount: 0, blockIdList: [], after: [], execChange: false};
				// console.log("add coverCb");
				rewards += this._rewardsOpt["coverCb"];
			}
			this.callbackMap[cbId].execCount++;

			for (let i in e.blockIdList) {
				let id = e.blockIdList[i];
				if (this.callbackMap[cbId].blockIdList.indexOf(id) === -1) {
					// console.log("add execBlockinNewCb");
					rewards += this._rewardsOpt["execBlockinNewCb"];
					// addとchangeで扱いを分けるべき(changeは2回カウントされるかもなため)
					if (this.nodeMap[id].diff === "added") {
						// console.log("add execChangedBlockinNewCb");
						rewards += this._rewardsOpt["execChangedBlockinNewCb"] * 2;
						this.callbackMap[cbId].execChange = true;
					} else if (this.nodeMap[id].diff === "changed") {
						// console.log("add execChangedBlockinNewCb");
						rewards += this._rewardsOpt["execChangedBlockinNewCb"];
						this.callbackMap[cbId].execChange = true;
					}
					this.callbackMap[cbId].blockIdList.push(e.blockIdList[i]);
				}
			}

			if (callbackSeq[i+1]) {
				let cbIdAfter = callbackSeq[i+1].arrangedCbId;
				if (this.callbackMap[cbId].after.indexOf(cbIdAfter) === -1) {
					// console.log("add coverCbPair");
					rewards += this._rewardsOpt["coverCbPair"];
					this.callbackMap[cbId].after.push(cbIdAfter);
				}
			}
		}

		let requestSeq = callbackSeq.filter(e => e.name.indexOf("[req]") === 0);
		for (let i=0; i<requestSeq.length; i++) {
			let name = this._arrangeCallbackId(requestSeq[i].name);
			if (!(name in this.requestMap)) {
				this.requestMap[name] = {execCount: 0, after: []};
				// console.log("add coverReq");
				rewards += this._rewardsOpt["coverReq"];
			}

			if (requestSeq[i+1]) {
				let reqAfter = this._arrangeCallbackId(requestSeq[i+1].name);
				if (this.requestMap[name].after.indexOf(reqAfter) === -1) {
					// console.log("add coverReqPair");
					rewards += this._rewardsOpt["coverReqPair"];
					this.requestMap[name].after.push(reqAfter);
				}
			}
		}

		this.callbackSeqList.push(callbackSeq);
		this.requestSeqList.push(requestSeq);


		// パス判定はむずいかもしれない（後回し）
		// console.log(iidSeq.map(iid => iidBlockIdMap[iid]).filter(id => !!id));
		// いいような悪いような
		// if (this.nodeMap[id].cov >= 3) {
		// 	console.log(id.split("_")[0]+" "+this.nodeMap[id].exec+" "+this.nodeMap[id].execT+" "+this.nodeMap[id].execF+" "+this.nodeMap[id].latestExec+" "+this.nodeMap[id].cond);
		// }

		// console.log(rewards);
		return rewards;
	}


	// コールバックのidベースなので繰り返しで死んじゃう(無駄に報酬を与えてしまう)
	// 呼び出し回数の識別子を取り除く
	// [req]mkdirP_call0---fs_exists0---fs_exists0---fs_mkdir0
	_arrangeCallbackId (cbId) {
		if (cbId.indexOf("[req]") === 0) {
			let arr = cbId.split("---");
			let callIdx = arr[0].lastIndexOf("_call");
			arr[0] = arr[0].slice(0, callIdx);
			cbId = arr.join("---");
		}
		return cbId;
	}


	_updateReadVars (requests, eventRecord, readWriteVars) {
		const self = this;
		let rewards = 0;
		for (let name in requests) {
			if (!(name in this.requestReads)) {
				this.requestReads[name] = {};
			}

			this.requestReads[name].readNewVar = false;
			this.requestReads[name].readNewVal = false;

			let readVars = readWriteVars.filter(v => v.type == "read").filter(v => {
				const relatedCbEid = eventRecord.filter(e => e.id.indexOf("[req]"+name) === 0).map(cb => cb.cbExecAsyncId);
				return relatedCbEid.indexOf(v.eid) >= 0;
			});
			let r = this.requestReads[name];
			// console.log(name+"をみてる");
			// console.log(r);
			// idはcb用なのでreadを見たい
			readVars.forEach(v => {
				if (!(v.name in r)) {
					self.requestReads[name].readNewVar = true;
					// console.log("readNewVariable "+v.name);
					rewards += self._rewardsOpt["readNewVariable"];
					r[v.name] = [];
				}
				if (r[v.name].indexOf(v.val_c) === -1) {
					self.requestReads[name].readNewVal = true;
					// console.log("readNewValue "+v.name); // どんどん追加されてて死んでる
					rewards += self._rewardsOpt["readNewValue"];
					r[v.name].push(v.val_c);
				}
			});
		}
		return rewards;
	}


	_updateBranchUseMap(branchUseMap) {
		for (let loc in branchUseMap) {
			for (let i in branchUseMap[loc]) {
				const brIid = branchUseMap[loc][i].iid;
				let cov = 0;
				for (let file in this.coverage._current) {
					let coverage = this.coverage._current[file];
					for (let iid in coverage.branches) {
						if (brIid == iid) cov = coverage.branches;
					}
				}

				branchUseMap[loc][i].execT = false;
				branchUseMap[loc][i].execF = false;
				if (cov % 2 == 1) {
					if (cov == 3 || cov == 7) branchUseMap[loc][i].execT = true;
					if (cov == 5 || cov == 7) branchUseMap[loc][i].execF = true;
				}
			}
		}
		return 0;
	}


	_updateBranchUse(requests, eventRecord, branchUseMap) {
		let rewards = 0;
		for (let name in requests) {
			if (!(name in this.requestBrUses)) {
				this.requestBrUses[name] = {};
			}
			const relatedCbEid = eventRecord.filter(e => e.id.indexOf("[req]"+name) === 0).map(cb => cb.cbExecAsyncId);
			for (let loc in branchUseMap) {
				// const id = this.getCondBlockId(loc);
				const id = this.getCondBlockId(loc.split("###")[0], loc.split("###").slice(1).join("###"));
				if (id) {
					// console.log(id);
					// console.log(this.nodeMap[id].execT + ", " + this.nodeMap[id].execF);
					if (this.nodeMap[id].execT && this.nodeMap[id].execF) {
						// console.log(loc+"は探索済み");
						continue;
					}
				}

				for (let i in branchUseMap[loc]) {
					if (relatedCbEid.indexOf(branchUseMap[loc][i].eid) >= 0) {
						// if (branchUseMap[loc][i].execT && branchUseMap[loc][i].execF) {
						// 	console.log(loc+"の"+i+"は探索済み");
						// 	continue;
						// }

						if (!this.requestBrUses[name][loc]) {
							// rewards += this._rewardsOpt["readNewBranch"];
							this.requestBrUses[name][loc] = [];
						}
						for (let j in branchUseMap[loc][i].use) {
							let v = branchUseMap[loc][i].use[j];
							if (this.requestBrUses[name][loc].indexOf(v) === -1) {
								// rewards += this._rewardsOpt["useNewVariableInBranch"];
								this.requestBrUses[name][loc].push(v);
							}
						}
					}
				}
			}
		}
		return rewards;
	}


	_updateOutputUse(requests, eventRecord, outputs) {
		let rewards = 0;
		for (let name in requests) {
			if (!(name in this.requestOutUses)) {
				this.requestOutUses[name] = {};
			}
			const relatedCbEid = eventRecord.filter(e => e.id.indexOf("[req]"+name) === 0).map(e => e.cbExecAsyncId);
			for (let id in outputs) {
				for (let i in outputs[id]) {
					let out = outputs[id][i];
					if (relatedCbEid.indexOf(out.eid) >= 0) {
						if (!this.requestOutUses[name][id]) {
							// rewards += this._rewardsOpt["readNewOutput"];
							this.requestOutUses[name][id] = [];
						}
						for (let i in out.use) {
							let v = out.use[i];
							if (this.requestOutUses[name][id].indexOf(v) === -1) {
								// rewards += this._rewardsOpt["useNewVariableInOutput"];
								this.requestOutUses[name][id].push(v);
							}
						}
					}
				}
			}
		}
		return rewards;
	}


	_updateUsePlaceMap (requests) {
		for (let name in requests) {
			let usePlaceMap = {};
			let brUses = this.requestBrUses[name];
			let outUses = this.requestOutUses[name];
			for (let loc in brUses) {
				brUses[loc].forEach(id => {
					if (!usePlaceMap[id]) usePlaceMap[id] = [];
					usePlaceMap[id].push(loc);
				});
			}
			for (let outId in outUses) {
				outUses[outId].forEach(id => {
					if (!usePlaceMap[id]) usePlaceMap[id] = [];
					usePlaceMap[id].push("out#"+outId);
				});
			}
			this.requestUsePlaceMaps[name] = usePlaceMap;
		}
		return 0;
	}


	updateInfo (finalOut) {
		let rewards = 0;
		rewards += this._updateReadVars(finalOut.requests, finalOut.eventRecord, finalOut.readWriteVars);
		rewards += this._updateBranchUseMap(finalOut.branchUseMap);
		rewards += this._updateBranchUse(finalOut.requests, finalOut.eventRecord, finalOut.branchUseMap);
		rewards += this._updateOutputUse(finalOut.requests, finalOut.eventRecord, finalOut.outputs);
		rewards += this._updateUsePlaceMap(finalOut.requests);
		return rewards;
	}


	// getBlockId(location) {
	// 	let loc = this._parseLoc(location);
	// 	for (let id in this.nodeMap) {
	// 		if (loc.file !== this.nodeMap[id].file) continue;
	// 		for (let i in this.nodeMap[id].locList) {
	// 			let l = this.nodeMap[id].locList[i];
	// 			let m = loc.loc;
	// 			if (l[0]==m[0] && l[1]==m[1] && l[2]==m[2] && l[3]==m[3]) {
	// 				return id;
	// 			}
	// 		}
	// 	}
	// }


	// TAJSのノードの種類
	// "write-variable"
	// "write-property"
	// "return"
	// "read-variable"
	// begin-for-in
	// begin-loop
	// begin-with
	// construct
	// call
	// catch
	// constant
	// function-expr
	// function-decl
	// vardecl
	// とかとか
	// めっちゃある

	// for (let id in this.nodeMap) {
	// 	console.log(id);
	// 	let file = this.nodeMap[id].file;
	// 	for (let i in this.nodeMap[id].locList) {
	// 		let loc = this.nodeMap[id].locList[i];
	// 		let inst = this.nodeMap[id].commands[i];
	// 		// 対応するiidをチェックしたい
	// 	}
	// }

	_matchCommand(id, loc, TAJSCommand, jalangiCommand) {
		// console.log(TAJSCommand);
		// console.log(id.split("_")[0] + " " + loc);

		if (!jalangiCommand) {
			return true;
		}

		switch(jalangiCommand) {
		case "write": case "putFieldPre":
			return TAJSCommand === "write-variable" || TAJSCommand === "write-property";
		case "read": case "getFieldPre":
			return TAJSCommand === "read-variable" || TAJSCommand === "read-property";
		case "literal":
			return TAJSCommand === "constant";
		case "declare":
			return TAJSCommand === "constant" || TAJSCommand === "function-expr";
		case "functionEnter":
			return false;
		case "functionExit":
			return TAJSCommand === "return";
		case "_with":
			return TAJSCommand === "";
		case "_throw":
			return TAJSCommand === "";
		case "_return":
			return TAJSCommand === "";
		case "endExpression":
			return false;
		case "forinObject":
			return TAJSCommand === "";
		case "invokeFun":
			return TAJSCommand === "call";
		case "invokeFunPre":
			return TAJSCommand === "";
		case "conditional":
			return TAJSCommand === "if";
		default:
			if (jalangiCommand.indexOf("binary")) {
				return TAJSCommand === jalangiCommand.split("~")[1];
			} else if (jalangiCommand.indexOf("unary")) {
				return TAJSCommand === jalangiCommand.split("~")[1];
			} else {
				console.log(jalangiCommand+"未定義");
			}
		}

		return false;
	}


	_getCondBlockIdFromIid(file, loc) {
		if (!loc) return; // とりあえず無視

		let cands = [];
		const m = loc.map(s => parseInt(s, 10));
		// console.log(loc);
		for (let id in this.nodeMap) {
			// console.log(this.nodeMap[id].file);
			// console.log(this.nodeMap[id].cond);
			if (file !== this.nodeMap[id].file || !this.nodeMap[id].cond) continue;
			// console.log("cand: "+id);
			for (let i in this.nodeMap[id].locList) {
				let l = this.nodeMap[id].locList[i];
				if ((this._isContain(m, l) && this._calcDiffScore(m, l) < 100) || (this._isContain(l, m) && this._calcDiffScore(l, m) < 100)) {
					cands.push({id: id, score: this._calcDiffScore(m, l)});
				}
				// if (this._isContain(m, l) && this._matchCommand(id, l, c, command)) {
				// 	// if (l[0]==m[0] && l[1]==m[1] && l[2]==m[2] && l[3]==m[3] && this._matchCommand(c, command)) {
				// 	cands.push({id: id, score: this._calcDiffScore(m, l)});
				// 	break;
				// }
			}
		}

		cands.sort((a, b) => a.score - b.score);
		// console.log(cands);
		return cands[0] ? cands[0].id : undefined;
	}


	// とりあえず仕様
	_getBlockIdFromIid(file, loc, command) {
		if (!loc) return; // とりあえず無視

		let cands = [];
		const m = loc.map(s => parseInt(s, 10));
		// console.log(loc);
		for (let id in this.nodeMap) {
			if (file !== this.nodeMap[id].file) continue;
			// console.log(this.nodeMap[id].locList);
			for (let i in this.nodeMap[id].locList) {
				let l = this.nodeMap[id].locList[i];
				let c = this.nodeMap[id].commands[i];
				// console.log(l);
				// console.log(m);
				if ((this._isContain(m, l) && this._calcDiffScore(m, l) < 100) || (this._isContain(l, m) && this._calcDiffScore(l, m) < 100)) {
					if (this._matchCommand(id, l, c, command)) {
						cands.push({id: id, score: this._calcDiffScore(m, l)});
					}
				}
				// if (this._isContain(m, l) && this._matchCommand(id, l, c, command)) {
				// 	// if (l[0]==m[0] && l[1]==m[1] && l[2]==m[2] && l[3]==m[3] && this._matchCommand(c, command)) {
				// 	cands.push({id: id, score: this._calcDiffScore(m, l)});
				// 	break;
				// }
			}
		}

		cands.sort((a, b) => a.score - b.score);
		// console.log(cands);
		return cands[0] ? cands[0].id : undefined;
	}


	// スコアが小さいほど良い
	_calcDiffScore (loc1, loc2) {
		let score = 0;
		score += Math.abs(loc1[0] - loc2[0]) * 100;
		score += Math.abs(loc1[1] - loc2[1]) * 1;
		score += Math.abs(loc1[2] - loc2[2]) * 100;
		score += Math.abs(loc1[3] - loc2[3]) * 1;
		return score;
	}


	_getReadBlockIdFromLoc(location) {
		const loc = this._parseLoc(location);
		for (let id in this.nodeMap) {
			let block = this.nodeMap[id];
			if (!block.read || loc.file !== block.file) continue;
			for (let i=0; i<block.read.length; i++) {
				let read = block.read[i];
				// console.log(read.loc);
				if(this._isContain(loc.loc, read.loc)) {
					// console.log(id);
					return id;
				}
			}
		}
	}


	_getWriteBlockIdFromLoc(location) {
		const loc = this._parseLoc(location);
		// console.log(jalangiLoc);
		for (let id in this.nodeMap) {
			let block = this.nodeMap[id];
			if (!block.write || loc.file !== block.file) continue;
			for (let i=0; i<block.write.length; i++) {
				let write = block.write[i];
				// console.log(write);
				if((this._isContain(loc.loc, write.loc) || (loc.loc[0] == write.loc[2] && loc.loc[1]-write.loc[3] == 3))) {
					// console.log(id);
					return id;
				}
			}
		}
	}


	_getCondBlockIdFromLoc(location) {
		const loc = this._parseLoc(location);
		if (!loc) return;
		// console.log(loc);
		let cands = [];
		for (let id in this.nodeMap) {
			// condしかみない
			if (this.nodeMap[id].cond && loc.file === this.nodeMap[id].file && this._isContain(loc.loc, this.nodeMap[id].cond)) {
				// console.log(id);
				// return id;
				cands.push({id: id, score: this._calcDiffScore(loc.loc, this.nodeMap[id].cond)});
			}
		}
		// if (cands.length === 0) return;
		// console.log(cands);
		cands.sort((a, b) => a.score - b.score);
		// if (!cands[0]) console.log("失敗: "+loc.file+" "+loc.loc);
		return cands[0] ? cands[0].id : undefined;
	}


	getReadBlockId(iid, location) {
		const loc = this._parseLoc(location);
		for (let id in this.nodeMap) {
			if (this.nodeMap[id].iidList.filter(o => o.file === loc.file && o.iid == iid).length > 0) {
				// console.log("getReadBlockId" + id);
				return id;
			}
		}
		return this._getReadBlockIdFromLoc(location);
		// console.log(iid+location+"見つからなかった");
	}


	getWriteBlockId(iid, location) {
		const loc = this._parseLoc(location);
		for (let id in this.nodeMap) {
			if (this.nodeMap[id].iidList.filter(o => o.file === loc.file && o.iid == iid).length > 0) {
				// console.log("getWriteBlockId" + id);
				return id;
			}
		}
		return this._getWriteBlockIdFromLoc(location);
		// console.log(iid+location+"見つからなかった");
	}


	// とりあえず2種類の探査で回避
	// カバレッジのためにもうちょいどうにかすべきかも
	getCondBlockId(iid, location) {
		const loc = this._parseLoc(location);
		for (let id in this.nodeMap) {
			// if (this.nodeMap[id].cond) {
			// 	console.log(id);
			// 	console.log(this.nodeMap[id].iidList);
			// }
			if (this.nodeMap[id].iidList.filter(o => o.file === loc.file && o.iid == iid).length > 0) {
				// console.log("getCondBlockId" + id);
				// console.log(id);
				return id;
			}
		}
		return this._getCondBlockIdFromLoc(location);
		// console.log(iid+location+"見つからなかった");
	}


	// _getCondBlocksIdFromSmap(file, loc_str) {
	// 	if (!loc_str) return; // とりあえず無視
	// 	const loc = {file: file, loc: loc_str.map(s => parseInt(s, 10))};
	// 	let cands = [];
	// 	// console.log(loc.file);
	// 	for (let id in this.nodeMap) {
	// 		// condしかみない
	// 		// console.log(this.nodeMap[id].file);
	// 		if (this.nodeMap[id].cond && loc.file === this.nodeMap[id].file && this._isContain(loc.loc, this.nodeMap[id].cond)) {
	// 			// console.log(id);
	// 			// return id;
	// 			cands.push({id: id, score: this._calcDiffScore(loc.loc, this.nodeMap[id].cond)});
	// 		}
	// 	}
	// 	if (cands.length === 0) return;
	// 	// console.log(cands);
	// 	cands.sort((a, b) => a.score - b.score);
	// 	return cands[0].id;
	// }


	// getFuncEntry (location) {
	// 	location = location.slice(1, -1);
	// 	let file = location.split(":").slice(0, -4).join(":");
	// 	let jalangiLoc = location.split(":").slice(-4).map(s => parseInt(s, 10));
	// 	for (let id in this.nodeMap) {
	// 		if (file === this.nodeMap[id].file) {
	// 			for (let i in this.nodeMap[id].locList) {
	// 				if (this._isContain(jalangiLoc, this.nodeMap[id].locList[i])) {
	// 					return this.nodeMap[id].entry;
	// 				}
	// 			}
	// 		}
	// 	}
	// }

	// iidは一意に対応していなかった！！！
	// ファイルごとに別に存在する模様
	// _getJalangiLocs(iid) {
	// 	let cands = [];
	// 	for (let file in this.coverage._current) {
	// 		if (this.coverage._current[file].smap && this.coverage._current[file].smap[iid]) {
	// 			let loc = this.coverage._current[file].smap[iid];
	// 			cands.push({file: file, loc: loc.map(s => parseInt(s, 10))});
	// 		}
	// 	}
	// 	return cands;
	// }


	_parseLoc(location) {
		// console.log(location);
		if (location.split(":").length < 2) return;
		if (location.split(":").length < 5) {
			location = location.slice(1, -1);
			let file = location.split(":").slice(0, -1).join(":");
			return {file: file};
		}
		location = location.slice(1, -1);
		let file = location.split(":").slice(0, -4).join(":");
		let loc = location.split(":").slice(-4).map(s => parseInt(s, 10));
		return {file: file, loc: loc};
	}


	// loc1がloc2に含まれる
	_isContain(loc1, loc2) {
		return (loc1[0] > loc2[0] || (loc1[0] == loc2[0] && loc1[1] >= loc2[1])) &&
		(loc1[2] < loc2[2] || (loc1[2] == loc2[2] && loc1[3] <= loc2[3]));
	}

}

export default Informations;
