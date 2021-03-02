/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2014@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

/*global window*/
/*global Element*/
/*global document*/

import {WrappedValue, ConcolicValue} from "./Values/WrappedValue";
import {SymbolicObject} from "./Values/SymbolicObject";
import Proc from "./Values/Procedure";
import ObjectHelper from "./Utilities/ObjectHelper";
import SymbolicState from "./SymbolicState";
import Log from "./Utilities/Log";
import NotAnErrorException from "./NotAnErrorException";
import {isNative} from "./Utilities/IsNative";
import ModelBuilder from "./Models/Models";
import External from "./External";

// const crypto = require("crypto");

class SymbolicExecution {

	constructor(sandbox, file, initialInput, requestSeq, cbOrder, exitFn) {
		this._sandbox = sandbox;
		this.state = new SymbolicState(file, initialInput, requestSeq, cbOrder, this, this._sandbox);
		this.models = ModelBuilder(this.state);

		this._fileList = new Array();
		this._exitFn = exitFn;

		if (typeof window !== "undefined") {

			const self = this;
			setTimeout(() => {
				console.log("Finish timeout (callback)");
				self.finished();
				External.close();
			}, 1000 * 60 * 3);

			const storagePool = {};

			window.localStorage.setItem = function(key, val) {
				storagePool[key] = val;
			};

			window.localStorage.getItem = function(key) {
				return storagePool[key];
			};

			console.log("Browser mode setup finished");

		} else {
			const process = External.load("process");

			//Bind any uncaught exceptions to the uncaught exception handler
			process.on("uncaughtException", this._uncaughtException.bind(this));

			//Bind the exit handler to the exit callback supplied
			process.on("exit", this.finished.bind(this));
		}

	}


	finished() {
		this.state.eventRecord = this.state.eventRecord.filter(e => e.completed && e.execCb);
		this._exitFn(this.state, this.state.coverage);
		External.close();
	}


	_uncaughtException(e) {

		e = this.state.getConcrete(e);

		//Ignore NotAnErrorException
		if (e instanceof NotAnErrorException) {
			return;
		}

		Log.log(`Uncaught exception ${e} \nStack: ${e && e.stack ? e.stack : ""}`);

		this.state.pushOutputValue("uncaughtException", "" + e);

		this.state.errors.push({
			error: "" + e,
			stack: e.stack
		});

		// this.finished();
	}


	_report(sourceString) {

		console.log("Processing " + sourceString);
		console.log(JSON.stringify(sourceString));

		if (!this.state.isSymbolic(sourceString)) {
			sourceString = sourceString.documentURI ? ("" + sourceString.documentURI) : ("" + sourceString);
			sourceString = this.state.asSymbolic(sourceString);
		} else {
			sourceString = this.state.asSymbolic(sourceString);
		}

		console.log(`OUTPUT_LOAD_EVENT: !!!${this.state.finalPC()}!!! !!!"${sourceString ? sourceString.toString() : ("" + sourceString)}"!!!`);
	}


	_reportFn(f, base, args) {
		if ((f.name == "appendChild" || f.name == "prependChild" || f.name == "insertBefore" || f.name == "replaceChild") && args[0] && (args[0].src || args[0].innerHTML.includes("src="))) {
			this._report(args[0].src);
			args[0].src = this.state.getConcrete(args[0].src);
		}

		if (f.name == "open") {
			this._report(args[1]);
		}
	}


