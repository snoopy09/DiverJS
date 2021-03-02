import { ConcolicValue } from "../Values/WrappedValue";
import Log from "../Utilities/Log";
import Proc from "../Values/Procedure";

export default function(state, ctx, model, helper) {

	const symbolicHook = helper.symbolicHook;
	const mkFunctionName = helper.mkFunctionName;
	const mkIndexSymbol = helper.mkIndexSymbol;
	const NoOp = helper.NoOp;
	const concritizeArrayCall = helper.concritizeArrayCall;

	model.add(Array.prototype.push, function(base, args) {

		const is_symbolic = state.isSymbolic(base);
		const args_well_formed = state.getConcrete(base) instanceof Array
		&& state.arrayType(base) == typeof(state.getConcrete(args[0]));

		if (is_symbolic && args_well_formed) {
			Log.log("Push symbolic prototype");

			const array_s = state.asSymbolic(base);
			const value_s = state.asSymbolic(args[0]);
			const array_p = state.asProcedure(base);
			const value_p = state.asProcedure(args[0]);

			const oldLength_s = array_s.getLength();
			const newLength_s = ctx.mkAdd(oldLength_s, ctx.mkIntVal(1));
			const oldLength_p = new Proc("getLength", [array_p]);
			const newLength_p = new Proc("mkAdd", [oldLength_p, new Proc("mkIntVal", [1])]);

			state.getConcrete(base).push(state.getConcrete(args[0]));
			state.updateSymbolic(
				base,
				array_s.setField(oldLength_s, value_s).setLength(newLength_s),
				new Proc("setLength", [new Proc("setField", [array_p, oldLength_p, value_p]), newLength_p])
			);

			return args[0];
		} else {

			//TODO: Check that this mechanism for removing-symbolicness actually works
			//TODO: The goal here is to concretize this result from here-on in as the concrete model might be non-homogonous
			if (state.isSymbolic(base)) {
				state.updateSymbolic(base, null, null);
			}

			if (state.isWrapped(args[0])) {
				return state.getConcrete(base).push(state.getConcrete(args[0]));
			} else {
				return state.getConcrete(base).push(args[0]);
			}
		}
	});

	model.add(Array.prototype.pop, function(base, args) {

		const is_symbolic = state.isSymbolic(base);
		const args_well_formed = state.getConcrete(base) instanceof Array
		&& state.arrayType(base) == typeof(state.getConcrete(args[0]));

		Log.log("TODO: Push prototype is not smart enough to decide array type");
		if (is_symbolic && args_well_formed) {
			Log.log("Push symbolic prototype");
			const array_s = state.asSymbolic(base);
			const array_p = state.asProcedure(base);

			const oldLength_s = array_s.getLength();
			const newLength_s = ctx.mkAdd(oldLength_s, ctx.mkIntVal(-1));
			const oldLength_p = array_p.getLength(array_s);
			const newLength_p = new Proc("mkAdd", [oldLength_p, new Proc("mkIntVal", [-1])]);

			const result = new ConcolicValue(
				state.getConcrete(base).pop(),
				// state.getField(oldLength_s) 勝手に変更
				array_s.getField(oldLength_s),
				new Proc("getField", [array_p, oldLength_p]),
				[]
			);
			state.updateSymbolic(base, array_s.setLength(newLength_s), new Proc("setLength", [array_p, newLength_p]));
			return result;
		} else {

			//TODO: Check this works (See push)
			if (state.isSymbolic(base)) {
				state.updateSymbolic(base, null, null);
			}

			return state.getConcrete(base).pop();
		}
	});

	model.add(Array.prototype.indexOf, symbolicHook(
		Array.prototype.indexOf,
		(base, _args) => {
			const is_symbolic = state.isSymbolic(base) && state.getConcrete(base) instanceof Array;
			return is_symbolic;
		},
		(base, args, result) => {

			const searchTarget_s = state.asSymbolic(args[0]);
			const searchTarget_p = state.asProcedure(args[0]);
			let result_obj = mkIndexSymbol("IndexOf");
			let result_s = result_obj.sym;
			let result_p = result_obj.proc;

			//The result is an integer -1 <= result_s < base.length
			state.pushCondition(
				ctx.mkGe(result_s, ctx.mkIntVal(-1)),
				new Proc("mkGe", [result_p, new Proc("mkIntVal", [-1])]),
				true
			);
			state.pushCondition(
				ctx.mkGt(state.asSymbolic(base).getLength(), result_s),
				new Proc("mkGt", [new Proc("getLength", [state.asProcedure(base)]), result_p]),
				true
			);

			// either result_s is a valid index for the searchtarget or -1
			state.pushCondition(
				ctx.mkOr(
					ctx.mkEq(ctx.mkSelect(state.asSymbolic(base), result_s), searchTarget_s),
					ctx.mkEq(result_s, ctx.mkIntVal(-1))
				),
				new Proc("mkOr", [
					new Proc("mkEq", [new Proc("mkSelect", [state.asProcedure(base), result_p]), searchTarget_p]),
					new Proc("mkEq", [result_p, new Proc("mkIntVal", [-1])])
				]),
				true /* Binder */
			);

			// If result != -1 then forall 0 < i < result select base i != target
			const intSort_s = ctx.mkIntSort();
			const i_s = ctx.mkBound(0, intSort_s);
			const intSort_p = new Proc("mkIntSort", []);
			const i_p = new Porc("mkBound", [0, intSort_p]);
			const match_func_decl_name_obj = mkFunctionName("IndexOf");
			const match_func_decl_name_s = match_func_decl_name_obj.sym;
			const match_func_decl_name_p = match_func_decl_name_obj.proc;

			const iLessThanResult_s = ctx.mkPattern([
				ctx.mkLt(i_s, result_s),
				ctx.mkGe(i_s, ctx.mkIntVal(0))
			]);
			const iLessThanResult_p = new Proc("mkPattern", [[
				new Proc("mkLt", [i_p, result_p]),
				new Proc("mkGe", [i_p, new Proc("mkIntVal", [0])])
			]]);

			const matchInArrayBody_s = ctx.mkImplies(
				ctx.mkAnd(ctx.mkGe(i_s, ctx.mkIntVal(0)), ctx.mkLt(i_s, result_s)),
				ctx.mkNot(
					ctx.mkEq(
						ctx.mkSelect(state.asSymbolic(base), i_s),
						searchTarget_s
					)
				)
			);
			const matchInArrayBody_p = new Proc("mkImplies", [
				new Proc("mkAnd", [new Proc("mkGe", [i_p, new Proc("mkIntVal", [0])]), new Proc("mkLt", [i_p, result_p])]),
				new Proc("mkNot", [
					new Proc("mkEq", [
						new Proc("mkSelect", [state.asProcedure(base), i_p]),
						searchTarget_p
					])
				])
			]);

			const noPriorUse_s = ctx.mkForAll([match_func_decl_name_s], intSort_s, matchInArrayBody_s, [iLessThanResult_s]);
			const noPriorUse_p = new Proc("mkForAll", [[match_func_decl_name_p], intSort_p, matchInArrayBody_p, [iLessThanResult_p]]);

			state.pushCondition(
				ctx.mkImplies(
					ctx.mkGt(result_s, ctx.mkIntVal(-1)),
					noPriorUse_s
				),
				new Proc("mkImplies", [
					new Proc("mkGt", [result_p, new Proc("mkIntVal", [-1])]),
					noPriorUse_p
				]),
				true
			);

			return new ConcolicValue(result, result_s, result_p, []);
		}
	));

	model.add(Array.prototype.includes, symbolicHook(
		Array.prototype.includes,
		(base, args) => {
			const is_symbolic = state.isSymbolic(base);
			const args_well_formed = state.getConcrete(base) instanceof Array
			&& state.arrayType(base) == typeof(state.getConcrete(args[0]));
			return is_symbolic && args_well_formed;
		},
		(base, args, result) => {

			const searchTarget_s = state.asSymbolic(args[0]);
			const searchTarget_p = state.asProcedure(args[0]);

			const intSort_s = ctx.mkIntSort();
			const i_s = ctx.mkBound(0, intSort_s);
			const intSort_p = new Proc("mkIntSort", []);
			const i_p = new Proc("mkBound", [0, intSort_p]);

			const lengthBounds_s = ctx.mkAnd(
				ctx.mkGe(i_s, ctx.mkIntVal(0)),
				ctx.mkLt(i_s, state.asSymbolic(base).getLength())
			);
			const lengthBounds_p = new Proc("mkAnd", [
				new Proc("mkGe", [i_p, new Proc("mkIntVal", [0])]),
				new Proc("mkLt", [i_p, new Proc("getLength", [state.asProcedure(base)])])
			]);

			const body_s = ctx.mkAnd(
				lengthBounds_s,
				ctx.mkEq(
					ctx.mkSelect(state.asSymbolic(base), i_s),
					searchTarget_s
				)
			);
			const body_p = new Proc("mkAnd", [
				lengthBounds_p,
				new Proc("mkEq", [
					new Proc("mkSelect", [state.asProcedure(base), i_p]),
					searchTarget_p
				])
			]);

			const iPattern_s = ctx.mkPattern([
				ctx.mkLt(i_s, state.asSymbolic(base).getLength()),
				ctx.mkGe(i_s, ctx.mkIntVal(0))
			]);
			const iPattern_p = new Proc("mkPattern", [[
				new Proc("mkLt", [i_p, new Proc("getLength", state.asProcedure(base))]),
				new Proc("mkGe", [i_p, new Proc("mkIntVal", [0])])
			]]);

			const func_decl_name_obj = mkFunctionName("Includes");
			const func_decl_name_s = func_decl_name_obj.sym;
			const func_decl_name_p = func_decl_name_obj.proc;
			const result_s = ctx.mkExists([func_decl_name_s], intSort_s, body_s, [iPattern_s]);
			const result_p = new Proc("mkExists", [[func_decl_name_p], intSort_p, body_p, [iPattern_p]]);

			return new ConcolicValue(result, result_s, result_p, []);
		}
	));

	model.add(Array.prototype.join, function(base, args) {
		// const sep = args[0] ? helper.coerceToString(args[0]) : ',';
		// let finalString = '';
		// for (let i = 0; i < state.getConcrete(base).length; i++) {
		// 	if (i > 0) {
		// 		finalString = state.binary('+', finalString, sep);
		// 	}
		// 	finalString = state.binary('+', finalString, state.getFieldBasic(base, i));
		// }
		// return finalString;
		base = state.getConcrete(base);
		const sep = args[0] ? helper.coerceToString(args[0]) : ',';
		let finalString = '';
		for (let i = 0; i < base.length; i++) {
			if (i > 0) {
				finalString = state.binary('+', finalString, sep);
			}
			finalString = state.binary('+', finalString, helper.coerceToString(base[i]));
		}
		return finalString;
	});

	model.add(Array.prototype.keys, concritizeArrayCall(Array.prototype.keys));
	model.add(Array.prototype.concat, concritizeArrayCall(Array.prototype.concat));
	model.add(Array.prototype.forEach, concritizeArrayCall(Array.prototype.forEach));
	model.add(Array.prototype.filter, concritizeArrayCall(Array.prototype.filter));
	model.add(Array.prototype.map, concritizeArrayCall(Array.prototype.map));
	model.add(Array.prototype.shift, concritizeArrayCall(Array.prototype.shift));
	model.add(Array.prototype.unshift, concritizeArrayCall(Array.prototype.unshift));
	model.add(Array.prototype.fill, concritizeArrayCall(Array.prototype.fill));
}
