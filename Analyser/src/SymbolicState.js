/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */


import Log from "./Utilities/Log";
import ObjectHelper from "./Utilities/ObjectHelper";
import Coverage from "./Coverage";
import External from "./External";
import Config from "./Config";
import SymbolicHelper from "./SymbolicHelper";
import { SymbolicObject } from "./Values/SymbolicObject";
import { WrappedValue, ConcolicValue } from "./Values/WrappedValue";
import Proc from "./Values/Procedure";
import Stats from "Stats";
import AsyncTask from "./AsyncTask";
import nodeCoreModels from "./MyModels/nodeCoreModels";
import eventModels from "./MyModels/eventModels";

//This is a bit ugly. If window is defined we require Electron RPC require rather than window level require to get z3javascript handle
const Z3 = External.load("z3javascript").default;

function BuildUnaryJumpTable(state) {
	const ctx = state.ctx;
	return {
		"boolean":  {
			"+": function(val_s) {
				return ctx.mkIte(val_s, state.constantSymbol(1), state.constantSymbol(0));
			},
			"-": function(val_s) {
				return ctx.mkIte(val_s, state.constantSymbol(-1), state.constantSymbol(0));
			},
			"!": function(val_s) {
				return ctx.mkNot(val_s);
			}
		},
		"number": {
			"!": function(val_s, val_c, val_p, val_t) {
				let bool_s = state.asSymbolic(state.toBool(new ConcolicValue(val_c, val_s, val_p, val_t)));
				return bool_s ? ctx.mkNot(bool_s) : undefined;
			},
			"+": function(val_s) {
				return val_s;
			},
			"-": function(val_s) {
				return ctx.mkUnaryMinus(val_s);
			}
		},
		"string": {
			"!": function(val_s, val_c, val_p, val_t) {
				let bool_s = state.asSymbolic(state.toBool(new ConcolicValue(val_c, val_s, val_p, val_t)));
				return bool_s ? ctx.mkNot(bool_s) : undefined;
			},
			"+": function(val_s) {
				return ctx.mkStrToInt(val_s);
			},
			"-": function(val_s) {
				return ctx.mkUnaryMinus(
					ctx.mkStrToInt(val_s)
				);
			}
		}
	};
}

function BuildUnaryProcJumpTable(state) {
	return {
		"boolean":  {
			"+": function(val_p) {
				return new Proc("mkIte", [val_p, state.constantSymbol(1), state.constantSymbol(0)]);
			},
			"-": function(val_p) {
				return new Proc("mkIte", [val_p, state.constantSymbol(-1), state.constantSymbol(0)]);
			},
			"!": function(val_p) {
				return new Proc("mkNot", [val_p]);
			}
		},
		"number": {
			"!": function(val_p, val_c, val_s, val_t) {
				let bool_p = state.asProcedure(state.toBool(new ConcolicValue(val_c, val_s, val_p, val_t)));
				return bool_p ? new Proc("mkNot", [bool_p]) : undefined;
			},
			"+": function(val_p) {
				return val_p;
			},
			"-": function(val_p) {
				return new Proc("mkUnaryMinus", [val_p]);
			}
		},
		"string": {
			"!": function(val_p, val_c, val_s, val_t) {
				let bool_p = state.asProcedure(state.toBool(new ConcolicValue(val_c, val_s, val_p, val_t)));
				return bool_p ? new Proc("mkNot", [bool_p]) : undefined;
			},
			"+": function(val_p) {
				return new Proc("mkStrToInt", [val_p]);
			},
			"-": function(val_p) {
				return new Proc("mkUnaryMinus", [new Proc("mkStrToInt", [val_p])]);
			}
		}
	};
}


class SymbolicState {
	constructor(file, input, requestSeq, cbOrder, exec, sandbox) {
		this.ctx = new Z3.Context();
		this.slv = new Z3.Solver(this.ctx,
			Config.incrementalSolverEnabled,
			[
				{ name: "timeout", value: Config.maxSolverTime },
				{ name: "random_seed", value: Math.floor(Math.random() * Math.pow(2, 32))},
				{ name: "phase_selection", value: 5 }
			]
		);

		Z3.Query.MAX_REFINEMENTS = Config.maxRefinements;

		this.exec = exec;
		this.file = file;
		this.input = input;
		this.inputSymbols = {};
		this.inputProcCounts = {};
		this.pathCondition = [];
		this.readWriteVars = [];
		this.outputs = {};
		this.funcStack = [];
		this.branchUseMap = {};
		this.nodeCoreModels = new nodeCoreModels(this);
		this.eventModelMap = {};


		// this.observedFuncs = [];
		// this.executingCallback = false;
		// this.callbackDepth = -1; // 監視していない時は-1
		// this.callbackInfo = [];


		this.requestSeq = requestSeq;
		this.requests = {};

		this.cbOrder = cbOrder;

		if (this.cbOrder.id !== "init") this.callbackOrder = this.cbOrder.order;
		else if (this.cbOrder.executed) this.callbackOrder = this.cbOrder.executed;
		this.callbackOrderIdx = 0;
		this.skippedEventList = [];

		if (this.cbOrder.executedA) this.callbackOrderA = this.cbOrder.executedA;
		this.callbackOrderIdxA = 0;
		this.skippedEventListA = [];

		this.eventRecord = []; // これはキューではなくて記録用
		this.executableQueue = [];

		// this.eventQueue = [];
		// this.taskQueue = []; // 未実装

		this.asyncTrace = [];
		this.asyncTrace.push({type: "handling", info: "startOriginalExecution"});

		this.scopeIdMap = {};
		this.objectList = [];
		this.concritizedFunCallTaint = [];

		this.stats = new Stats();
		this.coverage = new Coverage(sandbox);
		this.errors = [];
		this.allFileList = [];

		this._unaryJumpTable = BuildUnaryJumpTable(this);
		this._unaryProcJumpTable = BuildUnaryProcJumpTable(this);
		this._setupSmtFunctions();
	}