	invokeFunPre(iid, f, base, args, _isConstructor, _isMethod) {

		this.state.coverage.touch(iid, "invokeFunPre");
		Log.logHigh(`Execute function ${ObjectHelper.asString(f)} at ${this._location(iid)}`);
		// for (let i in args) {
		// 	Log.log(i+": "+this.state.isSymbolic(args[i]) + " " + args[i]);
		// }

		this.state.concritizedFunCallTaint.push(this.state.getTaint(f));
		f = this.state.getConcrete(f);

		/**
		* Concretize the function if it is native and we do not have a custom model for it
		* TODO: We force concretization on toString functions to avoid recursive call from the lookup into this.models
		* TODO: This is caused by getField(obj) calling obj.toString()
		* TODO: A better solution to this needs to be found
		*/

		Log.log("次の関数を呼ぶ");
		Log.log(f.name);
		Log.log(f.toString());
		for (let i in args) {
			Log.log(i);
			Log.log(args[i]);
		}
		Log.log(ObjectHelper.asString(base));

		// 他に欲しい非同期関数のモデル
		// setTimeout等のシステム系
		// ソケットI/O

		const fn_model = this.models.get(f);

		const node_core_model = this.state.nodeCoreModels.get(f, this.state.getConcrete(base));
		const baseInfo = this.state.variableInfo("", this.state.getConcrete(base));
		const evtModel = this.state.eventModelMap[baseInfo.id];
		if (evtModel) evtModel.invokeFun = true;

		// Log.log(fn_model);
		if (fn_model) {
			Log.log("モデル化したの呼ぶ");
			// taintのモデル化は面倒なのであとでまとめて付与したい
			this.state.recordConcritizedTaint(base); // taint計算
			this.state.recordConcritizedTaint(args); // taint計算
			this.state.stats.set("Modeled Function Call", f.name);
		} else if (isNative(f)) {
			Log.log("ネイティブの呼ぶ");
			let concretized = this.state.concretizeCall(f, base, args); // 中でtaint追加してる
			base = concretized.base;
			args = concretized.args;
		} else if (node_core_model) {
			Log.log("自分でモデル化したの呼ぶ");
			// const modelFunc = fs_model ? fs_model : fs_stream_model;
			let concretized = this.state.concretizeCall(f, base, args);
			const base_s = base;
			const args_s = args;
			base = concretized.base;
			args = concretized.args;
			f = node_core_model.func.call(node_core_model.base, f, base, args, iid, this._location(iid), base_s, args_s);
		} else {
			Log.log("普通に呼ぶ");
			this.state.stats.seen("General Function Call");
			this.state.recordConcritizedTaint(base); // taint計算
			base = this.state.getConcrete(base);
		}

		/**
		* End of conc
		*/
		return {
			f: fn_model || f,
			base: base,
			args: args,
			skip: false
		};
	}


	/**
	* Called after a function completes execution
	*/
	invokeFun(iid, f, base, args, result, _isConstructor, _isMethod) {
		this.state.coverage.touch(iid, "invokeFun");
		Log.logHigh(`Exit function (${ObjectHelper.asString(f)}) near ${this._location(iid)}`);

		// const result_c = this.state.getConcrete(result);
		// if (this.state.objectList.indexOf(result_c) === -1) {
		// 	this.state.objectList.push(result_c);
		// }

		const baseInfo = this.state.variableInfo("", this.state.getConcrete(base));
		const evtModel = this.state.eventModelMap[baseInfo.id];
		if (evtModel) evtModel.invokeFun = false;

		const concritizedFunCallTaint = this.state.concritizedFunCallTaint.pop();
		if (concritizedFunCallTaint.length > 0) {
			if (this.state.isWrapped(result)) {
				result.concatTaint(concritizedFunCallTaint);
			} else {
				result = new WrappedValue(result, concritizedFunCallTaint);
			}
		}

		const evt = this.state.eventRecord.filter(e => e.callback === f && e.executing)[0];
		if (evt) {
			evt.executing = false;
			evt.iid = iid;
			evt.location = this._location(iid);
		}

		return { result: result };
	}


	literal(iid, val, _hasGetterSetter) {
		this.state.coverage.touch(iid, "literal");
		return { result: val };
	}


	forinObject(iid, val) {
		this.state.coverage.touch(iid, "forinObject");
		return { result: val };
	}


	_location(iid) {
		return this._sandbox.iidToLocation(this._sandbox.getGlobalIID(iid));
	}


	endExpression(iid) {
		this.state.coverage.touch(iid, "endExpression");
	}


	declare(iid, name, val, _isArgument, _argumentIndex, _isCatchParam) {
		let id = this._location(iid); // これだと重複が発生するのでNG
		// const id = crypto.createHash("sha256").update(this._location(iid), "utf8").digest("hex");

		// オブジェクトも記録したい
		if (!this.state.scopeIdMap["scope:"+name]) {
			this.state.scopeIdMap["scope:"+name] = [];
		}

		id += "[count"+this.state.scopeIdMap["scope:"+name].filter(i => i.indexOf(id) === 0).length+"]";
		this.state.scopeIdMap["scope:"+name].push(id);

		const info = this.state.variableInfo(name, val);
		this.state.pushReadWriteVar("write", iid, this._location(iid), val, info.id, info.name);

		this.state.coverage.touch(iid, "declare");
		Log.logHigh(`decl ${name} as ${val} at ${this._location(iid)}`);
		return {
			result: val
		};
	}


