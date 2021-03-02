// この辺をjalangiじゃなくてexpoSE側でうまいことやりたい
import External from "./External";
import Config from "./SolverConfig";

const Z3 = External.load("z3javascript").default;

class Solver {
	constructor (input, alternativesA, alternativesB) {
		this.input = input;
		this.inputSymbolsA = {};
		this.inputProcCountsA = alternativesA.inputProcCounts;
		this.pathConditionA = alternativesA.pathCondition;
		this.procListA = alternativesA.procList;
		this.inputSymbolsB = {};
		this.inputProcCountsB = alternativesB.inputProcCounts;
		this.pathConditionB = alternativesB.pathCondition;
		this.procListB = alternativesB.procList;
		this._loggingFunction = false;

		this.ctx = new Z3.Context();
		this.slv = new Z3.Solver(this.ctx,
			Config.incrementalSolverEnabled,
			[
				{ name: "timeout", value: Config.maxSolverTime },
				{ name: "random_seed", value: Math.floor(Math.random() * Math.pow(2, 32))},
				{ name: "phase_selection", value: 5 }
			]
		);

		this._initialize();
	}


	_log (msg) {
		if (this._loggingFunction) {
			console.log("[Solver] "+msg);
		}
	}


	_initialize () {
		this._log("_initialize");

		// Z3の関数を適用
		this.symbolMapA = {};
		for (let i in this.procListA) {
			// console.log(this.procList[i].args[0]);
			// console.log(i);
			// console.log(this.procListA[i]);
			this.symbolMapA[this.procListA[i].count] = this._applyZ3Proc(this.procListA[i], this.symbolMapA);
		}
		this.symbolMapB = {};
		for (let i in this.procListB) {
			// console.log(this.procList[i].args[0]);
			// console.log(i);
			// console.log(this.procListB[i]);
			this.symbolMapB[this.procListB[i].count] = this._applyZ3Proc(this.procListB[i], this.symbolMapB);
		}

		// console.log(this.pathConditionA.filter(x => !x.procCount));
		// console.log(this.pathConditionB.filter(x => !x.procCount));

		// inputSymbolsとpathConditionのastにマッピング
		for(let i in this.pathConditionA) {
			// console.log(this.pathConditionA[i]);
			let count = this.pathConditionA[i].procCount;
			this.pathConditionA[i].ast = this.symbolMapA[count];
		}
		for(let i in this.pathConditionB) {
			// console.log(this.pathConditionB[i]);
			let count = this.pathConditionB[i].procCount;
			this.pathConditionB[i].ast = this.symbolMapB[count];
		}

		for(let name in this.inputProcCountsA) {
			let count = this.inputProcCountsA[name];
			this.inputSymbolsA[name] = this.symbolMapA[count];
		}
		for(let name in this.inputProcCountsB) {
			let count = this.inputProcCountsB[name];
			this.inputSymbolsB[name] = this.symbolMapB[count];
		}

		this.inputSymbolList = Object.keys(this.inputSymbolsA).concat(Object.keys(this.inputSymbolsB).filter(n => Object.keys(this.inputSymbolsA).indexOf(n) === -1));
		this._buildInputEqAsserts().forEach(x => this.slv.assert(x));

		Z3.Query.MAX_REFINEMENTS = Config.maxRefinements;
		// console.log(this.slv.toString());

		// これめっちゃログ吐くけど必要？？
		this._setupSmtFunctions();

	}


	_applyZ3Proc(proc, symbolMap) {
		this._log("_applyZ3Proc");

		try {
			let func;
			if (this.ctx[proc.func]) {
				func = this.ctx[proc.func];
				let newArgs = [];
				for (let i in proc.args) {
					// procオブジェクトなら置き換え
					// 再帰的に置き換えないといけない
					newArgs.push(this._replaceProc(proc.args[i], symbolMap));
				}
				return func.apply(this.ctx, newArgs);
			} else {
				let obj, len, idx, val;
				switch (proc.func) {
				case "getZ3RegexAst":
					return Z3.Regex(this.ctx, /^[^A-Z]+$/).ast;
				case "getLength":
					obj = this._replaceProc(proc.args[0], symbolMap);
					return obj.getLength();
				case "setLength":
					obj = this._replaceProc(proc.args[0], symbolMap);
					len = this._replaceProc(proc.args[1], symbolMap);
					return obj.setLength(len);
				case "getField":
					obj = this._replaceProc(proc.args[0], symbolMap);
					idx = this._replaceProc(proc.args[1], symbolMap);
					return obj.getField(idx);
				case "setField":
					obj = this._replaceProc(proc.args[0], symbolMap);
					idx = this._replaceProc(proc.args[1], symbolMap);
					val = this._replaceProc(proc.args[2], symbolMap);
					return obj.setField(idx, val);
				default:
					console.log("そんな関数ないぞ! "+proc.func);
					return;
				}
			}
		} catch (e) {
			// console.log("エラー起きた "+ e);
			return;
		}
	}


