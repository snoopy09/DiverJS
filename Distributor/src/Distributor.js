/* Copyright (c) Royal Holloway, University of London | Contact Blake Loring (blake@parsed.uk), Duncan Mitchell (Duncan.Mitchell.2015@rhul.ac.uk), or Johannes Kinder (johannes.kinder@rhul.ac.uk) for details or support | LICENSE.md for license details */

import Internal from "./Internal";
import Center from "./Center";
import Config from "./Config";
import CoverageMap from "./CoverageMap";
import JsonWriter from "./JsonWriter";

const fs = require("fs");

process.title = "ExpoSE Distributor";

process.on("disconnect", function() {
	console.log("Premature termination - Parent exit");
	process.exit();
});


// console.log(process.argv);
if (process.argv.length >= 7) {

	let targetA = process.argv[2];
	let targetB = process.argv[3];
	let targetDir = process.argv[4];
	let logDir = process.argv[5];
	let epsCount = process.argv[6];
	let initialInput = undefined;

	// ホントに？
	if (process.argv.length == 8) {
		initialInput = JSON.parse(process.argv[7]);
	}


	console.log(`[+A] ExpoSE ${targetA} concurrent: ${Config.maxConcurrent} timeout: ${Config.maxTime} per-test: ${Config.testMaxTime}`);
	console.log(`[+B] ExpoSE ${targetB} concurrent: ${Config.maxConcurrent} timeout: ${Config.maxTime} per-test: ${Config.testMaxTime}`);


	// Configに引数の情報を追加
	Config.targetDir = targetDir;
	Config.logDir = logDir;
	Config.learningEnv = JSON.parse(fs.readFileSync(logDir + "/LearningEnv.json"));
	Config.epsCount = epsCount;

	// console.log(epsCount);
	// console.log(Config.learningEnv.maxEps);
	if (epsCount >= Config.learningEnv.maxEps) {
	// if (process.env.LEARNING === "0" && epsCount > Config.learningEnv.maxEps) {
		process.exit(1);
	}


	// require("segfault-handler").registerHandler(logDir + "/crash.log");

	const start = (new Date()).getTime();
	const center = new Center(Config);

	// キャンセルがうまくいっていない
	process.on("SIGINT", function() {
		center.cancel();
	});

	const maxTimeout = setTimeout(function() {
		center.cancel();
	}, Config.maxTime);

	center.done((center, done, errors, coverageA, statsA, coverageB) => {
	// center.done((center, done, errors, coverageA, statsA, coverageB, statsB) => {

		if (Config.jsonOut) {
			JsonWriter(Config.jsonOut, targetA, targetB, coverageA, coverageB, start, (new Date()).getTime(), done);
		}

		function round(num, precision) {
			return Math.round(num * Math.pow(10, precision)) / Math.pow(10, precision);
		}

		function formatSeconds(v) {
			return round((v / 1000 / 1000), 4);
		}

		console.log("");

		// itemはcenterの140行目に対応(pushDoneのとこ)
		done.forEach(item => {
			const pcPart = Config.printPathCondition ? (` PCA: ${item.pcA} PCB: ${item.pcB}`) : "";
			console.log(`[+] ${JSON.stringify(item.input)}, ${JSON.stringify(item.requestSeq)}, ${JSON.stringify(item.cbOrder.order)}${pcPart} took ${formatSeconds(item.time)}s (${item.changeCoverage*100}%)`);
			item.errorsA.forEach(error => console.log(`[!A] ${error.error}`));
			item.errorsB.forEach(error => console.log(`[!B] ${error.error}`));
			// if (item.errorsA.length != 0) {
			// 	console.log(`[!A] ${item.replayA}`);
			// }
			// if (item.errorsB.length != 0) {
			// 	console.log(`[!B] ${item.replayB}`);
			// }
		});

		// console.log("[!] Stats");
		//
		// for (const stat in statsA) {
		// 	console.log(`[+A] ${stat}: ${JSON.stringify(statsA[stat].payload)}`);
		// }
		// for (const stat in statsB) {
		// 	console.log(`[+B] ${stat}: ${JSON.stringify(statsB[stat].payload)}`);
		// }

		console.log("[!] Done");

		let totalLines = 0;
		let totalRealLines = 0;
		let totalLinesFound = 0;

		coverageA.final().forEach(d => {

			if (Internal(d.file)) {
				return;
			}
			// console.log(`[+] ${d.file}. Coverage (Term): ${Math.round(d.terms.coverage * 100)}% Coverage (Decisions): ${Math.round(d.decisions.coverage * 100)}% Coverage (LOC): ${Math.round(d.loc.coverage * 100)}% Lines Of Code: ${d.loc.total} -*`);
			totalLines += d.loc.total;
			totalRealLines += d.loc.all.length;
			totalLinesFound += d.loc.found;
		});

		coverageB.final().forEach(d => {

			if (Internal(d.file)) {
				return;
			}
			// console.log(`[+] ${d.file}. Coverage (Term): ${Math.round(d.terms.coverage * 100)}% Coverage (Decisions): ${Math.round(d.decisions.coverage * 100)}% Coverage (LOC): ${Math.round(d.loc.coverage * 100)}% Lines Of Code: ${d.loc.total} -*`);
			totalLines += d.loc.total;
			totalRealLines += d.loc.all.length;
			totalLinesFound += d.loc.found;
		});

		console.log(`[+] Total Lines Of Code ${totalLines}`);
		console.log(`[+] Total Coverage: ${Math.round((totalLinesFound / totalRealLines) * 10000) / 100}%`);

		if (Config.printDeltaCoverage) {
			CoverageMap(coverageA.lines(), line => console.log(line));
			CoverageMap(coverageB.lines(), line => console.log(line));
		} else {
			// console.log("[+] EXPOSE_PRINT_COVERAGE=1 for line by line breakdown");
		}

		console.log(`[+] ExpoSE Finished. ${done.length} paths, ${errors} errors`);

		process.exitCode = errors;
		clearTimeout(maxTimeout);

		process.exit();

	}).start(targetA, targetB, initialInput);


} else {
	console.log(`USAGE: ${process.argv[0]} ${process.argv[1]} target1 target2 logDir (Optional: initial input)`);
}