	/** Set up a bunch of SMT functions used by the models **/
	_setupSmtFunctions() {

		this.stringRepeat = this.ctx.mkRecFunc(
			this.ctx.mkStringSymbol("str.repeat"),
			[this.ctx.mkStringSort(), this.ctx.mkIntSort()],
			this.ctx.mkStringSort()
		);
		this.stringRepeatProc = new Proc("mkRecFunc", [
			new Proc("mkStringSymbol", ["str.repeat"]),
			[new Proc("mkStringSort", []), new Proc("mkIntSort", [])],
			new Proc("mkStringSort", [])
		]);

		this.slv.fromString("(define-fun-rec str.repeat ((a String) (b Int)) String (if (<= b 0) \"\" (str.++ a (str.repeat a (- b 1)))))");

		this.whiteLeft = this.ctx.mkRecFunc(
			this.ctx.mkStringSymbol("str.whiteLeft"),
			[this.ctx.mkStringSort(), this.ctx.mkIntSort()],
			this.ctx.mkIntSort()
		);
		this.whiteLeftProc = new Proc("mkRecFunc", [
			new Proc("mkStringSymbol", ["str.whiteLeft"]),
			[new Proc("mkStringSort", []), new Proc("mkIntSort", [])],
			new Proc("mkIntSort", [])
		]);
		this.whiteRight = this.ctx.mkRecFunc(
			this.ctx.mkStringSymbol("str.whiteRight"),
			[this.ctx.mkStringSort(), this.ctx.mkIntSort()],
			this.ctx.mkIntSort()
		);
		this.whiteRightProc = new Proc("mkRecFunc", [
			new Proc("mkStringSymbol", ["str.whiteRight"]),
			[new Proc("mkStringSort", []), new Proc("mkIntSort", [])],
			new Proc("mkIntSort", [])
		]);

		/** Set up trim methods **/
		this.slv.fromString(
			"(define-fun str.isWhite ((c String)) Bool (= c \" \"))\n" + //TODO: Only handles
			"(define-fun-rec str.whiteLeft ((s String) (i Int)) Int (if (str.isWhite (str.at s i)) (str.whiteLeft s (+ i 1)) i))\n" +
			"(define-fun-rec str.whiteRight ((s String) (i Int)) Int (if (str.isWhite (str.at s i)) (str.whiteRight s (- i 1)) i))\n"
		);
	}


	_checkExecutedOrderA (completed) {

		if (!this.callbackOrderA) {
			return;
		}

		Log.log("Aの実行順序");
		Log.log(JSON.stringify(this.callbackOrderA, null, 2));
		Log.log("Aでの次の予定");
		Log.log(this.callbackOrderIdxA+": "+this.callbackOrderA[this.callbackOrderIdxA]);
		Log.log("completedはAの残りの予定のうち何番めか");
		Log.log(this.callbackOrderA.slice(this.callbackOrderIdxA).indexOf(completed.id));
		Log.log("まだ完了してないもの");
		Log.log(JSON.stringify(this.eventRecord.filter(e => !e.completed).map(e => e.id), null, 2));
		Log.log("まだ実行してないもの");
		Log.log(JSON.stringify(this.eventRecord.filter(e => !e.execCb).map(e => e.id), null, 2));
		Log.log("Aでスキップしたもの");
		Log.log(JSON.stringify(this.skippedEventListA, null, 2));
		Log.log("Aで実行できそうなもののキュー");
		Log.log(JSON.stringify(this.executableQueue.map(e => e.id), null, 2));
		Log.log("Aで実行できそうなもののキューでAに含まれないもの");
		Log.log(JSON.stringify(this.executableQueue.filter(e => !e.containedA).map(e => e.id), null, 2));

		// skipされたイベントの場合は実行
		const skippedIdx = this.skippedEventListA.indexOf(completed.id);
		if (skippedIdx >= 0) {
			this.skippedEventListA.splice(skippedIdx, 1);
			completed.containedA = true;
			if (this.executableQueue.indexOf(completed) === -1) {
				this.executableQueue.push(completed);
				this.executableQueue.sort((a, b) => {
					const idxA = this.callbackOrderA.indexOf(a.id);
					const idxB = this.callbackOrderA.indexOf(b.id);
					if (idxA >= 0 && idxB >= 0) return idxA - idxB; // -1じゃないときは昇順
					else return idxB - idxA; // -1は後ろに(降順)
				});
			}
			return;
		}

		if (this.callbackOrderA.length === this.callbackOrderIdxA || this.callbackOrderA.slice(this.callbackOrderIdxA).indexOf(completed.id) === -1) {
			if (this.executableQueue.indexOf(completed) === -1) this.executableQueue.push(completed);
			return;
		}

		// 指定されたコールバックを実行できないかチェック
		let nextId;
		let nextEvt;
		let callOne = false;
		while (this.callbackOrderIdxA < this.callbackOrderA.length) {
			nextId = this.callbackOrderA[this.callbackOrderIdxA];
			nextEvt = this.eventRecord.filter(e => e.completed && !e.execCb && e.id === nextId)[0];
			Log.log("ループA突入 何か呼んだか"+callOne);
			Log.log("Aで次に実行したいもの");
			Log.log(this.callbackOrderIdxA+": "+nextId);
			Log.log("Aで次に実行したいもの");
			Log.log(nextEvt);
			Log.log("Aでスキップしたもの");
			Log.log(JSON.stringify(this.skippedEventListA, null, 2));
			Log.log("Aで実行できそうなもののキュー");
			Log.log(JSON.stringify(this.executableQueue.map(e => e.id), null, 2));
			if (nextEvt) {
				nextEvt.containedA = true;
				callOne = true;
				if (this.executableQueue.indexOf(nextEvt) === -1) this.executableQueue.push(nextEvt);
			} else if (!callOne && this.eventRecord.filter(e => !e.completed).length === 0) {
				this.skippedEventListA.push(nextId);
			} else {
				return;
			}
			this.callbackOrderIdxA++;
		}

	}


	_isExecutable (evt) {
		if (!this.callbackOrderA) {
			return true;
		}

		// 含まれていない奴については順番を無視
		if (this.executableQueue.filter(e => e.containedA)[0] === evt) {
			const idx = this.executableQueue.indexOf(evt);
			this.executableQueue.splice(idx, 1);
			return true;
		} else if (this.executableQueue.filter(e => !e.containedA).indexOf(evt) >= 0){
			const idx = this.executableQueue.indexOf(evt);
			this.executableQueue.splice(idx, 1);
			return true;
		} else {
			return false;
		}
	}


