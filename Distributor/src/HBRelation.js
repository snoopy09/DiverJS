
const fs = require("fs");
const child_process = require("child_process");


// ここでのidは実行時にasync_hooksで取得したid
// 各実行ごとに計算するのでこれでおっけー

class HBRelation {

	constructor (eventRecord, trace, logDir) {

		this.dir = logDir + "/HBjson";

		// this.atomicSeqs = [];
		this.elements = [];
		// console.log(eventRecord);
		trace = this._arrangeTrace(eventRecord, trace);
		// console.log(trace);

		this._genElements(trace);
		// console.log(this.elements);
		this._calcPriority();

		// console.log(trace);
		// console.log(eventRecord.map(e => e.cbExecAsyncId));
		this._calcRelations(eventRecord);

		// console.log(this.relations.filter(pair => {
		// 	// console.log(pair);
		// 	return pair[0].type === "event" && pair[1].type === "event";
		// }));

		// this._calcAtomicSeqs();
	}

	// 関係ないイベントの情報は取り除く…？
	_calcRelations (eventRecord) {

		// console.log(this.elements);

		const jsonNodes = this.elements.map(e => {
			return {
				type: e.type,
				id: typeof e.id === "number" ? e.id.toString(10) : e.id,
				listenerId: e.listenerId ? e.listenerId.toString(10) : undefined,
				triggeredId : e.triggeredId ? e.triggeredId.toString(10) : undefined,
				elemId : e.elemId.toString(10),
				priority : e.priority
			};
		});
		const jsonEvts = eventRecord.map(e => {
			return {
				name : e.name,
				cbExecAsyncId : e.cbExecAsyncId.toString(10)
			};
		});

		fs.writeFileSync(this.dir+"/node_data.json", JSON.stringify(jsonNodes, null, 2));
		fs.writeFileSync(this.dir+"/evt_data.json", JSON.stringify(jsonEvts, null, 2));

		const args = ["./scripts/calcHB", this.dir+"/node_data.json", this.dir+"/evt_data.json", this.dir+"/output.json"];

		child_process.execSync(args.join(" "));

		this.relationMap = JSON.parse(fs.readFileSync(this.dir+"/output.json"));
		this.eventAsyncIdList = eventRecord.map(e => e.cbExecAsyncId);
		// console.log(this.eventAsyncIdList);

		// for(let i in eventRecord) {
		// 	for (let j in eventRecord) {
		// 		if (j > i) {
		// 			console.log(eventRecord[i].id+", "+eventRecord[j].id+": "+this.relationMap[i][j]);
		// 		}
		// 	}
		// }
	}



	_isHB (e1, e2) {
		// cbExecAsyncIdで比較
		const idx1 = this.eventAsyncIdList.indexOf(e1.cbExecAsyncId);
		const idx2 = this.eventAsyncIdList.indexOf(e2.cbExecAsyncId);
		// console.log(idx1+", "+idx2);
		return this.relationMap[idx1][idx2];
		// return this.relations.filter(r => r[0] === e1 && r[1] === e2).length > 0;
	}

	// _isAtomic (id1, id2) {
	// 	for (let i in this.atomicSeqs) {
	// 		let seq = this.atomicSeqs[i];
	// 		for (let j=0; j < seq.length-1; j++) {
	// 			if (seq[j].id === id1 && seq[j+1].id === id2) {
	// 				return true;
	// 			}
	// 		}
	// 	}
	// 	return false;
	// }
	//
	// _getAtomicSeq (id) {
	// 	for (let i in this.atomicSeqs) {
	// 		const idx = this.atomicSeqs[i].map(e => e.id).indexOf(id);
	// 		if (idx >= 0) {
	// 			return {seq: this.atomicSeqs[i], idx: idx};
	// 		}
	// 	}
	// }

	// idx番目に実行可能なイベントを返す(idxは0からスタート)
	getEnabled (order, idx) {
		// アトミックに呼び出されるイベントが存在するかどうかチェック
		// if (idx !== 0 && this._isAtomic(order[idx-1].cbExecAsyncId, order[idx].cbExecAsyncId)) {
		// 	return [order[idx]];
		// } else {
		let list = [];
		let enable;
		for (let i=idx; i<order.length; i++) {
			enable = true;
			for (let j=idx; j<i; j++) {
				if (this._isHB(order[j], order[i])) enable = false;
			}
			if (enable) {
				list.push(order[i]);
			}
		}
		return list;
		// }
	}

