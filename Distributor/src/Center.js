/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */


import Spawn from "./Spawn";
import Strategy from "./Strategy";
import Coverage from "./CoverageAggregator";
import Stats from "Stats";
import Log from "./Log";
import Informations from "./Informations";
import Learning from "./Learning";
import LearningFake from "./LearningFake";

class Center {

	constructor(options) {
		this.cbs = [];
		this._cancelled = false;
		this.options = options;
		this._loggingFunction = false;
	}

	_log (msg) {
		if (this._loggingFunction) {
			console.log("[Center] "+msg);
		}
	}

	start(fileA, fileB, baseInput) {
		this._log("start");

		this._done = [];
		this._errors = 0;
		// this._running = [];
		this._coverageA = new Coverage();
		this._coverageB = new Coverage();
		this._statsA = new Stats();
		this._statsB = new Stats();

		this._startTesting([{
			id: 0,
			pathA: fileA,
			pathB: fileB,
			input: baseInput || { _boundA: 0, _boundB: 0},
			requestSeqA: [],
			requestSeqB: [],
			cbOrderA: {id: "init"},
			cbOrderB: {id: "init"},
			preRewards: []
		}]);

		return this;
	}

	done(cb) {
		this._log("done");

		this.cbs.push(cb);
		return this;
	}

	_startTesting(cases) {
		this._log("_startTesting");

		// console.log("call function _startTesting");

		this._infoA = new Informations(this.options, this._coverageA, "A");
		this._infoB = new Informations(this.options, this._coverageB, "B");
		this._learning = process.env.LEARNING === "1" ? new Learning(this.options, this._infoA, this._infoB, this) : new LearningFake(this);
		this._strategy = new Strategy(this.options, this._infoA, this._infoB, this._learning);

		cases.forEach(i => this._strategy._inputQueue.push(i));
		this._printStatus();

		// ここで初期入力は実行しちゃってもいい気がする
		this._learning.start();
	}


	moveStep(action) {
		this._log("moveStep");

		if (!this._cancelled) {
			let test = this._strategy.next(action);
			// console.log("testしたい "+JSON.stringify(test));
			if (test) {
				this._testFile(test);
				return {};
			} else {
				// this._executeFail();
				return {notFind: true};
			}
		} else {
			return {cancel: true};
		}
	}

	// _executeFail() {
	// 	this._log("_executeFail");
	//
	// 	// console.log("テスト見つからなかった");
	// 	this._learning.update(0, false);
	// }

	_executed() {
		this._log("_executed");

		if (this._strategy.rewards === 0) {
			this._strategy.addRewards(this.options.learningEnv.rewards.noRewards, "noRewards");
		}

		// continueで続けるかどうか確認
		if (!this._strategy.continue()) {
			// console.log("終わるよ");
			this._learning.update(this._strategy.rewards, true);
			// this._finishedTesting();
		} else {
			// console.log("updateするよ");
			this._learning.update(this._strategy.rewards, false);
		}
	}

	_postTest() {
		this._log("_postTest");

		this._running = undefined;
		this._printStatus();
	}

	_printStatus() {
		Log("[" + this._done.length + " done / " + this._strategy.length() +" queued / " + this._errors + " errors / " + (this._coverageA.current().loc.toFixed(2)+this._coverageB.current().loc.toFixed(2)) / 2 * 100 + "% coverage ] ***");
	}

	// doneで登録したコールバックはここで実行
	// 中身はDistributorの55行目
	_finishedTesting() {
		this._log("_finishedTesting");

		this.cbs.forEach(cb => cb(this, this._done, this._errors, this._coverageA, this._statsA.final(), this._coverageB, this._statsB.final()));
	}


	cancel() {
		this._log("cancel");

		this._cancelled = true;
		this._running.kill();
		// this._running.forEach(test => test.kill());
		process.exit(1);
		// this._finishedTesting();
	}


	_expand (file, finalOutA, finalOutB) {
		this._log("_expand");

		// どちらかがundefinedの時はここで擬似オブジェクト渡せばいいのかもしれない(めんどくせえ)
		// エラー出せばいっか

		// if (finalOutA.errors.length > 0 && finalOutB.errors.length > 0) return;

		// console.log(this._strategy.nextExec);
		const rewards = this._strategy.nextExec.preRewards.concat([this._strategy.rewards]);

		// それぞれの中で報酬の記録をしたい
		this._strategy.updateCEPT(file.id, finalOutA.readWriteVars, finalOutB.readWriteVars);
		this._strategy.updateCbOrderTree(file, finalOutA, finalOutB, rewards);
		this._strategy.addInputs(file, finalOutA, finalOutB, rewards);
		if (finalOutA.errors.length === 0 || finalOutB.errors.length === 0) {
			this._strategy.addRequests(file, finalOutA, finalOutB, rewards);
		} else {
			console.log(finalOutA.errors.map(e => e.error));
			console.log(finalOutB.errors.map(e => e.error));
		}
	}


	_pushDone(test, finalOutA, coverageA, errorsA, finalOutB, coverageB, errorsB) { //add
		this._log("_pushDone");

		this._done.push({
			id: test.file.id,
			input: finalOutA.input,
			requestSeq: finalOutA.requestSeq,
			cbOrder: finalOutA.cbOrder,
			pcA: finalOutA.pc,
			errorsA: errorsA,
			pcB: finalOutB.pcB,
			errorsB: errorsB,
			changeCoverage: this._strategy.changedCoverage(),
			time: test.time(),
			startTime: test.startTime(),
			coverageA: this._coverageA.current(),
			coverageB: this._coverageB.current(),
			case_coverageA: this.options.perCaseCoverage ?  new Coverage().add(coverageA).final(true) : undefined,
			case_coverageB: this.options.perCaseCoverage ?  new Coverage().add(coverageB).final(true) : undefined,
			replayA: test.makeReplayString("A"),
			replayB: test.makeReplayString("B"),
			alternativesA: finalOutA.alternatives? finalOutA.alternatives.length : 0,
			alternativesB: finalOutB.alternatives? finalOutB.alternatives.length : 0
		});

		// if (errorsA.length + errorsB.length) {
		// 	this._errors += 1;
		// }
	}


