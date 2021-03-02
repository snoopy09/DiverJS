import Config from "../Config";
import { ConcolicValue } from "../Values/WrappedValue";
import Log from "../Utilities/Log";
import ObjectHelper from "../Utilities/ObjectHelper";
import { isNative } from "../Utilities/IsNative";
import Proc from "../Values/Procedure";

const map = Array.prototype.map;

export default function(state, ctx, model) {

	function runMethod(f, base, args, concretize = true) {
		let result, thrown;

		//Defer throw until after hook has run
		try {
			const c_base = concretize ? state.getConcrete(base) : base;
			const c_args = concretize ? map.call(args, arg => state.getConcrete(arg)) : args;
			result = f.apply(c_base, c_args);
		} catch (e) {
			thrown = e;
		}

		return [result, thrown];
	}

	/**
	* Symbolic hook is a helper function which builds concrete results and then,
	* if condition() -> true executes a symbolic helper specified by hook
	* Both hook and condition are called with (context (SymbolicExecutor), f, base, args, result)
	*
	* A function which makes up the new function model is returned
	*/
	function symbolicHook(f, condition, hook, concretize = true, featureDisabled = false) {
		return function(base, args) {

			let [result, thrown] = runMethod(f, base, args, concretize);

			Log.logMid(`Symbolic Testing ${f.name} with base ${ObjectHelper.asString(base)} and ${ObjectHelper.asString(args)} and initial result ${ObjectHelper.asString(result)}`);

			if (!featureDisabled && condition(base, args)) {
				result = hook(base, args, result);
			}

			Log.logMid(`Result: ${"" + result} Thrown: ${"" + thrown}`);

			if (thrown) {
				throw thrown;
			}

			return result;
		};
	}

	function ConcretizeIfNative(f) {
		return function(base, args) {
			// f_.apply(base_, args_)
			// つまり呼び出したい関数f_がbase
			// fはf_.apply
			// args[0]がbase_
			// args[1]がargs_

			base = state.getConcrete(base);
			args = state.getConcrete(args);
			const fn_model = model.get(base);
			const is_native = !fn_model && isNative(base);
			const node_core_model = state.nodeCoreModels.get(base);
			let my_fn_model;

			if (is_native) {
				Log.logMid("WARNING: Concretizing model for " + f.toString() + " " + JSON.stringify(base));
				const concretized = state.concretizeCall(f, base, args, false);
				base = concretized.base;
				args = concretized.args;
			} else if (node_core_model) {
				Log.log("自分でモデル化したの呼ぶ (ConcretizeIfNative)");
				const concretized = state.concretizeCall(f, base, args, false);
				// const base_s = base;
				// const args_s = args;
				base = concretized.base;
				args = concretized.args;
				// 何もしないやつじゃないと無理
				// バラバラにモデル化したらわんちゃん？
				my_fn_model = node_core_model.func.call(node_core_model.base);
			}
			Log.log(fn_model || my_fn_model || base);
			Log.log(args);
			for (let i in args[1]) {
				Log.log(args[1][i]);
			}

			return f.apply(fn_model || my_fn_model || base, args);
		};
	}

	function coerceToString(symbol) {

		if (typeof state.getConcrete(symbol) !== "string") {
			Log.log(`TODO: Concretizing non string input ${symbol} reduced to ${state.getConcrete(symbol)}`);
			return '' + state.getConcrete(symbol);
		}

		return symbol;
	}

	function NoOp(f) {
		return function(base, args) {
			Log.logMid(`NoOp ${f.name} with base ${ObjectHelper.asString(base)} and ${ObjectHelper.asString(args)}`);
			return f.apply(base, args);
		};
	}

	function concritizeArrayCall(f) {
		return function(base, args) {
			Log.logMid(`concritizeArrayCall ${f.name} with base ${ObjectHelper.asString(base)} and ${ObjectHelper.asString(args)}`);
			base = state.getConcrete(base);
			for (let i in args) {
				args[i] = state.getConcrete(args[i]);
			}
			return f.apply(base, args);
		};
	}

	/**
	* In JavaScript slice and substr can be given a negative index to indicate addressing from the end of the array
	* We need to rewrite the SMT to handle these cases
	*/
	function substringHandleNegativeLengths(base_s, index_s) {

		//Index s is negative to adding will get us to the right start
		const newIndex = ctx.mkAdd(base_s.getLength(), index_s);

		//Bound the minimum index by 0
		const aboveMin = ctx.mkGe(newIndex, ctx.mkIntVal(0));
		const indexOrZero = ctx.mkIte(aboveMin, newIndex, ctx.mkIntVal(0));

		return ctx.mkIte(ctx.mkGe(index_s, ctx.mkIntVal(0)), index_s, indexOrZero);
	}

	function substringHandleNegativeLengthsProc(base_p, index_p) {

		//Index s is negative to adding will get us to the right start
		const newIndex = new Proc("mkAdd", [new Proc("getLength", [base_p]), index_p]);

		//Bound the minimum index by 0
		const aboveMin = new Proc("mkGe", [newIndex, new Proc("mkIntVal", [0])]);
		const indexOrZero = new Proc("mkIte", [aboveMin, newIndex, new Proc("mkIntVal", [0])]);

		return new Proc("mkIte", [new Proc("mkGe", [index_p, new Proc("mkIntVal", [0])]), index_p, indexOrZero]);
	}

	function substringHelper(base, args, result) {
		state.stats.seen("Symbolic Substrings");
		const target_s = state.asSymbolic(base);
		const target_p = state.asProcedure(base);

		//The start offset is either the argument of str.len - the arguments
		let start_off_s = ctx.mkRealToInt(state.asSymbolic(args[0]));
		let start_off_p = new Proc("mkRealToInt", [state.asProcedure(args[0])]);
		start_off_s = substringHandleNegativeLengths(target_s, start_off_s);
		start_off_p = substringHandleNegativeLengthsProc(target_p, start_off_p);

		//Length defaults to the entire string if not specified
		let len_s, len_p;
		const maxLength_s = ctx.mkSub(target_s.getLength(), start_off_s);
		const maxLength_p = new Proc("mkSub", [new Proc("getLength", [target_p]), start_off_p]);

		if (args[1]) {
			len_s = state.asSymbolic(args[1]);
			len_s = ctx.mkRealToInt(len_s);
			len_p = state.asProcedure(args[1]);
			len_p = new Proc("mkRealToInt", [len_p]);

			//If the length is user-specified bound the length of the substring by the maximum size of the string ("123".slice(0, 8) === "123")
			const exceedMax_s = ctx.mkGe(
				ctx.mkAdd(start_off_s, len_s),
				target_s.getLength()
			);
			const exceedMax_p = new Proc("mkGe", [
				new Proc("mkAdd", [start_off_p, len_p]),
				new Proc("getLength", [target_p])
			]);

			len_s = ctx.mkIte(exceedMax_s, maxLength_s, len_s);
			len_p = new Proc("mkIte", [exceedMax_p, maxLength_p, len_p]);
		} else {
			len_s = maxLength_s;
			len_p = maxLength_p;
		}

		//If the start index is greater than or equal to the length of the string the empty string is returned
		const substr_s = ctx.mkSeqSubstr(target_s, start_off_s, len_s);
		const empty_s = ctx.mkString("");
		const result_s = ctx.mkIte(ctx.mkGe(start_off_s, target_s.getLength()), empty_s, substr_s);
		const substr_p = new Proc("mkSeqSubstr", [target_p, start_off_p, len_p]);
		const empty_p = new Proc("mkString", [""]);
		const result_p = new Proc("mkIte", [new Proc("mkGe", [start_off_p, new Proc("getLength", [target_p])]), empty_p, substr_p]);

		// const target_t = state.getTaint(base);
		// const start_off_t = state.getTaint(args[0]);
		// const len_t = args[1] ? state.getTaint(args[1]) : [];
		// let result_t = target_t;
		// result_t = result_t.concat(start_off_t.filter(v => result_t.indexOf(v) === -1));
		// result_t = result_t.concat(len_t.filter(v => result_t.indexOf(v) === -1));

		return new ConcolicValue(result, result_s, result_p, []);

	}

	let indexOfCounter = 0;

	function mkIndexSymbol(op) {
		return {sym: ctx.mkIntVar(`_${op}_${indexOfCounter})`), proc: new Proc("mkIntVar", [`_${op}_${indexOfCounter++})`])};
	}

	let funcCounter = 0;

	function mkFunctionName(fn) {
		return {sym: ctx.mkStringSymbol(`_fn_${fn}_${funcCounter}_`), proc: new Proc("mkStringSymbol", [`_fn_${fn}_${funcCounter++}_`])};
	}

	return {
		mkFunctionName: mkFunctionName,
		mkIndexSymbol: mkIndexSymbol,
		runMethod: runMethod,
		symbolicHook: symbolicHook,
		ConcretizeIfNative: ConcretizeIfNative,
		coerceToString: coerceToString,
		NoOp: NoOp,
		concritizeArrayCall: concritizeArrayCall,
		substring: substringHelper
	};
}
