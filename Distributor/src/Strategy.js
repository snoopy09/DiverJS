/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

const seedrandom = require("seedrandom");
const fs = require("fs");
const {performance} = require("perf_hooks");
const startTime = performance.now();

import CEPTList from "./CEPTList";
import Solver from "./Solver";
import JalangiUtils from "./JalangiUtils";
import HBRelation from "./HBRelation";
import CallbackOrder from "./CallbackOrder";

class Strategy {

	constructor(options, infoA, infoB, learning) {

		this.options = options;
		// Math.randomの値を変えられる
		seedrandom("eps"+this.options.epsCount, { global: true });

		this._infoA = infoA;
		this._infoB = infoB;
		this._utils = new JalangiUtils();
		// this.emitter = emitter;

		this._latestId = 1;
		this._executedMap = {};
		this._inputQueue = [];
		this._requestSeqQueue = [];
		this._allRequestSeqQueue = [];
		this._cbOrders = [];
		this._cbOrderQueue = [];
		this._executedQueue = [];

		this._diffInput = undefined;

		this._actions = this.options.learningEnv.actions;
		this._execRecord = [];
		this._learningRecord = [];

		const ActSwitch = require(this.options.logDir + "/ActionSwitch.js");
		this._actSwitch = new ActSwitch(this);

		this._learning = learning;
		this.rewards = 0;
		this._rewardsOpt = this.options.learningEnv.rewards;
		this._execStep = 1;
		this._maxExecStep = this.options.learningEnv.maxExecStep;

		this._CEPTListA = new CEPTList(this._infoA, this._infoB, this._rewardsOpt);
		this._CEPTListB = new CEPTList(this._infoB, this._infoA, this._rewardsOpt);

		this._execRecordFile = this.options.logDir+"/execRecord.json";
		this._learningRecordFile = this.options.logDir+"/learingRecord.json";
		this._actionLogFile = this.options.logDir+"/value_function/actionLog.log";
	}


	_nextID() {
		return this._latestId++;
	}


	changedCoverage() {
		const length = this._infoA.changedNodes.length + this._infoB.changedNodes.length;
		const covered = this._infoA.changedNodes.filter(id => this._infoA.nodeMap[id].exec).length + this._infoB.changedNodes.filter(id => this._infoB.nodeMap[id].exec).length;
		return covered / length;
	}


	addInputs(file, finalOutA, finalOutB, rewards) {
		let boundA = file.input._boundA;
		let boundB = file.input._boundB;

		// コールバックの順序を変更した場合干渉した変数+それに依存する変数の使用箇所以降に現れるブランチのみ反転
		if (file.conflictInfo) {
			// disabledの基準がわからん、実装しなきゃ
			// console.log(file.conflictInfo);
			boundA = this._PClengthToUsePlace(file.conflictInfo.type, file.conflictInfo.A, finalOutA);
			if (!boundA) boundA = file.input._boundA;
			boundB = this._PClengthToUsePlace(file.conflictInfo.type, file.conflictInfo.B, finalOutB);
			if (!boundB) boundB = file.input._boundB;
		}

		let slv = new Solver(file.input, finalOutA.alternatives, finalOutB.alternatives);

		const self = this;
		const newInputs = slv.generateInputs(boundA, boundB, this._infoA, this._infoB).map(input => {
			input.id = self._nextID();
			input.preId = file.id;
			input.pathA = file.pathA;
			input.pathB = file.pathB;
			input.requestSeqA = finalOutA.requestSeq;
			input.requestSeqB = finalOutB.requestSeq;
			input.cbOrderA = {id: "init", executed: finalOutA.cbOrder.executed};
			input.cbOrderB = {id: "init", executed: finalOutB.cbOrder.executed};
			input.preRewards = rewards;
			return input;
		});
		this._inputQueue = this._inputQueue.concat(newInputs);
	}


	_randomElem (array) {
		return array[Math.floor(Math.random() * array.length)];
	}


	_randomElemPop (array) {
		let rand = Math.floor(Math.random() * array.length);
		let ret = array[rand];
		array = array.splice(rand, 1);
		return ret;
	}


	updateCEPT(testId, readWriteVarsA, readWriteVarsB) {
		// 報酬を加算
		// this.rewards += this._CEPTListA.update(testId, readWriteVarsA, readWriteVarsB);
		// this.rewards += this._CEPTListB.update(testId, readWriteVarsB, readWriteVarsA);
		const rewardsA = this._CEPTListA.update(testId, readWriteVarsA, readWriteVarsB);
		const rewardsB = this._CEPTListB.update(testId, readWriteVarsB, readWriteVarsA);
		this.addRewards(rewardsA, "CEPTA");
		this.addRewards(rewardsB, "CEPTB");

		let containedA = this._CEPTListA.getContained();
		for(let id in this._infoA.nodeMap) {
			this._infoA.nodeMap[id].propDiff = containedA.indexOf(id) >= 0;
		}
		let containedB = this._CEPTListB.getContained();
		for(let id in this._infoB.nodeMap) {
			this._infoB.nodeMap[id].propDiff = containedB.indexOf(id) >= 0;
		}
	}


