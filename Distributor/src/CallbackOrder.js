
class State {

	// evt0 ~ state ~ evt1
	// evt1 = seq[idx]
	// evt0 = evtA, evtB
	// evt1はvisitedに含まれる
	constructor (evtA, evtB, idx) {
		this.idx = idx; // seq[idx]が次の遷移に相当
		this.evtA = evtA; // どのイベントによって遷移してきた状態か
		this.evtB = evtB;
		this.visitedA = []; // 次の状態遷移で実行されたもの
		this.visitedB = [];
		this.backtracks = [];
		this.nexts = [];
	}

	toString () {
		return `A: ${this.evtA ? this.evtA.id : "-"}  B: ${this.evtB ? this.evtB.id : "-"}`;
	}

	addNext (evtA, evtB) {
		const next = new State(evtA, evtB, this.idx+1);
		this.nexts.push(next);
		next.parent = this;
		// console.log("add");
		// console.log(this.toString());
		// console.log(next.toString());
		return next;
	}

	markVisited (idA, idB) {
		if (idA && this.visitedA.indexOf(idA) === -1) this.visitedA.push(idA);
		if (idB && this.visitedB.indexOf(idB) === -1) this.visitedB.push(idB);
	}
}



class CallbackOrderTree{

	constructor () {
		this.root = new State(undefined, undefined, 0);
		this.states = [this.root];
		this.latest = [];
	}


	updateVisited (orderA, orderB) {
		this.latest = [];

		let look = this.root;
		let i = 0, j = 0;
		this.latest.push(look);

		// console.log(orderA);
		// console.log(orderB);
		console.log();
		// console.log(orderA.map(e => e.id));
		// console.log(orderB.map(e => e.id));

		while (i < orderA.length || j < orderB.length) {
			if (i < orderA.length && j < orderB.length && orderA[i].id === orderB[j].id) {
				look.markVisited(orderA[i].id, orderB[j].id);
				let next = look.nexts.filter(s => s.evtA && s.evtB && s.evtA.id === orderA[i].id && s.evtB.id === orderB[j].id)[0];
				if (!next) {
					next = look.addNext(orderA[i], orderB[j]);
					this.states.push(next);
				}
				look = next;
				i++;
				j++;
			} else if (j < orderB.length && !orderB[j].containedA) {
				look.markVisited(i<orderA.length ? orderA[i].id : undefined, orderB[j].id);
				let next = look.nexts.filter(s => !s.evtA && s.evtB && s.evtB.id === orderB[j].id)[0];
				if (!next) {
					next = look.addNext(undefined, orderB[j]);
					this.states.push(next);
				}
				look = next;
				j++;
			} else if (i < orderA.length && orderB.map(e => e.id).indexOf(orderA[i].id) === -1) {
				look.markVisited(orderA[i].id, i<orderB.length ? orderB[i].id : undefined);
				let next = look.nexts.filter(s => s.evtA && !s.evtB && s.evtA.id === orderA[i].id)[0];
				if (!next) {
					next = look.addNext(orderA[i], undefined);
					this.states.push(next);
				}
				look = next;
				i++;
			} else {
				console.log("どゆこと？？"+i+", "+j);
				console.log(orderA.map(e => e.id));
				console.log(orderB.map(e => e.id));
				throw new Error();
				// return;
			}

			this.latest.push(look);
		}

		console.log(this.latest.map(s => {
			if (s.evtA && s.evtB) return "[AB] "+s.evtA.id;
			if (s.evtA) return "[A] "+s.evtA.id;
			if (s.evtB) return "[B] "+s.evtB.id;
			return "root";
		}));
	}


	addBt (idx, leftSeqA, leftSeqB, info, rewards) {
		// console.log({seqA: leftSeqA, seqB: leftSeqB, info: info, preRewards: rewards});
		this.latest[idx].backtracks.push({seqA: leftSeqA, seqB: leftSeqB, info: info, preRewards: rewards, exec: false});
	}


