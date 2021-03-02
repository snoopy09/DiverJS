/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

/*global J$*/

// do not remove the following comment
// JALANGI DO NOT INSTRUMENT
//
// Symbolic execution analyser entry point

import SymbolicExecution from "./SymbolicExecution";
import Config from "./Config";
import Log from "./Utilities/Log";
import External from "./External";

const fs = External.load("fs");
const process = External.load("process");

const file = process.argv[process.argv.length - 4];
const input = process.argv[process.argv.length - 3];
const requestSeq = process.argv[process.argv.length - 2];
const cbOrder = process.argv[process.argv.length - 1];


Log.logHigh("Built with VERY logging enabled");
Log.logMid("Built with FINE logging enabled");
Log.log("Built with BASE logging enabled");
Log.log("Initial Input " + input);
Log.log("Initial RequestSeq " + requestSeq);
Log.log("Initial CallbackOrder " + JSON.stringify(JSON.parse(cbOrder), null, 2));

process.title = "ExpoSE Play " + input;

process.on("disconnect", function() {
	Log.log("Premature termination - Parent exit");
	process.exit();
});


J$.analysis = new SymbolicExecution(J$, file, JSON.parse(input), JSON.parse(requestSeq), JSON.parse(cbOrder), (state, coverage) => {

	Log.log("Finished play with PC " + state.pathCondition.map(x => x.ast));

	if (Config.outCoveragePath) {
		fs.writeFileSync(Config.outCoveragePath, JSON.stringify(coverage.end()));
		Log.log("Wrote final coverage to " + Config.outCoveragePath);
	} else {
		Log.log("No final coverage path supplied");
	}

	//We record the alternatives list as the results develop to make the output tool more resilient to SMT crashes
	state.alternatives((current) => {

		const finalOut = {
			pc: state.finalPC(),
			input: state.input,
			outputs: state.outputs,
			requestSeq: state.requestSeq,
			requests: state.requests,
			cbOrder: state.cbOrder,
			eventRecord: state.eventRecord.map(e => {
				// delete e.args;
				delete e.callback;
				// delete e.opt;
				delete e.fsModels;
				delete e.state;
				return e;
			}),
			asyncTrace: state.asyncTrace,
			iidSeq: state.coverage._path,
			iidCommandMap: state.coverage._commandMap,
			errors: state.errors,
			alternatives: current,
			readWriteVars: state.readWriteVars,
			branchUseMap: state.branchUseMap,
			executeFiles: state.allFileList,
			stats: state.stats.export()
		};

		if (Config.outFilePath) {
			// console.log(finalOut.readWriteVars);
			// let finalOutStr = state.legalJSONstr(finalOut);
			// console.log(finalOutStr);
			state.readWriteVars.forEach(obj => {
				// Log.log(obj.name+"だよ");
				obj.val_c = state.concritizeVal(obj.val_c);
				// Log.log(obj.val_c);
			});
			fs.writeFileSync(Config.outFilePath, state.arrangedJSONStr(finalOut));
			Log.log("Wrote final output to " + Config.outFilePath);
		} else {
			Log.log("No final output path supplied");
		}
	});
});