	getFieldPre(iid, base, offset, _isComputed, _isOpAssign, _isMethodCall) {
		this.state.coverage.touch(iid, "getFieldPre");
		return {
			base: base,
			offset: offset,
			skip: this.state.isWrapped(base) || this.state.isWrapped(offset)
		};
	}


	_getFieldSymbolicOffset(base, offset) {
		const base_c = this.state.getConcrete(base);
		const offset_c = this.state.getConcrete(offset);
		for (const idx in base_c) {
			if (offset_c != base_c[idx]) {
				const condition = this.state.binary("==", idx, offset);
				this.state.pushCondition(
					this.state.ctx.mkNot(this.state.asSymbolic(condition)),
					new Proc("mkNot", [this.state.asProcedure(condition)])
				);
			}
		}
	}


	/**
	* GetField will be skipped if the base or offset is not wrapped (SymbolicObject or isSymbolic)
	*/
	getField(iid, base, offset, _val, _isComputed, _isOpAssign, _isMethodCall) {

		const info = this.state.getPropInfo(base, offset);
		// const base_t = this.state.getTaint(base);
		const offset_t = this.state.getTaint(offset);
		// let result_t = base_t;
		// result_t = result_t.concat(offset_t.filter(v => result_t.indexOf(v) === -1));
		// result_t = result_t.concat([info.name, info.id].filter(v => result_t.indexOf(v) === -1));
		let result_t = [info.name, info.id];
		result_t = result_t.concat(offset_t.filter(v => result_t.indexOf(v) === -1));


		// taint未対応
		//TODO: This is a horrible hacky way of making certain request attributes symbolic
		//TODO: Fix this!
		if (typeof(window) != "undefined") {

			if (base == window.navigator) {
				if (offset == "userAgent") {
					return { result: Object._expose.makeSymbolic(offset, window.navigator.userAgent) };
				}
			}

			if (base == window.document) {
				if (offset == "cookie") {
					return { result: Object._expose.makeSymbolic(offset, "") };
				}

				if (offset == "lastModified") {
					return { result: Object._expose.makeSymbolic(offset, window.document.lastModified) };
				}

				if (offset == "referer") {
					return { result: Object._expose.makeSymbolic(offset, window.document.referer) };
				}
			}

			if (base == window.location) {
				if (offset == "origin") {
					return { result: Object._expose.makeSymbolic(offset, window.location.origin) };
				}
				if (offset == "host") {
					return { result: Object._expose.makeSymbolic(offset, window.location.host) };
				}
			}

		}

		Log.logHigh(`Get field ${ObjectHelper.asString(base)}[${ObjectHelper.asString(offset)}] at ${this._location(iid)}`);

		//If dealing with a SymbolicObject then concretize the offset and defer to SymbolicObject.getField
		if (base instanceof SymbolicObject) {
			Log.logMid("Potential loss of precision, cocretize offset on SymbolicObject field lookups");
			let result = base.getField(this.state, this.state.getConcrete(offset));
			this.state.pushReadWriteVar("read", iid, this._location(iid), result, info.id, info.name);

			if (this.state.isWrapped(result)) {
				result.concatTaint(result_t);
			} else {
				result = new WrappedValue(result, result_t);
			}

			return {
				result: result
			};
		}

		//If we are evaluating a symbolic string offset on a concrete base then enumerate all fields
		//Then return the concrete lookup
		if (!this.state.isSymbolic(base) &&
		this.state.isSymbolic(offset) &&
		typeof this.state.getConcrete(offset) == "string") {
			this._getFieldSymbolicOffset(base, offset);

			let result = this.state.getConcrete(base)[this.state.getConcrete(offset)];
			this.state.pushReadWriteVar("read", iid, this._location(iid), result, info.id, info.name);

			if (this.state.isWrapped(result)) {
				result.concatTaint(result_t);
			} else {
				result = new WrappedValue(result, result_t);
			}

			return {
				result: result
			};
		}

		//If the array is a symbolic int and the base is a concrete array then enumerate all the indices
		if (!this.state.isSymbolic(base) &&
		this.state.isSymbolic(offset) &&
		this.state.getConcrete(base) instanceof Array &&
		typeof this.state.getConcrete(offset) == "number") {

			for (let i = 0; i < this.state.getConcrete(base).length; i++) {
				this.state.assertEqual(i, offset);
			}

			let result = this.state.getConcrete(base)[this.state.getConcrete(offset)];
			this.state.pushReadWriteVar("read", iid, this._location(iid), result, info.id, info.name);

			if (this.state.isWrapped(result)) {
				result.concatTaint(result_t);
			} else {
				result = new WrappedValue(result, result_t);
			}

			return {
				result: result
			};
		}

		//Otherwise defer to symbolicField
		let result_s, result_p;
		if (this.state.isSymbolic(base)) {
			let obj = this.state.symbolicField(this.state.getConcrete(base), this.state.asSymbolic(base), this.state.asProcedure(base), this.state.getConcrete(offset), this.state.asSymbolic(offset), this.state.asProcedure(offset));
			if (obj) {
				result_s = obj.sym;
				result_p = obj.proc;
			}
		}

		let result = this.state.getConcrete(base)[this.state.getConcrete(offset)];
		this.state.pushReadWriteVar("read", iid, this._location(iid), result, info.id, info.name);

		if (this.state.isWrapped(result)) {
			result.concatTaint(result_t);
		} else {
			result = new WrappedValue(result, result_t);
		}
		if (result_s) result = new ConcolicValue(this.state.getConcrete(result) , result_s, result_p, this.state.getTaint(result));

		return {
			result: result
		};
	}