	// spawnでdoneとして渡される
	_testFileDone(spawn, codeA, codeB, finalOutA, coverageA, logA, finalOutB, coverageB, logB, fsErrorsA, fsErrorsB) { //add
		this._log("_testFileDone");

		// 必要ならlogを渡せる

		// console.log("テスト一個終わった");

		let errorsA = fsErrorsA;
		let errorsB = fsErrorsB;

		if (codeA != 0) {
			errorsA.push({error: "Exit codeA non-zero"});
		}
		if (codeB != 0) {
			errorsB.push({error: "Exit codeB non-zero"});
		}


		// console.log(finalOutA);

		if (finalOutA && finalOutB) {
			if (coverageA) {
				this._coverageA.add(coverageA);
				// this._strategy.rewards += this._infoA.updateCoverage(finalOutA.iidSeq, finalOutA.iidCommandMap);
				const rewardsA = this._infoA.updateCoverage(finalOutA.iidSeq, finalOutA.iidCommandMap, finalOutA.eventRecord);
				this._strategy.addRewards(rewardsA, "coverageA");
			}
			if (coverageB) {
				this._coverageB.add(coverageB);
				// this._strategy.rewards += this._infoB.updateCoverage(finalOutB.iidSeq, finalOutB.iidCommandMap);
				const rewardsB = this._infoB.updateCoverage(finalOutB.iidSeq, finalOutB.iidCommandMap, finalOutB.eventRecord);
				this._strategy.addRewards(rewardsB, "coverageB");
			}

			// cbOrderは指定した順番
			// コールバックのexecIdが実際に実行された順番に相当
			finalOutA.eventRecord.sort((a, b) => a.cbExecId - b.cbExecId);
			finalOutB.eventRecord.sort((a, b) => a.cbExecId - b.cbExecId);
			finalOutA.cbOrder.executed = finalOutA.eventRecord.map(e => e.id);
			finalOutB.cbOrder.executed = finalOutB.eventRecord.map(e => e.id);

			this._pushDone(spawn, finalOutA, coverageA, errorsA.concat(finalOutA.errors), finalOutB, coverageB, errorsB.concat(finalOutB.errors));

			const self = this;
			finalOutA.readWriteVars.forEach(v => {
				v.val_c = JSON.stringify(self._strategy.objectSort(v.val_c));
			});
			finalOutB.readWriteVars.forEach(v => {
				v.val_c = JSON.stringify(self._strategy.objectSort(v.val_c));
			});

			const rewardsA = this._infoA.updateInfo(finalOutA);
			this._strategy.addRewards(rewardsA, "requestA");
			const rewardsB = this._infoB.updateInfo(finalOutB);
			this._strategy.addRewards(rewardsB, "requestB");

			this._strategy._executedMap[spawn.file.id] = {file: spawn.file, altA: finalOutA.alternatives, altB: finalOutB.alternatives};
			this._strategy.checkOutputs(spawn.file, finalOutA, finalOutB);
			this._statsA.merge(finalOutA.stats); //statsって何
			this._statsB.merge(finalOutB.stats); //statsって何
			this._expand(spawn.file, finalOutA, finalOutB);
		} else if (finalOutA) {
			finalOutA.eventRecord.sort((a, b) => a.cbExecId - b.cbExecId);
			finalOutA.cbOrder.executed = finalOutA.eventRecord.map(e => e.id);
			this._pushDone(spawn, finalOutA, coverageA, errorsA.concat(finalOutA.errors), spawn.file, coverageB, errorsB.concat([{ error: "Error extracting final output - a fatal error must have occured" }]));
			this._expand(spawn.file, finalOutA);
			this._infoA.updateInfo(finalOutA.requests, finalOutA.readWriteVars);
			this._statsA.merge(finalOutA.stats); //statsって何
		} else if (finalOutB) {
			finalOutB.eventRecord.sort((a, b) => a.cbExecId - b.cbExecId);
			finalOutB.cbOrder.executed = finalOutB.eventRecord.map(e => e.id);
			this._pushDone(spawn, spawn.file, coverageA, errorsA.concat([{ error: "Error extracting final output - a fatal error must have occured" }]), finalOutB, coverageB, errorsB.concat(finalOutB.errors));
			this._expand(spawn.file, undefined, finalOutB);
			this._infoB.updateInfo(finalOutB.requests, finalOutB.readWriteVars);
			this._statsB.merge(finalOutB.stats); //statsって何
		} else {
			this._pushDone(spawn, spawn.file, coverageA, errorsA.concat([{ error: "Error extracting final output - a fatal error must have occured" }]), spawn.file, coverageB, errorsB.concat([{ error: "Error extracting final output - a fatal error must have occured" }]));
		}

		this._postTest();
		this._executed();

	}


	// ここで1つの入力のテストを開始している
	_testFile(file) {
		this._log("_testFile");
		// fileはstrategyで返したオブジェクト

		let nextTest = new Spawn(this.options.analyseScript, file, {
			log: this.options.printPaths,
			timeout: this.options.testMaxTime,
			targetDir: this.options.targetDir,
			logDir: this.options.logDir,
		});

		this._running = nextTest.start(this._testFileDone.bind(this));
		// this._running.push(nextTest.start(this._testFileDone.bind(this)));
		this._printStatus();
	}

}

export default Center;