	_replaceProc (obj, symbolMap) {
		this._log("_replaceProc");
		if (obj.proc) {
			return symbolMap[obj.count];
		} else if (typeof obj === "object") {
			let newObj = (obj.constructor === Array)? [] : {};
			for (let key in obj) {
				newObj[key] = this._replaceProc(obj[key], symbolMap);
			}
			return newObj;
		} else {
			return obj;
		}
	}


	/** Set up a bunch of SMT functions used by the models **/
	_setupSmtFunctions() {

		// this.stringRepeat = this.ctx.mkRecFunc(this.ctx.mkStringSymbol("str.repeat"), [this.ctx.mkStringSort(), this.ctx.mkIntSort()], this.ctx.mkStringSort());

		this.slv.fromString("(define-fun-rec str.repeat ((a String) (b Int)) String (if (<= b 0) \"\" (str.++ a (str.repeat a (- b 1)))))");

		// this.whiteLeft = this.ctx.mkRecFunc(this.ctx.mkStringSymbol("str.whiteLeft"), [this.ctx.mkStringSort(), this.ctx.mkIntSort()], this.ctx.mkIntSort());
		// this.whiteRight = this.ctx.mkRecFunc(this.ctx.mkStringSymbol("str.whiteRight"), [this.ctx.mkStringSort(), this.ctx.mkIntSort()], this.ctx.mkIntSort());

		/** Set up trim methods **/
		this.slv.fromString(
			"(define-fun str.isWhite ((c String)) Bool (= c \" \"))\n" + //TODO: Only handles
			"(define-fun-rec str.whiteLeft ((s String) (i Int)) Int (if (str.isWhite (str.at s i)) (str.whiteLeft s (+ i 1)) i))\n" +
			"(define-fun-rec str.whiteRight ((s String) (i Int)) Int (if (str.isWhite (str.at s i)) (str.whiteRight s (- i 1)) i))\n"
		);
	}

	_myStringPC(pc) {
		return pc.map(x => x.ast.toString()).join(", ");
	}