	manageEventQueue (completed, again) {
		// this.cbOrderがundefinedの時は初期実行なので順序をそのまま実行
		// コールバックが完了するたびに呼び出しを行う
		if (again) Log.log("終わってないやつある");
		Log.log("このコールバック呼べるよ "+ completed.id);

		this._checkExecutedOrderA(completed);

		// // とりあえず1こは実行できるように
		// if (!completed && this.eventRecord.filter(e => !e.execCb && e.completed && e.matchA).length > 0) {
		// 	completed = this.eventRecord.filter(e => !e.execCb && e.completed && e.matchA)[0];
		// }

		// matchAはしてるけど指定された順序には登場しないときがヘン
		// matchAに順序関係がないのが悪い
		// matchAしたもので自分より先に実行されているかのチェックが必要
		// というかmatchAもキュー状になってる必要がありそう

		// 順序が指定されていない場合の実行
		if (!this.callbackOrder) {
			if (this._isExecutable(completed)) completed.execCallback("nondeterministic");
			return;
		}

		Log.log("orderされた実行順序");
		Log.log(JSON.stringify(this.callbackOrder, null, 2));
		Log.log("次の予定");
		Log.log(this.callbackOrderIdx+": "+this.callbackOrder[this.callbackOrderIdx]);
		Log.log("completedは残りの予定のうち何番めか");
		Log.log(this.callbackOrder.slice(this.callbackOrderIdx).indexOf(completed.id));
		Log.log("まだ完了してないもの");
		Log.log(JSON.stringify(this.eventRecord.filter(e => !e.completed).map(e => e.id), null, 2));
		Log.log("まだ実行してないもの");
		Log.log(JSON.stringify(this.eventRecord.filter(e => !e.execCb).map(e => e.id), null, 2));
		Log.log("スキップしたもの");
		Log.log(JSON.stringify(this.skippedEventList, null, 2));


		// 以降の実行予定イベント列に含まれなければ実行
		// skipされたイベントの場合も実行
		if (this.skippedEventList.indexOf(completed.id) >= 0) {
			this.skippedEventList.splice(this.skippedEventList.indexOf(completed.id), 1);
			if (this._isExecutable(completed)) completed.execCallback("skipped");
		} else if (this.callbackOrder.length <= this.callbackOrderIdx || this.callbackOrder.slice(this.callbackOrderIdx).indexOf(completed.id) === -1) {
			if (this.callbackOrderA) {
				let exec = this.executableQueue.filter(e => e.containedA)[0];
				Log.log("これ実行したい");
				Log.log(exec);
				if (exec && this._isExecutable(exec)) {
					exec.execCallback("unknown(orderedA)");
					exec = this.executableQueue.filter(e => e.containedA)[0];
				} else {
					if (this._isExecutable(completed)) completed.execCallback("unknown");
				}
			} else {
				if (this._isExecutable(completed)) completed.execCallback("unknown");
			}
		}


		// 指定されたコールバックを実行できないかチェック
		let nextId;
		let nextEvt;
		let callOne = false;
		while (this.callbackOrderIdx < this.callbackOrder.length) {
			nextId = this.callbackOrder[this.callbackOrderIdx];
			nextEvt = this.eventRecord.filter(e => e.completed && !e.execCb && e.id === nextId)[0];
			Log.log("ループ突入 何か呼んだか"+callOne);
			Log.log("次に実行したいもの");
			Log.log(this.callbackOrderIdx+": "+nextId);
			Log.log("次に実行したいもの");
			Log.log(nextEvt);
			Log.log("スキップしたもの");
			Log.log(JSON.stringify(this.skippedEventList, null, 2));
			if (nextEvt) {
				if (this._isExecutable(nextEvt)) {
					nextEvt.execCallback("ordered");
					callOne = true;
				}
			} else if (!callOne && this.eventRecord.filter(e => !e.completed).length === 0) {
				// 全コールバックが実行されたなら次に実行予定のイベントは実行不可になったパターンとみなす
				// スキップリストに追加
				this.skippedEventList.push(nextId);
			} else {
				return;
			}
			this.callbackOrderIdx++;
			// Log.log(this.callbackOrderIdx);
		}
	}


	registerAsyncTask (name, base, args, callbackIdx, replaceResult) {
		if (this.eventRecord.length > 100) {
			Log.log("強制終了2");
			this.exec.finished();
			External.close();
			return;
		}

		// 何も指定がない場合は最後の引数がコールバック
		if ((typeof callbackIdx !== "number" && typeof callbackIdx !== "string") || callbackIdx === -1) {
			callbackIdx = Object.keys(args).length - 1;
		}
		const callback = args[callbackIdx];
		const evt = new AsyncTask(name, base, args, callback, replaceResult, this);
		this.eventRecord.push(evt);

		if (typeof args[callbackIdx] === "function") {
			args[callbackIdx] = evt.complete.bind(evt);
		}
		return evt;
	}


	getPropInfo (base, offset) {
		const base_c = this.getConcrete(base);
		const offset_c = this.getConcrete(offset);
		const idx = this.objectList.map(o => o.val).indexOf(base_c);
		let baseInfo;
		if (idx === -1) {
			// throw new Error("base何これ"+base_c);
			baseInfo = {id: "global", name: "global"};
		} else {
			baseInfo = this.objectList[idx];
		}
		return {id: baseInfo.id+"."+offset_c, name: baseInfo.name+"."+offset_c};
	}


	putPropInfo (val, base, offset) {
		const propInfo = this.getPropInfo(base, offset);
		const val_c = this.getConcrete(val);
		if (typeof val_c === "object") {
			const idx = this.objectList.map(o => o.val).indexOf(val_c);
			if (idx === -1) {
				const info = {val: val_c, id: "object"+this.objectList.length, name: propInfo.name};
				this.objectList.push(info);
				this.eventModelMap[info.id] = new eventModels(this, info.id, info.name, val_c);
			}
		}
		return propInfo;
	}


	variableInfo (name, val) {
		const val_c = this.getConcrete(val);
		if (typeof val_c === "object") {
			const idx = this.objectList.map(o => o.val).indexOf(val_c);
			if (idx === -1) {
				const info = {val: val_c, id: "object"+this.objectList.length, name: name};
				this.objectList.push(info);
				this.eventModelMap[info.id] = new eventModels(this, info.id, info.name, val_c);
				return info;
			} else {
				let info = this.objectList[idx]; // ここか！！！
				info.name = name; // どんどんアップデートしていく方式で(とりあえず)
				return info;
			}
		} else {
			return {id: `${name}[${this.getScopeId(name)}]`, name: name};
		}
	}


	// putVarInfo (name, val) {
	// 	const val_c = this.getConcrete(val);
	// 	if (typeof val_c === "object") {
	// 		const idx = this.objectList.map(o => o.val).indexOf(val_c);
	// 		if (idx === -1) {
	// 			const info = {val: val_c, id: "object"+this.objectList.length, name: name};
	// 			this.objectList.push(info);
	// 			return info;
	// 		} else {
	// 			return this.objectList[idx];
	// 		}
	// 	} else {
	// 		return {id: `${name}[${this.getScopeId(name)}]`, name: name};
	// 	}
	// }