	putFieldPre(iid, base, offset, val, _isComputed, _isOpAssign) {
		this.state.coverage.touch(iid, "putFieldPre");
		Log.logHigh(`Put field ${ObjectHelper.asString(base)}[${ObjectHelper.asString(offset)}] at ${this._location(iid)}`);

		if (this.state.getConcrete(offset) === "src") {
			this._report(val);
			val = this.state.getConcrete(val);
		}

		return {
			base: base,
			offset: offset,
			val: val,
			skip: this.state.isWrapped(base) || this.state.isWrapped(offset)
		};
	}


	putField(iid, base, offset, val, _isComputed, _isOpAssign) {
		Log.logHigh(`PutField ${ObjectHelper.asString(base)} at ${offset}`);
		// Log.logHigh(`PutField ${base.toString()} at ${offset}`);

		const info = this.state.putPropInfo(val, base, offset);
		// const base_t = this.state.getTaint(base);
		// const offset_t = this.state.getTaint(offset);
		// let result_t = base_t;
		// result_t = result_t.concat(offset_t.filter(v => result_t.indexOf(v) === -1));
		// result_t = result_t.concat([info.name, info.id].filter(v => result_t.indexOf(v) === -1));


		this.state.pushReadWriteVar("write", iid, this._location(iid), val, info.id, info.name);

		// const val_t = this.state.getTaint(val);
		// if (this.state.isWrapped(base)) {
		// 	base.concatTaint(val_t);
		// } else {
		// 	base = new WrappedValue(base, val_t);
		// }

		if (base instanceof SymbolicObject) {
			return {
				result: base.setField(this.state, this.state.getConcrete(offset), val)
			};
		}

		//TODO: Enumerate if symbolic offset and concrete input

		if (this.state.isSymbolic(base) && this.state.getConcrete(base) instanceof Array && this.state.arrayType(base) == typeof(val)) {
			Log.log("TODO: Check that setField is homogonous");

			//SetField produce a new array
			//Therefore the symbolic portion of base needs to be updated
			const base_s = this.state.asSymbolic(base).setField(
				this.state.asSymbolic(offset),
				this.state.asSymbolic(val));
			const base_p = new Proc("setField", [this.state.asProcedure(base), this.state.asProcedure(offset), this.state.asProcedure(val)]);

			this.state.getConcrete(base)[this.state.getConcrete(offset)] = val;
			this.state.updateSymbolic(base, base_s, base_p);

			if (typeof(document) !== "undefined" && this.state.getConcrete(base) instanceof Element && document.contains(this.state.getConcrete(base)) && offset === "innerHTML") {
				const tv = this.state.getConcrete(val);
				if (typeof(tv) === "string" && tv.includes("src=")) {
					const sourceString = this.state.asSymbolic(val).toString();
					console.log(`OUTPUT_LOAD_EVENT: !!!"${this.state.finalPC()}"!!! !!!"${sourceString}"!!!`);
				}
			}

			return {
				result: val
			};
		}

		this.state.getConcrete(base)[this.state.getConcrete(offset)] = val;

		return { result: val };
	}