	_propagateCEPT() {

		const self = this;

		let leavesA = [];
		let leavesB = [];
		self._CEPTListA.getRoots().forEach(change => {
			const tree = self._CEPTListA.getTree(change);
			tree.getLeaves().forEach(leaf => {
				const node = tree.getNode(leaf);
				leavesA.push(node);
			});
		});
		self._CEPTListB.getRoots().forEach(change => {
			const tree = self._CEPTListB.getTree(change);
			tree.getLeaves().forEach(leaf => {
				const node = tree.getNode(leaf);
				leavesB.push(node);
			});
		});
		// console.log(leavesA);
		// console.log(leavesB);

		let candsA = [];
		let candsB = [];
		leavesA.forEach(leaf => {
			candsA = candsA.concat(self._propTree(self._infoA, leaf));
		});
		leavesB.forEach(leaf => {
			candsB = candsB.concat(self._propTree(self._infoB, leaf));
		});
		// console.log(candsA);
		// console.log(candsB);

		// leafNodeの情報から諸々判別する？
		let selected, executed, pcLength;
		let cands = candsA.concat(candsB);
		while (cands.length > 0) {
			// console.log(cands.length);
			let cand = this._randomElemPop(cands);
			switch (cand.type) {
			case "useProp":
				selected = cand.input;
				if (this._infoA.nodeMap[selected.blockIdA]) {
					this._infoA.nodeMap[selected.blockIdA].selected++;
					this._infoA.nodeMap[selected.blockIdA].useProp++;
				}
				if (this._infoB.nodeMap[selected.blockIdB]) {
					this._infoB.nodeMap[selected.blockIdB].selected++;
					this._infoB.nodeMap[selected.blockIdB].useProp++;
				}
				break;
			case "writeProp":
				executed = this._executedMap[cand.testId];
				pcLength = this._PClengthToWriteBlock(executed.altA, executed.altB, cand.nodeSeqA, cand.nodeSeqB);
				if (pcLength) selected = this._genWriteDiffInput(executed.file, executed.altA, executed.altB, cand.nodeSeqA[cand.nodeSeqA.length-1].writeVars, cand.nodeSeqB[cand.nodeSeqB.length-1].writeVars, pcLength[0], pcLength[1]);
				if (selected) {
					cand.leaf.writeProp++;
				} else {
					cand.leaf.failWriteProp++;
				}
				break;
			case "condProp":
				executed = this._executedMap[cand.testId];
				pcLength = this._PClengthToCondBlock(executed.altA, executed.altB, cand.nodeIdA, cand.nodeIdB);
				if (pcLength) selected = this._genCondDiffInput(executed.file, executed.altA, executed.altB, cand.leafId);
				if (selected) {
					cand.leaf.condProp++;
				} else {
					cand.leaf.failCondProp++;
				}
				break;
			}
			if (selected) {
				selected.tag = "_propagateCEPT ("+cand.type+")";
				return selected;
			}
		}
	}


	_propTree(info, leafNode) {
		const self = this;
		let cands = [];

		if (info.nodeMap[leafNode.id].write.length > 0) {
			// 変数定義ステートメントの時
			if(leafNode.writeDiff.length > 0) {
				// 変数定義ステートメントで異なる値をwriteしたけれど使われていない
				let usePlaces = [];
				for (let id in info.nodeMap) {
					let useVars = info.nodeMap[id].read ? info.nodeMap[id].read.filter(x => leafNode.writeDiff.indexOf(x.name) >= 0) : [];
					if (useVars.length > 0) {
						usePlaces.push(id);
					}
				}
				// inputQueueからとるとAに現れる使用箇所に近づけることしかできないけどOK？？
				const cands2 = this._inputQueue.filter(x => leafNode.testInfos.map(info => info.id).indexOf(x.preId) >= 0);
				cands2.forEach(x => {x.distance = self._calcMinDistance(info, (info.id === "A") ? x.blockIdA : x.blockIdB, usePlaces, false);});
				const reachables = cands2.filter(x => x.distance >= 0);
				if (reachables.length > 0) {
					cands = cands.concat(reachables.map(input => {return {type: "useProp", leaf: info.nodeMap[leafNode.id], input: input};}));
				} else {
					info.nodeMap[leafNode.id].failUseProp++;
				}
			} else {
				// 変数定義ステートメントで異なる値をreadしたけどwriteした値が一緒
				for (let i in leafNode.testInfos) {
					let testInfo = leafNode.testInfos[i];
					cands.push({
						type: "writeProp",
						leaf: info.nodeMap[leafNode.id],
						testId: testInfo.id,
						nodeSeqA: info.id === "A" ? testInfo.nodeSeq_main : testInfo.nodeSeq_sub,
						nodeSeqB: info.id === "B" ? testInfo.nodeSeq_main : testInfo.nodeSeq_sub,
					});
				}
			}
		}
		if (info.nodeMap[leafNode.id].cond) {
			// 条件分岐で異なる値をreadした or 変更箇所だけど分岐が一緒
			for (let i in leafNode.testInfos) {
				let testInfo = leafNode.testInfos[i];
				cands.push({
					type: "condProp",
					leaf: info.nodeMap[leafNode.id],
					testId: testInfo.id,
					nodeIdA: info.id === "A" ? leafNode.id : info.nodeMap[leafNode.id].mapped,
					nodeIdB: info.id === "B" ? leafNode.id : info.nodeMap[leafNode.id].mapped,
				});
			}
		}
		return cands;
	}


	_PClengthToUsePlace (type, confInfo, finalOut) {

		let eidList = [];
		let writeVars = [];
		if (type === "disabled") {
			if (!confInfo.evtId) return;
			const evt = finalOut.eventRecord.filter(e => e.id === confInfo.evtId)[0];
			if (!evt) return;
			eidList = finalOut.eventRecord.slice(finalOut.eventRecord.indexOf(evt)+1).map(e => e.cbExecAsyncId);
			writeVars = evt.cbWriteVars;
		}	else if (type === "conflict") {
			if (!confInfo.evtId0 || !confInfo.evtId1) return;
			const evt0 = finalOut.eventRecord.filter(e => e.id === confInfo.evtId0)[0];
			const evt1 = finalOut.eventRecord.filter(e => e.id === confInfo.evtId1)[0]; // こっちがあと
			if (!evt0 || !evt1) return;
			eidList = finalOut.eventRecord.slice(finalOut.eventRecord.indexOf(evt0)).map(e => e.cbExecAsyncId);
			writeVars = evt0.cbWriteVars.concat(evt1.cbWriteVars);
		}

		const locSeq = finalOut.iidSeq.filter(o => o.type === "touch").map(o => o.loc);
		const branchUseMap = finalOut.branchUseMap;

		let firstLoc;
		for (let loc in branchUseMap) {
			branchUseMap[loc].forEach(obj => {
				if (eidList.indexOf(obj.eid) >= 0) {
					obj.use.forEach(id => {
						if (writeVars.map(v => v.id).indexOf(id) >= 0) {
							if (!firstLoc || locSeq.indexOf(firstLoc) > locSeq.indexOf(loc)) firstLoc = loc;
						}
					});
				}
			});
		}

		let minPCLength;
		const pc = finalOut.alternatives.pathCondition;
		for (let i = 0; i < pc.length; i++) {
			if (locSeq.indexOf(pc[i].forkLoc) - locSeq.indexOf(firstLoc) >= 0) {
				minPCLength = i;
				break;
			}
		}

		const outputs = finalOut.outputs;
		for (let outId in outputs) {
			outputs[outId].forEach(obj => {
				if (eidList.indexOf(obj.eid) >= 0) {
					obj.use.forEach(id => {
						if (writeVars.map(v => v.id).indexOf(id) >= 0) {
							if (!minPCLength || minPCLength > obj.pcLength) minPCLength = obj.pcLength;
						}
					});
				}
			});
		}

		return minPCLength; // idxがminPCLengthのパス条件以降を反転してOK

	}