	addBackTracks(finalOutA, finalOutB, hbA, hbB, rewards) {

		// console.log(finalOutA.eventRecord);
		// for (let i=0; i<finalOutA.eventRecord.length; i++) {
		// 	for (let j=i+1; j<finalOutA.eventRecord.length; j++) {
		// 		console.log(finalOutA.eventRecord[i].id+", "+finalOutA.eventRecord[j].id);
		// 		console.log(hbA._isHB(hbA._getEvent(finalOutA.eventRecord[i].cbExecAsyncId), hbA._getEvent(finalOutA.eventRecord[j].cbExecAsyncId)));
		// 	}
		// }


		for (let i=0; i<this.latest.length; i++) {
			// latest[i]の状態についてbackTrackを計算
			const stateSeqA = this.latest.filter(s => s.evtA);
			const stateSeqB = this.latest.filter(s => s.evtB);
			const idxA = stateSeqA.indexOf(this.latest[i+1]); // latest[i]の状態の直後の遷移のidx
			const idxB = stateSeqB.indexOf(this.latest[i+1]);

			const self = this;
			let enabled0A = [];
			let enabled1A = [];
			let enabled0B = [];
			let enabled1B = [];
			if (idxA !== -1) {
				enabled0A = hbA.getEnabled(finalOutA.eventRecord, idxA);
				enabled1A = hbA.getEnabled(finalOutA.eventRecord, idxA+1);
			}
			if (idxB !== -1) {
				enabled0B = hbB.getEnabled(finalOutB.eventRecord, idxB);
				enabled1B = hbB.getEnabled(finalOutB.eventRecord, idxB+1);
			}

			const disabledA = enabled0A.filter(e => enabled1A.map(e1 => e1.id).indexOf(e.id) === -1);
			const disabledB = enabled0B.filter(e => enabled1B.map(e1 => e1.id).indexOf(e.id) === -1);

			// evtA, evtBによって遷移する直前の状態を取得
			const moveIdxA = disabledA.map(e => this.latest.map(s => s.evtA ? s.evtA.id : undefined).indexOf(e.id))
				.filter(idx => idx >= 0);
			const moveIdxB = disabledB.map(e => this.latest.map(s => s.evtB ? s.evtB.id : undefined).indexOf(e.id))
				.filter(idx => idx >= 0);
			const moveIdx = moveIdxA.concat(moveIdxB.filter(idx => moveIdxA.indexOf(idx) === -1));

			moveIdx.forEach(move => {
				const leftStateSeq = [self.latest[move]].concat(self.latest.slice(i+1, move)).concat(self.latest.slice(move+1));
				const leftSeqA = leftStateSeq.filter(s => s.evtA).map(s => s.evtA.id);
				const leftSeqB = leftStateSeq.filter(s => s.evtB).map(s => s.evtB.id);

				const cbEidListA = leftStateSeq.slice(1).filter(s => s.evtA).map(s => s.evtA.cbExecAsyncId);
				const disabledConflictsA = self._checkDisabledConflicts(self.latest[move].evtA, cbEidListA, finalOutA);
				const cbEidListB = leftStateSeq.slice(1).filter(s => s.evtB).map(s => s.evtB.cbExecAsyncId);
				const disabledConflictsB = self._checkDisabledConflicts(self.latest[move].evtB, cbEidListB, finalOutB);
				const info = {
					type : "disabled",
					A: {
						evtId: self.latest[move].evtA ? self.latest[move].evtA.id : undefined,
						vars: disabledConflictsA
					},
					B: {
						evtId: self.latest[move].evtB ? self.latest[move].evtB.id : undefined,
						vars: disabledConflictsB
					},
				};
				self.addBt(i, leftSeqA, leftSeqB, info, rewards);
			});

			for (let j=i+1; j<this.latest.length; j++) {
				const idxA2 = stateSeqA.indexOf(this.latest[j+1]);
				const idxB2 = stateSeqB.indexOf(this.latest[j+1]);
				let linearA, linearB;
				if (idxA !== -1 && idxA2 !== -1) {
					linearA = hbA.getLinearizaitons(finalOutA.eventRecord, idxA, idxA2);
				}
				if (idxB !== -1 && idxB2 !== -1) {
					linearB = hbB.getLinearizaitons(finalOutB.eventRecord, idxB, idxB2);
				}

				let conflictsA = [];
				let conflictsB = [];
				let leftSeqA = stateSeqA.slice(idxA).map(s => s.evtA.id);
				let leftSeqB = stateSeqB.slice(idxB).map(s => s.evtB.id);
				let evtIdPairA, evtIdPairB;
				if (linearA) {
					conflictsA = this._checkConflict(stateSeqA[idxA].evtA, stateSeqA[idxA2].evtA, linearA.after, finalOutA);
					leftSeqA = linearA.before.map(e => e.id).concat([stateSeqA[idxA2].evtA.id, stateSeqA[idxA].evtA.id]).concat(linearA.after.map(e => e.id));
					evtIdPairA = [stateSeqA[idxA2].evtA.id, stateSeqA[idxA].evtA.id];
				}
				if (linearB) {
					conflictsB = this._checkConflict(stateSeqB[idxB].evtB, stateSeqB[idxB2].evtB, linearB.after, finalOutB);
					leftSeqB = linearB.before.map(e => e.id).concat([stateSeqB[idxB2].evtB.id, stateSeqB[idxB].evtB.id]).concat(linearB.after.map(e => e.id));
					evtIdPairB = [stateSeqB[idxB2].evtB.id, stateSeqB[idxB].evtB.id];
				}
				if (conflictsA.length + conflictsB.length > 0) {
					// console.log("i, j: "+i+", "+j);
					// console.log("idxA, idxA2: "+idxA+", "+idxA2+" "+evtPairA.map(e => e.id));
					// console.log("idxB, idxB2: "+idxB+", "+idxB2+" "+evtPairB.map(e => e.id));
					// console.log(linearA.before.map(e => e.id));
					// console.log(linearA.after.map(e => e.id));
					// console.log(linearB.before.map(e => e.id));
					// console.log(linearB.after.map(e => e.id));
					// console.log(conflictsA);
					// console.log(conflictsB);
					// console.log(leftSeqA);
					// console.log(leftSeqB);
					const info = {
						type : "conflict",
						A: {
							evtId0: evtIdPairA ? evtIdPairA[0] : undefined,
							evtId1: evtIdPairA ? evtIdPairA[1] : undefined,
							shared: conflictsA
						},
						B: {
							evtId0: evtIdPairB ? evtIdPairB[0] : undefined,
							evtId1: evtIdPairB ? evtIdPairB[1] : undefined,
							shared: conflictsB
						},
					};
					this.addBt(i, leftSeqA, leftSeqB, info, rewards);
				}
			}
		}
	}