	_endRequest (endCallback) {
		Log.log("_endRequests呼んだ");
		Log.log(this.eventRecord.map(e => e.id+" "+e.completed+" "+e.execCb+"\n"));

		if (this._completedCallbackNum === this.eventRecord.filter(e => e.completed).length) {
			this._endRequestCall++;
		}
		this._completedCallbackNum = this.eventRecord.filter(e => e.completed).length;

		if (this._endRequestCall > 10) {
			const executableReq = this.eventRecord.filter(e => e.completed && !e.execCb && e.name.indexOf("[req]") === 0);
			if (executableReq.length > 0 && this._resetEndRequestCall < 10) {
				this.manageEventQueue(executableReq[0], true);
				this._endRequestCall = 0;
				this._resetEndRequestCall++;
			} else {
				Log.log("強制終了");
				endCallback();
				this.exec.finished();
				External.close();
				return;
			}
		}

		const notCompletes = this.eventRecord.filter(e => !e.completed);
		if (notCompletes.length === 0) {
			const notExec = this.eventRecord.filter(e => !e.execCb);
			if (notExec.length > 0) {
				this.manageEventQueue(notExec[0], true);
				Log.log("うまく行くんだろうか？");
			} else {
				Log.log("終われるはず");
				endCallback();
				return;
			}
		}
		const self = this;
		Log.log("終われる？");
		setTimeout(() => {
			self._endRequest(endCallback);
		}, 10);
	}


	callRequests (endCallback) {
		this.asyncTrace.push({type: "handling", info: "endOriginalExecution"});

		this._endRequestCall = 0;
		this._resetEndRequestCall = 0;
		const self = this;

		endCallback = this.getConcrete(endCallback);
		if (typeof endCallback !== "function") {
			endCallback = function () {};
		}

		let requestList = [];
		for (let idx in self.requestSeq) {
			const next = self.requestSeq[idx];
			const req = self.requests[next];

			let args = [];
			for (let i in req.args) {
				let name = next+"_call"+self.requestSeq.slice(0, idx).filter(r => r === next).length+"_idx"+i;
				let value = (name in self.input) ? self.input[name] : req.args[i];
				args.push(self.createSymbolicValue(name, value));
			}

			const id = "[req]"+next+"_call"+self.requestSeq.slice(0, idx).filter(r => r === next).length;
			const evt = new AsyncTask(id, null, [], req.func, undefined, self);
			self.eventRecord.push(evt);

			requestList.push({evt: evt, req: req, args: args});
		}

		// function addReqPromise (idx) {
		// 	if (idx >= self.requestSeq.length) return;
		//
		// 	return new Promise(resolve => {
		// 		const next = self.requestSeq[idx];
		// 		const req = self.requests[next];
		//
		// 		let args = [];
		// 		for (let i in req.args) {
		// 			let name = next+"_call"+self.requestSeq.slice(0, idx).filter(r => r === next).length+"_idx"+i;
		// 			let value = (name in self.input) ? self.input[name] : req.args[i];
		// 			args.push(self.createSymbolicValue(name, value));
		// 		}
		//
		// 		const id = "[req]"+next+"_call"+self.requestSeq.slice(0, idx).filter(r => r === next).length;
		// 		const evt = new AsyncTask(id, null, [], req.func, undefined, self);
		// 		self.eventRecord.push(evt);
		//
		// 		requestList.push({evt: evt, req: req, args: args});
		// 		resolve(idx);
		// 	}).then(idx => {
		// 		return addReqPromise(idx+1);
		// 	});
		// }


		function callReqPromise (idx) {
			// Log.log("reqPromiseLoop "+idx);
			if (requestList.length <= idx) {
				self._endRequest(endCallback);
				return;
			}
			return new Promise(resolve => {
				setTimeout(() => {
					const obj = requestList[idx];
					self.asyncTrace.push({type: "handling", id: self.getExecutionAsyncId(), info: "startExecRequest"});
					obj.evt.complete.apply(obj.evt, obj.args); // リクエストを実行
					self.asyncTrace.push({type: "handling", id: self.getExecutionAsyncId(), info: "endExecRequest"});
					resolve(idx);
				}, 1000);
			}).then(idx => {
				return callReqPromise(idx+1);
			});
		}

		process.nextTick(() => {
			// 全部を非同期なコールバックチェーンで呼び出したい
			// addReqPromise(0);
			callReqPromise(0);
		});
	}


	addRequest(name, args, func) {
		// 複数回コールされる可能性がある
		this.requests[name] = {func: this.getConcrete(func), args: this.getConcrete(args)};
	}


	setAsyncHooks(mod) {
		const self = this;
		const asyncHooks = this.getConcrete(mod);
		this.asyncHooks = asyncHooks;
		this.asyncHooks.createHook({
			init(asyncId, type, triggerAsyncId, resource) {
				const eid = asyncHooks.executionAsyncId();
				self.asyncHookInit(asyncId, type, resource, eid, triggerAsyncId);
			},
			before(asyncId) {
				const eid = asyncHooks.executionAsyncId();
				const tid = asyncHooks.triggerAsyncId();
				self.asyncHookBefore(asyncId, eid, tid);
			},
			after(asyncId) {
				const eid = asyncHooks.executionAsyncId();
				const tid = asyncHooks.triggerAsyncId();
				self.asyncHookAfter(asyncId, eid, tid);
			},
			promiseResolve(asyncId) {
				const eid = asyncHooks.executionAsyncId();
				const tid = asyncHooks.triggerAsyncId();
				self.asyncHookResolve(asyncId, eid, tid);
			}
		}).enable();
	}

	getExecutionAsyncId() {
		if (this.asyncHooks) return this.asyncHooks.executionAsyncId();
	}

	getTriggerAsyncId() {
		if (this.asyncHooks) return this.asyncHooks.triggerAsyncId();
	}

	// asyncHookInit(asyncId, type, resource, eid) {
	asyncHookInit(asyncId, type, resource, eid, tid) {
		// this.asyncHookLog.push(`[Init] asyncId: ${asyncId}, type: ${type}, eid: ${eid}, tid: ${tid}`);
		Log.log(`[Init] asyncId: ${asyncId}, type: ${type}, resource: ${resource}, eid: ${eid}, tid: ${tid}`);
		this.asyncTrace.push({type: "register", id: eid, listenerId: asyncId, typeInfo: type});
	}

	// asyncHookBefore(asyncId) {
	asyncHookBefore(asyncId, eid, tid) {
		// this.asyncHookLog.push(`[Before] asyncId: ${asyncId}, eid: ${eid}`);
		Log.log(`[Before] asyncId: ${asyncId}, eid: ${eid}, tid: ${tid}`);
		this.asyncTrace.push({type: "start", id: asyncId});
	}

	// asyncHookAfter(asyncId) {
	asyncHookAfter(asyncId, eid, tid) {
		// this.asyncHookLog.push(`[After] asyncId: ${asyncId}, eid: ${eid}`);
		Log.log(`[After] asyncId: ${asyncId}, eid: ${eid}, tid: ${tid}`);
		this.asyncTrace.push({type: "end", id: asyncId});
	}

	// これの挙動怪しい
	// asyncHookResolve(asyncId, eid) {
	asyncHookResolve(asyncId, eid, tid) {
		Log.log(`[Resolve] asyncId: ${asyncId}, eid: ${eid}, tid: ${tid}`);
		this.asyncTrace.push({type: "resolve", id: eid, triggeredId: asyncId});
	}


