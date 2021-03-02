/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */



import {spawn} from "child_process";

const tmp = require("tmp");
const fs = require("fs");
const kill = require("tree-kill");

const EXPOSE_REPLAY_PATH = "expoSE replay";

class Spawn {

	constructor(script, file, opts) {
		// console.log(file);

		this.script = script;
		this.file = file;
		this.options = opts;
		// テストファイル内のrequireは全て絶対パスにしちゃう？
		this.tmpCoverageFileA = tmp.fileSync();
		this.tmpOutFileA = tmp.fileSync();
		this.tmpLogFileA = tmp.fileSync(); //add
		this.tmpCoverageFileB = tmp.fileSync();
		this.tmpOutFileB = tmp.fileSync();
		this.tmpLogFileB = tmp.fileSync(); //add

		this.envA = JSON.parse(JSON.stringify(process.env));
		this.envB = JSON.parse(JSON.stringify(process.env));
		this.envG = JSON.parse(JSON.stringify(process.env));
		this.envA.EXPOSE_OUT_PATH = this.tmpOutFileA.name;
		this.envA.EXPOSE_COVERAGE_PATH = this.tmpCoverageFileA.name;
		this.envA.EXPOSE_LOG_PATH = this.tmpLogFileA.name; //playスクリプトで出力先に指定
		this.envB.EXPOSE_OUT_PATH = this.tmpOutFileB.name;
		this.envB.EXPOSE_COVERAGE_PATH = this.tmpCoverageFileB.name;
		this.envB.EXPOSE_LOG_PATH = this.tmpLogFileB.name;
		this.processCount = 0;
		this.codeA = 99999;
		this.codeB = 99999;
		this.codeG = 99999;

		console.log(this.tmpLogFileA.name);
		console.log(this.tmpLogFileB.name);

	}

	_tryParse(data, type, errors) {
		try {
			return JSON.parse(data);
		} catch (e) {
			errors.push({error: "Exception E: " + e + " of " + type + " on " + data});
			return null;
		}
	}

	startTime() {
		return this._startTime;
	}

	endTime() {
		return this._endTime;
	}

	time() {
		return this._endTime - this._startTime;
	}

	_recordEndTime() {
		this._endTiself = (new Date()).getTime();
	}

	_processAEnded(done) {

		let countA = 0;
		let self = this;
		let errorsA = [];
		let coverageA = null;
		let finalOutA = null;
		let logA = "";

		function cbA(err) {
			countA++;
			if (err) {
				errorsA.push({error: err});
			}
			if (countA === 3) {
				self.tmpOutFileA.removeCallback();
				self.tmpCoverageFileA.removeCallback();
				self.tmpLogFileA.removeCallback();
				done(finalOutA, coverageA, logA, errorsA);
			}
		}

		fs.readFile(this.tmpOutFileA.name, {encoding: "utf8"}, function(err, data) {
			if (!err) {
				// if (!data) console.log(self.tmpOutFileA.name);
				// console.log(data);
				finalOutA = self._tryParse(data, "test data", errorsA);
			}
			cbA(err);
		});

		fs.readFile(this.tmpCoverageFileA.name, {encoding: "utf8"}, function(err, data) {
			if (!err) {
				// console.log(data);
				coverageA = self._tryParse(data, "coverage data", errorsA);
			}
			cbA(err);
		});

		fs.readFile(this.tmpLogFileA.name, { encoding: "utf8" }, function (err, data) {
			if (!err) {
				// console.log(data);
				logA = data;
				let tmpfile = self.tmpLogFileA.name.split("/").pop();
				let filepath = self.options.logDir+"/jalangiLogA/"+tmpfile;
				fs.writeFile(filepath, data, function (err) {
					cbA(err);
				});
			} else {
				cbA(err);
			}
		});
	}

	_processBEnded(done) {

		let countB = 0;
		let self = this;
		let errorsB = [];
		let coverageB = null;
		let finalOutB = null;
		let logB = "";

		function cbB(err) {
			countB++;
			if (err) {
				errorsB.push({error: err});
			}
			if (countB === 3) {
				self.tmpOutFileB.removeCallback();
				self.tmpCoverageFileB.removeCallback();
				self.tmpLogFileB.removeCallback();
				// doneはCenterの_testFileDone
				done(finalOutB, coverageB, logB, errorsB);
			}
		}

		fs.readFile(this.tmpOutFileB.name, {encoding: "utf8"}, function(err, data) {
			if (!err) {
				// if (!data) console.log(self.tmpOutFileB.name);
				// console.log("test data: "+data);
				finalOutB = self._tryParse(data, "test data", errorsB);
			}
			cbB(err);
		});

		fs.readFile(this.tmpCoverageFileB.name, {encoding: "utf8"}, function(err, data) {
			if (!err) {
				// console.log("coverage data: "+data);
				coverageB = self._tryParse(data, "coverage data", errorsB);
			}
			cbB(err);
		});

		fs.readFile(this.tmpLogFileB.name, { encoding: "utf8" }, function (err, data) {
			if (!err) {
				// console.log(data);
				logB = data;
				let tmpfile = self.tmpLogFileB.name.split("/").pop();
				let filepath = self.options.logDir+"/jalangiLogB/"+tmpfile;
				fs.writeFile(filepath, data, function (err) {
					cbB(err);
				});
			} else {
				cbB(err);
			}
		});
	}


	shellescape(a) {
		let ret = [];

		a.forEach(function(s) {
			if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
				s = "'" + s.replace(/'/g, "'\\''") + "'";
			}
			ret.push(s);
		});

		return ret.join(" ");
	}