	read(iid, name, val, _isGlobal, _isScriptLocal) {
		this.state.coverage.touch(iid, "read");
		Log.logHigh(`Read ${name} as ${ObjectHelper.asString(val)} at ${this._location(iid)}`);


		const info = this.state.variableInfo(name, val);
		this.state.pushReadWriteVar("read", iid, this._location(iid), val, info.id, info.name);

		// Log.log(`Taint ${ObjectHelper.asString(val)} as ${info.id}, ${info.name} at ${this._location(iid)}`);
		if (this.state.isWrapped(val)) {
			val.concatTaint([info.id, info.name]);
		} else {
			// Log.log(`Wrap value ${val}`);
			val = new WrappedValue(val, [info.id, info.name]);
		}

		return { result: val };
	}


	write(iid, name, val, _lhs, _isGlobal, _isScriptLocal) {
		this.state.coverage.touch(iid, "write");
		Log.logHigh(`Write ${name} as ${ObjectHelper.asString(val)} at ${this._location(iid)}`);

		const info = this.state.variableInfo(name, val);
		this.state.pushReadWriteVar("write", iid, this._location(iid), val, info.id, info.name);

		return { result: val };
	}


	_return(iid, val) {
		this.state.coverage.touch(iid, "_return");
		return { result: val };
	}


	_throw(iid, val) {
		this.state.coverage.touch(iid, "_throw");
		return { result: val };
	}


	_with(iid, val) {
		this.state.coverage.touch(iid, "_with");
		Log.logHigh("With {val}");
		return { result: val };
	}


	functionEnter(iid, f, _dis, _args) {
		this.state.coverage.touch(iid, "functionEnter");
		this.state.funcStack.push(f);
		Log.logHigh(`Entering ${ObjectHelper.asString(f)} near ${this._location(iid)}`);

		// Log.log("次の関数にEnter");
		// Log.log(f.name);
		// Log.log(f.toString());
		// for (let i in _dis) {
		// 	Log.log(i);
		// 	Log.log(_dis[i]);
		// }
		// for (let i in _args) {
		// 	Log.log(i);
		// 	Log.log(_args[i]);
		// }
	}


	functionExit(iid, returnVal, wrappedExceptionVal) {
		this.state.coverage.touch(iid, "functionExit");
		this.state.funcStack.pop();
		Log.logHigh(`Exiting function ${this._location(iid)}`);
		return {
			returnVal: returnVal,
			wrappedExceptionVal: wrappedExceptionVal,
			isBacktrack: false
		};
	}


	_scriptDepth() {
		return this._fileList.length;
	}


	_addScript(fd) {
		this._fileList.push(fd);
	}


	_removeScript() {
		return this._fileList.pop();
	}


	scriptEnter(iid, instrumentedFileName, originalFileName) {
		//this.state.coverage.touch(iid);

		const enterString = `====== ENTERING SCRIPT ${originalFileName}(${instrumentedFileName}) depth ${this._scriptDepth()} ======`;

		if (this._scriptDepth() == 0) {
			Log.log(enterString);
		} else {
			Log.logMid(enterString);
		}

		this._addScript(originalFileName);
		if (this.state.allFileList.indexOf(originalFileName) === -1) this.state.allFileList.push(originalFileName);
	}


	scriptExit(iid, wrappedExceptionVal) {
		//this.state.coverage.touch(iid);

		const originalFileName = this._removeScript();
		const exitString = `====== EXITING SCRIPT ${originalFileName} depth ${this._scriptDepth()} ======`;

		if (this._scriptDepth() > 0) {
			Log.logMid(exitString);
		} else {
			Log.log(exitString);
		}

		return {
			wrappedExceptionVal: wrappedExceptionVal,
			isBacktrack: false
		};
	}