	compareOutputs(file, outA, outB) {
		this._log("compareOutputs");
		// console.log(JSON.stringify(outA, null, 2));
		// console.log(JSON.stringify(outB, null, 2));
		console.log("outputA");
		for (let key in outA) {
			console.log("key: "+key);
			for (let i in outA[key]) {
				console.log(outA[key][i].concrete);
			}
			console.log("---");
		}
		console.log("outputB");
		for (let key in outB) {
			console.log("key: "+key);
			for (let i in outB[key]) {
				console.log(outB[key][i].concrete);
			}
			console.log("---");
		}

		const nameList = Object.keys(outA).concat(Object.keys(outB).filter(n => Object.keys(outA).indexOf(n) === -1));
		for (let i in nameList) {
			const name = nameList[i];
			if (!outA[name] || !outB[name]) {
				return {
					input: file.input,
					requestSeqA: file.requestSeqA,
					requestSeqB: file.requestSeqB,
					cbOrderA: file.cbOrderA,
					cbOrderB: file.cbOrderB,
					msg: name+"がなかった",
					outA: JSON.stringify(outA),
					outB: JSON.stringify(outB),
				};
			}
			if (outA[name].length !== outB[name].length) {
				return {
					input: file.input,
					requestSeqA: file.requestSeqA,
					requestSeqB: file.requestSeqB,
					cbOrderA: file.cbOrderA,
					cbOrderB: file.cbOrderB,
					msg: name+"の数が違う",
					outA: JSON.stringify(outA),
					outB: JSON.stringify(outB),
				};
			}
			for (let i in outA[name]) {
				const valueA = outA[name][i];
				const valueB = outB[name][i];
				// console.log(name+" "+i);
				// console.log(typeof valueA.concrete + " " + typeof valueB.concrete);
				// console.log(JSON.stringify(valueA.concrete) + " " + JSON.stringify(valueB.concrete));
				if (typeof valueA.concrete !== typeof valueB.concrete || JSON.stringify(valueA.concrete) !== JSON.stringify(valueB.concrete)) {
					return {
						input: file.input,
						requestSeqA: file.requestSeqA,
						requestSeqB: file.requestSeqB,
						cbOrderA: file.cbOrderA,
						cbOrderB: file.cbOrderB,
						msg: name+"の値が違う"+`(A: ${JSON.stringify(valueA.concrete)} B: ${JSON.stringify(valueB.concrete)})`,
						outA: JSON.stringify(outA),
						outB: JSON.stringify(outB),
					};
				}

				const sA = this.symbolMapA[valueA.procCount];
				const sB = this.symbolMapB[valueB.procCount];
				if (!sA || !sB) {
					if (!sA && !sB) continue; // 両方ともないのはおっけー
					else return {
						input: file.input,
						requestSeqA: file.requestSeqA,
						requestSeqB: file.requestSeqB,
						cbOrderA: file.cbOrderA,
						cbOrderB: file.cbOrderB,
						msg: name+"のシンボルがなかった",
						outA: JSON.stringify(outA),
						outB: JSON.stringify(outB),
					};
				}
				// console.log(sA.toString());
				// console.log(sB.toString());

				// パス条件は全部じゃなくて関連する出力の部分までみれば十分
				// まとめてじゃなくて各出力ごとにソルバを起動すべき
				this._buildAssertsA(valueA.pcLength).forEach(x => {
					// console.log(x);
					this.slv.assert(x);
				});
				// this.slv.push();
				this._buildAssertsB(valueB.pcLength).forEach(x => {
					// console.log(x);
					this.slv.assert(x);
				});
				// this.slv.push();
				// this._buildInputEqAsserts().forEach(x => this.slv.assert(x));
				this.slv.push();

				let query = this.ctx.mkNot(this.ctx.mkEq(sA, sB));

				let allPc = this.pathConditionA.slice(0, valueA.pcLength).concat(this.pathConditionB.slice(0, valueB.pcLength));
				let allChecks = allPc.reduce((last, next) => last.concat(next.ast.checks), []).concat(query.checks);

				// console.log(this.slv.toString());
				// console.log(query.toString());
				let solution = this._checkSat(query, allChecks);
				if (solution) {
					return {
						input: solution,
						requestSeqA: file.requestSeqA,
						requestSeqB: file.requestSeqB,
						cbOrderA: file.cbOrderA,
						cbOrderB: file.cbOrderB,
						msg: name+i+"を異なる出力にする入力があった"};
				}
				this.slv.reset();
			}
		}
	}


	generateWriteDiffInput(pcIndexA, pcIndexB, writeVarsA, writeVarsB) {
		this._log("generateWriteDiffInput");
		// パス条件は全部じゃなくて関連するwriteの部分までみれば十分
		this._buildAssertsA(pcIndexA+1).forEach(x => this.slv.assert(x));
		// this.slv.push();
		this._buildAssertsB(pcIndexB+1).forEach(x => this.slv.assert(x));
		// this.slv.push();
		// this._buildInputEqAsserts().forEach(x => this.slv.assert(x));
		this.slv.push();

		let allPc = this.pathConditionA.slice(0, pcIndexA+1).concat(this.pathConditionB.slice(0, pcIndexB+1));
		let preChecks = allPc.reduce((last, next) => last.concat(next.ast.checks), []);

		// writeVarsAの具体値が一緒の時呼び出される
		// そのまま比較していいのか変数名ごとにマッピングした方がいいのか

		// 1個でも書き込みが異なるようなものがあればおっけー
		// これよくわかってない
		for (let i in writeVarsA) {
			let sA = this.symbolMapA[writeVarsA[i].procCount];
			let sB = this.symbolMapB[writeVarsB[i].procCount];
			let query = this.ctx.mkNot(this.ctx.mkEq(sA, sB));

			let allChecks = preChecks.concat(query.checks);
			let solution = this._checkSat(query, allChecks);
			if (solution) return solution;
		}
		for (let i in writeVarsB) {
			let sA = this.symbolMapA[writeVarsA[i].procCount];
			let sB = this.symbolMapB[writeVarsB[i].procCount];
			let query = this.ctx.mkNot(this.ctx.mkEq(sA, sB));

			let allChecks = preChecks.concat(query.checks);
			let solution = this._checkSat(query, allChecks);
			if (solution) {
				solution._boundA = pcIndexA;
				solution._boundB = pcIndexB;
				return solution;
			}
		}
	}