	getScopeId (name) {
		return this.scopeIdMap["scope:"+name] ? this.scopeIdMap["scope:"+name][this.scopeIdMap["scope:"+name].length - 1] : "global";
	}


	pushOutputValue (id, value) {
		const value_c = this.getConcrete(value),
			// value_s = this.asSymbolic(value),
			value_p = this.asProcedure(value),
			value_t = this.getTaint(value);
		const eid = this.getExecutionAsyncId();
		if (!(id in this.outputs)) {
			this.outputs[id] = [];
		}
		this.outputs[id].push({concrete: value_c, procCount: value_p.count, use: value_t, eid: eid, pcLength: this.pathCondition.length});
	}


	concritizeVal (val) {
		val = this.getConcrete(val);

		if (typeof val === "undefined") return "[val]undefined";
		if (typeof val === "function") return val.toString();
		if (!(val instanceof Object)) return val;

		for (let i in val) {
			const property = Object.getOwnPropertyDescriptor(val, i);
			if (property && this.isWrapped(property.value)) {
				val[i] = this.concritizeVal(val[i]);
				// Log.log(i);
				// Log.log(val[i]);
			// } else {
			// 	concritize(val[i]);
			}
		}
		// Log.log(val);
		return val;
	}


	arrangedJSONStr (obj) {
		// Note: cache should not be re-used by repeated calls to JSON.stringify.
		var cache = [];
		var str = JSON.stringify(obj, function(key, value) {

			// if (typeof value === "undefined") value = "[val]undefined";
			if (typeof value === "function") value = value.toString();

			if (typeof value === "object" && value !== null) {
				if (cache.indexOf(value) !== -1) {
					// Duplicate reference found
					try {
						// If this value does not reference a parent it can be deduped
						return JSON.parse(JSON.stringify(value));
					} catch (error) {
						// discard key if value cannot be deduped
						return;
					}
				}
				// Store value in our collection
				cache.push(value);
			}

			return value;
		});
		cache = null; // Enable garbage collection

		return str;
	}


	_isJalangiDependent(loc, id) {
		if (id.indexOf("S$") >= 0) return true;
		if (loc.split("/").pop().split(":")[0] == "symbols.js") return true;
		return false;
	}

	// val_sも与えないと転送条件の計算で困りそうな予感？
	// とりあえずわからないのでスルー
	// jalangi依存のよくわかんない変数は除外してみた
	// グローバルかどうかとかちゃんと考えないといけない気がする
	// HB定義論文のやつとかに従ってnameだけでなくidを考えないといけなさそう
	pushReadWriteVar(type, iid, loc, val, id, name) {

		if (!name) name = id;

		let eid = this.getExecutionAsyncId();
		// コールバック完了時(実行はまだ)のread/writeはコールバック呼び出し時に置き換え
		if (this.eventRecord.map(e => e.cbAsyncId).indexOf(eid) >= 0) {
			eid = this.eventRecord.filter(e => e.cbAsyncId === eid)[0].asyncId;
		}
		const obj = {
			location: loc,
			iid: iid,
			id: id,
			name: name,
			// isSymbolic: this.isSymbolic(val),
			val_c: this.getConcrete(val),
			// procCount: ConcolicValue.getProcedure(val) ? ConcolicValue.getProcedure(val).count : undefined,
			type: type,
			eid: eid,
		};
		this.readWriteVars.push(obj);
	}


	pushCondition(cnd, cndProc, binder, result) {
		// try {
		// 	throw new Error();
		// } catch (e) {
		// 	Log.log(e.stack);
		// }
		// Log.log("procある？"+cndProc.count);
		// Log.log(cnd);
		// Log.log(cndProc);
		// Log.log(result);
		this.pathCondition.push({
			ast: cnd,
			procCount: cndProc.count,
			binder: binder || false,
			forkIid: this.coverage.last(),
			forkLoc: this.coverage.lastLoc(),
			eid: this.getExecutionAsyncId(),
			result: result
		});
	}


	conditional(result) {

		// ここでパス条件追加している

		const result_c = this.getConcrete(result),
			result_s = this.asSymbolic(result),
			result_p = this.asProcedure(result);

		if (result_c === true) {
			Log.logMid(`Concrete result was true, pushing ${result_s}`);
			this.pushCondition(result_s, result_p, undefined, result_c);
		} else if (result_c === false) {
			Log.logMid(`Concrete result was false, pushing not of ${result_s}`);
			this.pushCondition(this.ctx.mkNot(result_s), new Proc("mkNot", [result_p]), undefined, result_c);
		} else {
			Log.log("WARNING: Symbolic Conditional on non-bool, concretizing");
		}

		return result_c;
	}

	/**
	*Formats PC to pretty string if length != 0
	*/
	_stringPC(pc) {
		return pc.length ? pc.reduce((prev, current) => {
			let this_line = current.simplify().toPrettyString().replace(/\s+/g, " ").replace(/not /g, "¬");

			if (this_line.startsWith("(¬")) {
				this_line = this_line.substr(1, this_line.length - 2);
			}

			if (this_line == "true" || this_line == "false") {
				return prev;
			} else {
				return prev + (prev.length ? ", " : "") + this_line;
			}
		}, "") : "";
	}

	/**
	*Formats PC to pretty string if length != 0
	*/
	_myStringPC(pc) {
		return pc.length ? pc.reduce((prev, current) => {
			let this_line = current.ast.simplify().toPrettyString().replace(/\s+/g, " ").replace(/not /g, "¬");
			if (this_line.startsWith("(¬")) {
				this_line = this_line.substr(1, this_line.length - 2);
			}

			if (this_line == "true" || this_line == "false") {
				return prev;
			} else {
				return prev + (prev.length ? ", " : "") + this_line;
			}
		}, "") : "";
	}


	/**
	* Creates a full (up to date) solver instance and then calls toString on it to create an SMT2Lib problem
	* TODO: This is a stop-gag implementation for the work with Ronny - not to be relied upon.
	*/
	inlineToSMTLib() {
		this.slv.push();
		this.pathCondition.forEach(pcItem => this.slv.assert(pcItem.ast));
		const resultString = this.slv.toString();
		this.slv.pop();
		return resultString;
	}

	/**
	* Returns the final PC as a string (if any symbols exist)
	*/
	finalPC() {
		return this._myStringPC(this.pathCondition.filter(x => x.ast));
		// return this._stringPC(this.pathCondition.filter(x => x.ast).map(x => x.ast));
	}

	// inputCallbackはanalyserの所に記述
	alternatives(inputCallback) {
		const procList = new Proc().getFinalProcList();
		inputCallback({inputProcCounts: this.inputProcCounts, pathCondition: this.pathCondition, procList: procList});
	}