	// ちょっとアルゴリズム違う説濃厚
	getLinearizaitons (order, i, j) {
		// iとjがHBなのはダメ
		if (this._isHB(order[i], order[j])) return;

		// // iまたはjが他のアトミックなイベントでガードされていないかチェック
		// const atomic_i = this._getAtomicSeq(order[i].cbExecAsyncId);
		// if (atomic_i && atomic_i.idx < atomic_i.seq.length-1 && atomic_i.seq[atomic_i.idx+1].id !== order[j].cbExecAsyncId) return;
		// const atomic_j = this._getAtomicSeq(order[j].cbExecAsyncId);
		// if (atomic_j && atomic_j.idx > 0 && atomic_j.seq[atomic_j.idx-1].id !== order[i].cbExecAsyncId) return;

		// HB(i, k)かつHB(k, j)が存在するかどうか確認
		const before_j = order.slice(i+1, j).filter(e => this._isHB(e, order[j]));
		const after_i_before_j = before_j.filter(e => this._isHB(order[i], e));
		if (after_i_before_j.length > 0) return;

		let newBeforeElems = before_j;
		// let newBeforeElems = [];
		// for (let k in before_j) {
		// 	let atomic = this._getAtomicSeq(before_j[k].cbExecAsyncId);
		// 	if (atomic) {
		// 		for (let l in atomic.seq) {
		// 			let add = order.filter(e => e.cbExecAsyncId === atomic[l].seq)[0]; // これで大丈夫？
		// 			newBeforeElems.push(add);
		// 		}
		// 	} else {
		// 		newBeforeElems.push(before_j[k]);
		// 	}
		// }

		let add = true;
		while (add) {
			// newBeforeElemsの中のあるイベントよりも先に起きていないといけないものを追加
			add = false;
			for (let k in newBeforeElems) {
				const mustHappens = order.slice(i+1, j)
					.filter(e => this._isHB(e, newBeforeElems[k]));
				if (mustHappens.length > 0) {
					mustHappens.forEach(e => {
						if (newBeforeElems.indexOf(e) == -1) {
							newBeforeElems.push(e);
							add = true;
						}
					});
					break;
				}
			}
		}

		let newBefore = [];
		let newAfter = [];
		for (let k=i; k<order.length; k++) {
			if (newBeforeElems.indexOf(order[k]) >= 0) newBefore.push(order[k]);
			else if (k !== i && k !== j) newAfter.push(order[k]);
		}
		return {before: newBefore, after: newAfter};
	}

	// _addRelation (before, after) {
	// 	if (!before || !after) {
	// 		// console.log("ないよ");
	// 		// console.log(before);
	// 		// console.log(after);
	// 		return;
	// 	}
	// 	if (!this._isHB(before, after)) {
	// 		this.relations.push([before, after]);
	// 	}
	// }

	_arrangeTrace(eventRecord, trace) {
		// これでid26のコールバックをid48のtickObjectの中での実行に変更
		// 26はcbAsyncId
		// 48がcbExecAsyncId
		// { type: 'register',
		//   id: 26,
		//   listenerId: 48,
		//   typeInfo: 'TickObject' }


		// console.log(JSON.stringify(eventRecord, null, 2));

		// 2段階で登録されている奴に対処できていないねえ

		let t_id = 0;
		trace.forEach(t => {
			// console.log(t);
			t.traceId = t_id++;
		});

		let watched = [];
		const startOrigianl = trace.filter(t => t.type === "handling" && t.info === "startOriginalExecution")[0];
		const endOrigianl = trace.filter(t => t.type === "handling" && t.info === "endOriginalExecution")[0];
		if (!endOrigianl) {
			watched.concat(trace.filter(t => t.traceId > startOrigianl.traceId));
		} else {
			watched.concat(trace.filter(t => t.traceId > startOrigianl.traceId && t.traceId < endOrigianl.traceId));
		}


		eventRecord.filter(e => e.name.indexOf("[req]") === 0).forEach(e => {
			// console.log(e.id+", "+e.asyncId+", "+e.cbAsyncId+", "+e.cbExecAsyncId);
			let execRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbExecAsyncId)[0];
			// console.log(execRegister);
			// let cbRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbAsyncId)[0];
			// console.log(cbRegister);

			execRegister.id = 0;
			execRegister.typeInfo = "request";
			watched.push(execRegister);
		});