	binaryPre(iid, op, left, right, _isOpAssign, _isSwitchCaseComparison, _isComputed) {

		//Don't do symbolic logic if the symbolic values are diff types
		//Concretise instead

		if (this.state.isWrapped(left) || this.state.isWrapped(right)) {

			const left_c  = this.state.getConcrete(left),
				right_c = this.state.getConcrete(right);

			//We also consider boxed primatives to be primative
			const is_primative = typeof(left_c) != "object" || (left_c instanceof Number || left_c instanceof String || left_c instanceof Boolean);
			const is_null = left_c === undefined || right_c === undefined || left_c === null || right_c === null;
			const is_real = typeof(left_c) == "number" ? (Number.isFinite(left_c) && Number.isFinite(right_c)) : true;

			//TODO: Work out how to check that boxed values are the same type
			const is_same_type = typeof(left_c) === typeof(right_c) || (!is_null && left_c.valueOf() === right_c.valueOf());

			if (!is_same_type || !is_primative || is_null || !is_real) {
				Log.log(`Concretizing binary ${op} on operands of differing types. Type coercion not yet implemented symbolically. (${ObjectHelper.asString(left_c)}, ${ObjectHelper.asString(right_c)}) (${typeof left_c}, ${typeof right_c})`);
				const left_t  = this.state.getTaint(left),
					right_t = this.state.getTaint(right);
				const result_t = left_t.concat(right_t.filter(v => left_t.indexOf(v) === -1));
				if (result_t.length > 0) {
					this.state.concritizedOpTaint = result_t;
				}
				left = left_c;
				right = right_c;
			} else {
				Log.logHigh("Not concretizing " + op + " " + left + " " + right + " " + typeof left_c + " " + typeof right_c);
			}

		}

		// Don't evaluate natively when args are symbolic
		return {
			op: op,
			left: left,
			right: right,
			skip: this.state.isWrapped(left) || this.state.isWrapped(right)
			// skip: this.state.isWrapped(left) || this.state.isWrapped(right) || !!this.state.concritizedOpTaint
		};
	}


	binary(iid, op, left, right, result_c, _isOpAssign, _isSwitchCaseComparison, _isComputed) {
		this.state.coverage.touch(iid, "binary", op);

		Log.logHigh("Op " + op + " left " + ObjectHelper.asString(left) + " right " + ObjectHelper.asString(right) + " result_c " + ObjectHelper.asString(result_c) + " at " + this._location(iid));

		return {
			result: this.state.binary(op, left, right)
		};
	}


	unaryPre(iid, op, left) {
		// Don't evaluate natively when args are symbolic
		return {
			op: op,
			left: left,
			skip: this.state.isWrapped(left)
		};
	}


	unary(iid, op, left, result_c) {
		this.state.coverage.touch(iid, "unary", op);

		Log.logHigh("Unary " + op + " left " + ObjectHelper.asString(left) + " result " + ObjectHelper.asString(result_c));

		return {
			result: this.state.unary(op, left)
		};
	}


	conditional(iid, result) {
		this.state.coverage.touch_cnd(iid, this.state.getConcrete(result));

		if (this.state.isSymbolic(result)) {
			Log.logMid(`Evaluating symbolic condition ${this.state.asSymbolic(result)} at ${this._location(iid)}`);
			this.state.conditional(this.state.toBool(result));
		} else {
			Log.logMid(`Evaluating concreat condition ${ObjectHelper.asString(result)} at ${this._location(iid)}`);
		}

		if (this.state.isTainted(result)) {
			// このオブジェクトを用意する
			// 違う文脈で複数回来ることはあるのか？ないと仮定しよ
			const id = iid+"###"+this._location(iid);
			if (!this.state.branchUseMap[id]) {
				this.state.branchUseMap[id] = [];
			}
			this.state.branchUseMap[id].push({use: this.state.getTaint(result), eid: this.state.getExecutionAsyncId()});
			// this.state.branchUseMap[this._location(iid)].push({use: this.state.getTaint(result), eid: this.state.getExecutionAsyncId(), iid: iid});
		}

		return { result: this.state.getConcrete(result) };
	}


	instrumentCodePre(iid, code) {
		// Log.log(`計装するよ ${code} at ${this._location(iid)}`);
		return { code: code, skip: false };
	}


	instrumentCode(iid, code, _newAst) {
		// Log.log(`計装されたやつ？ ${code} at ${this._location(iid)}`);
		return { result: code };
	}


	/*runInstrumentedFunctionBody(iid) {}*/
	onReady(cb) { cb(); }

}

export default SymbolicExecution;