	_checkDisabledConflicts (evt, cbEidList, finalOut) {
		if (!evt) return [];
		const usePlaceMap = this._genUsePlaceMap(cbEidList, finalOut.branchUseMap, finalOut.outputs);
		let ret = [];
		evt.cbWriteVars.forEach(v => {
			if (usePlaceMap[v]) ret.push({id: v.id, usePlaces: usePlaceMap[v]});
		});
		return ret;
	}


	_isConflict(v1, v2, usePlaceMap, isSame) {
		if (v1.id === v2.id) {
			// console.log(v1.id);
			// console.log(v1.val_c);
			// console.log(v2.val_c);
			if (isSame || v1.val_c !== v2.val_c) {
				// console.log(v1.id);
				// console.log(v1.val_c);
				// console.log(v2.val_c);
				// console.log(usePlaceMap[v1.id]);
				if (usePlaceMap[v1.id]) {
					return {id: v1.id, usePlaces: usePlaceMap[v1.id]};
					// return {id: v1.id, e1: v1, e2: v2, usePlaces: usePlaceMap[v1.id]};
				// } else if (v1.id.indexOf("[global]") === 0) {
				// 	return {id: v1.id, usePlaces: ["global"]};
				}
			}
		}
	}


	_genUsePlaceMap (eidList, branchUseMap, outputs) {
		// console.log(eidList);
		// console.log(branchUseMap);
		// console.log(outputs);
		let usePlaceMap = {};
		for (let loc in branchUseMap) {
			branchUseMap[loc].forEach(obj => {
				if (eidList.indexOf(obj.eid) >= 0) {
					if (obj.execT && obj.execF) {
						console.log(loc+"の"+branchUseMap[loc].indexOf(obj)+"は探索済み");
						return;
					}
					obj.use.forEach(id => {
						if (!usePlaceMap[id]) usePlaceMap[id] = [];
						if (usePlaceMap[id].indexOf(loc) === -1) usePlaceMap[id].push(loc);
					});
				}
			});
		}
		for (let outId in outputs) {
			outputs[outId].forEach(obj => {
				if (eidList.indexOf(obj.eid) >= 0) {
					obj.use.forEach(id => {
						if (!usePlaceMap[id]) usePlaceMap[id] = [];
						if (usePlaceMap[id].indexOf("out#"+outId) === -1) usePlaceMap[id].push("out#"+outId);
					});
				}
			});
		}
		// console.log(usePlaceMap);
		return usePlaceMap;
	}