	_PClengthToWriteBlock (altA, altB, nodeSeqA, nodeSeqB) {
		let pcA = altA.pathCondition;
		let pcB = altB.pathCondition;

		// 該当ノードのところのインデックスを計算
		let iA, iB;
		let tmpSeqA = [].concat(nodeSeqA); //配列をコピー
		let tmpSeqB = [].concat(nodeSeqB); //配列をコピー
		for (iA = 0; iA < pcA.length; iA++) {
			// let blockIdA = this._infoA.getCondBlockId(pcA[iA].forkLoc);
			let blockIdA = this._infoA.getCondBlockId(pcA[iA].forkIid, pcA[iA].forkLoc);
			while (tmpSeqA.length > 0 && tmpSeqA[0].id != blockIdA) tmpSeqA.shift();
			if (tmpSeqA.length == 0) break;
		}
		for (iB = 0; iB < pcB.length; iB++) {
			// let blockIdB = this._infoB.getCondBlockId(pcB[iB].forkLoc);
			let blockIdB = this._infoB.getCondBlockId(pcB[iB].forkIid, pcB[iB].forkLoc);
			while (tmpSeqB.length > 0 && tmpSeqB[0].id != blockIdB) tmpSeqB.shift();
			if (tmpSeqB.length == 0) break;
		}

		if (iA < pcA.length && iB < pcB.length) return [iA, iB];
	}


	_genWriteDiffInput(file, altA, altB, writeVarsA, writeVarsB, iA, iB) {
		let slv = new Solver(undefined, altA, altB);
		let input = slv.generateWriteDiffInput(iA, iB, writeVarsA, writeVarsB);

		if (input) {
			return {
				id: this._nextID(),
				input: input,
				pathA: file.pathA,
				pathB: file.pathB,
				requestSeqA: file.requestSeqA,
				requestSeqB: file.requestSeqB,
				cbOrderA: {id: "init", executed: file.cbOrderA.executed},
				cbOrderB: {id: "init", executed: file.cbOrderB.executed}
			};
		}
	}


	_PClengthToCondBlock (altA, altB, nodeIdA, nodeIdB) {
		if (!nodeIdA || !nodeIdB) return;

		let pcA = altA.pathCondition;
		let pcB = altB.pathCondition;
		// 該当ノードのところのインデックスを計算
		let iA, iB;
		for (iA = 0; iA < pcA.length; iA++) {
			// let blockIdA = this._infoA.getCondBlockId(pcA[iA].forkLoc);
			let blockIdA = this._infoA.getCondBlockId(pcA[iA].forkIid, pcA[iA].forkLoc);
			if (blockIdA == nodeIdA && !pcA[iA].binder) break;
		}
		for (iB = 0; iB < pcB.length; iB++) {
			// let blockIdB = this._infoB.getCondBlockId(pcB[iB].forkLoc);
			let blockIdB = this._infoB.getCondBlockId(pcB[iB].forkIid, pcB[iB].forkLoc);
			if (blockIdB == nodeIdB && !pcB[iB].binder) break;
		}
		if (iA < pcA.length && iB < pcB.length) return [iA, iB];
	}


	_genCondDiffInput(file, altA, altB, iA, iB) {
		let slv = new Solver(undefined, altA, altB);
		let input = slv.generateCondDiffInput(iA, iB);

		if (input) {
			return {
				id: this._nextID(),
				input: input,
				pathA: file.pathA,
				pathB: file.pathB,
				requestSeqA: file.requestSeqA,
				requestSeqB: file.requestSeqB,
				cbOrderA: {id: "init", executed: file.cbOrderA.executed},
				cbOrderB: {id: "init", executed: file.cbOrderB.executed}
			};
		}
	}


	// 本当はCEPTをみて呼び出しがサボれるときもあるはず
	// とりあえず毎回呼びだし
	checkOutputs (file, finalOutA, finalOutB) {
		// console.log(finalOutA.outputs);
		// console.log(finalOutB.outputs);
		let slv = new Solver(undefined, finalOutA.alternatives, finalOutB.alternatives);
		this._diffInput = slv.compareOutputs(file, finalOutA.outputs, finalOutB.outputs);
	}


	addRequests(file, finalOutA, finalOutB, rewards) {
		const self = this;

		let requests = {};
		for (let name in finalOutA.requests) {
			requests[name] = {A: finalOutA.requests[name]};
		}
		for (let name in finalOutB.requests) {
			if (!requests[name]) requests[name] = {B: finalOutB.requests[name]};
			else requests[name].B = finalOutB.requests[name];
		}

		let newInput = {};
		for (let key in file.input) {
			newInput[key] = file.input[key];
		}
		newInput._boundA = finalOutA.alternatives.pathCondition.length;
		newInput._boundB = finalOutB.alternatives.pathCondition.length;

		// 上書きもありうる
		let writeValA = {};
		let writeValB = {};
		finalOutA.readWriteVars.filter(v => v.type === "write").forEach(v => {
			if (v.eid === "[val]undefined") return;
			if (!writeValA[v.name]) writeValA[v.name] = {};
			writeValA[v.name][v.eid] = v.val_c;
		});
		finalOutB.readWriteVars.filter(v => v.type === "write").forEach(v => {
			if (v.eid === "[val]undefined") return;
			if (!writeValB[v.name]) writeValB[v.name] = {};
			writeValB[v.name][v.eid] = v.val_c;
		});

		for (let name in requests) {
			let newRequestSeqA = finalOutA.requestSeq;
			let newRequestSeqB = finalOutB.requestSeq;

			if (requests[name].A) {
				newRequestSeqA = newRequestSeqA.concat([name]);
			}
			if (requests[name].B) {
				newRequestSeqB = newRequestSeqB.concat([name]);
			}

			// console.log(newRequestSeqA);
			let add = true;
			this._allRequestSeqQueue.concat(this._executedQueue.filter(r => r.queue === "request")).forEach(r => {
				if (r.addReq !== name) return;
				add = !(self._objectEqual(writeValA, r.writeValA) && self._objectEqual(writeValB, r.writeValB));
			});

			// console.log(add);
			if (add) {
				this._allRequestSeqQueue.push({
					id: this._nextID(),
					input: newInput,
					pathA: file.pathA,
					pathB: file.pathB,
					requestSeqA: newRequestSeqA,
					requestSeqB: newRequestSeqB,
					addReq: name,
					cbOrderA: {id: "init", executed: finalOutA.cbOrder.executed},
					cbOrderB: {id: "init", executed: finalOutB.cbOrder.executed},
					writeValA: writeValA,
					writeValB: writeValB,
					preRewards: rewards,
				});
			} else {
				console.log("一緒だった！！！");
			}
		}

		// console.log(Object.keys(writeValA));
		this._allRequestSeqQueue.forEach(r => {
			r.sharedNotStrict = self._symjsShared(r.writeValA, r.writeValB, r.addReq);
		});
		this._executedQueue.filter(r => r.queue === "request").forEach(r => {
			r.sharedNotStrict = self._symjsShared(r.writeValA, r.writeValB, r.addReq);
		});
		// console.log(this._allRequestSeqQueue);
		// console.log(this._executedQueue.filter(r => r.queue === "request"));
		// console.log("減らしていくよ");
		this._requestSeqQueue = this._allRequestSeqQueue.filter(r => {
			let result = true;
			// console.log(r.requestSeqA);
			// console.log(Object.keys(r.sharedNotStrict));
			self._executedQueue.filter(r => r.queue === "request").filter(r2 => r2.addReq === r.addReq).forEach(r2 => {
				// console.log(r2.requestSeqA);
				// console.log(Object.keys(r2.sharedNotStrict));
				if (self._objectEqual(r2.sharedNotStrict, r.sharedNotStrict)) {
					result = false;
					// console.log("これと一緒だった "+r2.requestSeqA);
					// console.log("削減した "+r.requestSeqA);
					// console.log(r.sharedNotStrict);
					// console.log(r2.sharedNotStrict);
					return;
				}
			});
			return result;
		});
		this._requestSeqQueue.forEach(r => {
			r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
		});
		// console.log(JSON.stringify(this._allRequestSeqQueue.map(r => {return {input: r.input, request: r.requestSeqA, var: Object.keys(r.sharedNotStrict)};}), null, 2));
		// console.log(JSON.stringify(this._requestSeqQueue.map(r => {return {input: r.input, request: r.requestSeqA, var: Object.keys(r.sharedNotStrict)};}), null, 2));
		// console.log(JSON.stringify(this._allRequestSeqQueue.map(r => {return {input: r.input, request: r.requestSeqA, var: r.sharedNotStrict};}), null, 2));
		// console.log(JSON.stringify(this._requestSeqQueue.map(r => {return {input: r.input, request: r.requestSeqA, var: r.sharedNotStrict};}), null, 2));
	}