	generateCondDiffInput(pcIndexA, pcIndexB) {
		this._log("generateCondDiffInput");
		//Push all PCs up until pcIndexA
		this._buildAssertsA(pcIndexA).forEach(x => this.slv.assert(x));
		// this.slv.push();
		this._buildAssertsB(pcIndexB).forEach(x => this.slv.assert(x));
		// this.slv.push();
		// 各inputシンボルが等しいよって制約が必要？？？？？本当に？？？とりあえずなしで動いている
		// this._buildInputEqAsserts().forEach(x => this.slv.assert(x));
		this.slv.push();

		// クエリとアサートの違いがよくわからない
		let newPCs = [this.ctx.mkNot(this.pathConditionA[pcIndexA].ast), this.pathConditionB[pcIndexB].ast];
		let allPc = this.pathConditionA.slice(0, pcIndexA).concat(this.pathConditionB.slice(0, pcIndexB));
		let allChecks = allPc.reduce((last, next) => last.concat(next.ast.checks), []).concat(newPCs[0].checks).concat(newPCs[1].checks);
		let solution = this._checkSat(newPCs, allChecks);
		if (solution) {
			this.slv.reset();
			solution._boundA = pcIndexA + 1;
			solution._boundB = pcIndexB + 1;
			return solution;
		}

		newPCs = [this.ctx.mkNot(this.pathConditionB[pcIndexB].ast), this.pathConditionA[pcIndexA].ast];
		allChecks = allPc.reduce((last, next) => last.concat(next.ast.checks), []).concat(newPCs[0].checks).concat(newPCs[1].checks);
		solution = this._checkSat(newPCs, allChecks);
		if (solution) {
			this.slv.reset();
			solution._boundA = pcIndexA + 1;
			solution._boundB = pcIndexB + 1;
			return solution;
		}

		this.slv.reset();
	}


	_buildInputEqAsserts () {
		this._log("_buildInputEqAsserts");
		let ret = [];
		for(let name in this.inputSymbolList) {
			if (this.inputSymbolsA[name] && this.inputSymbolsB[name]) {
				ret.push(this.ctx.mkEq(this.inputSymbolsA[name], this.inputSymbolsB[name]));
			}
		}
		return ret;
	}