	_getSort(concrete) {
		let sort;

		switch (typeof(concrete)) {

		case "boolean":
			sort = this.ctx.mkBoolSort();
			break;

		case "number":
			sort = this.ctx.mkRealSort();
			break;

		case "string":
			sort = this.ctx.mkStringSort();
			break;

		default:
			Log.log(`Symbolic input variable of type ${typeof val} not yet supported.`);
		}

		return sort;
	}

	_getSortProc(concrete) {
		let sort;

		switch (typeof(concrete)) {

		case "boolean":
			sort = new Proc("mkBoolSort", []);
			break;

		case "number":
			sort = new Proc("mkRealSort", []);
			break;

		case "string":
			sort = new Proc("mkStringSort", []);
			break;

		default:
			Log.log(`Symbolic input variable of type ${typeof val} not yet supported.`);
		}

		return sort;
	}


	recordConcritizedTaint (arg) {
		// Log.log(arg);
		const arg_c = this.getConcrete(arg);
		// Log.log(arg_c);
		if (this.isWrapped(arg)) {
			const self = this;
			this.getTaint(arg).forEach(v => {
				if (self.concritizedFunCallTaint[self.concritizedFunCallTaint.length - 1].indexOf(v) === -1) self.concritizedFunCallTaint[self.concritizedFunCallTaint.length - 1].push(v);
			});
		}

		if (arg_c instanceof Object) {
			for (let i in arg_c) {
				const property = Object.getOwnPropertyDescriptor(arg_c, i);
				if (property && this.isWrapped(property.value)) {
					this.recordConcritizedTaint(arg_c[i]);
				}
			}
		// } else if (typeof arg_c === "object") {
		// 	for (let i in arg_c) {
		// 		this.recordConcritizedTaint(arg_c[i]);
		// 	}
		}
	}

	_deepConcrete(arg, concreteCount) {

		/** TODO: Deep concretize shouldn't only conc if val is symbolic */
		if (this.isWrapped(arg)) {
			const self = this;
			this.getTaint(arg).forEach(v => {
				if (self.concritizedFunCallTaint[self.concritizedFunCallTaint.length - 1].indexOf(v) === -1) self.concritizedFunCallTaint[self.concritizedFunCallTaint.length - 1].push(v);
			});
			arg = this.getConcrete(arg);
			concreteCount.val += 1;
		}

		if (arg instanceof Object) {
			for (let i in arg) {
				const property = Object.getOwnPropertyDescriptor(arg, i);
				if (property && this.isWrapped(property.value)) {
					arg[i] = this._deepConcrete(arg[i], concreteCount);
				}
			}
		}

		return arg;
	}

	concretizeCall(f, base, args, report = true) {

		const numConcretizedProperties = { val: 0 };
		base = this._deepConcrete(base, numConcretizedProperties);

		const n_args = Array(args.length);

		for (let i = 0; i < args.length; i++) {
			n_args[i] = this._deepConcrete(args[i], numConcretizedProperties);
		}

		if (report && numConcretizedProperties.val) {
			this.stats.set("Concretized Function Calls", f.name);
			Log.logMid(`Concrete function concretizing all inputs ${ObjectHelper.asString(f)} ${ObjectHelper.asString(base)} ${ObjectHelper.asString(args)}`);
		}

		return {
			base: base,
			args: n_args
		};
	}

	createPureSymbol(name) {

		this.stats.seen("Pure Symbols");

		let pureType = this.createSymbolicValue(name + "_t", "undefined");

		let res;

		if (this.assertEqual(pureType, this.concolic("string"))) {
			res = this.createSymbolicValue(name, "seed_string");
		} else if (this.assertEqual(pureType, this.concolic("number"))) {
			res = this.createSymbolicValue(name, 0);
		} else if (this.assertEqual(pureType, this.concolic("boolean"))) {
			res = this.createSymbolicValue(name, false);
		} else if (this.assertEqual(pureType, this.concolic("object"))) {
			res = this.createSymbolicValue(name, {});
		} else if (this.assertEqual(pureType, this.concolic("array_number"))) {
			res = this.createSymbolicValue(name, [0]);
		} else if (this.assertEqual(pureType, this.concolic("array_string"))) {
			res = this.createSymbolicValue(name, [""]);
		} else if (this.assertEqual(pureType, this.concolic("array_bool"))) {
			res = this.createSymbolicValue(name, [false]);
		} else if (this.assertEqual(pureType, this.concolic("null"))) {
			res = null;
		} else {
			res = undefined;
		}

		return res;
	}

	/**
	* TODO: Symbol Renaming internalization
	*/
	createSymbolicValue(name, concrete) {

		Log.logMid(`Args ${JSON.stringify(arguments)} ${name} ${concrete}`);

		this.stats.seen("Symbolic Values");

		//TODO: Very ugly short circuit
		if (!(concrete instanceof Array) && typeof concrete === "object") {
			return new SymbolicObject(name);
		}

		let symbolic;
		let procedure;
		let arrayType;

		if (concrete instanceof Array) {
			this.stats.seen("Symbolic Arrays");
			symbolic = this.ctx.mkArray(name, this._getSort(concrete[0]));
			procedure = new Proc("mkArray", [name, this._getSortProc(concrete[0])]);
			this.pushCondition(this.ctx.mkGe(symbolic.getLength(), this.ctx.mkIntVal(0)), new Proc("mkGe", [new Proc("getLength", [procedure]), new Proc("mkIntVal", [0])]), true);
			arrayType = typeof(concrete[0]);
		} else {
			this.stats.seen("Symbolic Primitives");
			const sort = this._getSort(concrete);
			const sortProc = this._getSortProc(concrete);
			const symbol = this.ctx.mkStringSymbol(name);
			const proc = new Proc("mkStringSymbol", [name]);
			symbolic = this.ctx.mkConst(symbol, sort);
			procedure = new Proc("mkConst", [proc, sortProc]);
		}

		// Use generated input if available
		if (name in this.input) {
			concrete = this.input[name];
		} else {
			this.input[name] = concrete;
		}

		this.inputSymbols[name] = symbolic;
		this.inputProcCounts[name] = procedure.count;

		Log.logMid(`Initializing fresh symbolic variable ${symbolic} using concrete value ${concrete}`);
		return new ConcolicValue(concrete, symbolic, procedure, [], arrayType);
	}

	isWrapped(val) {
		return val instanceof WrappedValue;
	}

	isSymbolic(val) {
		return !!ConcolicValue.getSymbolic(val); // !!はboolean型に変換してるだけ
	}

	isTainted(val) {
		return this.getTaint(val).length > 0;
	}

	updateSymbolic(val, val_s, val_p) {
		return ConcolicValue.setSymbolic(val, val_s, val_p);
	}