	_getMinDist (distA, distB) {
		if (distA && distB) {
			if (distA !== -1 && distB !== -1)	return Math.min(distA, distB);
			else if (distA !== -1) return distB;
			else if (distB !== -1) return distA;
			else return -1;
		} else if (distA){
			return distA;
		} else if (distB){
			return distB;
		} else {
			return -1;
		}
	}


	// どの変更箇所でもいいから最短で到達できるとこの距離を返す
	// 到達できないやつは-1
	_calcMinDistance(info, blockId, targetList, uncoverd) { //実行済みの箇所も選択するか
		if (!blockId) return -1;
		const distanceList = targetList.filter(id => !uncoverd || !info.nodeMap[id].exec)
			.map(id => info.getCDGdist(blockId, id))
			.filter(dist => dist !== -1);
		return (distanceList.length > 0)? distanceList.reduce((a,b)=>Math.min(a,b)) : -1;
	}


	// _calcDistance(blockId, result) {
	_calcDistance(info, blockId, targetId, uncoverd) {
		if (!blockId) return;
		if (blockId && (!uncoverd || !info.nodeMap[targetId].exec)) {
			return info.getCDGdist(blockId, targetId);
		} else {
			return -1;
		}
	}


	objectSort(obj){
		if (!(obj instanceof Object) || obj == null) return obj;

		// まずキーのみをソートする
		var keys = Object.keys(obj).sort();

		// 返却する空のオブジェクトを作る
		var map = {};

		// ソート済みのキー順に返却用のオブジェクトに値を格納する
		const self = this;
		keys.forEach(function(key){
			map[key] = !(obj[key] instanceof Object) || obj[key] == null ? obj[key] : self.objectSort(obj[key]);
		});

		return map;
	}


	_objectEqual(obj1, obj2) {
		return JSON.stringify(this.objectSort(obj1)) === JSON.stringify(this.objectSort(obj2));
	}


	_readDiffValue (reads, writeMap) {
		// console.log(reads);
		for (let i in writeMap) {
			// console.log(writeMap[i]);
			// console.log(reads.indexOf(writeMap[i]));
			if (reads.indexOf(writeMap[i]) === -1) return true;
		}
		return false;
	}


	_symjsConflict(writeValA, writeValB, reqName) {
		let readsA = this._infoA.requestReads[reqName];
		let readsB = this._infoB.requestReads[reqName];
		let usePlaceMapA = this._infoA.requestUsePlaceMaps[reqName];
		let usePlaceMapB = this._infoB.requestUsePlaceMaps[reqName];

		// console.log(writeValA);
		// console.log(usePlaceMapA);
		let shared = {};
		for (let name in readsA) {
			if (name in writeValA && this._readDiffValue(readsA[name], writeValA[name])) {
				if (usePlaceMapA[name]) {
					shared[name] = {writeA: writeValA[name], usePlacesA: usePlaceMapA[name]};
					// } else if (name.indexOf("[global]") === 0) {
					// 	shared[name] = {writeA: writeValA[name], usePlacesA: ["global"]};
				}
			}
		}
		for (let name in readsB) {
			if (name in writeValB && this._readDiffValue(readsB[name], writeValB[name])) {
				if (usePlaceMapB[name]) {
					if (!shared[name]) {
						shared[name] = {writeB: writeValB[name], usePlacesB: usePlaceMapB[name]};
					}	else {
						shared[name].writeB = writeValB[name];
						shared[name].usePlacesB = usePlaceMapB[name];
					}
					// } else if (id.indexOf("[global]") === 0) {
					// 	if (!shared[id]) {
					// 		shared[id] = {writeB: writeValB[id], usePlacesB: ["global"]};
					// 	}	else {
					// 		shared[id].writeB = writeValB[id];
					// 		shared[id].usePlacesB = ["global"];
					// 	}
				}
			}
		}
		// console.log(shared);
		return shared;
	}