	generateInputs(boundA, boundB, infoA, infoB) {
		this._log("generateInputs");
		if (boundA >= this.pathConditionA.length && boundB >= this.pathConditionB.length) {
			// throw `Bound ${this.input._bound} > ${this.pathConditionA.length}, divergence has occured`;
			return [];
		}

		this._buildAssertsA(Math.min(boundA, this.pathConditionA.length)).forEach(x => this.slv.assert(x));
		this._buildAssertsB(Math.min(boundB, this.pathConditionB.length)).forEach(x => this.slv.assert(x));
		this.slv.push();

		let newInputs = [];

		for (let i=boundA; i<this.pathConditionA.length; i++) {
			if (!this.pathConditionA[i].binder) {
				// if (!this.pathConditionA[i].ast) break;
				// console.log(this.slv.toString());
				// console.log(this.pathConditionA[i].ast.toString());
				const forkLocA = this.pathConditionA[i].forkLoc;
				// const blockIdA = infoA.getCondBlockId(forkLocA);
				const forkIidA = this.pathConditionA[i].forkIid;
				const blockIdA = infoA.getCondBlockId(forkIidA, forkLocA);
				const blockIdB = (!infoA.nodeMap[blockIdA] || infoA.nodeMap[blockIdA].mapped === "added") ? undefined : infoA.nodeMap[blockIdA].mapped;

				const newPC = this.ctx.mkNot(this.pathConditionA[i].ast);
				const allChecks = this.pathConditionA.slice(0, i).concat(this.pathConditionB.slice(0, boundB)).reduce((last, next) => last.concat(next.ast.checks), []).concat(newPC.checks);
				const solution = this._checkSat(newPC, allChecks);

				for (let key in solution) {
					solution[key] = typeof solution[key] === "string"? solution[key].replace("\u0000", "a") : solution[key];
				}
				// console.log(solution);

				if (solution) {
					solution._boundA = i + 1;
					solution._boundB = boundB;
					newInputs.push({input: solution, blockIdA: blockIdA, blockIdB: blockIdB});
				} else {
					if (infoA.nodeMap[blockIdA]) infoA.nodeMap[blockIdA].failNegate++;
					if (infoB.nodeMap[blockIdB]) infoB.nodeMap[blockIdB].failNegate++;
				}

				//Push the current thing we're looking at to the solver
				this.slv.assert(this.pathConditionA[i].ast);
				this.slv.push();
			}
		}

		for (let i=boundB; i<this.pathConditionB.length; i++) {

			if (!this.pathConditionB[i].binder) {
				// if (!this.pathConditionB[i].ast) break;
				const forkLocB = this.pathConditionB[i].forkLoc;
				// const blockIdB = infoB.getCondBlockId(forkLocB);
				const forkIidB = this.pathConditionB[i].forkIid;
				const blockIdB = infoB.getCondBlockId(forkIidB, forkLocB);
				const blockIdA = (!infoB.nodeMap[blockIdB] || infoB.nodeMap[blockIdB].mapped === "added") ? undefined : infoB.nodeMap[blockIdB].mapped;
				// if (infoB.nodeMap[blockIdB] && infoB.nodeMap[blockIdB].diff === "unchanged") continue; // 絶対に制約解決不可能なので追加しない、いやその前の値が違う可能性あるか

				const newPC = this.ctx.mkNot(this.pathConditionB[i].ast);
				const allChecks = this.pathConditionA.concat(this.pathConditionB.slice(0, i)).reduce((last, next) => last.concat(next.ast.checks), []).concat(newPC.checks);
				const solution = this._checkSat(newPC, allChecks);

				// console.log(solution);
				if (solution) {
					solution._boundB = i + 1;
					solution._boundA = boundA;
					newInputs.push({input: solution, blockIdA: blockIdA, blockIdB: blockIdB});
				} else {
					if (infoA.nodeMap[blockIdA]) infoA.nodeMap[blockIdA].failNegate++;
					if (infoB.nodeMap[blockIdB]) infoB.nodeMap[blockIdB].failNegate++;
				}

				//Push the current thing we're looking at to the solver
				this.slv.assert(this.pathConditionB[i].ast);
				this.slv.push();
			}
		}

		this.slv.reset();

		// console.log(newInputs);
		return newInputs;
	}


	_stringPC(pc) {
		this._log("_stringPC");
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


	_getSolution(model) {
		this._log("_getSolution");
		let solution = {};

		for (let i in this.inputSymbolList) {
			let name = this.inputSymbolList[i];
			let solutionAst = this.inputSymbolsA[name] ? model.eval(this.inputSymbolsA[name]) : model.eval(this.inputSymbolsB[name]);
			solution[name] = solutionAst.asConstant(model);
			solutionAst.destroy();
		}

		model.destroy();
		return solution;
	}

	_buildAssertsA(i) {
		return this.pathConditionA.slice(0, i).map(x => x.ast);
	}

	_buildAssertsB(i) {
		return this.pathConditionB.slice(0, i).map(x => x.ast);
	}

	_checkSat(clause, checks) {
		this._log("_checkSat");
		let model;
		if (clause.length) {
			// console.log(clause);
			model = new Z3.Query(clause, checks).getModel(this.slv);
		} else {
			model = new Z3.Query([clause], checks).getModel(this.slv);
		}
		return model ? this._getSolution(model) : undefined;
	}
}

export default Solver;