	getConcrete(val) {
		return val instanceof WrappedValue || val instanceof ConcolicValue ? val.getConcrete() : val;
	}

	getTaint(val) {
		return val instanceof WrappedValue || val instanceof ConcolicValue ? val.getTaint() : [];
	}

	arrayType(val) {
		return val instanceof ConcolicValue ? val.getArrayType() : undefined;
		// return val instanceof WrappedValue ? val.getArrayType() : undefined;
	}

	getSymbolic(val) {
		return ConcolicValue.getSymbolic(val);
	}

	asSymbolic(val) {
		return ConcolicValue.getSymbolic(val) || this.constantSymbol(val);
	}

	asProcedure(val) {
		return ConcolicValue.getProcedure(val) || this.constantProc(val);
	}

	_symbolicBinary(op, left_c, left_s, right_c, right_s) {
		this.stats.seen("Symbolic Binary");

		Log.logMid(`Symbolic Binary: ${JSON.stringify(arguments)}`);

		switch (op) {
		case "===":
		case "==":
			return this.ctx.mkEq(left_s, right_s);
		case "!==":
		case "!=":
			return this.ctx.mkNot(this.ctx.mkEq(left_s, right_s));
		case "&&":
			return this.ctx.mkAnd(left_s, right_s);
		case "||":
			return this.ctx.mkOr(left_s, right_s);
		case ">":
			return this.ctx.mkGt(left_s, right_s);
		case ">=":
			return this.ctx.mkGe(left_s, right_s);
		case "<=":
			return this.ctx.mkLe(left_s, right_s);
		case "<":
			return this.ctx.mkLt(left_s, right_s);
		case "<<":
		case "<<<":
			left_s = this.ctx.mkRealToInt(left_s);
			right_s = this.ctx.mkRealToInt(right_s);
			return this.ctx.mkIntToReal(this.ctx.mkMul(left_s, this.ctx.mkPower(this.ctx.mkIntVal(2), right_s)));
		case ">>":
		case ">>>":
			left_s = this.ctx.mkRealToInt(left_s);
			right_s = this.ctx.mkRealToInt(right_s);
			return this.ctx.mkIntToReal(this.ctx.mkDiv(left_s, this.ctx.mkPower(this.ctx.mkIntVal(2), right_s)));
		case "+":
			// if (typeof left_c === "string") {
			// 	Log.log([left_s, right_s]);
			// 	Log.log(left_s._sortName());
			// 	Log.log(right_s._sortName());
			// }
			return typeof left_c === "string" ? this.ctx.mkSeqConcat([left_s, right_s]) : this.ctx.mkAdd(left_s, right_s);
		case "-":
			return this.ctx.mkSub(left_s, right_s);
		case "*":
			return this.ctx.mkMul(left_s, right_s);
		case "/":
			return this.ctx.mkDiv(left_s, right_s);
		case "%":
			return this.ctx.mkMod(left_s, right_s);
		default:
			Log.log(`Symbolic execution does not support operand ${op}, concretizing.`);
			break;
		}

		return undefined;
	}

	_symbolicBinaryProc(op, left_c, left_p, right_c, right_p) {
		switch (op) {
		case "===":
		case "==":
			return new Proc("mkEq", [left_p, right_p]);
		case "!==":
		case "!=":
			return new Proc("mkNot", [new Proc("mkEq", [left_p, right_p])]);
		case "&&":
			return new Proc("mkAnd", [left_p, right_p]);
		case "||":
			return new Proc("mkOr", [left_p, right_p]);
		case ">":
			return new Proc("mkGt", [left_p, right_p]);
		case ">=":
			return new Proc("mkGe", [left_p, right_p]);
		case "<=":
			return new Proc("mkLe", [left_p, right_p]);
		case "<":
			return new Proc("mkLt", [left_p, right_p]);
		case "<<":
		case "<<<":
			left_p = new Proc("mkRealToInt", [left_p]);
			right_p = new Proc("mkRealToInt", [right_p]);
			return new Proc("mkIntToReal", [new Proc("mkMul", [left_p, new Proc("mkPower", [new Proc("mkIntVal", [2]), right_p])])]);
		case ">>":
		case ">>>":
			left_p = new Proc("mkRealToInt", [left_p]);
			right_p = new Proc("mkRealToInt", [right_p]);
			return new Proc("mkIntToReal", [new Proc("mkDiv", [left_p, new Proc("mkPower", [new Proc("mkIntVal", [2]), right_p])])]);
		case "+":
			// if (typeof left_c === "string") Log.log(JSON.stringify(left_p));
			// if (typeof left_c === "string") Log.log(JSON.stringify(right_p));
			return typeof left_c === "string" ? new Proc("mkSeqConcat", [[left_p, right_p]]) : new Proc("mkAdd", [left_p, right_p]);
		case "-":
			return new Proc("mkSub", [left_p, right_p]);
		case "*":
			return new Proc("mkMul", [left_p, right_p]);
		case "/":
			return new Proc("mkDiv", [left_p, right_p]);
		case "%":
			return new Proc("mkMod", [left_p, right_p]);
		default:
			break;
		}

		return undefined;
	}

	/**
	* Symbolic binary operation, expects two concolic values and an operator
	*/
	binary(op, left, right) {
		const result_c = SymbolicHelper.evalBinary(op, this.getConcrete(left), this.getConcrete(right));

		const left_t = this.getTaint(left);
		const right_t = this.getTaint(right);
		let result_t = left_t.concat(right_t.filter(v => left_t.indexOf(v) == -1));
		if (this.concritizedOpTaint) {
			result_t = result_t.concat(this.concritizedOpTaint);
			delete this.concritizedOpTaint;
		}

		let result = result_c;
		if (this.isSymbolic(left) || this.isSymbolic(right)) {
			const result_s = this._symbolicBinary(op, this.getConcrete(left), this.asSymbolic(left), this.getConcrete(right), this.asSymbolic(right));
			const result_p = this._symbolicBinaryProc(op, this.getConcrete(left), this.asProcedure(left), this.getConcrete(right), this.asProcedure(right));
			if (result_s) result = new ConcolicValue(result_c, result_s, result_p, result_t);
		} else if (result_t.length > 0) {
			result = new WrappedValue(result_c, result_t);
		}

		return result;
	}