	_symjsShared(writeValA, writeValB, reqName) {
		let readsA = this._infoA.requestReads[reqName];
		let readsB = this._infoB.requestReads[reqName];

		let shared = {};
		for (let name in readsA) {
			if (name in writeValA && this._readDiffValue(readsA[name], writeValA[name])) {
				// console.log(name);
				// console.log(readsA[name]);
				// console.log(writeValA[name]);
				shared[name] = {A: writeValA[name]};
			}
		}
		for (let name in readsB) {
			if (name in writeValB && this._readDiffValue(readsB[name], writeValB[name])) {
				if (!shared[name]) {
					shared[name] = {B: writeValB[name]};
				}	else {
					shared[name].B = writeValB[name];
				}
			}
		}
		return shared;
	}


	_calcCbReadWrite (e, rw) {
		e.allCbReadVars = rw.filter(v => v.type === "read");
		e.allCbWriteVars = rw.filter(v => v.type === "write");

		let rwMap = {};
		rw.forEach(v => {
			if (!rwMap[v.id]) rwMap[v.id] = [];
			rwMap[v.id].push(v);
		});

		e.cbReadVars = [];
		e.cbWriteVars = [];
		Object.values(rwMap).forEach(arr => {
			const writes = arr.filter(v => v.type === "write");
			if (writes.length > 0) e.cbWriteVars.push(writes[writes.length-1]);
			arr.forEach(v => {
				if (v.type === "read") e.cbReadVars.push(v);
				if (v.type === "write") return;
			});
		});
	}


	updateCbOrderTree (file, finalOutA, finalOutB, rewards) {

		for (let i in finalOutA.eventRecord) {
			let e = finalOutA.eventRecord[i];
			let rw = finalOutA.readWriteVars.filter(v => v.eid === e.cbExecAsyncId);
			this._calcCbReadWrite(e, rw);
			// console.log(e.id);
			// console.log(e.cbReadVars.map(v => v.id));
			// console.log(e.cbWriteVars.map(v => v.id));
			// console.log(e.allCbReadVars.filter(v => e.cbReadVars.indexOf(v) === -1).map(v => v.id));
			// console.log(e.allCbWriteVars.filter(v => e.cbWriteVars.indexOf(v) === -1).map(v => v.id));
		}
		for (let i in finalOutB.eventRecord) {
			let e = finalOutB.eventRecord[i];
			let rw = finalOutB.readWriteVars.filter(v => v.eid === e.cbExecAsyncId);
			this._calcCbReadWrite(e, rw);
		}

		let cbOrderId = file.cbOrderA.id;
		if (cbOrderId ===  "init") {
			cbOrderId = this._cbOrders.length;
			this._cbOrders.push(new CallbackOrder(cbOrderId, file.input, file.pathA, file.pathB, finalOutA.requestSeq, finalOutB.requestSeq));
		}

		this._cbOrders[cbOrderId].tree.updateVisited(finalOutA.eventRecord, finalOutB.eventRecord);

		const hbA = new HBRelation(finalOutA.eventRecord, finalOutA.asyncTrace, this.options.logDir);
		const hbB = new HBRelation(finalOutB.eventRecord, finalOutB.asyncTrace, this.options.logDir);
		this._cbOrders[cbOrderId].tree.addBackTracks(finalOutA, finalOutB, hbA, hbB, rewards);

		// cbOrderの候補を計算
		this._cbOrderQueue = [];
		for (let i in this._cbOrders) {
			this._cbOrderQueue = this._cbOrderQueue.concat(this._cbOrders[i].getNewOrders());
		}
	}


	_calcMinDistanceFromUse (usePlacesA, usePlacesB) {

		if (!usePlacesA) usePlacesA = [];
		if (!usePlacesB) usePlacesB = [];

		// console.log(usePlacesA);
		// console.log(usePlacesB);

		let minDist = -1;
		for (let i in usePlacesA) {
			let distA = -1;
			if (usePlacesA[i].indexOf("out#") == 0) {
				// distA = 0; // ここどうしよう
			} else {
				let blockA = this._infoA.getCondBlockId(usePlacesA[i].split("###")[0], usePlacesA[i].split("###").slice(1).join("###"));
				distA = this._calcMinDistance(this._infoA, blockA, this._infoA.changedNodes, false);
				// console.log(blockA);
				// console.log(distA);
			}
			if (distA !== -1 && (minDist === -1 || minDist > distA)) minDist = distA;
		}
		for (let i in usePlacesB) {
			let distB = -1;
			if (usePlacesB[i].indexOf("out#") == 0) {
				// distB = 0; // ここどうしよう
			} else {
				let blockB = this._infoB.getCondBlockId(usePlacesB[i].split("###")[0], usePlacesB[i].split("###").slice(1).join("###"));
				distB = this._calcMinDistance(this._infoB, blockB, this._infoB.changedNodes, false);
			}
			if (distB !== -1 && (minDist === -1 || minDist > distB)) minDist = distB;
		}
		// console.log(minDist);
		return minDist;
	}


	_calcSymjsScore_diff (shared) {
		let score = -1;
		for (let id in shared) {
			// console.log("_calcSymjsScore_diff "+id);
			const v = shared[id];
			// console.log(v.usePlacesB);
			const minDist = this._calcMinDistanceFromUse(v.usePlacesA, v.usePlacesB);
			// score += minDist === -1 ? 1.0 / (minDist+1) : 0;
			if (minDist !== -1 || score > minDist) score = minDist;
			// console.log(minDist);
		}
		return score;
	}


	_calcConflictScore_diff (conflictsA, conflictsB) {
		let usePlaceMap = {};
		// console.log(conflictsA);
		conflictsA.forEach(o => {
			if (!usePlaceMap[o.id]) usePlaceMap[o.id] = {};
			usePlaceMap[o.id].A = o.usePlaces;
		});
		conflictsB.forEach(o => {
			if (!usePlaceMap[o.id]) usePlaceMap[o.id] = {};
			usePlaceMap[o.id].B = o.usePlaces;
		});

		let score = -1;
		for (let id in usePlaceMap) {
			// console.log("_calcConflictScore_diff "+id);
			// console.log(usePlaceMap[id]);
			const minDist = this._calcMinDistanceFromUse(usePlaceMap[id].A, usePlaceMap[id].B);
			// score += minDist === -1 ? 1.0 / (minDist+1) : 0;
			if (minDist !== -1 || score > minDist) score = minDist;
			// console.log(minDist);
		}
		return score;
	}


	_calcConflictScore(conflictsA, conflictsB) {
		let idList = [];
		conflictsA.concat(conflictsB).forEach(o => {
			let id = o.id.slice(o.id.indexOf("]")+1);
			if (idList.indexOf(id) === -1) idList.push(id);
		});
		return idList.length;
	}