		eventRecord.filter(e => e.name.indexOf("[req]") !== 0 && e.name.indexOf("EVENT") !== 0).forEach(e => {
			// console.log(e.id+", "+e.asyncId+", "+e.cbAsyncId+", "+e.cbExecAsyncId);
			// let execRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbExecAsyncId)[0];
			// console.log(execRegister);
			let cbRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbAsyncId)[0];
			// console.log(cbRegister);

			const cbRegister_copy = JSON.parse(JSON.stringify(cbRegister));
			cbRegister_copy.id = e.asyncId;
			cbRegister_copy.listenerId = e.cbExecAsyncId;
			cbRegister_copy.eventId = e.id;
			watched.push(cbRegister_copy);
			// trace = trace.filter(t => t.type !== "register" || t.listenerId !== e.cbExecAsyncId);
		});

		eventRecord.filter(e => e.name.indexOf("EVENT") === 0).forEach(e => {
			// console.log(e.id+", "+e.asyncId+", "+e.cbAsyncId+", "+e.cbExecAsyncId);
			let execRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbExecAsyncId)[0];
			// console.log(execRegister);
			let cbRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbAsyncId)[0];
			// console.log(cbRegister);

			execRegister.id = cbRegister.listenerId;
			watched.push(execRegister);
			if (watched.indexOf(cbRegister) === -1) watched.push(cbRegister);
			let listenerId = cbRegister.id;
			while (watched.filter(e => e.listenerId === listenerId).length === 0) {
				const eventRegister = trace.filter(t => t.type === "register" && t.listenerId === listenerId)[0];
				// console.log(eventRegister);
				if (eventRegister && watched.indexOf(eventRegister) === -1) {
					watched.push(eventRegister);
					listenerId = eventRegister.id;
				} else {
					break;
				}
			}
			// const cbRegister_copy = JSON.parse(JSON.stringify(cbRegister));
			// // if (replaceMap[cbRegister_copy.id]) cbRegister_copy.id = replaceMap[cbRegister_copy.id];
			// cbRegister_copy.listenerId = e.cbExecAsyncId;
			// cbRegister_copy.eventId = e.id;
			// watched.push(cbRegister_copy);
			// trace = trace.filter(t => t.type !== "register" || t.listenerId !== e.cbExecAsyncId);
			// // replaceMap[cbRegister_copy.listenerId] = cbRegister_copy.id;
			// if (watched.filter(e => e.listenerId === cbRegister_copy.id).length === 0) {
			// 	const eventRegister = trace.filter(t => t.type === "register" && t.listenerId === cbRegister_copy.id)[0];
			// 	console.log(eventRegister);
			// 	if (eventRegister) watched.push(eventRegister);
			// }
		});

		const interestingIds = watched.map(e => e.id).concat(eventRecord.map(e => e.cbExecAsyncId));
		watched = watched.concat(trace.filter(t => interestingIds.indexOf(t.id) >= 0 && (t.type === "start" || t.type === "end")));

		// let add = false;
		// trace.forEach(t => {
		// 	// console.log(t);
		// 	if (t.type === "handling") {
		// 		switch (t.info) {
		// 		case "startOriginalExecution": case "startExecRequest": case "startExecCallback":
		// 			add = true;
		// 			break;
		// 		case "endOriginalExecution": case "endExecRequest": case "endExecCallback":
		// 			add = false;
		// 			break;
		// 		}
		// 	} else {
		// 		if (add) watched.push(t);
		// 	}
		// });



		// let length = 0;
		// while (length < watched.length) {
		// 	length = watched.length;
		// 	let registered = watched.filter(t => t.type === "register" && t.typeInfo !== "request").map(t => t.listenerId);
		// 	trace.forEach(t => {
		// 		if (registered.indexOf(t.id) >= 0 && watched.indexOf(t) === -1) {
		// 			watched.push(t);
		// 		}
		// 	});
		// }

		watched.sort((a, b) => {
			if (a.traceId != b.traceId) return a.traceId - b.traceId;
			else return a.asyncId - b.asyncId; // なんだこれ
		});
		watched.forEach(t => {delete t.traceId;});

		// console.log(watched);
		// この削り方がいいのかは謎
		// for (let i = 0; i< watched.length; i++) {
		// 	if (watched[i].type === "start" && watched[i+1] && watched[i+1].type === "end") {
		// 		watched.splice(i, 2);
		// 		i -= 2;
		// 	}
		// }
		// console.log(watched);


		return watched;

		// console.log(watched);

		// const dummys = trace.filter(t => t.type === "dummy");
		// const dummyTraces = trace.filter(t => dummys.indexOf(t.id) >= 0 || (t.type === "register" && dummys.indexOf(t.listenerId) >= 0));
		//
		// console.log(dummyTraces);
		// console.log(trace.filter(t => dummyTraces.indexOf(t) === -1));

		// コールバックの登録は追加
		// let contains = eventRecord.map(e => {
		// 	// console.log(e.id);
		// 	// console.log(e.cbAsyncId+", "+e.cbExecAsyncId);
		// 	// console.log(trace.filter(t => t.id === e.cbAsyncId || t.triggeredId === e.cbAsyncId || t.listenerId === e.cbAsyncId));
		// 	// console.log(trace.filter(t => t.id === e.cbExecAsyncId || t.triggeredId === e.cbExecAsyncId || t.listenerId === e.cbExecAsyncId));
		//
		// 	if (e.name.indexOf("[req]") === 0) {
		// 		// 本当のtypeがどうなるのかわからん
		// 		// イベントに紐づいたコールバックがどうなるのか調べなきゃ
		// 		return {type: "register", id: 0, listenerId: e.cbExecAsyncId, typeInfo: "request"};
		// 	} else {
		// 		let execRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbExecAsyncId)[0];
		// 		let cbRegister = trace.filter(t => t.type === "register" && t.listenerId === e.cbAsyncId)[0];
		// 		// console.log(e.asyncId);
		// 		// console.log(cbRegister);
		// 		// console.log(execRegister);
		// 		return {type: "register", id: e.asyncId, listenerId: e.cbExecAsyncId, typeInfo: cbRegister.typeInfo};
		// 	}
		// });
		//
		// const lookIdList = [0, 1].concat(eventRecord.map(e => e.cbExecAsyncId));
		// // console.log(lookIdList);
		// contains = contains.concat(trace.filter(t => lookIdList.indexOf(t.id) >= 0));
		//
		// // console.log(contains);
		//
		// // 見落としはない？
		//
		// // let length;
		// // while (!length || length < contains.length) {
		// // 	lengths = contains.length;
		// // 	contains.forEach
		// //
		// // }
		//
		// return contains;


		// let interestingIds = [];
		// for (let i in eventRecord) {
		// 	if (interestingIds.indexOf(eventRecord[i].asyncId) === -1) {
		// 		interestingIds.push(eventRecord[i].asyncId);
		// 	}
		// 	if (interestingIds.indexOf(eventRecord[i].cbAsyncId) === -1) {
		// 		interestingIds.push(eventRecord[i].cbAsyncId);
		// 	}
		// 	if (interestingIds.indexOf(eventRecord[i].cbExecAsyncId) === -1) {
		// 		interestingIds.push(eventRecord[i].cbExecAsyncId);
		// 	}
		// }
		//
		// let reduced = [];
		// for (let i in trace) {
		// 	if (interestingIds.indexOf(trace[i].id)) {
		// 		reduced.push(trace[i]);
		// 	} else if (trace[i].type == "register" && interestingIds.indexOf(trace[i].listenerId)) {
		// 		reduced.push(trace[i]);
		// 	} else if (trace[i].type == "trigger" && interestingIds.indexOf(trace[i].triggeredId)) {
		// 		reduced.push(trace[i]);
		// 	}
		// }
		// return reduced;
	}

	_getEvent(id) {
		let list = this.elements.filter(e => e.type === "event");
		for (let i in list) {
			if (list[i].id === id) return list[i];
		}
	}
	//
	// _getStart(id) {
	// 	let list = this.elements.filter(e => e.type === "start");
	// 	for (let i in list) {
	// 		if (list[i].id === id) return list[i];
	// 	}
	// }
	//
	// _getEnd(id) {
	// 	let list = this.elements.filter(e => e.type === "end");
	// 	for (let i in list) {
	// 		if (list[i].id === id) return list[i];
	// 	}
	// }
	//
	// // idがなくても取れるはず
	// _getRegister(listenerId) {
	// 	let list = this.elements.filter(e => e.type === "register");
	// 	for (let i in list) {
	// 		if (list[i].listenerId === listenerId) return list[i];
	// 	}
	// }
	//
	// _getTrigger(id, triggeredId) {
	// 	let list = this.elements.filter(e => e.type === "trigger");
	// 	for (let i in list) {
	// 		if (list[i].id === id && list[i].triggeredId == triggeredId) return list[i];
	// 	}
	// }

	_genElements (trace) {
		let elemId = 0;
		this.elements.push({type: "event", id: 0, typeInfo: "global?", elemId: elemId++});
		this.elements.push({type: "event", id: 1, typeInfo: "main?", elemId: elemId++});
		for (let i in trace) {
			// console.log(trace[i]);
			if (!this._getEvent("event", trace[i].id))
				switch (trace[i].type) {
				case "start":
					// startしてるのにtriggerがない時はlibuvによってtriggerされたものとみなす
					if (this.elements.filter(e => e.type === "trigger" && e.triggeredId === trace[i].id).length === 0) {
						this.elements.push({type: "trigger", id: "libuv", triggeredId: trace[i].id, elemId: elemId++});
					}
					this.elements.push({type: "start", id: trace[i].id, elemId: elemId++});
					break;
				case "end":
					this.elements.push({type: "end", id: trace[i].id, elemId: elemId++});
					break;
				case "register":
				// この辺わかんない
					this.elements.push({type: "event", id: trace[i].listenerId, typeInfo: trace[i].typeInfo, elemId: elemId++});
					this.elements.push({type: "register", id: trace[i].id, listenerId: trace[i].listenerId, elemId: elemId++});

					// e.g. process.nextTick, setImmediate, and function resolve in promise
					if (["Immediate", "TickObject", "Timeout", "TIMERWRAP", "PROMISE"].indexOf(trace[i].typeInfo) >= 0) {
						this.elements.push({type: "trigger", id: trace[i].id, triggeredId: trace[i].listenerId, elemId: elemId++});
					}
					break;
				case "resolve":
					// this._getEvent(trace[i].triggeredId).promiseEvt = true;
					this.elements.push({type: "trigger", id: trace[i].id, triggeredId: trace[i].triggeredId, elemId: elemId++});
					break;
				}
		}
	}

	_calcPriority () {
		// バージョン8.xのドキュメントより
		// https://nodejs.org/docs/latest-v8.x/api/async_hooks.html#async_hooks_init_asyncid_type_triggerasyncid_resource
		//
		// FSEVENTWRAP, FSREQWRAP, GETADDRINFOREQWRAP, GETNAMEINFOREQWRAP, HTTPPARSER,
		// JSSTREAM, PIPECONNECTWRAP, PIPEWRAP, PROCESSWRAP, QUERYWRAP, SHUTDOWNWRAP,
		// SIGNALWRAP, STATWATCHER, TCPCONNECTWRAP, TCPSERVERWRAP, TCPWRAP, TIMERWRAP,
		// TTYWRAP, UDPSENDWRAP, UDPWRAP, WRITEWRAP, ZLIB, SSLCONNECTION, PBKDF2REQUEST,
		// RANDOMBYTESREQUEST, TLSWRAP, Timeout, Immediate, TickObject
		// PROMISEもあるらしい

		this.elements.filter(e => e.type == "event").forEach(e => {
			let priority = 4; // わからんやつは4に
			switch (e.typeInfo) {
			case "TickObject": case "PROMISE":
				priority = 0;
				break;
			case "Immediate":
				priority = 1;
				break;
			case "Timeout": case "TIMERWRAP":
				priority = 2;
				break;
			case "FSREQWRAP":
				priority = 3;
				break;
			default:
				// console.log(e.typeInfo);
			}
			// if (e.promiseEvt) priority = 0; // Promise関連は強制で0(typeがどうなってるかは知らん)
			e.priority = priority;
		});
	}
}

export default HBRelation;