	/**
	* Symbolic field lookup - currently only has support for symbolic arrays / strings
	*/
	symbolicField(base_c, base_s, base_p, field_c, field_s, field_p) {
		this.stats.seen("Symbolic Field");

		function canHaveFields() {
			return typeof base_c === "string" || base_c instanceof Array;
		}

		function isRealNumber() {
			return typeof field_c === "number" && Number.isFinite(field_c);
		}

		if (canHaveFields() && isRealNumber()) {

			const withinBounds = this.ctx.mkAnd(
				this.ctx.mkGt(field_s, this.ctx.mkIntVal(-1)),
				this.ctx.mkLt(field_s, base_s.getLength())
			);
			const withinBoundsProc = new Proc("mkAnd", [
				new Proc("mkGt", [field_p, new Proc("mkIntVal", [-1])]),
				new Proc("mkLt", [field_p, new Proc("getLength", [base_p])]),
			]);

			if (this.conditional(new ConcolicValue(field_c > -1 && field_c < base_c.length, withinBounds, withinBoundsProc), [])) {
				return {
					sym: base_s.getField(this.ctx.mkRealToInt(field_s)),
					proc: new Proc("getField", [base_p, new Proc("mkRealToInt", [field_p])])
				};
			} else {
				return undefined;
			}
		}

		switch (field_c) {

		case "length": {

			if (base_s.getLength()) {
				return {sym: base_s.getLength(), proc: new Proc("getLength", [base_p])};
			} else {
				Log.log("No length field on symbolic value");
			}

			break;
		}

		default: {
			Log.log("Unsupported symbolic field - concretizing " + base_c + " and field " + field_c);
			break;
		}

		}

		return undefined;
	}


	getFieldBasic (base, offset) {
		const info = this.getPropInfo(base, offset);
		const offset_t = this.getTaint(offset);
		let result_t = [info.name, info.id];
		result_t = result_t.concat(offset_t.filter(v => result_t.indexOf(v) === -1));

		let result_s, result_p;
		if (this.isSymbolic(base)) {
			let obj = this.symbolicField(this.getConcrete(base), this.asSymbolic(base), this.asProcedure(base), this.getConcrete(offset), this.asSymbolic(offset), this.asProcedure(offset));
			if (obj) {
				result_s = obj.sym;
				result_p = obj.proc;
			}
		}

		let result = this.getConcrete(base)[this.getConcrete(offset)];
		if (this.isWrapped(result)) {
			result.concatTaint(result_t);
		} else {
			result = new WrappedValue(result, result_t);
		}
		if (result_s) result = new ConcolicValue(this.getConcrete(result), result_s, result_p, this.getTaint(result));
		return result;
	}



	toBool(val) {

		if (this.isSymbolic(val)) {
			const val_type = typeof this.getConcrete(val);

			switch (val_type) {
			case "boolean":
				return val;
			case "number":
				return this.binary("!=", val, this.concolic(0));
			case "string":
				return this.binary("!=", val, this.concolic(""));
			}

			Log.log("WARNING: Concretizing coercion to boolean (toBool) due to unknown type");
		} else if (this.isTainted(val)) {
			return val;
		}

		return this.getConcrete(!!val);
	}

	/**
	* Perform a symbolic unary action.
	* Expects an Expr and returns an Expr or undefined if we don't
	* know how to do this op symbolically
	*/
	_symbolicUnary(op, left_c, left_s, left_p) {
		this.stats.seen("Symbolic Unary");

		const unaryFn = this._unaryJumpTable[typeof(left_c)] ? this._unaryJumpTable[typeof(left_c)][op] : undefined;

		if (unaryFn) {
			return unaryFn(left_s, left_c, left_p);
		} else {
			Log.log(`Unsupported symbolic operand: ${op} on ${left_c} symbolic ${left_s}`);
			return undefined;
		}
	}

	_symbolicUnaryProc(op, left_c, left_s, left_p) {

		const unaryFn = this._unaryProcJumpTable[typeof(left_c)] ? this._unaryProcJumpTable[typeof(left_c)][op] : undefined;

		if (unaryFn) {
			return unaryFn(left_p, left_c, left_s);
		} else {
			return undefined;
		}
	}

	/**
	* Perform a unary op on a ConcolicValue or a concrete value
	* Concretizes the ConcolicValue if we don't know how to do that action symbolically
	*/
	unary(op, left) {
		const result_c = SymbolicHelper.evalUnary(op, this.getConcrete(left));
		const result_t = this.getTaint(left);

		let result = result_c;
		if (this.isSymbolic(left)) {
			const result_s = this._symbolicUnary(op, this.getConcrete(left), this.asSymbolic(left), this.asProcedure(left));
			const result_p = this._symbolicUnaryProc(op, this.getConcrete(left), this.asSymbolic(left), this.asProcedure(left));
			result = new ConcolicValue(result_c, result_s, result_p, result_t);
		} else if (result_t.length > 0) {
			result = new WrappedValue(result_c, result_t);
		}

		return result;
	}

	/**
	* Return a symbol which will always be equal to the constant value val
	* returns undefined if the theory is not supported.
	*/
	constantSymbol(val) {
		this.stats.seen("Wrapped Constants");

		// Log.log("constantSymbol呼んだ ");
		// Log.log(val);

		if (val && typeof(val) === "object") {
			val = val.valueOf();
		}


		switch (typeof(val)) {
		case "boolean":
			return val ? this.ctx.mkTrue() : this.ctx.mkFalse();
		case "number":
			// Log.log("realにするかも "+val);
			return Math.round(val) === val ? this.ctx.mkReal(val, 1) : this.ctx.mkNumeral(String(val), this.realSort);
		case "string":
			return this.ctx.mkString(val.toString());
		default:
			Log.log("Symbolic expressions with " + typeof(val) + " literals not yet supported.");
		}

		return undefined;
	}

	constantProc(val) {

		// Log.log("constantProc呼んだ ");
		// Log.log(val);

		if (val && typeof(val) === "object") {
			val = val.valueOf();
		}

		switch (typeof(val)) {
		case "boolean":
			return val ? new Proc("mkTrue", []) : new Proc("mkFalse", []);
		case "number":
			// try {
			// 	throw new Error();
			// } catch (e) {
			// 	Log.log(e.stack);
			// }
			// Log.log("realにするかも(proc) "+val);
			return Math.round(val) === val ?  new Proc("mkReal", [val, 1]) : new Proc("mkNumeral", [String(val), this.realSort]);
		case "string":
			return new Proc("mkString", [val.toString()]);
		default:
			// Log.log("Symbolic expressions with " + typeof(val) + " literals not yet supported.");
		}

		// countプロパティを参照したい
		return {};
		// return undefined;
	}


	/**
	* If val is a symbolic value then return val otherwise wrap it
	* with a constant symbol inside a ConcolicValue.
	*
	* Used to turn a concrete value into a constant symbol for symbolic ops.
	*/
	concolic(val) {
		return this.isSymbolic(val) ? val : new ConcolicValue(val, this.constantSymbol(val), this.constantProc(val), [], this);
	}


	/**
	* Assert left == right on the path condition
	*/
	assertEqual(left, right) {
		const equalityTest = this.binary("==", left, right);
		this.conditional(equalityTest);
		return this.getConcrete(equalityTest);
	}
}

export default SymbolicState;