	_selectBest (queue, key, up) {
		if (queue.length === 0) return;
		queue.sort((a, b) => up? a[key] - b[key] : b[key] - a[key]);
		const best = queue[0][key];
		return this._randomElem(queue.filter(c => c[key] === best));
	}


	// 変更ノードと反転したブランチのCDG上での距離を計算、最も近いものを実行
	// 変更ノードは全てをマージして扱う
	// 怪しいところ
	// cdg上での距離の扱い（計算が本当にあってるか、重み0のノードはどれか、interへの変換方法）
	// ノードのTFを完全に無視している、これで計算はあってるの？？
	_ASE2010() {
		const self = this;
		this._inputQueue.forEach(alt => {
			let distA = self._calcMinDistance(self._infoA, alt.blockIdA, self._infoA.changedNodes, false);
			let distB = self._calcMinDistance(self._infoB, alt.blockIdB, self._infoB.changedNodes, false);
			alt.distance = self._getMinDist(distA, distB);
		});
		let reachables = this._inputQueue.filter(x => x.distance >= 0);
		let selected = this._selectBest(reachables, "distance", true);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_ASE2010 ("+selected.queue+")";
		}
		return selected;
	}


	_selectRandomInput() {
		const selected = this._randomElem(this._inputQueue);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectRandomInput ("+selected.queue+")";
		}
		return selected;
	}


	// _selectExausitiveInput() {
	// 	const selected = this._inputQueue[0];
	// 	if (selected) {
	// 		this._removeFromQueue(selected);
	// 		selected.tag = "_selectExausitiveInput ("+selected.queue+")";
	// 	}
	// 	return selected;
	// }


	_selectExausitiveInput() {
		const executed = this._executedQueue.filter(p => p.queue === "input");
		const cands = this._inputQueue.filter(p => executed.map(q => q.id).indexOf(p.preId) >= 0);
		const selected = cands.length > 0 ? this._randomElem(cands) : this._randomElem(this._inputQueue);
		// const selected = cands[0];
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectExausitiveInput ("+selected.queue+")";
		}
		return selected;
	}


	// _selectHighRewardsInput() {
	// 	const self = this;
	// 	this._inputQueue.forEach(r => {
	// 		// console.log(r.input);
	// 		// console.log(r.requestSeqA);
	// 		// console.log(r.preRewards);
	// 		r.score = self._calcRewardsScore(r.preRewards);
	// 		// console.log(r.score);
	// 	});
	// 	let selected = this._selectBest(this._inputQueue, "score", false);
	// 	if (selected && selected.score <= 0) {
	// 		// 一番早めに追加されたやつ
	// 		selected = this._selectBest(this._inputQueue, "id", true);
	// 	}
	// 	if (selected) {
	// 		this._removeFromQueue(selected);
	// 		selected.tag = "_selectHighRewardsInput ("+selected.queue+")";
	// 	}
	// 	return selected;
	// }


	// _calcRewardsScore (preRewards) {
	// 	if (preRewards.length === 0) return 0;
	//
	// 	// return preRewards[preRewards.length-1];
	// 	let score = 0;
	// 	let weights = Object.keys(preRewards).map(idx => Math.pow(0.3, preRewards.length - idx));
	// 	let sum = 0;
	// 	for (let i in preRewards) {
	// 		score += preRewards[i] * weights[i];
	// 		sum += weights[i];
	// 	}
	// 	return score / sum;
	// }


	_selectFirstRequest () {
		// const cands = this._requestSeqQueue.filter(r => r.requestSeqA.length <= 1 && r.requestSeqB.length <= 1);
		const executedReq = this._executedQueue.filter(c => c.queue === "request");
		const candsA = this._requestSeqQueue.filter(r => r.requestSeqA.length === 1)
			.filter(r => executedReq.filter(r2 => r2.requestSeqA.length === 1 && r.requestSeqA[0] === r2.requestSeqA[0]).length === 0);
		const candsB = this._requestSeqQueue.filter(r => r.requestSeqB.length === 1)
			.filter(r => executedReq.filter(r2 => r2.requestSeqB.length === 1 && r.requestSeqB[0] === r2.requestSeqB[0]).length === 0);
		const cands = candsA.concat(candsB.filter(r => candsA.indexOf(r) === -1));
		let selected = this._randomElem(cands);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectFirstRequest ("+selected.queue+")";
		}
		return selected;
	}


	_selectRequestSeq_diff () {
		const self = this;
		// const cands = this._requestSeqQueue.filter(r => r.requestSeqA.length > 1 || r.requestSeqB.length > 1);
		this._requestSeqQueue.forEach(r => {
			// r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
			r.distance = self._calcSymjsScore_diff(r.shared);
		});
		let reachables = this._requestSeqQueue.filter(x => x.distance >= 0);
		let selected = this._selectBest(reachables, "distance", true);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectRequestSeq_diff ("+selected.queue+")";
		}
		return selected;
	}


	_selectRequestSeq() {
		// const self = this;
		// const cands = this._requestSeqQueue.filter(r => r.requestSeqA.length > 1 || r.requestSeqB.length > 1);
		this._requestSeqQueue.forEach(r => {
			// r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
			r.score = Object.keys(r.shared).length;
		});

		let selected = this._selectBest(this._requestSeqQueue, "score", false);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectRequestSeq ("+selected.queue+")";
		}
		return selected;
	}


	// _selectHighRewardsSeq() {
	// 	const self = this;
	// 	const cands = this._requestSeqQueue.filter(r => r.requestSeqA.length > 1 || r.requestSeqB.length > 1);
	// 	cands.forEach(r => {
	// 		// console.log(r.input);
	// 		// console.log(r.requestSeqA);
	// 		r.score = (Object.keys(r.shared).length+1) * self._calcRewardsScore(r.preRewards);
	// 		// console.log(r.score);
	// 	});
	// 	let selected = this._selectBest(cands, "score", false);
	// 	if (selected && selected.score <= 0) {
	// 		// 一番早めに追加されたやつ
	// 		selected = this._selectBest(cands, "id", true);
	// 	}
	// 	if (selected) {
	// 		this._removeFromQueue(selected);
	// 		selected.tag = "_selectHighRewardsSeq ("+selected.queue+")";
	// 	}
	// 	return selected;
	// }


	_selectRandomSeq () {
		const selected = this._randomElem(this._requestSeqQueue);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectRandomSeq ("+selected.queue+")";
		}
		return selected;
	}


	_selectCbOrder_diff () {
		const self = this;
		this._cbOrderQueue.forEach(o => {
			const dist = self._calcConflictScore_diff(o.conflictInfo.A.shared, o.conflictInfo.B.shared);
			o.distance = dist;
		});
		let reachables = this._cbOrderQueue.filter(x => x.distance >= 0);
		let selected = this._selectBest(reachables, "distance", true);
		if (selected) {
			this._removeFromQueue(selected);
			selected.id = this._nextID();
			selected.tag = "_selctCbOrder_diff ("+selected.queue+")";
		}
		return selected;
	}


	_selectCbOrder () {
		const self = this;
		this._cbOrderQueue.forEach(o => {
			const score = self._calcConflictScore(o.conflictInfo.A.shared, o.conflictInfo.B.shared);
			o.score = score;
		});
		let selected = this._selectBest(this._cbOrderQueue, "score", false);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectCbOrder ("+selected.queue+")";
		}
		return selected;
	}


	// _selectHighRewardsOrder() {
	// 	const self = this;
	// 	this._cbOrderQueue.forEach(o => {
	// 		const score = self._calcConflictScore(o.conflictInfo.A.shared, o.conflictInfo.B.shared);
	// 		o.score = (score+1) * self._calcRewardsScore(o.preRewards);
	// 	});
	// 	let selected = this._selectBest(this._cbOrderQueue, "score", false);
	// 	if (selected && selected.score <= 0) {
	// 		// 一番早めに追加されたやつ
	// 		selected = this._selectBest(this._cbOrderQueue, "id", true);
	// 	}
	// 	if (selected) {
	// 		this._removeFromQueue(selected);
	// 		selected.tag = "_selectHighRewardsOrder ("+selected.queue+")";
	// 	}
	// 	return selected;
	// }


	_selectRandomOrder () {
		let selected = this._randomElem(this._cbOrderQueue);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectRandomOrder ("+selected.queue+")";
		}
		return selected;
	}


	_probabiliticalGuideToDiff (threshold) {
		if (Math.random() > threshold) return; // 確率thresholdでランダム選択
		let selected = this._guideToDiff();
		if (selected) selected.tag = "_probabiliticalGuideToDiff"+threshold+" ("+selected.queue+")";
		return selected;
	}


	_guideToDiff () {
		const self = this;

		this._inputQueue.forEach(alt => {
			let distA = self._calcMinDistance(self._infoA, alt.blockIdA, self._infoA.changedNodes, false);
			let distB = self._calcMinDistance(self._infoB, alt.blockIdB, self._infoB.changedNodes, false);
			alt.distance = self._getMinDist(distA, distB);
		});

		this._requestSeqQueue.forEach(r => {
			// r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
			r.distance = self._calcSymjsScore_diff(r.shared);
		});

		this._cbOrderQueue.forEach(o => {
			const score = self._calcConflictScore_diff(o.conflictInfo.A.shared, o.conflictInfo.B.shared);
			o.distance = score;
		});

		let cands = this._inputQueue.concat(this._requestSeqQueue).concat(this._cbOrderQueue);
		let reachables = cands.filter(x => x.distance >= 0);
		let selected = this._selectBest(reachables, "distance", true);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_guideToDiff ("+selected.queue+")";
		}
		return selected;

	}


	// _selectUnseenRequestSeq () {
	// 	const self = this;
	// 	this._executedQueue.filter(r => r.queue === "request").forEach(r => {
	// 		r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
	// 	});
	// 	let cands = this._requestSeqQueue.filter(r => {
	// 		let result = true;
	// 		self._executedQueue.filter(r => r.queue === "request").filter(r2 => r2.addReq === r.addReq).forEach(r2 => {
	// 			// console.log(r2.requestSeqA);
	// 			// console.log(Object.keys(r2.sharedNotStrict));
	// 			if (self._objectEqual(Object.keys(r2.shared), Object.keys(r.shared))) {
	// 				result = false;
	// 				console.log("これと一緒だった "+r2.requestSeqA);
	// 				console.log("削減した "+r.requestSeqA);
	// 				// console.log(r.sharedNotStrict);
	// 				// console.log(r2.sharedNotStrict);
	// 				return;
	// 			}
	// 		});
	// 		return result;
	// 	});
	// 	cands.forEach(r => {
	// 		// r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
	// 		r.score = Object.keys(r.shared).length;
	// 	});
	//
	// 	let selected = this._selectBest(cands, "score", false);
	// 	if (selected) {
	// 		this._removeFromQueue(selected);
	// 		selected.tag = "_selectUnseenRequestSeq ("+selected.queue+")";
	// 	}
	// 	return selected;
	// }


	// _exploreUnseenEvent() {
	// 	const self = this;
	// 	this._executedQueue.filter(r => r.queue === "request").forEach(r => {
	// 		r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
	// 	});
	// 	let cands = this._requestSeqQueue.filter(r => {
	// 		let result = true;
	// 		self._executedQueue.filter(r => r.queue === "request").filter(r2 => r2.addReq === r.addReq).forEach(r2 => {
	// 			// console.log(r2.requestSeqA);
	// 			// console.log(Object.keys(r2.sharedNotStrict));
	// 			if (self._objectEqual(Object.keys(r2.shared), Object.keys(r.shared))) {
	// 			// if (self._objectEqual(r2.shared, r.shared)) {
	// 				result = false;
	// 				console.log("これと一緒だった "+r2.requestSeqA);
	// 				console.log("削減した "+r.requestSeqA);
	// 				// console.log(r.sharedNotStrict);
	// 				// console.log(r2.sharedNotStrict);
	// 				return;
	// 			}
	// 		});
	// 		return result;
	// 	});
	// 	cands.forEach(r => {
	// 		// r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
	// 		r.score = Object.keys(r.shared).length;
	// 	});
	//
	// 	this._cbOrderQueue.forEach(o => {
	// 		const score = self._calcConflictScore(o.conflictInfo.A.shared, o.conflictInfo.B.shared);
	// 		o.score = score;
	// 	});
	//
	// 	cands = cands.concat(this._cbOrderQueue);
	// 	let selected = this._selectBest(cands, "score", false);
	// 	if (selected) {
	// 		this._removeFromQueue(selected);
	// 		selected.tag = "_exploreUnseenEvent ("+selected.queue+")";
	// 	}
	// 	return selected;
	//
	// }


	_exploreEvent() {
		const self = this;
		this._requestSeqQueue.forEach(r => {
			// console.log(r.requestSeqA);
			// console.log(r.shared);
			// console.log(r.sharedNotStrict);
			// r.shared = self._symjsConflict(r.writeValA, r.writeValB, r.addReq);
			r.score = Object.keys(r.shared).length;
		});

		this._cbOrderQueue.forEach(o => {
			const score = self._calcConflictScore(o.conflictInfo.A.shared, o.conflictInfo.B.shared);
			o.score = score;
		});

		let cands = this._requestSeqQueue.concat(this._cbOrderQueue);
		let selected = this._selectBest(cands, "score", false);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_exploreEvent ("+selected.queue+")";
		}
		return selected;

	}


	_probabiliticalSelectRandom (threshold) {
		if (Math.random() > threshold) return; // 確率thresholdでランダム選択
		let cands = this._inputQueue.concat(this._requestSeqQueue).concat(this._cbOrderQueue);
		const selected = this._randomElem(cands);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_probabiliticalSelectRandom"+threshold+" ("+selected.queue+")";
		}
		return selected;
	}


	_selectRandom () {
		let cands = this._inputQueue.concat(this._requestSeqQueue).concat(this._cbOrderQueue);
		const selected = this._randomElem(cands);
		if (selected) {
			this._removeFromQueue(selected);
			selected.tag = "_selectRandom ("+selected.queue+")";
		}
		return selected;
	}


	_removeFromQueue(selected) {
		let idx;
		idx = this._inputQueue.indexOf(selected);
		if (idx >= 0) {
			this._inputQueue.splice(idx, 1);
			selected.queue = "input";
			if (this._infoA.nodeMap[selected.blockIdA]) this._infoA.nodeMap[selected.blockIdA].selected++;
			if (this._infoB.nodeMap[selected.blockIdB]) this._infoB.nodeMap[selected.blockIdB].selected++;
		}
		idx = this._requestSeqQueue.indexOf(selected);
		if (idx >= 0) {
			this._requestSeqQueue.splice(idx, 1);
			const idx2 = this._allRequestSeqQueue.indexOf(selected);
			this._allRequestSeqQueue.splice(idx2, 1);
			selected.queue = "request";
		}
		idx = this._cbOrderQueue.indexOf(selected);
		if (idx >= 0) {
			this._cbOrderQueue.splice(idx, 1);
			selected.queue = "callback";
			selected.id = this._nextID();
			selected.btObj.exec = true;
		}
		this._executedQueue.push(selected);
	}


	next (action) {
		// if (this._diffInput) {
		// 	// あれば確認用に実行したいかも
		// 	// 今は見つけた時点でプログラムが終了している
		// }

		// console.log(action);

		if (!action || this.options.learningEnv.random) {
			action = this._randomElem(this.options.learningEnv.actions);
		}

		console.log(action);

		let nextExec = this._actSwitch.select(action);

		// console.log(this._cbOrderQueue);

		if (nextExec) {
			this.nextExec = nextExec;

			// console.log("### exec next ###");
			console.log("");
			console.log(nextExec.tag);
			// console.log(nextExec.distance);
			// console.log(nextExec.score);
			console.log(nextExec.input);
			console.log(nextExec.requestSeqA);
			console.log(nextExec.requestSeqB);
			console.log(nextExec.cbOrderA);
			console.log(nextExec.cbOrderB);
			console.log(nextExec.conflictInfo);

			// if (process.env.LEARNING === "1") {
			// 	fs.appendFileSync(this._actionLogFile, [
			// 		"",
			// 		JSON.stringify(nextExec.input),
			// 		JSON.stringify(nextExec.requestSeqA),
			// 		JSON.stringify(nextExec.requestSeqB),
			// 		JSON.stringify(nextExec.cbOrderA.order ? nextExec.cbOrderA.order : "undef"),
			// 		JSON.stringify(nextExec.cbOrderB.order ? nextExec.cbOrderB.order : "undef"),
			// 		""
			// 	].join("\n"));
			// }

			this._execRecord.push(nextExec.tag);
			this._learningRecord.push(action+"###succ");

			this.rewards = 0;
			this._execStep++;
			nextExec.action = action;
			// console.log(action);

		} else {
			this._learningRecord.push(action+"###fail");
			// this.rewards += this._rewardsOpt.noInput;
			this.addRewards(this._rewardsOpt.noInput, "noInput");
		}

		return nextExec;
	}


	addRewards(reward, msg) {
		if (reward !== 0) console.log("add reward ("+msg+") +("+reward+")");
		this.rewards += reward;
	}


	length() {
		return this._inputQueue.length + this._requestSeqQueue.length + this._cbOrderQueue.length;
	}


	// 全ての変更ノードをカバーできたら終了
	// ここで探索を続けるかどうか決定
	continue() {
		// return this.changedCoverage() < 1; // 変更箇所に全て到達したら終了
		// return true;

		if (this._diffInput) {
			console.log("出力が違う！！！！！");
			console.log(this._diffInput);

			// this.rewards += this._rewardsOpt.find;
			this.addRewards(this._rewardsOpt.find, "find");
			// this._learning.update(this.rewards, true);

			this._printRecord("find", this._diffInput.msg);
			return false;

		} else if (this._execStep > this._maxExecStep) {

			// this.rewards += this._rewardsOpt.notFinish;
			this.addRewards(this._rewardsOpt.notFinish, "not find");
			// this._learning.update(this.rewards, true);

			this._printRecord("not find");
			return false;

		} else {
			return this.length() > 0;
		}
	}


	_printRecord (result, msg) {
		let total = {succ: {}, fail: {}};
		total.succ.sum = this._learningRecord.filter(s => s.split("###")[1] == "succ").length;
		total.fail.sum = this._learningRecord.filter(s => s.split("###")[1] == "fail").length;
		this._actions.forEach(a => {
			total.succ[a] = this._learningRecord.filter(s => s.split("###")[0] == a && s.split("###")[1] == "succ").length;
			total.fail[a] = this._learningRecord.filter(s => s.split("###")[0] == a && s.split("###")[1] == "fail").length;
		});
		fs.appendFileSync(this._learningRecordFile, JSON.stringify({
			result: result,
			total: total,
			time: performance.now() - startTime,
			// record: this._learningRecord
		}, null, 2)+"\n~~~\n");

		let exec = {};
		exec.sum = this._execRecord.length;
		this._execRecord.forEach(t => {
			if (!exec[t]) exec[t] = 0;
			exec[t]++;
		});
		fs.appendFileSync(this._execRecordFile, JSON.stringify({
			result: msg ? result+" "+msg : result,
			total: exec,
			time: performance.now() - startTime,
			episode: this.options.epsCount
		}, null, 2)+"\n~~~\n");
	}
}

export default Strategy;