	_mkEnvReplay(fileId) {
		let env = {};
		if (fileId == "A") {
			env = this.envA;
		}
		if (fileId == "B") {
			env = this.envB;
		}
		let envStr = "";
		for (let i in env) {
			envStr += i + "=\"" + env[i] + "\" ";
		}
		return envStr;
	}

	makeReplayString(fileId) {
		if (fileId == "A") {
			return /* this._mkEnvReplay('A') + */ EXPOSE_REPLAY_PATH + " " + this.shellescape(this.argsA);
		}
		if (fileId == "B") {
			return /* this._mkEnvReplay('B') + */ EXPOSE_REPLAY_PATH + " " + this.shellescape(this.argsB);
		}
	}

	kill(fileId) {
		if (fileId == "A") {
			kill(this._pidA, "SIGKILL");
		} else if (fileId == "B") {
			kill(this._pidB, "SIGKILL");
		} else if (fileId == "G") {
			kill(this._pidG, "SIGKILL");
		} else {
			kill(this._pidA, "SIGKILL");
			kill(this._pidB, "SIGKILL");
			kill(this._pidG, "SIGKILL");
		}
	}

	_buildTimeout(fileId) {
		return setTimeout(() => {
			this.kill(fileId);
		}, this.options.timeout);
	}

	_arrangeEvent (finalOut) {
		finalOut.eventRecord = finalOut.eventRecord.filter(e => typeof e.cbExecId === "number");
		finalOut.eventRecord.sort((a, b) => a.cbExecId - b.cbExecId);
	}


	start(done) {

		const self = this;
		this._startTiself = (new Date()).getTime();

		try {
			const stdio = this.options.log ? ["ignore", "inherit", "inherit"] : ["ignore", "ignore", "ignore"];
			// console.log("argsA: "+this.argsA);
			self.argsA = [self.file.pathA, JSON.stringify(self.file.input), JSON.stringify(self.file.requestSeqA), JSON.stringify(self.file.cbOrderA)];

			// console.log(this.script);
			// console.log(this.argsA);
			// console.log(this.envA);

			const prcA = spawn(this.script, this.argsA, {
				stdio: stdio,
				env: this.envA,
				disconnected: false
			});
			// console.log("argsB: "+this.argsB);
			// console.log(this.envB);

			// console.log(prcA.pid);
			// console.log(prcB.pid);

			prcA.on("exit", codeA => {
				// console.log("codeA: "+code);
				clearTimeout(self._killTimeoutA);
				self._processAEnded((finalOutA, coverageA, logA, errorsA) => {

					if (errorsA.length > 0) console.log(errorsA);

					self._arrangeEvent(finalOutA);
					const cbOrderA = finalOutA.eventRecord.map(e => e.id);
					self.file.cbOrderB.executedA = cbOrderA;
					// console.log(self.file.cbOrderB);
					self.argsB = [self.file.pathB, JSON.stringify(self.file.input), JSON.stringify(self.file.requestSeqB), JSON.stringify(self.file.cbOrderB)];

					const prcB = spawn(self.script, self.argsB, {
						stdio: stdio,
						env: self.envB,
						disconnected: false
					});
					prcB.on("exit", codeB => {
						// console.log("codeB: "+code);
						clearTimeout(self._killTimeoutB);
						self._processBEnded((finalOutB, coverageB, logB, errorsB) => {

							if (errorsB.length > 0) console.log(errorsB);

							self._arrangeEvent(finalOutB);
							// console.log(finalOutB.eventRecord);

							const execFilesA = finalOutA.executeFiles;
							const execFilesB = finalOutB.executeFiles;
							const filesA = fs.readFileSync(self.options.logDir+"/graphs/callgraph/toolLog/acgA.filter", "utf-8").split("\n").slice(1).map(line => line.slice(1));
							const filesB = fs.readFileSync(self.options.logDir+"/graphs/callgraph/toolLog/acgB.filter", "utf-8").split("\n").slice(1).map(line => line.slice(1));
							const newFilesA = execFilesA.filter(f => filesA.indexOf(f) === -1);
							const newFilesB = execFilesB.filter(f => filesB.indexOf(f) === -1);
							const newFilesIdA = newFilesA.filter(f => f.indexOf(self.options.targetDir+"/dirA/") === 0)
								.map(f => f.slice((self.options.targetDir+"/dirA/").length));
							const newFilesIdB = newFilesB.filter(f => f.indexOf(self.options.targetDir+"/dirB/") === 0)
								.map(f => f.slice((self.options.targetDir+"/dirB/").length));
							let newFilesIdAB = newFilesIdA.concat(newFilesIdB.filter(id => newFilesIdA.indexOf(id) === -1));
							// 使用の有無にかかわらずファイル構成は同じと仮定する
							// ない場合は勝手にコピーするよ
							// console.log(newFilesIdAB);

							const argsG = [self.options.logDir, self.options.targetDir].concat(newFilesIdAB);
							// console.log(argsG);
							const prcG = spawn("./scripts/update_graphs", argsG, {
								stdio: stdio,
								env: self.envG,
								disconnected: false
							});
							prcG.on("exit", () => {
								done(self, codeA, codeB, finalOutA, coverageA, logA, finalOutB, coverageB, logB, errorsA, errorsB);
							});
							self._killTimeoutG = self._buildTimeout("G");
							self._pidG = prcG.pid;
						});
					});
					self._killTimeoutB = self._buildTimeout("B");
					self._pidB = prcB.pid;
				});
			});
			this._killTimeoutA = this._buildTimeout("A");
			this._pidA = prcA.pid;

		} catch (ex) {
			console.log("Distributor ERROR: " + ex + " just falling back to default error");
			// this._processEnded(99999, 99999, done);
		}

		return this;
	}
}

export default Spawn;