	_checkConflict (e1, e2, after, finalOut) {

		// console.log(e1.id);
		// console.log(e2.id);

		const read1 = e1.cbReadVars;
		const read2 = e2.cbReadVars;
		const write1 = e1.cbWriteVars;
		const write2 = e2.cbWriteVars;
		// const rw1 = e1.cbReadVars.concat(e1.cbWriteVars);
		// const rw2 = e2.cbReadVars.concat(e2.cbWriteVars);

		// e1, e2, afterによって使用する範囲を指定
		const cbEidList = [e1.cbExecAsyncId, e2.cbExecAsyncId].concat(after.map(e => e.cbExecAsyncId));
		const usePlaceMap = this._genUsePlaceMap(cbEidList, finalOut.branchUseMap, finalOut.outputs);

		// console.log(usePlaceMap);

		// console.log(finalOut.branchUseMap);
		// console.log(read1.map(v => v.id));
		// console.log(read2.map(v => v.id));
		// console.log(write1.map(v => v.id));
		// console.log(write2.map(v => v.id));
		// console.log(usePlaceMap);

		let shared = [];
		// for (let i in rw1) {
		// 	for (let j in rw2) {
		// 		let conf = this._isConflict(rw1[i], rw2[j], usePlaceMap);
		// 		if (conf && shared.map(o => o.id).indexOf(conf.id) === -1) shared.push(conf);
		// 	}
		// }
		for (let i in write1) {
			for (let j in read2) {
				let conf = this._isConflict(write1[i], read2[j], usePlaceMap, true);
				if (conf && shared.map(o => o.id).indexOf(conf.id) === -1) shared.push(conf);
			}
		}
		for (let i in read1) {
			for (let j in write2) {
				let conf = this._isConflict(read1[i], write2[j], usePlaceMap, false);
				if (conf && shared.map(o => o.id).indexOf(conf.id) === -1) shared.push(conf);
			}
		}
		for (let i in write1) {
			for (let j in write2) {
				let conf = this._isConflict(write1[i], write2[j], usePlaceMap, false);
				if (conf && shared.map(o => o.id).indexOf(conf.id) === -1) shared.push(conf);
			}
		}
		return shared;
	}


	getNewOrders () {
		let newOrders = [];
		for (let i in this.states) {
			let s = this.states[i];
			// console.log(s.toString());
			// console.log(s.visitedA);
			// console.log(s.visitedB);
			let unexplored = s.backtracks.filter(obj => !obj.exec).filter(obj => {
				if (obj.seqA[0] && obj.seqB[0]) {
					return s.visitedA.indexOf(obj.seqA[0]) === -1 || s.visitedB.indexOf(obj.seqB[0]) === -1;
				} else if (obj.seqA[0]) {
					return s.visitedA.indexOf(obj.seqA[0]) === -1;
				} else if (obj.seqB[0]) {
					return s.visitedB.indexOf(obj.seqB[0]) === -1;
				}
			});
			for (let j in unexplored) {
				let orderA = [].concat(unexplored[j].seqA);
				let orderB = [].concat(unexplored[j].seqB);
				// console.log(orderA);
				// console.log(orderB);
				let parent = s;
				while (parent) {
					if (parent.evtA) orderA.unshift(parent.evtA.id);
					if (parent.evtB) orderB.unshift(parent.evtB.id);
					parent = parent.parent;
				}
				// console.log(unexplored[j].type);
				// console.log(orderA);
				// console.log(orderB);
				newOrders.push({orderA: orderA, orderB: orderB, info: unexplored[j].info, btObj: unexplored[j], preRewards: unexplored[j].preRewards});
			}
		}
		// console.log(newOrders);
		return newOrders;
	}
}



class CallbackOrder {

	constructor (id, input, pathA, pathB, requestSeqA, requestSeqB) {
		this.id = id;
		this.input = input;
		this.pathA = pathA;
		this.pathB = pathB;
		this.requestSeqA = requestSeqA;
		this.requestSeqB = requestSeqB;
		this.tree = new CallbackOrderTree();
	}


	getNewOrders () {
		const self = this;
		let newOrders = this.tree.getNewOrders();
		newOrders = newOrders.map(obj => {
			const cand = {
				cbOrderA: {id: self.id, order: obj.orderA},
				cbOrderB: {id: self.id, order: obj.orderB},
				input: self.input,
				pathA: self.pathA,
				pathB: self.pathB,
				requestSeqA: self.requestSeqA,
				requestSeqB: self.requestSeqB,
				conflictInfo: obj.info,
				preRewards: obj.preRewards,
				btObj: obj.btObj
			};
			return cand;
		});
		// console.log(newOrders.map(o => o.cbOrderA.order));
		return newOrders;
	}
}

export default CallbackOrder;
